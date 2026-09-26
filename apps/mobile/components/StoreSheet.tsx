import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { adPrivacyOptionsRequired, showAdPrivacyOptions } from "../lib/ads";
import { useEntitlements } from "../lib/entitlements";
import { useI18n } from "../lib/i18n";
import {
  PRODUCT_IDS,
  type PremiumFichasId,
  type PremiumMesaId,
  type ProductId,
} from "../lib/iapCatalog";
import { SkinScope } from "../lib/tileSkins";
import { THEME, THEMES } from "../theme";
import TileDisplay from "./TileDisplay";

// Page-sheet store: Todo Capi hero, remove ads, 3 mesas, 3 fichas, restore,
// privacy link, and the ad privacy options link where UMP requires one. Every
// product shows what it sells: real tiles in the skin, the felt of the mesa,
// a struck-out ad tag. Owned states derive from ent so a mid-sheet purchase
// updates rows live. Prices come from the store only; until they arrive every
// buy button shows a neutral "see price" pill, never a guessed amount.
export default function StoreSheet({
  visible,
  onClose,
  onPurchased,
}: {
  visible: boolean;
  onClose: () => void;
  // Fires after the store confirmed a purchase, with the product bought.
  onPurchased?: (id: ProductId) => void;
}) {
  const { s } = useI18n();
  const {
    ent,
    prices,
    buying,
    restoring,
    lastError,
    restore,
    refreshPrices,
    clearError,
    devGrantAll,
  } = useEntitlements();

  // Surface each purchase error exactly once; the ref guards re-renders that
  // land before clearError() settles.
  const alertedErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastError) {
      alertedErrorRef.current = null;
      return;
    }
    if (alertedErrorRef.current === lastError) return;
    alertedErrorRef.current = lastError;
    // A deferred (Ask to Buy) purchase is not a failure: its note stands alone.
    if (lastError === "purchaseFailed" || lastError === "purchasePending") {
      Alert.alert(s[lastError]);
    } else {
      Alert.alert(s.purchaseFailed, s[lastError]);
    }
    clearError();
  }, [lastError, clearError, s]);

  // Google requires a way to change ad consent where UMP says one is needed.
  // Checked each time the sheet opens, since the ads flow may have learned it
  // after launch. Ad-free owners get no ads, so the consent SDK stays
  // untouched for them and the link stays hidden.
  const adFree = ent.adFree;
  const [adPrivacyRequired, setAdPrivacyRequired] = useState(false);
  useEffect(() => {
    if (!visible || adFree) return;
    let active = true;
    adPrivacyOptionsRequired().then((required) => {
      if (active) setAdPrivacyRequired(required);
    });
    return () => {
      active = false;
    };
  }, [visible, adFree]);

  // UMP presents its form from the root view controller, which cannot present
  // while this page sheet is up, so on iOS the form opens once the sheet has
  // closed (Modal onDismiss is iOS only).
  const adPrivacyAfterCloseRef = useRef(false);
  function openAdPrivacyOptions() {
    if (Platform.OS !== "ios") {
      showAdPrivacyOptions();
      return;
    }
    adPrivacyAfterCloseRef.current = true;
    onClose();
  }
  function handleDismiss() {
    if (!adPrivacyAfterCloseRef.current) return;
    adPrivacyAfterCloseRef.current = false;
    showAdPrivacyOptions();
  }

  // The launch warm-up can miss (offline, slow store). Try again each time the
  // sheet opens without prices; once a retry also comes back empty, say so.
  const [priceFetchMissed, setPriceFetchMissed] = useState(false);
  const noPrices = prices.size === 0;
  useEffect(() => {
    if (!visible || !noPrices) return;
    let active = true;
    refreshPrices().then(() => {
      if (active) setPriceFetchMissed(true);
    });
    return () => {
      active = false;
    };
  }, [visible, noPrices, refreshPrices]);

  async function handleRestore() {
    try {
      const n = await restore();
      Alert.alert(n === null ? s.restoreFailed : s.restoreDone(n));
    } catch {
      Alert.alert(s.restoreFailed);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={handleDismiss}
    >
      {/* iOS page sheets sit below the status bar already (top inset 0);
          Android shows the modal full screen, so the header needs the inset. */}
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: THEME.pageBg }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 10,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827" }}>
            {s.store}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={s.closeTray}
            hitSlop={8}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.06)",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#6b7280" }}>
              ✕
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 40,
            gap: 10,
          }}
        >
          {noPrices && priceFetchMissed ? (
            <Text
              style={{
                fontSize: 12,
                color: "#9ca3af",
                textAlign: "center",
                marginBottom: 2,
              }}
            >
              {s.storeUnavailable}
            </Text>
          ) : null}

          {/* Todo Capi hero */}
          <View
            style={{
              borderWidth: 2,
              borderColor: "#6366f1",
              backgroundColor: "#ffffff",
              borderRadius: 16,
              padding: 16,
              gap: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>
              {s.todoCapiTitle}
            </Text>
            {/* What the bundle unlocks, in the order of the sections below */}
            <View
              style={{
                alignSelf: "stretch",
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 6,
                marginVertical: 2,
              }}
            >
              <MesaPreview id="quisqueya" size="strip" />
              <MesaPreview id="larimar" size="strip" />
              <MesaPreview id="noche" size="strip" />
              <FichasPreview id="quisqueya" size="strip" />
              <FichasPreview id="borinquen" size="strip" />
              <FichasPreview id="kingston" size="strip" />
            </View>
            <Text
              style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}
            >
              {s.todoCapiDesc}
            </Text>
            <BuyButton
              productId={PRODUCT_IDS.todo}
              owned={ent.ownedIds.has(PRODUCT_IDS.todo)}
              onPurchased={onPurchased}
              hero
            />
          </View>

          <ProductRow
            name={s.removeAdsTitle}
            desc={s.removeAdsDesc}
            preview={<AdFreePreview />}
            productId={PRODUCT_IDS.removeAds}
            owned={ent.adFree}
            onPurchased={onPurchased}
          />

          <SectionLabel text={s.table} />
          <ProductRow
            name={s.themeQuisqueya}
            desc={s.themeQuisqueyaDesc}
            preview={<MesaPreview id="quisqueya" />}
            productId={PRODUCT_IDS.mesaQuisqueya}
            owned={ent.mesas.has("quisqueya")}
            onPurchased={onPurchased}
          />
          <ProductRow
            name={s.themeLarimar}
            desc={s.themeLarimarDesc}
            preview={<MesaPreview id="larimar" />}
            productId={PRODUCT_IDS.mesaLarimar}
            owned={ent.mesas.has("larimar")}
            onPurchased={onPurchased}
          />
          <ProductRow
            name={s.themeNoche}
            desc={s.themeNocheDesc}
            preview={<MesaPreview id="noche" />}
            productId={PRODUCT_IDS.mesaNoche}
            owned={ent.mesas.has("noche")}
            onPurchased={onPurchased}
          />

          <SectionLabel text={s.fichasLabel} />
          <ProductRow
            name={s.themeQuisqueya}
            desc={s.fichasQuisqueyaDesc}
            preview={<FichasPreview id="quisqueya" />}
            productId={PRODUCT_IDS.fichasQuisqueya}
            owned={ent.fichas.has("quisqueya")}
            onPurchased={onPurchased}
          />
          <ProductRow
            name="Borinquen"
            desc={s.fichasBorinquenDesc}
            preview={<FichasPreview id="borinquen" />}
            productId={PRODUCT_IDS.fichasBorinquen}
            owned={ent.fichas.has("borinquen")}
            onPurchased={onPurchased}
          />
          <ProductRow
            name="Kingston"
            desc={s.fichasKingstonDesc}
            preview={<FichasPreview id="kingston" />}
            productId={PRODUCT_IDS.fichasKingston}
            owned={ent.fichas.has("kingston")}
            onPurchased={onPurchased}
          />

          {/* Restore */}
          <Pressable
            onPress={handleRestore}
            disabled={restoring || buying !== null}
            accessibilityRole="button"
            accessibilityLabel={s.restorePurchases}
            accessibilityState={{ disabled: restoring || buying !== null }}
            style={{
              alignItems: "center",
              paddingVertical: 12,
              opacity: restoring || buying !== null ? 0.4 : 1,
            }}
          >
            {restoring ? (
              <ActivityIndicator color="#6366f1" />
            ) : (
              <Text
                style={{ color: "#6366f1", fontSize: 14, fontWeight: "700" }}
              >
                {s.restorePurchases}
              </Text>
            )}
          </Pressable>

          {/* Privacy footer */}
          <Pressable
            onPress={() =>
              Linking.openURL("https://playcapi.com/privacy").catch(() => {})
            }
            accessibilityRole="link"
            accessibilityLabel={s.privacyPolicy}
            style={{ alignItems: "center", paddingVertical: 4 }}
          >
            <Text
              style={{
                color: "#9ca3af",
                fontSize: 12,
                textDecorationLine: "underline",
              }}
            >
              {s.privacyPolicy}
            </Text>
          </Pressable>

          {adPrivacyRequired && !adFree ? (
            <Pressable
              onPress={openAdPrivacyOptions}
              accessibilityRole="button"
              accessibilityLabel={s.adPrivacyOptions}
              style={{ alignItems: "center", paddingVertical: 10 }}
            >
              <Text
                style={{
                  color: "#9ca3af",
                  fontSize: 12,
                  textDecorationLine: "underline",
                }}
              >
                {s.adPrivacyOptions}
              </Text>
            </Pressable>
          ) : null}

          {__DEV__ ? (
            <Pressable
              onPress={devGrantAll}
              style={{ alignItems: "center", paddingVertical: 8 }}
            >
              <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                DEV: grant all
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginTop: 8,
      }}
    >
      {text}
    </Text>
  );
}

