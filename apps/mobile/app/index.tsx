import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { router } from "expo-router";
import AdBanner from "../components/AdBanner";
import ModeGlyph from "../components/ModeGlyph";
import StoreSheet from "../components/StoreSheet";
import { useEntitlements } from "../lib/entitlements";
import {
  PRODUCT_IDS,
  type PremiumFichasId,
  type PremiumMesaId,
  type ProductId,
} from "../lib/iapCatalog";
import { useI18n } from "../lib/i18n";
import { saveSession } from "../lib/session";
import { TILE_SKINS, useTileSkin, type TileSkinId } from "../lib/tileSkins";
import { API_BASE, THEME } from "../theme";
import type { Lang } from "@capi/i18n";

const LANGS: Lang[] = ["es", "en"];

const AVATAR_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
];

type ThemeId =
  | "barberia"
  | "colmado"
  | "patio"
  | "quisqueya"
  | "larimar"
  | "noche";

const TABLE_THEMES: {
  id: ThemeId;
  label: string;
  color: string;
  accent: string;
  premium?: PremiumMesaId;
}[] = [
  { id: "barberia", label: "Barbería", color: "#145228", accent: "#c0392b" },
  { id: "colmado", label: "Colmado", color: "#3a2a1a", accent: "#d4a017" },
  { id: "patio", label: "Patio", color: "#7a7268", accent: "#c4693d" },
  {
    id: "quisqueya",
    label: "Quisqueya",
    color: "#0f2b56",
    accent: "#c9a227",
    premium: "quisqueya",
  },
  {
    id: "larimar",
    label: "Larimar",
    color: "#17606f",
    accent: "#58b7c4",
    premium: "larimar",
  },
  {
    id: "noche",
    label: "Capi Noche",
    color: "#131329",
    accent: "#6366f1",
    premium: "noche",
  },
];

const FICHAS_IDS: TileSkinId[] = [
  "clasico",
  "quisqueya",
  "borinquen",
  "kingston",
];

function productIdForMesa(mesa: PremiumMesaId): ProductId {
  switch (mesa) {
    case "quisqueya":
      return PRODUCT_IDS.mesaQuisqueya;
    case "larimar":
      return PRODUCT_IDS.mesaLarimar;
    case "noche":
      return PRODUCT_IDS.mesaNoche;
  }
}

function productIdForFichas(id: PremiumFichasId): ProductId {
  switch (id) {
    case "quisqueya":
      return PRODUCT_IDS.fichasQuisqueya;
    case "borinquen":
      return PRODUCT_IDS.fichasBorinquen;
    case "kingston":
      return PRODUCT_IDS.fichasKingston;
  }
}

// Mini vertical tile: face, center divider, one pip per half. Enough to tell
// the four skins apart at a glance.
function SkinSwatch({ id }: { id: TileSkinId }) {
  const skin = TILE_SKINS[id];
  return (
    <View
      style={{
        width: 20,
        height: 40,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: skin.border,
        backgroundColor: skin.face,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "space-evenly",
      }}
    >
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: skin.pipTop[1],
        }}
      />
      <View
        style={{
          alignSelf: "stretch",
          height: 2,
          backgroundColor: skin.divider,
        }}
      />
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: skin.pipBottom[1],
        }}
      />
    </View>
  );
}

