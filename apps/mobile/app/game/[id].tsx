import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useKeepAwake } from "expo-keep-awake";
import type { Tile, Seat } from "@capi/engine";
import { getTeam } from "@capi/engine";
import { chatText, errorKeyFor, type ErrorKey } from "@capi/i18n";
import {
  useRealtimeGame,
  type ChatMessage,
} from "../../hooks/useRealtimeGame";
import AdBanner from "../../components/AdBanner";
import Board from "../../components/Board";
import BugReportButton from "../../components/BugReportButton";
import Hand from "../../components/Hand";
import QuickChat from "../../components/QuickChat";
import ScorePanel from "../../components/ScorePanel";
import TileDisplay from "../../components/TileDisplay";
import CalloutOverlay, {
  VeinticincoBanner,
} from "../../components/CalloutOverlay";
import { getSession, saveSession, type PlayerSession } from "../../lib/session";
import { useI18n } from "../../lib/i18n";
import {
  isMuted,
  loadMuteState,
  playCallout,
  playChatReceive,
  playDraw,
  playSlam,
  preloadSounds,
  setMuted,
} from "../../lib/sounds";
import { API_BASE, getTheme, THEME } from "../../theme";

interface ChatBubbleItem extends ChatMessage {
  phase: "in" | "out";
}

type Connection = "live" | "reconnecting" | "offline";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same palette as the landing picker. The join card takes the first color
// nobody at the table is using.
const AVATAR_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
];

// A seat that holds the turn and has been out of presence this long is
// shown as away.
const AWAY_AFTER_MS = 45_000;
const ERROR_FLASH_MS = 3500;
const LIVE_FLASH_MS = 2000;