function ProductRow({
  name,
  desc,
  preview,
  productId,
  owned,
  onPurchased,
}: {
  name: string;
  desc: string;
  // What the product looks like (one of the previews below). Decorative:
  // the name and description carry the meaning for screen readers.
  preview: ReactNode;
  productId: ProductId;
  owned: boolean;
  onPurchased?: (id: ProductId) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "#ffffff",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      {preview}
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}
        >
          {name}
        </Text>
        <Text
          numberOfLines={2}
          style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}
        >
          {desc}
        </Text>
      </View>
      <BuyButton productId={productId} owned={owned} onPurchased={onPurchased} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Product previews. Row previews are 64 x 44; the Todo Capi strip shows the
// same six at 40 x 28. Every box is decorative: the row text carries the
// meaning, so screen readers skip the box and the tiles inside it.
// ---------------------------------------------------------------------------

const PREVIEW_SIZES = {
  row: { w: 64, h: 44 },
  strip: { w: 40, h: 28 },
} as const;
type PreviewSize = keyof typeof PREVIEW_SIZES;

const DECORATIVE = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

// Two tiles in the skin on sale. The ground is a neutral light gray so the
// black kingston tiles and the white borinquen tiles both keep a silhouette.
function FichasPreview({
  id,
  size = "row",
}: {
  id: PremiumFichasId;
  size?: PreviewSize;
}) {
  const { w, h } = PREVIEW_SIZES[size];
  const tileH = h - 8;
  const tileW = Math.round(tileH / 2);
  return (
    <View
      {...DECORATIVE}
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        backgroundColor: "#f3f4f6",
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: size === "row" ? 5 : 3,
      }}
    >
      <SkinScope skinId={id}>
        <TileDisplay tile={[6, 6]} w={tileW} h={tileH} />
        <TileDisplay tile={[2, 5]} w={tileW} h={tileH} />
      </SkinScope>
    </View>
  );
}

