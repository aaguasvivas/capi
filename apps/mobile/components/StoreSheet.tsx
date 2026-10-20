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
import type { Tile } from "@capi/engine";
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
import { FELT_LOCATIONS, THEME, THEMES, feltColors } from "../theme";
import ScorePanel from "./ScorePanel";
import TileDisplay from "./TileDisplay";

// A design the sheet can show full size before it is bought.
export type StorePreview =
  | { mesa: PremiumMesaId }
  | { fichas: PremiumFichasId };

const MESA_IDS: PremiumMesaId[] = ["quisqueya", "larimar", "noche"];
const FICHAS_IDS: PremiumFichasId[] = ["quisqueya", "borinquen", "kingston"];

const MESA_PRODUCTS: Record<PremiumMesaId, ProductId> = {
  quisqueya: PRODUCT_IDS.mesaQuisqueya,
  larimar: PRODUCT_IDS.mesaLarimar,
  noche: PRODUCT_IDS.mesaNoche,
};

const FICHAS_PRODUCTS: Record<PremiumFichasId, ProductId> = {
  quisqueya: PRODUCT_IDS.fichasQuisqueya,
  borinquen: PRODUCT_IDS.fichasBorinquen,
  kingston: PRODUCT_IDS.fichasKingston,
};

// Page-sheet store: Todo Capi hero, remove ads, 3 mesas, 3 fichas, restore,
// privacy link, and the ad privacy options link where UMP requires one. Every
// product shows what it sells: real tiles in the skin, the felt of the mesa,
// a struck-out ad tag. A tap on a mesa or fichas row (or its thumbnail in the
// Todo Capi strip) swaps the list for that design's full preview in the same
// sheet; a second Modal would break the ad privacy flow on dismiss. Owned
// states derive from ent so a mid-sheet purchase updates rows live. Prices
// come from the store only; until they arrive every buy button shows a
// neutral "see price" pill, never a guessed amount.
export default function StoreSheet({
  visible,
  initialPreview,
  onClose,
  onPurchased,
}: {
  visible: boolean;
  // Design whose preview the sheet opens on; null or missing opens the list.
  initialPreview?: StorePreview | null;
  onClose: () => void;
  // Fires after the store confirmed a purchase, with the product bought.
  onPurchased?: (id: ProductId) => void;
}) {
  const { s } = useI18n();

  // The design on preview, or null for the list. Each opening starts on
  // initialPreview; it is set while rendering, not in an effect, so the
  // slide-in already shows that view. A close keeps the view, so the sheet
  // slides away unchanged.
  const [preview, setPreview] = useState<StorePreview | null>(
    visible ? initialPreview ?? null : null
  );
  const [shownVisible, setShownVisible] = useState(visible);
  if (visible !== shownVisible) {
    setShownVisible(visible);
    if (visible) setPreview(initialPreview ?? null);
  }

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

  const mesaNames: Record<PremiumMesaId, string> = {
    quisqueya: s.themeQuisqueya,
    larimar: s.themeLarimar,
    noche: s.themeNoche,
  };
  const mesaDescs: Record<PremiumMesaId, string> = {
    quisqueya: s.themeQuisqueyaDesc,
    larimar: s.themeLarimarDesc,
    noche: s.themeNocheDesc,
  };
  const fichasNames: Record<PremiumFichasId, string> = {
    quisqueya: s.themeQuisqueya,
    borinquen: s.fichasBorinquen,
    kingston: s.fichasKingston,
  };
  const fichasDescs: Record<PremiumFichasId, string> = {
    quisqueya: s.fichasQuisqueyaDesc,
    borinquen: s.fichasBorinquenDesc,
    kingston: s.fichasKingstonDesc,
  };

  // What a row and a preview say about one design.
  function productOf(p: StorePreview) {
    return "mesa" in p
      ? {
          name: mesaNames[p.mesa],
          desc: mesaDescs[p.mesa],
          openLabel: s.previewMesaOf(mesaNames[p.mesa]),
          productId: MESA_PRODUCTS[p.mesa],
          owned: ent.mesas.has(p.mesa),
        }
      : {
          name: fichasNames[p.fichas],
          desc: fichasDescs[p.fichas],
          openLabel: s.previewFichasOf(fichasNames[p.fichas]),
          productId: FICHAS_PRODUCTS[p.fichas],
          owned: ent.fichas.has(p.fichas),
        };
  }
  const shown = preview ? productOf(preview) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      // Android's back button leaves a preview first; iOS has no back button.
      onRequestClose={
        preview && Platform.OS === "android" ? () => setPreview(null) : onClose
      }
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
          {preview ? (
            <Pressable
              onPress={() => setPreview(null)}
              accessibilityRole="button"
              accessibilityLabel={s.back}
              hitSlop={8}
              style={{ height: 32, justifyContent: "center" }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "800", color: "#6366f1" }}
              >
                ‹ {s.back}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827" }}>
              {s.store}
            </Text>
          )}
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

        {/* The list stays mounted under a preview so Back returns to the
            same scroll position. */}
        <ScrollView
          style={{ display: preview ? "none" : "flex" }}
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
              {MESA_IDS.map((id) => (
                <PreviewThumb
                  key={`mesa-${id}`}
                  label={s.previewMesaOf(mesaNames[id])}
                  hint={mesaDescs[id]}
                  onPress={() => setPreview({ mesa: id })}
                >
                  <MesaPreview id={id} size="strip" />
                </PreviewThumb>
              ))}
              {FICHAS_IDS.map((id) => (
                <PreviewThumb
                  key={`fichas-${id}`}
                  label={s.previewFichasOf(fichasNames[id])}
                  hint={fichasDescs[id]}
                  onPress={() => setPreview({ fichas: id })}
                >
                  <FichasPreview id={id} size="strip" />
                </PreviewThumb>
              ))}
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
          {MESA_IDS.map((id) => (
            <ProductRow
              key={id}
              {...productOf({ mesa: id })}
              preview={<MesaPreview id={id} />}
              onPurchased={onPurchased}
              onOpen={() => setPreview({ mesa: id })}
            />
          ))}

          <SectionLabel text={s.fichasLabel} />
          {FICHAS_IDS.map((id) => (
            <ProductRow
              key={id}
              {...productOf({ fichas: id })}
              preview={<FichasPreview id={id} />}
              onPurchased={onPurchased}
              onOpen={() => setPreview({ fichas: id })}
            />
          ))}

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

        {preview && shown ? (
          <>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: 20,
                gap: 14,
              }}
            >
              {"mesa" in preview ? (
                <MesaShowcase id={preview.mesa} />
              ) : (
                <FichasShowcase id={preview.fichas} />
              )}
              <View style={{ gap: 4 }}>
                <Text
                  style={{ fontSize: 22, fontWeight: "900", color: "#111827" }}
                >
                  {shown.name}
                </Text>
                <Text style={{ fontSize: 13, color: "#6b7280" }}>
                  {shown.desc}
                </Text>
              </View>
            </ScrollView>
            {/* Pinned under the scroll so the buy button is always in reach */}
            <SafeAreaView
              edges={["bottom"]}
              style={{
                alignItems: "center",
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 12,
                borderTopWidth: 1,
                borderTopColor: "#e5e7eb",
              }}
            >
              <BuyButton
                productId={shown.productId}
                owned={shown.owned}
                onPurchased={onPurchased}
                hero
              />
            </SafeAreaView>
          </>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