function isSeat(v: unknown): v is Seat {
  return v === "n" || v === "e" || v === "s" || v === "w";
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

// Seats around the table relative to mine: partner across, opponents on the
// sides. Mirrors the web client so every player sees themselves at bottom.
function getRelativeSeats(mySeat: Seat): {
  top: Seat;
  left: Seat;
  right: Seat;
} {
  switch (mySeat) {
    case "n":
      return { top: "s", left: "w", right: "e" };
    case "e":
      return { top: "w", left: "n", right: "s" };
    case "s":
      return { top: "n", left: "e", right: "w" };
    case "w":
      return { top: "e", left: "s", right: "n" };
  }
}

// Join failures: known API messages map to their keys, anything else reads
// as a generic join failure rather than a move failure.
function joinErrorKeyFor(message: unknown): ErrorKey | "failedJoin" {
  const key = errorKeyFor(message);
  return key === "errMoveFailed" ? "failedJoin" : key;
}

// Screen wakelock while a round is live. A hook cannot be conditional, so the
// screen mounts this only while phase === "playing".
function KeepAwake() {
  useKeepAwake();
  return null;
}

export default function GameScreen() {
  const { id, p, seat } = useLocalSearchParams<{
    id: string;
    p?: string;
    seat?: string;
  }>();
  // Keyed by id: a rematch replaces the route with a new id, and a fresh
  // mount is the simplest guarantee that slam and chat refs, bubble timers
  // and transient pills never leak from one table into the next.
  return (
    <GameTable
      key={id}
      id={id}
      bootPlayerId={typeof p === "string" ? p : undefined}
      bootSeat={typeof seat === "string" ? seat : undefined}
    />
  );
}

function GameTable({
  id,
  bootPlayerId,
  bootSeat,
}: {
  id: string;
  bootPlayerId?: string;
  bootSeat?: string;
}) {
  const { s, lang } = useI18n();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<PlayerSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeShown, setCodeShown] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinErrorKey, setJoinErrorKey] = useState<
    ErrorKey | "failedJoin" | null
  >(null);
  const [nextRoundLoading, setNextRoundLoading] = useState(false);
  const [rematchLoading, setRematchLoading] = useState(false);
  // Tile picked in the hand but not yet placed (both ends fit with different
  // pips); the board pulses the ends it can go on.
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [muted, setMutedState] = useState(isMuted());
  const [chatBubbles, setChatBubbles] = useState<ChatBubbleItem[]>([]);
  // Failures raised by this screen (next round, rematch); the hook raises
  // move failures through errorKey.
  const [localErrorKey, setLocalErrorKey] = useState<ErrorKey | null>(null);
  const [liveFlash, setLiveFlash] = useState(false);
  const [awaySeat, setAwaySeat] = useState<Seat | null>(null);
  const [topRowHeight, setTopRowHeight] = useState(0);

  // Slam plays on board growth from any source: my optimistic play, a remote
  // play, the first tile of a round. The round index resets the baseline so
  // a fresh empty board is not read as shrinkage. Null until the first state
  // arrives, so rejoining a table mid-round is silent.
  const boardWatchRef = useRef<{ round: number; len: number } | null>(null);
  // Chat message IDs already turned into bubbles.
  const seenChatIdsRef = useRef<Set<string>>(new Set());
  // Timers per bubble so unmount can cancel them.
  const bubbleTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const localErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const copyTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevConnectionRef = useRef<Connection>("live");

  // Session: a stored one wins. Otherwise the deep link seats this device:
  // "Open in Capi" from the iMessage extension arrives as
  // capi://game/<id>?p=<playerId>&seat=<n|e|s|w>.
  useEffect(() => {
    let active = true;
    (async () => {
      let sess = await getSession(id);
      if (!sess && isUuid(bootPlayerId) && isSeat(bootSeat)) {
        sess = { playerId: bootPlayerId, seat: bootSeat, gameId: id };
        await saveSession(sess);
      }
      if (!active) return;
      setSession(sess);
      setSessionLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [id, bootPlayerId, bootSeat]);

  // Load the persisted mute preference, then warm the sound instances.
  useEffect(() => {
    let active = true;
    loadMuteState().then(() => {
      if (active) setMutedState(isMuted());
    });
    preloadSounds();
    return () => {
      active = false;
    };
  }, []);

  const {
    gameState,
    gameSettings,
    inviteCode,
    players,
    stateVersion,
    loading,
    errorKey,
    connection,
    presence,
    lastCallout,
    lastCalloutPayload,
    chatMessages,
    submitMove,
    sendChat,
    clearCallout,
    dismissChat,
    refetch,
  } = useRealtimeGame(id, session);

  // Single source for the slam sound: the board grew.
  useEffect(() => {
    if (!gameState) return;
    const len = gameState.board.length;
    const prev = boardWatchRef.current;
    if (prev) {
      const prevLen = prev.round === gameState.roundIndex ? prev.len : 0;
      if (len > prevLen) playSlam();
    }
    boardWatchRef.current = { round: gameState.roundIndex, len };
  }, [gameState]);

  // Callout fanfare, fired for the mid-round banner and the overlay alike.
  useEffect(() => {
    if (lastCallout) playCallout();
  }, [lastCallout]);

  // Spawn chat bubbles from incoming chatMessages.
  useEffect(() => {
    for (const msg of chatMessages) {
      if (seenChatIdsRef.current.has(msg.id)) continue;
      seenChatIdsRef.current.add(msg.id);

      // Play notification for opponent messages.
      if (!msg.isMe) {
        playChatReceive();
      }

      const bubble: ChatBubbleItem = { ...msg, phase: "in" };

      // Keep at most 3 bubbles; drop oldest if needed.
      setChatBubbles((prev) => [...prev, bubble].slice(-3));

      // Switch to fade-out after 2.5s.
      const fadeTimer = setTimeout(() => {
        setChatBubbles((prev) =>
          prev.map((b) => (b.id === msg.id ? { ...b, phase: "out" } : b))
        );
        // Remove after the fade animation completes.
        const removeTimer = setTimeout(() => {
          setChatBubbles((prev) => prev.filter((b) => b.id !== msg.id));
          bubbleTimersRef.current.delete(msg.id);
          bubbleTimersRef.current.delete(`${msg.id}-rm`);
          dismissChat(msg.id);
        }, 350);
        bubbleTimersRef.current.set(`${msg.id}-rm`, removeTimer);
      }, 2500);
      bubbleTimersRef.current.set(msg.id, fadeTimer);
    }
  }, [chatMessages, dismissChat]);

  // Cleanup every timer this screen owns on unmount.
  useEffect(() => {
    const bubbleTimers = bubbleTimersRef.current;
    const copyTimers = copyTimersRef.current;
    return () => {
      bubbleTimers.forEach((t) => clearTimeout(t));
      copyTimers.forEach((t) => clearTimeout(t));
      if (localErrorTimerRef.current) clearTimeout(localErrorTimerRef.current);
    };
  }, []);

  // Connection pill: visible while degraded, and for a moment after recovery
  // so the player sees the table come back.
  useEffect(() => {
    const prev = prevConnectionRef.current;
    prevConnectionRef.current = connection;
    if (connection !== "live") {
      setLiveFlash(false);
      return;
    }
    if (prev === "live") return;
    setLiveFlash(true);
    const t = setTimeout(() => setLiveFlash(false), LIVE_FLASH_MS);
    return () => clearTimeout(t);
  }, [connection]);

  // Away detection: the seat holding the turn has been out of presence for
  // AWAY_AFTER_MS without a break. Any presence flip or turn change restarts
  // the clock. My own seat never counts.
  const turnSeat: Seat | null =
    gameState?.phase === "playing" ? gameState.currentTurn : null;
  const turnPresent = turnSeat ? presence[turnSeat] === true : true;
  const sessionSeat = session?.seat ?? null;
  useEffect(() => {
    setAwaySeat(null);
    if (!turnSeat || turnPresent || turnSeat === sessionSeat) return;
    const t = setTimeout(() => setAwaySeat(turnSeat), AWAY_AFTER_MS);
    return () => clearTimeout(t);
  }, [turnSeat, turnPresent, sessionSeat]);

  const flashError = useCallback((key: ErrorKey) => {
    if (localErrorTimerRef.current) clearTimeout(localErrorTimerRef.current);
    setLocalErrorKey(key);
    localErrorTimerRef.current = setTimeout(() => {
      setLocalErrorKey(null);
      localErrorTimerRef.current = null;
    }, ERROR_FLASH_MS);
  }, []);

  const handlePlay = useCallback(
    async (tile: Tile, end: "left" | "right") => {
      if (!session) return;
      // The slam comes from the board-growth effect (optimistic update).
      // Haptics wait for the server: a dropped double-tap gives no physical
      // confirmation.
      const ok = await submitMove({ type: "play", tile, end });
      if (ok) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
          () => {}
        );
      }
    },
    [session, submitMove]
  );

  const handlePass = useCallback(() => {
    if (!session) return;
    void submitMove({ type: "pass" });
  }, [session, submitMove]);

  const handleDraw = useCallback(() => {
    if (!session) return;
    playDraw();
    void submitMove({ type: "draw" });
  }, [session, submitMove]);

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  }

  function confirmLeave() {
    Alert.alert(s.leaveTable, s.leaveConfirm, [
      { text: s.reportBugCancel, style: "cancel" },
      {
        text: s.leaveTable,
        style: "destructive",
        onPress: () => {
          if (router.canGoBack()) router.dismissAll();
          else router.replace("/");
        },
      },
    ]);
  }

  async function handleNextRound() {
    if (!session || !gameState) return;
    setNextRoundLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/games/${id}/next-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: session.playerId,
          stateVersion,
        }),
      });
      const data = await res.json().catch(() => ({}));
      // 409 = another player already advanced (or stale snapshot). That is a
      // success from the user's perspective, so just resync.
      if (res.ok || res.status === 409) {
        await refetch();
        return;
      }
      flashError(errorKeyFor(data.error));
    } catch {
      flashError("connectionError");
    } finally {
      setNextRoundLoading(false);
    }
  }

  async function handleRematch() {
    if (!session) return;
    setRematchLoading(true);
    let navigating = false;
    try {
      const res = await fetch(`${API_BASE}/api/games/${id}/rematch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: session.playerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.gameId) {
        flashError(errorKeyFor(data.error));
        return;
      }
      await saveSession({
        playerId: data.playerId,
        seat: data.seat,
        gameId: data.gameId,
      });
      navigating = true;
      router.replace(`/game/${data.gameId}`);
    } catch {
      flashError("connectionError");
    } finally {
      if (!navigating) setRematchLoading(false);
    }
  }

  async function handleJoin() {
    const nickname = joinName.trim();
    if (!nickname || joinLoading) return;
    setJoinLoading(true);
    setJoinErrorKey(null);
    const avatarColor =
      AVATAR_COLORS.find(
        (c) => !players.some((pl) => pl.avatar_color === c)
      ) ?? AVATAR_COLORS[0];
    try {
      const res = await fetch(`${API_BASE}/api/games/${id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, avatarColor }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.playerId || !isSeat(data.seat)) {
        setJoinErrorKey(joinErrorKeyFor(data.error));
        return;
      }
      const sess: PlayerSession = {
        playerId: data.playerId,
        seat: data.seat,
        gameId: id,
      };
      await saveSession(sess);
      setSession(sess);
      await refetch();
    } catch {
      setJoinErrorKey("connectionError");
    } finally {
      setJoinLoading(false);
    }
  }

  function trackTimer(t: ReturnType<typeof setTimeout>) {
    copyTimersRef.current.push(t);
  }

  async function copyInviteLink() {
    try {
      await Clipboard.setStringAsync(`${API_BASE}/?join=${id}`);
      setCopied(true);
      trackTimer(setTimeout(() => setCopied(false), 2000));
    } catch {
      /* code chip is the fallback */
    }
  }

  async function copyCode() {
    if (!inviteCode) return;
    try {
      await Clipboard.setStringAsync(inviteCode);
      setCodeCopied(true);
      trackTimer(
        setTimeout(() => {
          setCodeCopied(false);
          setCodeShown(false);
        }, 2000)
      );
    } catch {
      /* no-op */
    }
  }

  const seatLabels: Record<Seat, string> = {
    n: s.seatNorth,
    e: s.seatEast,
    s: s.seatSouth,
    w: s.seatWest,
  };

  // The edge swipe must not pop a live game; every other phase may go back.
  const screen = (
    <Stack.Screen
      options={{ gestureEnabled: gameState?.phase !== "playing" }}
    />
  );

  // ── Loading ──
  if (!sessionLoaded || (loading && !gameState)) {
    return (
      <>
        {screen}
        <View style={centerScreen}>
          <ActivityIndicator size="large" color={THEME.scoreBg} />
          <Text style={{ marginTop: 12, color: "#6b7280", fontSize: 14 }}>
            {s.loading}
          </Text>
        </View>
      </>
    );
  }

  // ── Error (no game) ──
  if (errorKey && !gameState) {
    return (
      <>
        {screen}
        <View style={centerScreen}>
          <Text style={{ color: "#dc2626", fontWeight: "500", fontSize: 16 }}>
            {s[errorKey]}
          </Text>
          <Pressable
            onPress={() => router.replace("/")}
            hitSlop={8}
            style={{ marginTop: 16 }}
          >
            <Text
              style={{
                color: "#4f46e5",
                textDecorationLine: "underline",
                fontSize: 14,
              }}
            >
              {s.backToHome}
            </Text>
          </Pressable>
        </View>
      </>
    );
  }

  // ── Waiting room ──
  if (!gameState || gameState.phase === "waiting") {
    // gameState is null until the game starts, so the mode comes from settings.
    const is2v2Waiting = gameSettings?.is2v2 ?? false;
    const maxPlayers = is2v2Waiting ? 4 : 2;
    const seatOrder: Seat[] = is2v2Waiting ? ["n", "e", "s", "w"] : ["n", "s"];
    const playersNeeded = maxPlayers - players.length;
    // No session for this table: a free seat gets a join card instead of the
    // share controls, which belong to people already seated.
    const canJoin = !session && playersNeeded > 0;
    const joinDisabled = !joinName.trim() || joinLoading;

    return (
      <>
        {screen}
        <SafeAreaView style={{ flex: 1, backgroundColor: THEME.pageBg }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <View style={waitingCard}>
              <Text style={{ fontSize: 40 }}>
                {is2v2Waiting ? "👥" : "🎲"}
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "900",
                  color: "#111827",
                  textAlign: "center",
                }}
              >
                {canJoin
                  ? s.joinTable
                  : playersNeeded > 0
                  ? s.waitingForPlayers(playersNeeded)
                  : s.preparing}
              </Text>
              {is2v2Waiting ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: "#4f46e5",
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                >
                  2v2 · {s.conTuFrente}
                </Text>
              ) : null}

              {/* Seat slots: one row in 1v1, 2x2 grid in 2v2 */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  width: "100%",
                }}
              >
                {seatOrder.map((seat) => {
                  const p = players.find((pl) => pl.seat === seat);
                  const isMe = !!p && p.id === session?.playerId;
                  return (
                    <View
                      key={seat}
                      style={{
                        flexBasis: "45%",
                        flexGrow: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderStyle: p ? "solid" : "dashed",
                        borderColor: p ? "#86efac" : "#d1d5db",
                        backgroundColor: p ? "#f0fdf4" : "#f9fafb",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: p?.avatar_color ?? "#e5e7eb",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: p ? "#fff" : "#9ca3af",
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {p?.nickname?.[0]?.toUpperCase() ?? "?"}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 13,
                          color: p ? "#1f2937" : "#9ca3af",
                          fontWeight: p ? "500" : "400",
                          flexShrink: 1,
                        }}
                        numberOfLines={1}
                      >
                        {p ? p.nickname : seatLabels[seat]}
                        {isMe ? `  ${s.youTag}` : ""}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {is2v2Waiting ? (
                <Text
                  style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}
                >
                  N-S: {s.team1} · E-W: {s.team2}
                </Text>
              ) : null}

              {canJoin ? (
                <View style={{ width: "100%", gap: 8 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {s.yourName}
                  </Text>
                  <TextInput
                    value={joinName}
                    onChangeText={setJoinName}
                    placeholder={s.joinNamePlaceholder}
                    placeholderTextColor="#9ca3af"
                    maxLength={20}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="join"
                    onSubmitEditing={handleJoin}
                    editable={!joinLoading}
                    style={joinInput}
                  />
                  <Pressable
                    onPress={handleJoin}
                    disabled={joinDisabled}
                    style={{
                      width: "100%",
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: THEME.scoreBg,
                      opacity: joinDisabled ? 0.4 : 1,
                    }}
                  >
                    {joinLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text
                        style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}
                      >
                        {s.joinTable}
                      </Text>
                    )}
                  </Pressable>
                  {joinErrorKey ? (
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#dc2626",
                        fontWeight: "600",
                        textAlign: "center",
                      }}
                    >
                      {s[joinErrorKey]}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <>
                  {/* Copy invite link */}
                  <Pressable
                    onPress={copyInviteLink}
                    style={{
                      width: "100%",
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: copied ? "#22c55e" : THEME.scoreBg,
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}
                    >
                      {copied ? `✓ ${s.copied}` : `🔗 ${s.copyLink}`}
                    </Text>
                  </Pressable>

                  {/* Code chip */}
                  {inviteCode ? (
                    <View style={{ alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                        {s.orShareCode}
                      </Text>
                      <Pressable
                        onPress={copyCode}
                        style={{
                          paddingHorizontal: 20,
                          paddingVertical: 8,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: "#e5e7eb",
                          backgroundColor: "#f9fafb",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 26,
                            fontWeight: "900",
                            letterSpacing: 8,
                            color: "#111827",
                            paddingLeft: 8,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {inviteCode}
                        </Text>
                      </Pressable>
                      {codeCopied ? (
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#16a34a",
                            fontWeight: "600",
                          }}
                        >
                          {s.codeCopied}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </>
              )}

              <View style={{ alignItems: "center", gap: 6 }}>
                <Text
                  style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}
                >
                  {s.autoRefresh}
                </Text>
                <Pressable onPress={() => refetch()} hitSlop={8}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#4f46e5",
                      fontWeight: "600",
                      textDecorationLine: "underline",
                    }}
                  >
                    {s.refresh}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
          {/* Waiting room is a calm screen; the active game below never gets
              a banner. */}
          <AdBanner />
        </SafeAreaView>
      </>
    );
  }

  // ── Active / round-over / finished ──
  const palette = getTheme(gameState.theme);
  const is2v2 = gameState.is2v2 ?? gameSettings?.is2v2 ?? false;
  // No session for a started table means watching, never a made-up seat.
  const mySeat: Seat | null = session ? (session.seat as Seat) : null;
  const spectating = mySeat === null;
  // Perspective the table is drawn from: my seat, or south for a spectator.
  const viewSeat: Seat = mySeat ?? "s";
  const myHand = mySeat ? gameState.hands[mySeat] ?? [] : [];
  const isMyTurn = mySeat !== null && gameState.currentTurn === mySeat;
  const board = gameState.board;
  const boardLeftEnd = board.length > 0 ? board[0][0] : -1;
  const boardRightEnd = board.length > 0 ? board[board.length - 1][1] : -1;
  // Only the ends this hand can actually play on light up.
  const playableEnds = {
    left: isMyTurn && myHand.some((t) => t[0] === boardLeftEnd || t[1] === boardLeftEnd),
    right: isMyTurn && myHand.some((t) => t[0] === boardRightEnd || t[1] === boardRightEnd),
  };

  // 1v1: single opponent across. 2v2: partner across, opponents on the sides.
  const relSeats = is2v2 ? getRelativeSeats(viewSeat) : null;
  const topSeat: Seat = relSeats ? relSeats.top : viewSeat === "n" ? "s" : "n";
  const topHand = gameState.hands[topSeat] ?? [];
  const leftSeat = relSeats?.left ?? null;
  const rightSeat = relSeats?.right ?? null;
  const leftHand = leftSeat ? gameState.hands[leftSeat] ?? [] : [];
  const rightHand = rightSeat ? gameState.hands[rightSeat] ?? [] : [];

  const viewPlayer = players.find((p) => p.seat === viewSeat);
  const topPlayer = players.find((p) => p.seat === topSeat);
  const leftPlayer = leftSeat
    ? players.find((p) => p.seat === leftSeat)
    : null;
  const rightPlayer = rightSeat
    ? players.find((p) => p.seat === rightSeat)
    : null;
  const turnPlayer = players.find((p) => p.seat === gameState.currentTurn);
  const turnName = turnPlayer?.nickname ?? seatLabels[gameState.currentTurn];

  const myBubbles = chatBubbles.filter((b) => b.isMe);
  const oppBubbles = chatBubbles.filter((b) => !b.isMe);

  const isRoundOver = gameState.phase === "round_over";
  const isFinished = gameState.phase === "finished";
  const isGameEnded = isRoundOver || isFinished;

  // Team the table is drawn from (mine, or N-S for a spectator) and the other.
  const viewTeam = getTeam(viewSeat, is2v2);
  const otherTeam: 0 | 1 = viewTeam === 0 ? 1 : 0;

  const payload = gameState.lastCalloutPayload ?? lastCalloutPayload;
  const roundWinnerTeam =
    payload && typeof payload.winningTeam === "number"
      ? (payload.winningTeam as number)
      : null;
  const roundWinnerKnown = roundWinnerTeam !== null;
  const iWonRound = !spectating && roundWinnerTeam === viewTeam;

  // Overlay/banner labels: both nicknames in 2v2, single nickname in 1v1.
  // Fallbacks: "you" for my own empty slot, seat names for a spectator.
  const viewSeatFallback = spectating ? seatLabels[viewSeat] : s.you;
  const viewTeamName = is2v2
    ? [viewPlayer?.nickname, topPlayer?.nickname].filter(Boolean).join(" & ") ||
      viewSeatFallback
    : viewPlayer?.nickname ?? viewSeatFallback;
  const otherTeamName = is2v2
    ? [leftPlayer?.nickname, rightPlayer?.nickname].filter(Boolean).join(" & ") ||
      s.opponent
    : topPlayer?.nickname ?? s.opponent;

  // Points credited this round (dominó/capicúa carry pipsAwarded [+bonus],
  // trancao carries pts) and who they went to, headlined in the round-over
  // modal so the pips table can't be misread as the score.
  const roundAward =
    (typeof payload?.pipsAwarded === "number"
      ? (payload.pipsAwarded as number)
      : typeof payload?.pts === "number"
      ? (payload.pts as number)
      : 0) +
    (typeof payload?.capicuaBonus === "number"
      ? (payload.capicuaBonus as number)
      : 0);
  const roundWinnerName =
    roundWinnerTeam === viewTeam ? viewTeamName : otherTeamName;
  const roundTitle =
    !roundWinnerKnown || spectating
      ? s.roundEnded
      : iWonRound
      ? s.wonRound
      : s.lostRound;
  const roundEmoji =
    !roundWinnerKnown || spectating ? "🎲" : iWonRound ? "🎉" : "😤";

  const winnerTeam = gameState.winnerTeam;
  const iWonGame = !spectating && winnerTeam === viewTeam;
  const winnerName =
    winnerTeam === null
      ? null
      : winnerTeam === viewTeam
      ? viewTeamName
      : otherTeamName;
  const finishedTitle = spectating
    ? winnerName ?? s.roundEnded
    : iWonGame
    ? s.won
    : s.lost;

  // Mid-round VEINTICINCO shows as a non-blocking banner so the forcer keeps
  // the board free for their next play. Round-ending callouts use the overlay.
  const isMidRoundCallout =
    lastCallout === "veinticinco" && gameState.phase === "playing";
  const bannerTeamName =
    roundWinnerTeam === null
      ? null
      : roundWinnerTeam === viewTeam
      ? viewTeamName
      : otherTeamName;

  const bannerKey = errorKey ?? localErrorKey;
  const connectionLabel =
    connection === "reconnecting"
      ? s.connectionReconnecting
      : connection === "offline"
      ? s.connectionOffline
      : liveFlash
      ? s.connectionLive
      : null;
  const awayPlayer = awaySeat
    ? players.find((p) => p.seat === awaySeat)
    : null;
  const awayName = awaySeat ? awayPlayer?.nickname ?? seatLabels[awaySeat] : "";
  // Transient pills sit just under the top hand row so they never cover the
  // opponent's name, and never take layout space from the board.
  const floatingTop = (isGameEnded ? 0 : topRowHeight) + 6;

  const stripText = {
    fontSize: 11,
    fontWeight: "600" as const,
    color: palette.scoreText,
    opacity: 0.6,
  };

  return (
    <>
      {screen}
      {gameState.phase === "playing" ? <KeepAwake /> : null}
      <View style={{ flex: 1, backgroundColor: palette.feltMid }}>
        {/* Score bar (top, respects notch). Long-press reveals the invite
            code for re-inviting a friend mid-game. */}
        <View
          style={{ paddingTop: insets.top, backgroundColor: palette.scoreBg }}
        >
          <Pressable
            onLongPress={() => setCodeShown((v) => !v)}
            delayLongPress={400}
          >
            <ScorePanel
              scores={gameState.scores}
              targetScore={gameState.targetScore}
              players={players}
              currentTurn={gameState.currentTurn}
              mySeat={mySeat ?? ""}
              is2v2={is2v2}
              bg={palette.scoreBg}
              textColor={palette.scoreText}
            />
          </Pressable>

          {/* Table strip: leave (left), connection (center), code (right) */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingBottom: 6,
              minHeight: 22,
            }}
          >
            <Pressable
              onPress={confirmLeave}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={s.leaveTable}
            >
              <Text style={stripText}>‹ {s.leaveTable}</Text>
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              {connectionLabel ? (
                <ConnectionPill label={connectionLabel} tone={connection} />
              ) : null}
            </View>
            {inviteCode ? (
              <Pressable
                onPress={codeShown ? copyCode : () => setCodeShown(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={s.inviteCode}
              >
                <Text
                  style={
                    codeShown && !codeCopied
                      ? {
                          fontSize: 12,
                          fontWeight: "900",
                          letterSpacing: 2,
                          color: palette.scoreText,
                          fontVariant: ["tabular-nums"],
                        }
                      : stripText
                  }
                >
                  {codeCopied
                    ? `✓ ${s.codeCopied}`
                    : codeShown
                    ? inviteCode
                    : `${s.inviteCode} ›`}
                </Text>
              </Pressable>
            ) : (
              <View />
            )}
          </View>
        </View>

        {/* Felt game area. The vertical gradient approximates the web's radial
            light pool (center glow fading to dark edges) */}
        <LinearGradient
          colors={[palette.feltCenter, palette.feltMid, palette.feltEdge]}
          locations={[0, 0.55, 1]}
          style={{ flex: 1 }}
        >
          {/* Table watermark, behind the board and all floating UI */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 0,
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

          {/* Transient notices: move errors and an away opponent. Absolute,
              so the board never shifts when they appear. */}
          {bannerKey || awaySeat ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: floatingTop,
                left: 12,
                right: 12,
                zIndex: 6,
                alignItems: "center",
                gap: 6,
              }}
            >
              {bannerKey ? (
                <View style={errorBanner}>
                  <Text
                    style={{ color: "#fff", fontSize: 13, textAlign: "center" }}
                  >
                    {s[bannerKey]}
                  </Text>
                </View>
              ) : null}
              {awaySeat ? (
                <View style={awayPill}>
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    {s.waitingFor(awayName)}
                  </Text>
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.75)",
                      fontSize: 11,
                      textAlign: "center",
                    }}
                  >
                    {s.awayHint}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Bottom-right utility cluster: mute + bug report */}
          <View
            style={{
              position: "absolute",
              right: 8,
              bottom: 8,
              zIndex: 3,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Pressable
              onPress={toggleMute}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={muted ? s.enableSound : s.muteSound}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.3)",
              }}
            >
              <Text style={{ fontSize: 15 }}>{muted ? "🔇" : "🔊"}</Text>
            </Pressable>
            <BugReportButton
              gameId={id}
              playerId={session?.playerId}
              gameState={gameState}
              stateVersion={stateVersion}
            />
          </View>

          {/* QuickChat toggle, floating bottom-left of the felt. Seated only:
              a spectator has no seat to speak from. */}
          {!isGameEnded && !spectating ? (
            <View
              style={{ position: "absolute", left: 8, bottom: 8, zIndex: 3 }}
            >
              <QuickChat onSend={sendChat} />
            </View>
          ) : null}

          {/* My chat bubbles, above the QuickChat button */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 8,
              bottom: 48,
              zIndex: 4,
              flexDirection: "column-reverse",
              gap: 6,
              alignItems: "flex-start",
              maxWidth: 180,
            }}
          >
            {myBubbles.map((b) => (
              <ChatBubble
                key={b.id}
                bubble={b}
                text={chatText(b.type, b.payload, lang)}
                accentColor={viewPlayer?.avatar_color ?? "#666"}
              />
            ))}
          </View>

          {/* Opponent chat bubbles, under the opponent hand row */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 8,
              top: 64,
              zIndex: 4,
              gap: 6,
              alignItems: "flex-start",
              maxWidth: 180,
            }}
          >
            {oppBubbles.map((b) => {
              const sender = players.find((p) => p.seat === b.seat);
              return (
                <ChatBubble
                  key={b.id}
                  bubble={b}
                  text={chatText(b.type, b.payload, lang)}
                  accentColor={sender?.avatar_color ?? "#666"}
                />
              );
            })}
          </View>

          {/* Top hand row (face-down): partner in 2v2, opponent in 1v1 */}
          {!isGameEnded ? (
            <View
              onLayout={(e) => setTopRowHeight(e.nativeEvent.layout.height)}
              style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: topPlayer?.avatar_color ?? "#999",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: gameState.currentTurn === topSeat ? 2 : 0,
                      borderColor: "#4ade80",
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}
                    >
                      {topPlayer?.nickname?.[0]?.toUpperCase() ?? "?"}
                    </Text>
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                    {topPlayer?.nickname ??
                      (spectating
                        ? seatLabels[topSeat]
                        : is2v2
                        ? s.partner
                        : s.opponent)}
                    {is2v2 && !spectating ? (
                      <Text style={{ color: "rgba(255,255,255,0.35)" }}>
                        {" "}
                        {s.partnerTag}
                      </Text>
                    ) : null}
                    {"  ·  "}
                    {s.tileCount(topHand.length)}
                  </Text>
                </View>
                {/* Boneyard indicator, 1v1 only (2v2 deals all 28 tiles) */}
                {!is2v2 && (gameState.boneyard?.length ?? 0) > 0 ? (
                  <Text
                    style={{
                      color: "rgba(252,211,77,0.85)",
                      fontSize: 12,
                      fontWeight: "500",
                    }}
                  >
                    {s.boneyard}: {gameState.boneyard.length}
                  </Text>
                ) : null}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  gap: 2,
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {topHand.map((_, i) => (
                  <TileDisplay key={i} tile={[0, 0]} small faceDown />
                ))}
              </View>
            </View>
          ) : null}

          {/* Board, flanked by opponent side rails in 2v2 */}
          {is2v2 && !isGameEnded ? (
            <View style={{ flex: 1, flexDirection: "row" }}>
              <SideRail
                player={leftPlayer}
                isActive={gameState.currentTurn === leftSeat}
                tileCount={leftHand.length}
                tilesLabel={s.tilesLabel}
              />
              <View style={{ flex: 1 }}>
                <Board
                  board={board}
                  endsGlow={isMyTurn}
                  playableEnds={playableEnds}
                  selectedTile={selectedTile}
                />
              </View>
              <SideRail
                player={rightPlayer}
                isActive={gameState.currentTurn === rightSeat}
                tileCount={rightHand.length}
                tilesLabel={s.tilesLabel}
              />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Board
                  board={board}
                  endsGlow={isMyTurn}
                  playableEnds={playableEnds}
                  selectedTile={selectedTile}
                />
            </View>
          )}

          {/* ── Callout overlays ── */}
          {lastCallout && isMidRoundCallout ? (
            <VeinticincoBanner teamName={bannerTeamName} onDone={clearCallout} />
          ) : null}
          {lastCallout && !isMidRoundCallout ? (
            <CalloutOverlay
              callout={lastCallout}
              payload={lastCalloutPayload}
              onDismiss={clearCallout}
            />
          ) : null}

          {/* ── Round Over overlay ── */}
          {isRoundOver && !lastCallout ? (
            <View style={overlayBackdrop}>
              <View
                style={[overlayCard, { backgroundColor: palette.scoreBg }]}
              >
                <Text style={{ fontSize: 48 }}>{roundEmoji}</Text>
                <Text style={[overlayTitle, { color: palette.scoreText }]}>
                  {roundTitle}
                </Text>

                {/* Points awarded, the headline. Without it the pips table
                    below reads like a scoreboard and the loser's counted pips
                    look like points credited to the loser. Hidden when the
                    winner is unknown rather than guessed. */}
                {roundWinnerKnown ? (
                  <View style={{ alignItems: "center" }}>
                    <Text
                      style={{
                        fontSize: 30,
                        fontWeight: "900",
                        color: palette.accent,
                      }}
                    >
                      +{roundAward}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: palette.scoreText,
                        opacity: 0.7,
                      }}
                    >
                      {s.awardedTo} {roundWinnerName}
                    </Text>
                  </View>
                ) : null}

                {/* Pip breakdown */}
                <View style={overlayInner}>
                  <Text
                    style={{
                      fontSize: 9,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: palette.scoreText,
                      opacity: 0.5,
                      textAlign: "center",
                      marginBottom: 2,
                    }}
                  >
                    {s.pipsInHand}
                  </Text>
                  <PipRow
                    name={viewTeamName}
                    value={pipFor(payload, viewTeam)}
                    color={palette.scoreText}
                  />
                  <PipRow
                    name={otherTeamName}
                    value={pipFor(payload, otherTeam)}
                    color={palette.scoreText}
                  />
                </View>

                {/* Score line */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                  }}
                >
                  <Text style={[bigScore, { color: palette.scoreText }]}>
                    {gameState.scores[viewTeam]}
                  </Text>
                  <Text style={{ color: palette.scoreText, opacity: 0.5 }}>
                    –
                  </Text>
                  <Text style={[bigScore, { color: palette.scoreText }]}>
                    {gameState.scores[otherTeam]}
                  </Text>
                </View>

                {spectating ? (
                  <SpectatingPill label={s.spectating} color={palette.accent} />
                ) : (
                  <Pressable
                    onPress={handleNextRound}
                    disabled={nextRoundLoading}
                    style={{
                      ...overlayButton,
                      backgroundColor: palette.accent,
                      opacity: nextRoundLoading ? 0.5 : 1,
                    }}
                  >
                    {nextRoundLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={overlayButtonText}>{s.nextRound}</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}

          {/* ── Game Over overlay ── */}
          {isFinished && !lastCallout ? (
            <View style={overlayBackdrop}>
              <View
                style={[overlayCard, { backgroundColor: palette.scoreBg }]}
              >
                <Text style={{ fontSize: 56 }}>
                  {iWonGame || spectating ? "🏆" : "💪"}
                </Text>
                <Text
                  style={[
                    overlayTitle,
                    { fontSize: 28, color: palette.scoreText },
                  ]}
                  numberOfLines={2}
                >
                  {finishedTitle}
                </Text>
                {!spectating ? (
                  <Text
                    style={{
                      fontSize: 13,
                      color: palette.scoreText,
                      opacity: 0.6,
                      textAlign: "center",
                    }}
                  >
                    {iWonGame ? s.wonFlavor : s.lostFlavor}
                  </Text>
                ) : null}

                <View style={overlayInner}>
                  <PipRow
                    name={viewTeamName}
                    value={String(gameState.scores[viewTeam])}
                    big
                    color={palette.scoreText}
                  />
                  <View
                    style={{
                      height: 1,
                      backgroundColor: "rgba(255,255,255,0.1)",
                    }}
                  />
                  <PipRow
                    name={otherTeamName}
                    value={String(gameState.scores[otherTeam])}
                    big
                    color={palette.scoreText}
                  />
                </View>

                {gameState.rematchGameId && !spectating ? (
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: palette.accent,
                      textAlign: "center",
                    }}
                  >
                    {s.rematchReady}
                  </Text>
                ) : null}

                {spectating ? (
                  <SpectatingPill label={s.spectating} color={palette.accent} />
                ) : (
                  <Pressable
                    onPress={handleRematch}
                    disabled={rematchLoading}
                    style={{
                      ...overlayButton,
                      backgroundColor: palette.accent,
                      opacity: rematchLoading ? 0.6 : 1,
                    }}
                  >
                    {rematchLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={overlayButtonText}>
                        {gameState.rematchGameId ? s.joinRematch : s.playAgain}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}
        </LinearGradient>

        {/* Bottom panel (respects home indicator): my hand, or the spectator
            strip when this device has no seat at the table. */}
        {isGameEnded ? null : mySeat ? (
          <View
            style={{
              backgroundColor: palette.handBg,
              paddingHorizontal: 12,
              paddingTop: 12,
              paddingBottom: Math.max(12, insets.bottom),
              borderTopWidth: isMyTurn ? 2 : 1,
              borderTopColor: isMyTurn ? palette.accent : "rgba(0,0,0,0.1)",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: palette.handText,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {s.yourHand}
              </Text>
              {isMyTurn ? (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: palette.accent,
                  }}
                >
                  {s.yourTurn}
                </Text>
              ) : null}
            </View>
            <Hand
              tiles={myHand}
              isMyTurn={isMyTurn}
              boardLeftEnd={boardLeftEnd}
              boardRightEnd={boardRightEnd}
              boneyardCount={gameState.boneyard?.length ?? 0}
              onPlay={handlePlay}
              onPass={handlePass}
              onDraw={handleDraw}
              onSelectionChange={setSelectedTile}
            />
          </View>
        ) : (
          <View
            style={{
              backgroundColor: palette.handBg,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: Math.max(12, insets.bottom),
              borderTopWidth: 1,
              borderTopColor: "rgba(0,0,0,0.1)",
              gap: 10,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <SpectatingPill label={s.spectating} color={palette.accent} />
              <Text
                style={{ flex: 1, fontSize: 12, color: palette.handText }}
                numberOfLines={2}
              >
                {s.spectatingHint}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 1,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: viewPlayer?.avatar_color ?? "#999",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: gameState.currentTurn === viewSeat ? 2 : 0,
                    borderColor: "#4ade80",
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}
                  >
                    {viewPlayer?.nickname?.[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 12, color: palette.handText, flexShrink: 1 }}
                  numberOfLines={1}
                >
                  {viewPlayer?.nickname ?? seatLabels[viewSeat]}
                  {"  ·  "}
                  {s.tileCount((gameState.hands[viewSeat] ?? []).length)}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: palette.accent,
                  flexShrink: 1,
                }}
                numberOfLines={1}
              >
                {s.turnOf(turnName)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </>
  );
}

function ConnectionPill({
  label,
  tone,
}: {
  label: string;
  tone: Connection;
}) {
  const dot =
    tone === "live" ? "#4ade80" : tone === "reconnecting" ? "#fbbf24" : "#f87171";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: "rgba(0,0,0,0.3)",
      }}
    >
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }}
      />
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}

