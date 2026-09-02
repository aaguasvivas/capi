import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEntitlements } from "../lib/entitlements";
import { useI18n } from "../lib/i18n";
import { PRODUCT_IDS, type ProductId } from "../lib/iapCatalog";
import { THEME } from "../theme";

// Page-sheet store: Todo Capi hero, remove ads, 3 mesas, 3 fichas, restore,
// privacy link. Owned states derive from ent so a mid-sheet purchase updates
// rows live. Prices come from the store only; until they arrive every buy
// button shows a neutral "see price" pill, never a guessed amount.
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
    if (lastError === "purchaseFailed") Alert.alert(s.purchaseFailed);
    else Alert.alert(s.purchaseFailed, s[lastError]);
    clearError();
  }, [lastError, clearError, s]);

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
            productId={PRODUCT_IDS.removeAds}
            owned={ent.adFree}
            onPurchased={onPurchased}
          />

          <SectionLabel text={s.table} />
          <ProductRow
            name={s.themeQuisqueya}
            desc={s.themeQuisqueyaDesc}
            productId={PRODUCT_IDS.mesaQuisqueya}
            owned={ent.mesas.has("quisqueya")}
            onPurchased={onPurchased}
          />
          <ProductRow
            name={s.themeLarimar}
            desc={s.themeLarimarDesc}
            productId={PRODUCT_IDS.mesaLarimar}
            owned={ent.mesas.has("larimar")}
            onPurchased={onPurchased}
          />
          <ProductRow
            name={s.themeNoche}
            desc={s.themeNocheDesc}
            productId={PRODUCT_IDS.mesaNoche}
            owned={ent.mesas.has("noche")}
            onPurchased={onPurchased}
          />

          <SectionLabel text={s.fichasLabel} />
          <ProductRow
            name={`Fichas ${s.themeQuisqueya}`}
            desc={s.fichasQuisqueyaDesc}
            productId={PRODUCT_IDS.fichasQuisqueya}
            owned={ent.fichas.has("quisqueya")}
            onPurchased={onPurchased}
          />
          <ProductRow
            name="Fichas Borinquen"
            desc={s.fichasBorinquenDesc}
            productId={PRODUCT_IDS.fichasBorinquen}
            owned={ent.fichas.has("borinquen")}
            onPurchased={onPurchased}
          />
          <ProductRow
            name="Fichas Kingston"
            desc={s.fichasKingstonDesc}
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
  productId,
  owned,
  onPurchased,
}: {
  name: string;
  desc: string;
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
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>
          {name}
        </Text>
        <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
          {desc}
        </Text>
      </View>
      <BuyButton productId={productId} owned={owned} onPurchased={onPurchased} />
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
