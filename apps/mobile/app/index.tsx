import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AdBanner from "../components/AdBanner";
import ModeGlyph from "../components/ModeGlyph";
import StoreSheet, { type StorePreview } from "../components/StoreSheet";
import { useEntitlements } from "../lib/entitlements";
import {
  checkFields,
  normalizeCode,
  type FieldErrors,
  type FormField,
} from "../lib/gameForms";
import { loadHomePrefs, saveHomePrefs, savedThemeAction } from "../lib/homePrefs";
import {
  deriveEntitlements,
  PRODUCT_IDS,
  type PremiumFichasId,
  type PremiumMesaId,
  type ProductId,
} from "../lib/iapCatalog";
import { useI18n } from "../lib/i18n";
import { pickerColumns, ROW_BASIS } from "../lib/pickerColumns";
import { skinToSend } from "../lib/seatSkins";
import { clearSession, saveSession } from "../lib/session";
import { TILE_SKINS, useTileSkin, type TileSkinId } from "../lib/tileSkins";
import { API_BASE, THEME } from "../theme";
import { errorKeyFor, type ErrorKey, type Lang } from "@capi/i18n";

const LANGS: Lang[] = ["es", "en"];

const NICKNAME_MAX = 20;

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
  color: string;
  accent: string;
  premium?: PremiumMesaId;
}[] = [
  { id: "barberia", color: "#145228", accent: "#c0392b" },
  { id: "colmado", color: "#3a2a1a", accent: "#d4a017" },
  { id: "patio", color: "#7a7268", accent: "#c4693d" },
  {
    id: "quisqueya",
    color: "#0f2b56",
    accent: "#c9a227",
    premium: "quisqueya",
  },
  {
    id: "larimar",
    color: "#17606f",
    accent: "#58b7c4",
    premium: "larimar",
  },
  {
    id: "noche",
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

// Floating pills are about 23pt tall; the slop brings each to a 44pt target.
// Only the outer edge of a pair gets horizontal slop, so neighbors never
// share a strip of the other's target.
const PILL_SLOP_V = 11;
const PILL_SLOP_H = 8;

// Pill labels grow with the text size up to 1.09 times, then stop. At 375pt
// in Spanish (the longer labels) the two pills sit 31pt apart at the default
// size and 16.6pt apart at 1.09; any closer and their facing 8pt slops
// overlap, and past 1.18 the pills themselves do. The pills are navigation
// chrome, and iOS keeps a navigation bar's buttons at a fixed size too;
// VoiceOver reads their full labels, and the store and rules screens they open
// scale in full.
const PILL_MAX_FONT_SCALE = 1.09;

// A flagged name field scrolls to this far below the top of the scroll area,
// the same clearance the content's top padding gives the floating pills.
const FLAGGED_FIELD_TOP = 64;

// Tables this device joined that are still in progress, read from the
// per-game session keys (capi_session_<gameId>).
const SESSION_KEY_PREFIX = "capi_session_";
const MAX_RESUMABLE = 3;

interface ResumableGame {
  gameId: string;
  code: string | null;
  createdAt: number;
}

// Fire-and-forget audit of every saved session: the server says whether the
// table still exists and is still in play. Gone (404) or finished tables lose
// their key; a network miss keeps the key and shows nothing for now.
async function loadResumableGames(): Promise<ResumableGame[]> {
  let keys: readonly string[];
  try {
    keys = await AsyncStorage.getAllKeys();
  } catch {
    return [];
  }
  const ids = keys
    .filter((k) => k.startsWith(SESSION_KEY_PREFIX))
    .map((k) => k.slice(SESSION_KEY_PREFIX.length));
  const checks = await Promise.all(
    ids.map(async (gameId): Promise<ResumableGame | null> => {
      try {
        const res = await fetch(`${API_BASE}/api/games/${gameId}`, {
          cache: "no-store",
        });
        if (res.status === 404) {
          clearSession(gameId);
          return null;
        }
        if (!res.ok) return null;
        const { game } = (await res.json()) as {
          game: {
            status?: string;
            invite_code?: string | null;
            created_at?: string;
            game_state?: { phase?: string } | null;
          };
        };
        if (
          game.status === "finished" ||
          game.game_state?.phase === "finished"
        ) {
          clearSession(gameId);
          return null;
        }
        return {
          gameId,
          code: typeof game.invite_code === "string" ? game.invite_code : null,
          createdAt: Date.parse(game.created_at ?? "") || 0,
        };
      } catch {
        return null;
      }
    })
  );
  return checks
    .filter((g): g is ResumableGame => g !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_RESUMABLE);
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
  // Larger text sizes give the table and fichas pickers fewer cards per row.
  const { fontScale } = useWindowDimensions();
  const columns = pickerColumns(fontScale);
  const { ent, prices, reconciled } = useEntitlements();
  const { skinId, setSkinId } = useTileSkin();
  const [nickname, setNickname] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [theme, setTheme] = useState<ThemeId>("barberia");
  const [is2v2, setIs2v2] = useState(false);
  const [targetScore, setTargetScore] = useState<100 | 200>(100);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState<"create" | "join" | null>(null);
  // String keys, so the messages follow a language switch. Field messages sit
  // under their field; a request's failure sits under the button that sent it.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<{
    action: "create" | "join";
    key: ErrorKey | "networkError";
  } | null>(null);
  // The button whose tap found the name empty. The name field's Return key
  // then finishes that action, so the player need not scroll back to it.
  const [nameFor, setNameFor] = useState<"create" | "join" | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const nameInputRef = useRef<TextInput>(null);
  const codeInputRef = useRef<TextInput>(null);
  // The name block's offset in the scroll content: the form card's y plus the
  // block's y inside the card.
  const cardYRef = useRef(0);
  const nameYRef = useRef(0);
  const codeFocusedRef = useRef(false);
  const [storeOpen, setStoreOpen] = useState(false);
  // Which locked picker card opened the store, so the matching purchase can
  // select that design and dismiss the sheet. The sheet opens on its preview.
  const storeTargetRef = useRef<StorePreview | null>(null);
  const [storePreview, setStorePreview] = useState<StorePreview | null>(null);
  const [resumable, setResumable] = useState<ResumableGame[]>([]);

  // Last launch's choices. The table waits in savedTheme until entitlements
  // say whether it may come back (theme state never holds a locked id).
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [savedTheme, setSavedTheme] = useState<ThemeId | null>(null);
  useEffect(() => {
    let active = true;
    loadHomePrefs({
      colors: AVATAR_COLORS,
      themes: TABLE_THEMES.map((t) => t.id),
      maxNickname: NICKNAME_MAX,
    }).then((p) => {
      if (!active) return;
      const name = p.nickname;
      if (name) setNickname((prev) => prev || name);
      if (p.avatarColor) setAvatarColor(p.avatarColor);
      if (p.is2v2 !== undefined) setIs2v2(p.is2v2);
      if (p.targetScore) setTargetScore(p.targetScore);
      if (p.theme) setSavedTheme(p.theme);
      setPrefsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!savedTheme) return;
    const premium = TABLE_THEMES.find((t) => t.id === savedTheme)?.premium;
    const action = savedThemeAction(premium, ent.mesas, reconciled);
    if (action === "wait") return;
    if (action === "apply") setTheme(savedTheme);
    setSavedTheme(null);
  }, [savedTheme, ent, reconciled]);

  useEffect(() => {
    if (!prefsLoaded) return;
    saveHomePrefs({
      nickname,
      avatarColor,
      theme: savedTheme ?? theme,
      is2v2,
      targetScore,
    });
  }, [prefsLoaded, nickname, avatarColor, theme, savedTheme, is2v2, targetScore]);

  // A table the player picks (or buys) wins over one still waiting above.
  function pickTheme(id: ThemeId) {
    setSavedTheme(null);
    setTheme(id);
  }

  // Re-audit saved sessions every time home comes back into focus: a table
  // left mid-game shows up here, a finished one disappears.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadResumableGames().then((games) => {
        if (active) setResumable(games);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  // The code field sits just above Join at the bottom of the form. iOS only
  // scrolls far enough to show the focused field, which leaves Join under the
  // keyboard, so once the keyboard is up the form scrolls to its end.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      if (codeFocusedRef.current) {
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    });
    return () => sub.remove();
  }, []);

  const tableLabels: Record<ThemeId, string> = {
    barberia: s.themeBarberia,
    colmado: s.themeColmado,
    patio: s.themePatio,
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
    borinquen: s.fichasBorinquen,
    kingston: s.fichasKingston,
  };

  function openStore(target: StorePreview | null) {
    storeTargetRef.current = target;
    setStorePreview(target);
    setStoreOpen(true);
  }

  function closeStore() {
    storeTargetRef.current = null;
    setStoreOpen(false);
  }

  // A confirmed purchase of the design that opened the sheet (or of the
  // bundle that includes it) selects it and dismisses the sheet. A single
  // design bought from the Tienda pill is selected too, sheet left open.
  function handlePurchased(id: ProductId) {
    const got = deriveEntitlements([id]);
    const target = storeTargetRef.current;
    if (target && "mesa" in target && got.mesas.has(target.mesa)) {
      pickTheme(target.mesa);
      closeStore();
      return;
    }
    if (target && "fichas" in target && got.fichas.has(target.fichas)) {
      setSkinId(target.fichas);
      closeStore();
      return;
    }
    if (got.mesas.size === 1) pickTheme([...got.mesas][0]);
    if (got.fichas.size === 1) setSkinId([...got.fichas][0]);
  }

  // Runs on every Create or Join tap. Flags each invalid field, brings the
  // first one into view and focuses it, and says whether the request may go.
  // The jump is not animated: the keyboard opening on focus re-reads the
  // scroll offset and would stop an animated scroll partway.
  function fieldsReady(
    action: "create" | "join",
    fields: ReadonlyArray<readonly [FormField, string]>
  ) {
    setRequestError(null);
    const { errors, first } = checkFields(fields);
    setFieldErrors(errors);
    setNameFor(errors.name ? action : null);
    if (!first) {
      Keyboard.dismiss();
      return true;
    }
    AccessibilityInfo.announceForAccessibility(
      fields.flatMap(([f]) => {
        const key = errors[f];
        return key ? [s[key]] : [];
      }).join(" ")
    );
    if (first === "name") {
      scrollRef.current?.scrollTo({
        y: Math.max(0, cardYRef.current + nameYRef.current - FLAGGED_FIELD_TOP),
        animated: false,
      });
      // One frame later, so the field already shows the Join (or Go) return
      // key that nameFor sets: iOS reads the key type only on focus.
      requestAnimationFrame(() => nameInputRef.current?.focus());
    } else {
      // The code field is the last field, right above Join.
      scrollRef.current?.scrollToEnd({ animated: false });
      codeInputRef.current?.focus();
    }
    return false;
  }

  function editName(text: string) {
    setNickname(text);
    setFieldErrors((e) => (e.name ? { ...e, name: undefined } : e));
  }

  function editCode(text: string) {
    setInviteCode(normalizeCode(text));
    setFieldErrors((e) => (e.code ? { ...e, code: undefined } : e));
  }

  async function handleCreate() {
    if (loading || !fieldsReady("create", [["name", nickname]])) return;
    setLoading("create");
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
          tileSkin: skinToSend(skinId, ent.fichas),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRequestError({
          action: "create",
          key: errorKeyFor(data.error, "failedCreate"),
        });
        return;
      }
      await saveSession({
        playerId: data.playerId,
        seat: data.seat,
        gameId: data.gameId,
      });
      router.push(`/game/${data.gameId}`);
    } catch {
      setRequestError({ action: "create", key: "networkError" });
    } finally {
      setLoading(null);
    }
  }

  async function handleJoin() {
    if (
      loading ||
      !fieldsReady("join", [
        ["name", nickname],
        ["code", inviteCode],
      ])
    ) {
      return;
    }
    setLoading("join");
    try {
      const lookupRes = await fetch(
        `${API_BASE}/api/games/by-code/${encodeURIComponent(inviteCode)}`
      );
      if (!lookupRes.ok) {
        // Only a 404 means a wrong code; a server failure is not the
        // player's typo.
        const body = await lookupRes.json().catch(() => ({}));
        setRequestError({
          action: "join",
          key: errorKeyFor(
            body.error,
            lookupRes.status === 404 ? "gameNotFound" : "failedJoin"
          ),
        });
        return;
      }
      const { gameId } = await lookupRes.json();

      const joinRes = await fetch(`${API_BASE}/api/games/${gameId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          avatarColor,
          tileSkin: skinToSend(skinId, ent.fichas),
        }),
      });
      const data = await joinRes.json().catch(() => ({}));
      if (!joinRes.ok) {
        setRequestError({
          action: "join",
          key: errorKeyFor(data.error, "failedJoin"),
        });
        return;
      }
      await saveSession({
        playerId: data.playerId,
        seat: data.seat,
        gameId,
      });
      router.push(`/game/${gameId}`);
    } catch {
      setRequestError({ action: "join", key: "networkError" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.pageBg }}>
      <StatusBar style="dark" />

      {/* Store and rules entries, top-left mirror of the language toggle */}
      <View
        style={[
          floatingPillStyle,
          {
            left: 20,
            top: insets.top + 12,
            flexDirection: "row",
            alignItems: "center",
          },
        ]}
      >
        <Pressable
          onPress={() => openStore(null)}
          accessibilityRole="button"
          accessibilityLabel={s.store}
          hitSlop={{ top: PILL_SLOP_V, bottom: PILL_SLOP_V, left: PILL_SLOP_H }}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 999,
          }}
        >
          <Text
            style={{ fontSize: 11, fontWeight: "800", color: THEME.scoreBg }}
            maxFontSizeMultiplier={PILL_MAX_FONT_SCALE}
          >
            🛍 {s.store}
          </Text>
        </Pressable>
        <View style={{ width: 1, height: 14, backgroundColor: "#e5e7eb" }} />
        <Pressable
          onPress={() => router.push("/rules")}
          accessibilityRole="button"
          accessibilityLabel={s.howToPlay}
          hitSlop={{ top: PILL_SLOP_V, bottom: PILL_SLOP_V, right: PILL_SLOP_H }}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 999,
          }}
        >
          <Text
            style={{ fontSize: 11, fontWeight: "800", color: THEME.scoreBg }}
            maxFontSizeMultiplier={PILL_MAX_FONT_SCALE}
          >
            📖 {s.howToPlay}
          </Text>
        </Pressable>
      </View>

      {/* Language toggle */}
      <View
        style={[
          floatingPillStyle,
          { right: 20, top: insets.top + 12, flexDirection: "row" },
        ]}
      >
        {LANGS.map((l, i) => (
          <Pressable
            key={l}
            onPress={() => setLang(l)}
            accessibilityRole="button"
            accessibilityLabel={l === "es" ? "ES" : "EN"}
            accessibilityState={{ selected: lang === l }}
            hitSlop={{
              top: PILL_SLOP_V,
              bottom: PILL_SLOP_V,
              left: i === 0 ? PILL_SLOP_H : 0,
              right: i === LANGS.length - 1 ? PILL_SLOP_H : 0,
            }}
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
                color: lang === l ? "#ffffff" : "#6b7280",
              }}
              maxFontSizeMultiplier={PILL_MAX_FONT_SCALE}
            >
              {l === "es" ? "ES" : "EN"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
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
        {/* Title. The word mark grows to 3 times its size and then stops:
            at the largest text size (3.57) "Capi" is about 341pt wide and
            breaks as "Cap/i" in the 327pt column; at 3 it is about 287pt. */}
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <Text
            style={{
              fontSize: 44,
              fontWeight: "900",
              color: THEME.scoreBg,
              letterSpacing: -1,
            }}
            maxFontSizeMultiplier={3}
          >
            Capi
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#4b5563",
              marginTop: 2,
            }}
          >
            {s.tagline}
          </Text>
        </View>

        {/* Tables still in play on this device */}
        {resumable.length > 0 ? (
          <View style={{ gap: 8, marginBottom: 16 }}>
            {resumable.map((g) => {
              const hint = g.code ? s.resumeGameHint(g.code) : null;
              return (
                <Pressable
                  key={g.gameId}
                  onPress={() => router.push(`/game/${g.gameId}`)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    hint ? `${s.resumeGame}, ${hint}` : s.resumeGame
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#ffffff",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    {/* Wraps at large text sizes instead of cutting off */}
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#1f2937",
                      }}
                    >
                      {s.resumeGame}
                    </Text>
                    {hint ? (
                      <Text
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          marginTop: 1,
                          fontVariant: ["tabular-nums"],
                        }}
                        numberOfLines={1}
                      >
                        {hint}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 18, color: "#9ca3af" }}>›</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View
          onLayout={(e) => {
            cardYRef.current = e.nativeEvent.layout.y;
          }}
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
          <View
            onLayout={(e) => {
              nameYRef.current = e.nativeEvent.layout.y;
            }}
            style={{ gap: 6 }}
          >
            <Text style={labelStyle}>{s.yourName}</Text>
            <TextInput
              ref={nameInputRef}
              value={nickname}
              onChangeText={editName}
              maxLength={NICKNAME_MAX}
              placeholder={s.namePlaceholder}
              placeholderTextColor="#9ca3af"
              returnKeyType={
                nameFor === "join" ? "join" : nameFor === "create" ? "go" : "done"
              }
              onSubmitEditing={() => {
                if (nameFor === "join") handleJoin();
                else if (nameFor === "create") handleCreate();
              }}
              accessibilityLabel={s.yourName}
              accessibilityHint={
                fieldErrors.name ? s[fieldErrors.name] : undefined
              }
              style={[inputStyle, fieldErrors.name ? invalidInputStyle : null]}
            />
            {fieldErrors.name ? (
              <Text accessibilityLiveRegion="polite" style={fieldErrorStyle}>
                {s[fieldErrors.name]}
              </Text>
            ) : null}
          </View>

          {/* Color picker */}
          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>{s.yourColor}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {AVATAR_COLORS.map((c, i) => (
                <Pressable
                  key={c}
                  onPress={() => setAvatarColor(c)}
                  hitSlop={6}
                  accessibilityRole="button"
                  // Numbered so VoiceOver tells the six swatches apart.
                  accessibilityLabel={`${s.yourColor} ${i + 1}`}
                  accessibilityState={{ selected: avatarColor === c }}
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

          {/* Table theme: two rows of three (fewer per row at large text
              sizes), premium cards gated */}
          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>{s.table}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {TABLE_THEMES.map((t) => {
                // Non-null when this mesa is premium and not owned yet.
                const lockedMesa =
                  t.premium !== undefined && !ent.mesas.has(t.premium)
                    ? t.premium
                    : null;
                const title = tableLabels[t.id];
                const price = lockedMesa
                  ? prices.get(productIdForMesa(lockedMesa)) ?? s.priceUnknown
                  : null;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      // Guard here only: theme state never holds a locked id,
                      // and unlocking mid-session keeps state valid.
                      if (lockedMesa) {
                        openStore({ mesa: lockedMesa });
                        return;
                      }
                      pickTheme(t.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      price
                        ? `${title}, ${themeDescs[t.id]}, ${price}`
                        : `${title}, ${themeDescs[t.id]}`
                    }
                    accessibilityState={{ selected: theme === t.id }}
                    style={[
                      cardStyle,
                      {
                        flexBasis: ROW_BASIS[columns.mesa],
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
                    <Text style={cardTitleStyle}>{title}</Text>
                    <Text style={cardDescStyle}>{themeDescs[t.id]}</Text>
                    {price ? (
                      <Text
                        style={priceTagStyle}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {price}
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
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {FICHAS_IDS.map((f) => {
                // Non-null when this skin is premium and not owned yet.
                const lockedFichas =
                  f !== "clasico" && !ent.fichas.has(f) ? f : null;
                const price = lockedFichas
                  ? prices.get(productIdForFichas(lockedFichas)) ??
                    s.priceUnknown
                  : null;
                return (
                  <Pressable
                    key={f}
                    onPress={() => {
                      if (lockedFichas) {
                        openStore({ fichas: lockedFichas });
                        return;
                      }
                      setSkinId(f);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      price ? `${fichasLabels[f]}, ${price}` : fichasLabels[f]
                    }
                    accessibilityState={{ selected: skinId === f }}
                    style={[
                      cardStyle,
                      {
                        flexBasis: ROW_BASIS[columns.fichas],
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
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {fichasLabels[f]}
                    </Text>
                    {price ? (
                      <Text
                        style={priceTagStyle}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        🔒 {price}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Mode (stacked at the largest text sizes, like the score pair) */}
          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>{s.mode}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pressable
                onPress={() => setIs2v2(false)}
                accessibilityRole="button"
                accessibilityLabel="1v1"
                accessibilityState={{ selected: !is2v2 }}
                style={[
                  cardStyle,
                  {
                    flexBasis: ROW_BASIS[columns.pair],
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
                accessibilityRole="button"
                accessibilityLabel={`2v2, ${s.conTuFrente}`}
                accessibilityState={{ selected: is2v2 }}
                style={[
                  cardStyle,
                  {
                    flexBasis: ROW_BASIS[columns.pair],
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
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pressable
                onPress={() => setTargetScore(100)}
                accessibilityRole="button"
                accessibilityLabel={s.score100}
                accessibilityState={{ selected: targetScore === 100 }}
                style={[
                  cardStyle,
                  {
                    flexBasis: ROW_BASIS[columns.pair],
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
                accessibilityRole="button"
                accessibilityLabel={s.score200}
                accessibilityState={{ selected: targetScore === 200 }}
                style={[
                  cardStyle,
                  {
                    flexBasis: ROW_BASIS[columns.pair],
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

          {/* Create: only a running request disables it; an empty name is
              flagged on tap instead */}
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={handleCreate}
              disabled={loading !== null}
              accessibilityRole="button"
              accessibilityLabel={s.createAction}
              accessibilityState={{
                disabled: loading !== null,
                busy: loading === "create",
              }}
              style={{
                backgroundColor: THEME.scoreBg,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                opacity: loading === "join" ? 0.4 : 1,
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
            {requestError?.action === "create" ? (
              <Text accessibilityLiveRegion="polite" style={requestErrorStyle}>
                {s[requestError.key]}
              </Text>
            ) : null}
          </View>

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
            {/* Kept to A-Z and 0-9 as typed (normalizeCode caps it at six,
                so no maxLength: it would cut a pasted "ABC-123" short).
                Return runs Join without dropping the keyboard, so a flagged
                field keeps focus. */}
            <TextInput
              ref={codeInputRef}
              value={inviteCode}
              onChangeText={editCode}
              onFocus={() => {
                codeFocusedRef.current = true;
                // Moving here from the name field keeps the keyboard up, so
                // no keyboardDidShow follows.
                if (Keyboard.isVisible()) {
                  scrollRef.current?.scrollToEnd({ animated: true });
                }
              }}
              onBlur={() => {
                codeFocusedRef.current = false;
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              returnKeyType="join"
              submitBehavior="submit"
              onSubmitEditing={handleJoin}
              placeholder="XXXXXX"
              placeholderTextColor="#9ca3af"
              accessibilityLabel={s.inviteCode}
              accessibilityHint={
                fieldErrors.code ? s[fieldErrors.code] : undefined
              }
              style={[
                inputStyle,
                {
                  textAlign: "center",
                  letterSpacing: 8,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                },
                fieldErrors.code ? invalidInputStyle : null,
              ]}
            />
            {fieldErrors.code ? (
              <Text accessibilityLiveRegion="polite" style={fieldErrorStyle}>
                {s[fieldErrors.code]}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            <Pressable
              onPress={handleJoin}
              disabled={loading !== null}
              accessibilityRole="button"
              accessibilityLabel={s.joinAction}
              accessibilityState={{
                disabled: loading !== null,
                busy: loading === "join",
              }}
              style={{
                borderWidth: 2,
                borderColor: THEME.scoreBg,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: "center",
                opacity: loading === "create" ? 0.4 : 1,
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
            {requestError?.action === "join" ? (
              <Text accessibilityLiveRegion="polite" style={requestErrorStyle}>
                {s[requestError.key]}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Sibling of the ScrollView so it pins to the bottom; zero height
          until an ad actually loads. */}
      <AdBanner />

      <StoreSheet
        visible={storeOpen}
        initialPreview={storePreview}
        onClose={closeStore}
        onPurchased={handlePurchased}
      />
    </SafeAreaView>
  );
}

// Store and language pills float over the scrolling form: opaque with a soft
// shadow so scrolled content never shows through them.
const floatingPillStyle = {
  position: "absolute" as const,
  zIndex: 10,
  backgroundColor: "#ffffff",
  borderRadius: 999,
  padding: 3,
  borderWidth: 1,
  borderColor: "#e5e7eb",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 3,
};

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

// Gray-500: 4.83:1 on a card, 4.63:1 on a selected one.
const cardDescStyle = {
  fontSize: 10,
  color: "#6b7280",
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

const invalidInputStyle = { borderColor: "#dc2626" };

// A field's own message, directly under it.
const fieldErrorStyle = {
  color: "#dc2626",
  fontSize: 13,
  fontWeight: "600" as const,
};

// A failed request, directly under the button that sent it.
const requestErrorStyle = {
  ...fieldErrorStyle,
  textAlign: "center" as const,
};