function SpectatingPill({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: color,
      }}
    >
      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
        {label}
      </Text>
    </View>
  );
}

function ChatBubble({
  bubble,
  text,
  accentColor,
}: {
  bubble: ChatBubbleItem;
  text: string;
  accentColor: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (bubble.phase === "in") {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Finishes inside the 350ms removal window of the spawn effect.
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [bubble.phase, opacity, translateY]);

  if (bubble.type === "emote") {
    return (
      <Animated.Text
        style={{ fontSize: 30, opacity, transform: [{ translateY }] }}
      >
        {text}
      </Animated.Text>
    );
  }

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: accentColor,
        shadowColor: accentColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 13,
          fontWeight: "700",
          lineHeight: 17,
        }}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

// Narrow column flanking the board in 2v2: opponent avatar (turn ring when
// active), name, and a tile-count chip. Their hand stays hidden.
function SideRail({
  player,
  isActive,
  tileCount,
  tilesLabel,
}: {
  player?: { nickname: string; avatar_color: string } | null;
  isActive: boolean;
  tileCount: number;
  tilesLabel: string;
}) {
  return (
    <View
      style={{
        width: 52,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 8,
        zIndex: 2,
      }}
    >
      <View style={{ alignItems: "center", gap: 4 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: player?.avatar_color ?? "#999",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: isActive ? 2 : 0,
            borderColor: "#4ade80",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
            {player?.nickname?.[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
        <Text
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 9,
            fontWeight: "500",
            maxWidth: 50,
            textAlign: "center",
          }}
          numberOfLines={1}
        >
          {player?.nickname ?? "?"}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: "rgba(0,0,0,0.35)",
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 6,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "900",
            fontVariant: ["tabular-nums"],
          }}
        >
          {tileCount}
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 8,
            marginTop: 1,
          }}
        >
          {tilesLabel}
        </Text>
      </View>
    </View>
  );
}