// The felt of the mesa on sale, framed in its accent, with two clasico tiles
// on it (a double standing, a tile lying) so it reads as a table and not as
// a color chip. Same three-stop gradient as the game screen.
function MesaPreview({
  id,
  size = "row",
}: {
  id: PremiumMesaId;
  size?: PreviewSize;
}) {
  const palette = THEMES[id];
  const { w, h } = PREVIEW_SIZES[size];
  const tileH = size === "row" ? 24 : 16;
  const tileW = tileH / 2;
  return (
    <LinearGradient
      {...DECORATIVE}
      colors={[palette.feltCenter, palette.feltMid, palette.feltEdge]}
      locations={[0, 0.55, 1]}
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: palette.accent,
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
      }}
    >
      <SkinScope skinId="clasico">
        <TileDisplay tile={[6, 6]} w={tileW} h={tileH} />
        {/* The lying tile: the wrapper reserves its rotated footprint */}
        <View
          style={{
            width: tileH,
            height: tileW,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ transform: [{ rotate: "90deg" }] }}>
            <TileDisplay tile={[3, 4]} w={tileW} h={tileH} />
          </View>
        </View>
      </SkinScope>
    </LinearGradient>
  );
}

// A struck-out "AD" tag drawn with plain views. The label is a pictogram,
// not copy: it is hidden from screen readers with the rest of the box.
function AdFreePreview() {
  const { w, h } = PREVIEW_SIZES.row;
  const strikeW = 56;
  const strikeH = 2.5;
  return (
    <View
      {...DECORATIVE}
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        backgroundColor: "#f3f4f6",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 44,
          height: 28,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: "#9ca3af",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "800",
            letterSpacing: 1.5,
            color: "#6b7280",
          }}
        >
          AD
        </Text>
      </View>
      <View
        style={{
          position: "absolute",
          left: (w - strikeW) / 2,
          top: (h - strikeH) / 2,
          width: strikeW,
          height: strikeH,
          borderRadius: strikeH / 2,
          backgroundColor: "#dc2626",
          transform: [{ rotate: "-32deg" }],
        }}
      />
    </View>
  );
}

