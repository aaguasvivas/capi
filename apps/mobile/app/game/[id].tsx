import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import type { Tile, Seat } from "@capi/engine";
import { getTeam } from "@capi/engine";
import {
  useRealtimeGame,
  type ChatMessage,
} from "../../hooks/useRealtimeGame";
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
import { API_BASE, THEME } from "../../theme";

interface ChatBubbleItem extends ChatMessage {
  phase: "in" | "out";
}

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { s } = useI18n();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<PlayerSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [nextRoundLoading, setNextRoundLoading] = useState(false);
  const [rematchLoading, setRematchLoading] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [chatBubbles, setChatBubbles] = useState<ChatBubbleItem[]>([]);

  // Detect opponent's plays (board grew without our local move) to play slam.
  const prevBoardLenRef = useRef(0);
  // Chat message IDs already turned into bubbles.
  const seenChatIdsRef = useRef<Set<string>>(new Set());
  // Timers per bubble so unmount can cancel them.
  const bubbleTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  useEffect(() => {
    let active = true;
    getSession(id).then((sess) => {
      if (!active) return;
      setSession(sess);
      setSessionLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [id]);

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
    error,
    lastCallout,
    lastCalloutPayload,
    chatMessages,
    submitMove,
    sendChat,
    clearCallout,
    dismissChat,
    refetch,
  } = useRealtimeGame(id, session);

  // Opponent slam: board grew from a remote update.
  useEffect(() => {
    if (!gameState) return;
    const len = gameState.board.length;
    if (prevBoardLenRef.current > 0 && len > prevBoardLenRef.current) {
      playSlam();
    }
    prevBoardLenRef.current = len;
  }, [gameState]);

  // Callout fanfare — fires for the mid-round banner and the overlay alike.
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

  // Cleanup bubble timers on unmount.
  useEffect(() => {
    const timers = bubbleTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const handlePlay = useCallback(
    (tile: Tile, end: "left" | "right") => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      playSlam();
      submitMove({ type: "play", tile, end });
    },
    [submitMove]
  );

  const handlePass = useCallback(() => {
    submitMove({ type: "pass" });
  }, [submitMove]);

  const handleDraw = useCallback(() => {
    playDraw();
    submitMove({ type: "draw" });
  }, [submitMove]);

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
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
      if (!res.ok) {
        // 409 = another player already advanced (or stale snapshot). That's a
        // success from the user's perspective — just resync.
        if (res.status === 409) {
          await refetch();
        }
        // Other errors: silently leave the overlay; realtime will resync.
      } else {
        await refetch();
      }
    } catch {
      /* connection error — overlay stays, realtime resyncs */
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
      if (res.ok && data.gameId) {
        await saveSession({
          playerId: data.playerId,
          seat: data.seat,
          gameId: data.gameId,
        });
        navigating = true;
        router.replace(`/game/${data.gameId}`);
      }
    } catch {
      /* leave button re-enabled on failure */
    } finally {
      if (!navigating) setRematchLoading(false);
    }
  }

  async function copyInviteLink() {
    try {
      await Clipboard.setStringAsync(`${API_BASE}/?join=${id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* code chip is the fallback */
    }
  }

  async function copyCode() {
    if (!inviteCode) return;
    try {
      await Clipboard.setStringAsync(inviteCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      /* no-op */
    }
  }

  // ── Loading ──
  if (!sessionLoaded || (loading && !gameState)) {
    return (
      <View style={centerScreen}>
        <ActivityIndicator size="large" color={THEME.scoreBg} />
        <Text style={{ marginTop: 12, color: "#6b7280", fontSize: 14 }}>
          {s.loading}
        </Text>
      </View>
    );
  }

  // ── Error (no game) ──
  if (error && !gameState) {
    return (
      <View style={centerScreen}>
        <Text style={{ color: "#dc2626", fontWeight: "500", fontSize: 16 }}>
          {error}
        </Text>
        <Pressable onPress={() => router.replace("/")} style={{ marginTop: 16 }}>
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
    );
  }

  // ── Waiting room ──
  if (!gameState || gameState.phase === "waiting") {
    const seatOrder: Seat[] = ["n", "s"];
    const seatLabels: Record<string, string> = {
      n: s.seatNorth,
      s: s.seatSouth,
    };
    const playersNeeded = 2 - players.length;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: THEME.pageBg }}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View style={waitingCard}>
            <Text style={{ fontSize: 40 }}>🎲</Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "900",
                color: "#111827",
                textAlign: "center",
              }}
            >
              {playersNeeded > 0
                ? s.waitingForPlayers(playersNeeded)
                : s.preparing}
            </Text>

            {/* Seat slots */}
            <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
              {seatOrder.map((seat) => {
                const p = players.find((pl) => pl.seat === seat);
                const isMe = p?.id === session?.playerId;
                return (
                  <View
                    key={seat}
                    style={{
                      flex: 1,
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
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
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

            <Text
              style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}
            >
              {s.autoRefresh}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Active / round-over / finished ──
  const mySeat = (session?.seat ?? "n") as Seat;
  const oppSeat: Seat = mySeat === "n" ? "s" : "n";
  const myHand = gameState.hands[mySeat] ?? [];
  const oppHand = gameState.hands[oppSeat] ?? [];
  const isMyTurn = gameState.currentTurn === mySeat;
  const board = gameState.board;
  const boardLeftEnd = board.length > 0 ? board[0][0] : -1;
  const boardRightEnd = board.length > 0 ? board[board.length - 1][1] : -1;

  const myPlayer = players.find((p) => p.seat === mySeat);
  const oppPlayer = players.find((p) => p.seat === oppSeat);

  const myBubbles = chatBubbles.filter((b) => b.isMe);
  const oppBubbles = chatBubbles.filter((b) => !b.isMe);

  const isRoundOver = gameState.phase === "round_over";
  const isFinished = gameState.phase === "finished";
  const isGameEnded = isRoundOver || isFinished;

  const myTeam = getTeam(mySeat, false);
  const oppTeam: 0 | 1 = myTeam === 0 ? 1 : 0;

  const payload = gameState.lastCalloutPayload ?? lastCalloutPayload;
  const roundWinnerTeam =
    payload && typeof payload.winningTeam === "number"
      ? (payload.winningTeam as number)
      : null;
  const iWonRound = roundWinnerTeam === myTeam;

  const myTeamName = myPlayer?.nickname ?? s.youTag;
  const oppTeamName = oppPlayer?.nickname ?? s.opponent;

  // Mid-round VEINTICINCO shows as a non-blocking banner so the forcer keeps
  // the board free for their next play. Round-ending callouts use the overlay.
  const isMidRoundCallout =
    lastCallout === "veinticinco" && gameState.phase === "playing";
  const bannerTeamName =
    roundWinnerTeam === null
      ? null
      : roundWinnerTeam === myTeam
      ? myTeamName
      : oppTeamName;

  return (
    <View style={{ flex: 1, backgroundColor: THEME.feltMid }}>
      {/* Score bar (top, respects notch) */}
      <View style={{ paddingTop: insets.top, backgroundColor: THEME.scoreBg }}>
        <ScorePanel
          scores={gameState.scores}
          targetScore={gameState.targetScore}
          players={players}
          currentTurn={gameState.currentTurn}
          mySeat={mySeat}
          is2v2={false}
        />
      </View>

      {/* Transient error banner */}
      {error ? (
        <View
          style={{
            backgroundColor: "rgba(239,68,68,0.92)",
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{ color: "#fff", fontSize: 13, textAlign: "center" }}
          >
            {error}
          </Text>
        </View>
      ) : null}

      {/* Felt game area */}
      <View style={{ flex: 1, backgroundColor: THEME.feltMid }}>
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

        {/* QuickChat toggle — floats bottom-left of the felt */}
        {!isGameEnded ? (
          <View
            style={{ position: "absolute", left: 8, bottom: 8, zIndex: 3 }}
          >
            <QuickChat onSend={sendChat} />
          </View>
        ) : null}

        {/* My chat bubbles — above the QuickChat button */}
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
              accentColor={myPlayer?.avatar_color ?? "#666"}
            />
          ))}
        </View>

        {/* Opponent chat bubbles — under the opponent hand row */}
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
                accentColor={sender?.avatar_color ?? "#666"}
              />
            );
          })}
        </View>

        {/* Opponent hand row (face-down) */}
        {!isGameEnded ? (
          <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }}>
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
                    backgroundColor: oppPlayer?.avatar_color ?? "#999",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: gameState.currentTurn === oppSeat ? 2 : 0,
                    borderColor: "#4ade80",
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}
                  >
                    {oppPlayer?.nickname?.[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                  {oppPlayer?.nickname ?? s.opponent}
                  {"  ·  "}
                  {s.tileCount(oppHand.length)}
                </Text>
              </View>
              {(gameState.boneyard?.length ?? 0) > 0 ? (
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
              {oppHand.map((_, i) => (
                <TileDisplay key={i} tile={[0, 0]} small faceDown />
              ))}
            </View>
          </View>
        ) : null}

        {/* Board */}
        <View style={{ flex: 1 }}>
          <Board board={board} endsGlow={isMyTurn} />
        </View>

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
            <View style={overlayCard}>
              <Text style={{ fontSize: 48 }}>{iWonRound ? "🎉" : "😤"}</Text>
              <Text style={overlayTitle}>
                {iWonRound ? s.wonRound : s.lostRound}
              </Text>

              {/* Pip breakdown */}
              <View style={overlayInner}>
                <PipRow
                  name={myTeamName}
                  value={pipFor(payload, myTeam)}
                  suffix={s.pips}
                />
                <PipRow
                  name={oppTeamName}
                  value={pipFor(payload, oppTeam)}
                  suffix={s.pips}
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
                <Text style={bigScore}>{gameState.scores[myTeam]}</Text>
                <Text style={{ color: THEME.scoreText, opacity: 0.5 }}>–</Text>
                <Text style={bigScore}>{gameState.scores[oppTeam]}</Text>
              </View>

              <Pressable
                onPress={handleNextRound}
                disabled={nextRoundLoading}
                style={{
                  ...overlayButton,
                  opacity: nextRoundLoading ? 0.5 : 1,
                }}
              >
                {nextRoundLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={overlayButtonText}>{s.nextRound}</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ── Game Over overlay ── */}
        {isFinished && !lastCallout ? (
          <View style={overlayBackdrop}>
            <View style={overlayCard}>
              <Text style={{ fontSize: 56 }}>
                {gameState.winnerTeam === myTeam ? "🏆" : "💪"}
              </Text>
              <Text style={[overlayTitle, { fontSize: 28 }]}>
                {gameState.winnerTeam === myTeam ? s.won : s.lost}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: THEME.scoreText,
                  opacity: 0.6,
                  textAlign: "center",
                }}
              >
                {gameState.winnerTeam === myTeam ? s.wonFlavor : s.lostFlavor}
              </Text>

              <View style={overlayInner}>
                <PipRow
                  name={myTeamName}
                  value={String(gameState.scores[myTeam])}
                  big
                />
                <View
                  style={{
                    height: 1,
                    backgroundColor: "rgba(255,255,255,0.1)",
                  }}
                />
                <PipRow
                  name={oppTeamName}
                  value={String(gameState.scores[oppTeam])}
                  big
                />
              </View>

              <Pressable
                onPress={handleRematch}
                disabled={rematchLoading}
                style={{
                  ...overlayButton,
                  opacity: rematchLoading ? 0.6 : 1,
                }}
              >
                {rematchLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={overlayButtonText}>{s.playAgain}</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* My hand (bottom, respects home indicator) */}
      {!isGameEnded ? (
        <View
          style={{
            backgroundColor: THEME.handBg,
            paddingHorizontal: 12,
            paddingTop: 12,
            paddingBottom: Math.max(12, insets.bottom),
            borderTopWidth: isMyTurn ? 2 : 1,
            borderTopColor: isMyTurn ? THEME.accent : "rgba(0,0,0,0.1)",
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
                color: "#6b7280",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {s.yourHand}
            </Text>
            {isMyTurn ? (
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: THEME.accent }}
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
          />
        </View>
      ) : null}
    </View>
  );
}

function ChatBubble({
  bubble,
  accentColor,
}: {
  bubble: ChatBubbleItem;
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
        {bubble.payload}
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
        {bubble.payload}
      </Text>
    </Animated.View>
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
}: {
  name: string;
  value: string;
  suffix?: string;
  big?: boolean;
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
          color: THEME.scoreText,
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
          color: THEME.scoreText,
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