function pipFor(
  payload: Record<string, unknown> | null,
  team: 0 | 1
): string {
  if (!payload || typeof payload.team0Pips !== "number") return "-";
  return String(team === 0 ? payload.team0Pips : payload.team1Pips);
}

function PipRow({
  name,
  value,
  suffix,
  big,
  color = THEME.scoreText,
}: {
  name: string;
  value: string;
  suffix?: string;
  big?: boolean;
  color?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color,
          fontSize: big ? 14 : 13,
          flexShrink: 1,
          marginRight: 8,
        }}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text
        style={{
          color,
          fontWeight: big ? "900" : "700",
          fontSize: big ? 22 : 13,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
        {suffix ? ` ${suffix}` : ""}
      </Text>
    </View>
  );
}

const centerScreen = {
  flex: 1,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  backgroundColor: THEME.pageBg,
};

const waitingCard = {
  backgroundColor: "#ffffff",
  borderRadius: 24,
  padding: 28,
  maxWidth: 360,
  width: "100%" as const,
  alignItems: "center" as const,
  gap: 16,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 16,
  elevation: 4,
};

const joinInput = {
  width: "100%" as const,
  borderWidth: 1,
  borderColor: "#e5e7eb",
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 16,
  color: "#111827",
  backgroundColor: "#f9fafb",
};