// A Todo Capi strip thumbnail that opens its design's preview. The slop
// brings the 28pt-tall box to a 44pt target without reaching a neighbor.
function PreviewThumb({
  label,
  hint,
  onPress,
  children,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}
    >
      {children}
    </Pressable>
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

// With onOpen, everything left of the buy button is one button that opens
// the preview. The buy button is its sibling, not its child, so it keeps its
// own touch target and its own VoiceOver stop.
function ProductRow({
  name,
  desc,
  preview,
  productId,
  owned,
  onPurchased,
  onOpen,
  openLabel,
}: {
  name: string;
  desc: string;
  // What the product looks like (one of the previews below). Decorative:
  // the name and description carry the meaning for screen readers.
  preview: ReactNode;
  productId: ProductId;
  owned: boolean;
  onPurchased?: (id: ProductId) => void;
  onOpen?: () => void;
  // The screen reader name of the open-preview button. It names the kind
  // (table or tiles), since a table and a tile design can share a name.
  openLabel?: string;
}) {
  const infoStyle = {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingLeft: 14,
    paddingVertical: 12,
  };
  const info = (
    <>
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
    </>
  );
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#e5e7eb",
      }}
    >
      {onOpen ? (
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={openLabel ?? name}
          accessibilityHint={desc}
          style={infoStyle}
        >
          {info}
        </Pressable>
      ) : (
        <View style={infoStyle}>{info}</View>
      )}
      <View style={{ paddingLeft: 12, paddingRight: 14 }}>
        <BuyButton productId={productId} owned={owned} onPurchased={onPurchased} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Product previews. Row previews are 64 x 44; the Todo Capi strip shows the
// same six at 40 x 28. Every box is decorative: the row text (or the strip
// thumbnail's label) carries the meaning, so screen readers skip the box and
// the tiles inside it.
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