// Price pill / owned check for one product. Every buy button disables while
// any purchase is in flight; only the one being bought shows the spinner.
function BuyButton({
  productId,
  owned,
  onPurchased,
  hero,
}: {
  productId: ProductId;
  owned: boolean;
  onPurchased?: (id: ProductId) => void;
  hero?: boolean;
}) {
  const { s } = useI18n();
  const { prices, buying, buy } = useEntitlements();

  if (owned) {
    return (
      <Text
        style={{
          color: "#16a34a",
          fontSize: hero ? 15 : 13,
          fontWeight: "800",
          paddingVertical: hero ? 10 : 0,
        }}
      >
        ✓ {s.owned}
      </Text>
    );
  }

  const busy = buying !== null;
  const price = prices.get(productId) ?? s.priceUnknown;
  return (
    <Pressable
      onPress={async () => {
        if (await buy(productId)) onPurchased?.(productId);
      }}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={price}
      accessibilityState={{ disabled: busy, busy: buying === productId }}
      style={{
        alignSelf: hero ? "stretch" : "auto",
        minWidth: 64,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 14,
        paddingVertical: hero ? 12 : 7,
        borderRadius: hero ? 12 : 999,
        backgroundColor: hero ? "#6366f1" : "#ffffff",
        borderWidth: hero ? 0 : 1.5,
        borderColor: "#6366f1",
        opacity: busy && buying !== productId ? 0.4 : 1,
      }}
    >
      {buying === productId ? (
        <ActivityIndicator size="small" color={hero ? "#ffffff" : "#6366f1"} />
      ) : (
        <Text
          numberOfLines={1}
          style={{
            color: hero ? "#ffffff" : "#6366f1",
            fontSize: hero ? 15 : 13,
            fontWeight: "800",
          }}
        >
          {price}
        </Text>
      )}
    </Pressable>
  );
}