const errorBanner = {
  backgroundColor: "rgba(239,68,68,0.92)",
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 12,
  maxWidth: 320,
};

const awayPill = {
  backgroundColor: "rgba(0,0,0,0.55)",
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 14,
  maxWidth: 300,
  alignItems: "center" as const,
  gap: 2,
};

const overlayBackdrop = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.65)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  zIndex: 10,
  padding: 24,
};

const overlayCard = {
  backgroundColor: THEME.scoreBg,
  borderRadius: 24,
  padding: 28,
  maxWidth: 320,
  width: "100%" as const,
  alignItems: "center" as const,
  gap: 16,
};

const overlayInner = {
  width: "100%" as const,
  backgroundColor: "rgba(255,255,255,0.1)",
  borderRadius: 12,
  padding: 12,
  gap: 6,
};

const overlayTitle = {
  fontSize: 22,
  fontWeight: "900" as const,
  color: THEME.scoreText,
  textAlign: "center" as const,
};

const bigScore = {
  fontSize: 26,
  fontWeight: "900" as const,
  color: THEME.scoreText,
  fontVariant: ["tabular-nums" as const],
};

const overlayButton = {
  width: "100%" as const,
  paddingVertical: 14,
  borderRadius: 12,
  backgroundColor: THEME.accent,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const overlayButtonText = {
  color: "#fff",
  fontSize: 16,
  fontWeight: "700" as const,
};