// Two tiles in the skin on sale: a face and a back in the row, two faces in
// the strip (a back that small reads as a color chip). The ground is a
// neutral light gray so the black kingston tiles and the white borinquen
// tiles both keep a silhouette.
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
        {size === "row" ? (
          <TileDisplay tile={[0, 0]} faceDown w={tileW} h={tileH} />
        ) : (
          <TileDisplay tile={[2, 5]} w={tileW} h={tileH} />
        )}
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
      colors={feltColors(palette)}
      locations={FELT_LOCATIONS}
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

// ---------------------------------------------------------------------------
// Full previews, one design at a time. Tiles keep the game's sizes: the
// hand's 44 x 88, the top row's 36 x 72 backs, and a board-sized 28 x 56
// line. The art is decorative; the visible labels and the name below it
// carry the meaning.
// ---------------------------------------------------------------------------

const SHOW_HAND: Tile[] = [[6, 6], [2, 5], [0, 3], [4, 4], [1, 6]];
const SHOW_BACKS = 6;
const LINE_FICHAS: Tile[] = [[6, 6], [6, 3], [3, 1], [1, 1]];
const LINE_MESA: Tile[] = [[5, 5], [5, 2], [2, 4], [4, 4]];
const LINE_W = 28;
const LINE_H = 56;

const SHOW_GROUND = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  gap: 8,
  paddingVertical: 10,
  borderRadius: 12,
  backgroundColor: "#f3f4f6",
};

// Everything in the design on sale: the player's own tiles, the backs the
// other players see, and a short line on the classic felt.
function FichasShowcase({ id }: { id: PremiumFichasId }) {
  const { s } = useI18n();
  const felt = THEMES.barberia;
  return (
    <SkinScope skinId={id}>
      <View
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#e5e7eb",
          padding: 16,
          gap: 14,
        }}
      >
        <ShowcaseGroup label={s.previewYourTiles}>
          <View {...DECORATIVE} style={SHOW_GROUND}>
            {SHOW_HAND.map((t) => (
              <TileDisplay key={`${t[0]}-${t[1]}`} tile={t} />
            ))}
          </View>
        </ShowcaseGroup>
        <ShowcaseGroup label={s.previewOthersSee}>
          <View {...DECORATIVE} style={[SHOW_GROUND, { gap: 4 }]}>
            {Array.from({ length: SHOW_BACKS }, (_, i) => (
              <TileDisplay key={i} tile={[0, 0]} small faceDown />
            ))}
          </View>
        </ShowcaseGroup>
        <ShowcaseGroup label={s.previewOnTable}>
          <LinearGradient
            {...DECORATIVE}
            colors={feltColors(felt)}
            locations={FELT_LOCATIONS}
            style={{
              height: 88,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TileLine tiles={LINE_FICHAS} />
          </LinearGradient>
        </ShowcaseGroup>
      </View>
    </SkinScope>
  );
}

// The mesa on sale as the game screen draws it: the score bar in the table's
// colors over its felt, the watermark, and a short line of clasico tiles.
function MesaShowcase({ id }: { id: PremiumMesaId }) {
  const { s } = useI18n();
  const palette = THEMES[id];
  return (
    <View
      {...DECORATIVE}
      style={{
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: palette.accent,
        overflow: "hidden",
      }}
    >
      <ScorePanel
        scores={[45, 70]}
        targetScore={100}
        players={[
          { seat: "n", nickname: s.opponent, avatar_color: "#ec4899" },
          { seat: "s", nickname: s.you, avatar_color: "#6366f1" },
        ]}
        currentTurn="s"
        mySeat=""
        bg={palette.scoreBg}
        textColor={palette.scoreText}
      />
      <LinearGradient
        colors={feltColors(palette)}
        locations={FELT_LOCATIONS}
        style={{ height: 200, alignItems: "center", justifyContent: "center" }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.05)",
              fontSize: 22,
              fontWeight: "900",
              letterSpacing: 4,
              transform: [{ rotate: "-2deg" }],
              textAlign: "center",
            }}
          >
            {palette.watermark}
          </Text>
        </View>
        <SkinScope skinId="clasico">
          <TileLine tiles={LINE_MESA} />
        </SkinScope>
      </LinearGradient>
    </View>
  );
}

function ShowcaseGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

// A short played line, laid out as the board lays a row: doubles stand
// across it, the rest lie along it, turned the way the board turns a tile
// played left to right. Each lying tile's wrapper reserves its turned
// footprint.
function TileLine({ tiles }: { tiles: Tile[] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
      {tiles.map((t) => {
        const key = `${t[0]}-${t[1]}`;
        return t[0] === t[1] ? (
          <TileDisplay key={key} tile={t} w={LINE_W} h={LINE_H} />
        ) : (
          <View
            key={key}
            style={{
              width: LINE_H,
              height: LINE_W,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View style={{ transform: [{ rotate: "-90deg" }] }}>
              <TileDisplay tile={t} w={LINE_W} h={LINE_H} />
            </View>
          </View>
        );
      })}
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