export default function Index() {
  const { lang, setLang, s } = useI18n();
  const insets = useSafeAreaInsets();
  const { ent, prices } = useEntitlements();
  const { skinId, setSkinId } = useTileSkin();
  const [nickname, setNickname] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [theme, setTheme] = useState<ThemeId>("barberia");
  const [is2v2, setIs2v2] = useState(false);
  const [targetScore, setTargetScore] = useState<100 | 200>(100);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");
  const [storeOpen, setStoreOpen] = useState(false);

  // Premium labels come from i18n; the free three keep their TABLE_THEMES
  // labels (proper nouns, identical in both languages).
  const premiumLabels: Record<PremiumMesaId, string> = {
    quisqueya: s.themeQuisqueya,
    larimar: s.themeLarimar,
    noche: s.themeNoche,
  };

  const themeDescs: Record<ThemeId, string> = {
    barberia: s.themeClassic,
    colmado: s.themeBarrio,
    patio: s.themeOutdoors,
    quisqueya: s.themeQuisqueyaDesc,
    larimar: s.themeLarimarDesc,
    noche: s.themeNocheDesc,
  };

  const fichasLabels: Record<TileSkinId, string> = {
    clasico: s.fichasClasico,
    quisqueya: s.themeQuisqueya,
    borinquen: "Borinquen",
    kingston: "Kingston",
  };

  async function handleCreate() {
    if (!nickname.trim() || loading) return;
    setLoading("create");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          avatarColor,
          mode: "live",
          theme,
          is2v2,
          targetScore,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? s.failedCreate);
        return;
      }
      await saveSession({
        playerId: data.playerId,
        seat: data.seat,
        gameId: data.gameId,
      });
      router.push(`/game/${data.gameId}`);
    } catch {
      setError(s.networkError);
    } finally {
      setLoading(null);
    }
  }

  async function handleJoin() {
    if (!nickname.trim() || inviteCode.trim().length !== 6 || loading) return;
    setLoading("join");
    setError("");
    try {
      const code = inviteCode.trim().toUpperCase();
      const lookupRes = await fetch(`${API_BASE}/api/games/by-code/${code}`);
      if (!lookupRes.ok) {
        setError(s.gameNotFound);
        return;
      }
      const { gameId } = await lookupRes.json();

      const joinRes = await fetch(`${API_BASE}/api/games/${gameId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), avatarColor }),
      });
      const data = await joinRes.json();
      if (!joinRes.ok) {
        setError(data.error ?? s.failedJoin);
        return;
      }
      await saveSession({
        playerId: data.playerId,
        seat: data.seat,
        gameId,
      });
      router.push(`/game/${gameId}`);
    } catch {
      setError(s.networkError);
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.pageBg }}>
      {/* Store entry, top-left mirror of the language toggle */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 12,
          left: 20,
          zIndex: 10,
          backgroundColor: "rgba(255,255,255,0.85)",
          borderRadius: 999,
          padding: 3,
          borderWidth: 1,
          borderColor: "#e5e7eb",
        }}
      >
        <Pressable
          onPress={() => setStoreOpen(true)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 999,
          }}
        >
          <Text
            style={{ fontSize: 11, fontWeight: "800", color: THEME.scoreBg }}
          >
            🛍 {s.store}
          </Text>
        </Pressable>
      </View>

      {/* Language toggle */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 12,
          right: 20,
          zIndex: 10,
          flexDirection: "row",
          backgroundColor: "rgba(255,255,255,0.85)",
          borderRadius: 999,
          padding: 3,
          borderWidth: 1,
          borderColor: "#e5e7eb",
        }}
      >
        {LANGS.map((l) => (
          <Pressable
            key={l}
            onPress={() => setLang(l)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: lang === l ? THEME.scoreBg : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: lang === l ? "#ffffff" : "#9ca3af",
              }}
            >
              {l === "es" ? "ES" : "EN"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop: 64,
          paddingBottom: 32,
        }}
        keyboardShouldPersistTaps="handled"
        // iOS: inset the scroll area by the keyboard height so a focused
        // field (the join code lives at the very bottom) scrolls above the
        // keyboard instead of being covered by it. Android resizes the
        // window by default and needs nothing.
        automaticallyAdjustKeyboardInsets
      >
        {/* Title */}
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <Text
            style={{
              fontSize: 44,
              fontWeight: "900",
              color: THEME.scoreBg,
              letterSpacing: -1,
            }}
          >
            Capi
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#9ca3af",
              marginTop: 2,
            }}
          >
            {s.tagline}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 24,
            padding: 24,
            gap: 20,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          {/* Name */}
          <View style={{ gap: 6 }}>
            <Text style={labelStyle}>{s.yourName}</Text>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              maxLength={20}
              placeholder={s.namePlaceholder}
              placeholderTextColor="#9ca3af"
              style={inputStyle}
            />
          </View>

          {/* Color picker */}
          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>{s.yourColor}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {AVATAR_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setAvatarColor(c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: c,
                    borderWidth: 3,
                    borderColor:
                      avatarColor === c ? THEME.scoreBg : "transparent",
                    transform:
                      avatarColor === c ? [{ scale: 1.1 }] : undefined,
                  }}
                />
              ))}
            </View>
          </View>

          {/* Table theme: two rows of three, premium rows gated */}
          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>{s.table}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {TABLE_THEMES.map((t) => {
                // Non-null when this mesa is premium and not owned yet.
                const lockedMesa =
                  t.premium !== undefined && !ent.mesas.has(t.premium)
                    ? t.premium
                    : null;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      // Guard here only: theme state never holds a locked id,
                      // and unlocking mid-session keeps state valid.
                      if (lockedMesa) {
                        setStoreOpen(true);
                        return;
                      }
                      setTheme(t.id);
                    }}
                    style={[
                      cardStyle,
                      {
                        flexBasis: "30%",
                        flexGrow: 1,
                        borderColor: theme === t.id ? THEME.scoreBg : "#e5e7eb",
                        backgroundColor:
                          theme === t.id ? "#f9fafb" : "#ffffff",
                      },
                    ]}
                  >
                    {/* Swatch: RN has no CSS gradients, so approximate the
                        web's diagonal two-color blend with a base color and a
                        half-width accent overlay at 45% opacity. */}
                    <View
                      style={{ alignSelf: "stretch", height: 32, marginBottom: 6 }}
                    >
                      <View
                        style={{
                          flex: 1,
                          borderRadius: 8,
                          backgroundColor: t.color,
                          overflow: "hidden",
                          opacity: lockedMesa ? 0.4 : 1,
                        }}
                      >
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: "50%",
                            backgroundColor: t.accent,
                            opacity: 0.45,
                            borderTopRightRadius: 8,
                            borderBottomRightRadius: 8,
                          }}
                        />
                      </View>
                      {lockedMesa ? (
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ fontSize: 14 }}>🔒</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={cardTitleStyle}>
                      {t.premium ? premiumLabels[t.premium] : t.label}
                    </Text>
                    <Text style={cardDescStyle}>{themeDescs[t.id]}</Text>
                    {lockedMesa ? (
                      <Text style={priceTagStyle}>
                        {prices.get(productIdForMesa(lockedMesa)) ?? "$0.99"}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Fichas skin picker */}
          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>{s.fichasLabel}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {FICHAS_IDS.map((f) => {
                // Non-null when this skin is premium and not owned yet.
                const lockedFichas =
                  f !== "clasico" && !ent.fichas.has(f) ? f : null;
                return (
                  <Pressable
                    key={f}
                    onPress={() => {
                      if (lockedFichas) {
                        setStoreOpen(true);
                        return;
                      }
                      setSkinId(f);
                    }}
                    style={[
                      cardStyle,
                      {
                        flexBasis: "22%",
                        paddingHorizontal: 4,
                        borderColor: skinId === f ? THEME.scoreBg : "#e5e7eb",
                        backgroundColor:
                          skinId === f ? "#f9fafb" : "#ffffff",
                      },
                    ]}
                  >
                    <View
                      style={{
                        opacity: lockedFichas ? 0.4 : 1,
                        marginBottom: 6,
                      }}
                    >
                      <SkinSwatch id={f} />
                    </View>
                    <Text
                      style={[cardTitleStyle, { fontSize: 10 }]}
                      numberOfLines={1}
                    >
                      {fichasLabels[f]}
                    </Text>
                    {lockedFichas ? (
                      <Text style={priceTagStyle}>
                        🔒{" "}
                        {prices.get(productIdForFichas(lockedFichas)) ??
                          "$0.99"}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Mode */}
          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>{s.mode}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setIs2v2(false)}
                style={[
                  cardStyle,
                  {
                    borderColor: !is2v2 ? THEME.scoreBg : "#e5e7eb",
                    backgroundColor: !is2v2 ? "#f9fafb" : "#ffffff",
                  },
                ]}
              >
                <ModeGlyph mode="1v1" />
                <Text style={[cardTitleStyle, { marginTop: 6 }]}>1v1</Text>
              </Pressable>
              <Pressable
                onPress={() => setIs2v2(true)}
                style={[
                  cardStyle,
                  {
                    borderColor: is2v2 ? THEME.scoreBg : "#e5e7eb",
                    backgroundColor: is2v2 ? "#f9fafb" : "#ffffff",
                  },
                ]}
              >
                <ModeGlyph mode="2v2" />
                <Text style={[cardTitleStyle, { marginTop: 6 }]}>2v2</Text>
                <Text style={cardDescStyle}>{s.conTuFrente}</Text>
              </Pressable>
            </View>
          </View>

          {/* Target score */}
          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>{s.firstTo}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setTargetScore(100)}
                style={[
                  cardStyle,
                  {
                    borderColor:
                      targetScore === 100 ? THEME.scoreBg : "#e5e7eb",
                    backgroundColor:
                      targetScore === 100 ? "#f9fafb" : "#ffffff",
                  },
                ]}
              >
                <Text style={cardTitleStyle}>{s.score100}</Text>
              </Pressable>
              <Pressable
                onPress={() => setTargetScore(200)}
                style={[
                  cardStyle,
                  {
                    borderColor:
                      targetScore === 200 ? THEME.scoreBg : "#e5e7eb",
                    backgroundColor:
                      targetScore === 200 ? "#f9fafb" : "#ffffff",
                  },
                ]}
              >
                <Text style={cardTitleStyle}>{s.score200}</Text>
              </Pressable>
            </View>
          </View>

          {error ? (
            <Text style={{ color: "#dc2626", fontSize: 14, fontWeight: "500" }}>
              {error}
            </Text>
          ) : null}

          {/* Create */}
          <Pressable
            onPress={handleCreate}
            disabled={!nickname.trim() || loading !== null}
            style={{
              backgroundColor: THEME.scoreBg,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              opacity: !nickname.trim() || loading !== null ? 0.4 : 1,
            }}
          >
            {loading === "create" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                {s.createAction}
              </Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
            <Text style={{ fontSize: 12, color: "#9ca3af", fontWeight: "600" }}>
              ·
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
          </View>

          {/* Join by code */}
          <View style={{ gap: 6 }}>
            <Text style={labelStyle}>{s.inviteCode}</Text>
            <TextInput
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              placeholder="XXXXXX"
              placeholderTextColor="#9ca3af"
              style={[
                inputStyle,
                {
                  textAlign: "center",
                  letterSpacing: 8,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                },
              ]}
            />
          </View>

          <Pressable
            onPress={handleJoin}
            disabled={
              !nickname.trim() || inviteCode.length !== 6 || loading !== null
            }
            style={{
              borderWidth: 2,
              borderColor: THEME.scoreBg,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
              opacity:
                !nickname.trim() || inviteCode.length !== 6 || loading !== null
                  ? 0.4
                  : 1,
            }}
          >
            {loading === "join" ? (
              <ActivityIndicator color={THEME.scoreBg} />
            ) : (
              <Text
                style={{ color: THEME.scoreBg, fontSize: 15, fontWeight: "700" }}
              >
                {s.joinAction}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Sibling of the ScrollView so it pins to the bottom; zero height
          until an ad actually loads. */}
      <AdBanner />

      <StoreSheet visible={storeOpen} onClose={() => setStoreOpen(false)} />
    </SafeAreaView>
  );
}

const labelStyle = {
  fontSize: 11,
  fontWeight: "700" as const,
  color: "#6b7280",
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const cardStyle = {
  flex: 1,
  paddingVertical: 12,
  paddingHorizontal: 8,
  borderRadius: 14,
  borderWidth: 2,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const cardTitleStyle = {
  fontSize: 12,
  fontWeight: "700" as const,
  color: "#1f2937",
  textAlign: "center" as const,
};

const cardDescStyle = {
  fontSize: 10,
  color: "#9ca3af",
  textAlign: "center" as const,
  marginTop: 1,
};

const priceTagStyle = {
  fontSize: 10,
  fontWeight: "700" as const,
  color: "#6366f1",
  marginTop: 2,
};

const inputStyle = {
  borderWidth: 1,
  borderColor: "#e5e7eb",
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 15,
  color: "#111827",
  backgroundColor: "#f9fafb",
};
