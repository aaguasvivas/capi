"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRealtimeGame } from "@/hooks/useRealtimeGame";
import type { ChatMessage } from "@/hooks/useRealtimeGame";
import Board from "@/components/game/Board";
import Hand from "@/components/game/Hand";
import ScorePanel from "@/components/game/ScorePanel";
import CalloutOverlay from "@/components/game/CalloutOverlay";
import TileDisplay from "@/components/game/TileDisplay";
import QuickChat from "@/components/game/QuickChat";
import type { Tile } from "@/lib/engine/types";
import {
  playSlam,
  playDraw as playDrawSound,
  playCallout,
  playChatReceive,
  isMuted,
  setMuted,
  loadMuteState,
  preloadSounds,
} from "@/lib/sounds";

interface Session {
  playerId: string;
  seat: string;
  gameId: string;
}

interface Toast {
  id: number;
  message: string;
  phase: "in" | "out";
}

interface ChatBubble extends ChatMessage {
  phase: "in" | "out";
}

let toastId = 0;

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [copied, setCopied] = useState(false);
  const [muted, setMutedState] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [nextRoundLoading, setNextRoundLoading] = useState(false);
  const [chatBubbles, setChatBubbles] = useState<ChatBubble[]>([]);

  // Track which chat message IDs we've already displayed
  const seenChatIdsRef = useRef<Set<string>>(new Set());
  // Timer refs per bubble for cleanup
  const bubbleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Refs for detecting changes
  const prevBoardLenRef = useRef(0);
  const prevOppHandLenRef = useRef(-1);

  useEffect(() => {
    loadMuteState();
    setMutedState(isMuted());
    preloadSounds();
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(`capi_session_${id}`);
    if (raw) {
      try {
        setSession(JSON.parse(raw));
      } catch {
        router.push("/");
      }
    }
  }, [id, router]);

  const {
    gameState,
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
  } = useRealtimeGame(id, session);

  const showToast = useCallback((message: string) => {
    const tid = ++toastId;
    setToasts((prev) => [...prev, { id: tid, message, phase: "in" }]);
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === tid ? { ...t, phase: "out" } : t))
      );
    }, 2000);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== tid));
    }, 2300);
  }, []);

  // Spawn chat bubbles from incoming chatMessages
  useEffect(() => {
    for (const msg of chatMessages) {
      if (seenChatIdsRef.current.has(msg.id)) continue;
      seenChatIdsRef.current.add(msg.id);

      // Play notification for opponent messages
      if (!msg.isMe) {
        playChatReceive();
      }

      const bubble: ChatBubble = { ...msg, phase: "in" };

      setChatBubbles((prev) => {
        // Keep at most 3 bubbles; drop oldest if needed
        const next = [...prev, bubble].slice(-3);
        return next;
      });

      // Switch to fade-out after 2.5s
      const fadeTimer = setTimeout(() => {
        setChatBubbles((prev) =>
          prev.map((b) => (b.id === msg.id ? { ...b, phase: "out" } : b))
        );
        // Remove after animation completes
        const removeTimer = setTimeout(() => {
          setChatBubbles((prev) => prev.filter((b) => b.id !== msg.id));
          bubbleTimersRef.current.delete(msg.id);
        }, 350);
        bubbleTimersRef.current.set(`${msg.id}-rm`, removeTimer);
      }, 2500);
      bubbleTimersRef.current.set(msg.id, fadeTimer);
    }
  }, [chatMessages]);

  // Cleanup bubble timers on unmount
  useEffect(() => {
    return () => {
      bubbleTimersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  function handlePlay(tile: Tile, end: "left" | "right") {
    playSlam();
    submitMove({ type: "play", tile, end });
  }

  function handlePass() {
    submitMove({ type: "pass" });
  }

  function handleDraw() {
    playDrawSound();
    submitMove({ type: "draw" });
  }

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  }

  async function handleNextRound() {
    if (!session || !gameState) return;
    setNextRoundLoading(true);
    try {
      const res = await fetch(`/api/games/${id}/next-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: session.playerId,
          stateVersion,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error ?? "Error starting next round");
      }
    } catch {
      showToast("Connection error");
    } finally {
      setNextRoundLoading(false);
    }
  }

  // Detect board changes (opponent played) to play slam sound
  useEffect(() => {
    if (!gameState) return;
    const boardLen = gameState.board.length;
    if (prevBoardLenRef.current > 0 && boardLen > prevBoardLenRef.current) {
      playSlam();
    }
    prevBoardLenRef.current = boardLen;
  }, [gameState?.board.length, gameState]);

  // Detect opponent drawing tiles to show toast
  useEffect(() => {
    if (!gameState || !session) return;
    const oppSeat = session.seat === "n" ? "s" : "n";
    const oppHand =
      gameState.hands[oppSeat as keyof typeof gameState.hands] ?? [];
    const oppLen = oppHand.length;
    if (prevOppHandLenRef.current >= 0 && oppLen > prevOppHandLenRef.current) {
      const drew = oppLen - prevOppHandLenRef.current;
      showToast(
        `Oponente jaló ${drew} ficha${drew !== 1 ? "s" : ""}`
      );
    }
    prevOppHandLenRef.current = oppLen;
  }, [gameState, session, showToast]);

  // Play callout sound when a callout appears
  useEffect(() => {
    if (lastCallout) {
      playCallout();
    }
  }, [lastCallout]);

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Cargando…</p>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error && !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
        <div className="text-center space-y-3">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-indigo-600 underline"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // --- Waiting for opponent ---
  if (!gameState || gameState.phase === "waiting") {
    return (
      <div
        data-theme="barberia"
        className="min-h-screen flex items-center justify-center bg-theme-page p-4"
      >
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">🎲</div>
          <h2 className="text-lg font-black text-gray-900">
            Esperando oponente…
          </h2>
          <p className="text-sm text-gray-500">Comparte este enlace:</p>
          <button
            onClick={async () => {
              const inviteUrl = `${window.location.origin}?join=${id}`;
              await navigator.clipboard.writeText(inviteUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="w-full px-4 py-3 bg-gray-100 rounded-xl text-sm font-mono text-gray-700 hover:bg-gray-200 transition-colors active:scale-[0.98]"
          >
            {copied
              ? "¡Copiado!"
              : `${window.location.origin}?join=${id}`}
          </button>
          <p className="text-xs text-gray-400">
            La página se actualizará cuando se unan.
          </p>
        </div>
      </div>
    );
  }

  // --- Active game ---
  const mySeat = session?.seat ?? "n";
  const myHand =
    gameState.hands[mySeat as keyof typeof gameState.hands] ?? [];
  const isMyTurn = gameState.currentTurn === mySeat;
  const board = gameState.board;
  const boardLeftEnd = board.length > 0 ? board[0][0] : -1;
  const boardRightEnd =
    board.length > 0 ? board[board.length - 1][1] : -1;

  const oppSeat = mySeat === "n" ? "s" : "n";
  const oppPlayer = players.find(
    (p: { seat: string }) => p.seat === oppSeat
  );
  const oppHand =
    gameState.hands[oppSeat as keyof typeof gameState.hands] ?? [];
  const myPlayer = players.find(
    (p: { seat: string }) => p.seat === mySeat
  );

  const isRoundOver = gameState.phase === "round_over";
  const isFinished = gameState.phase === "finished";
  const isGameEnded = isRoundOver || isFinished;

  const myTeam = mySeat === "n" ? 0 : 1;
  const oppTeam = mySeat === "n" ? 1 : 0;

  const payload = gameState.lastCalloutPayload ?? lastCalloutPayload;
  const roundWinnerTeam =
    payload && typeof payload.winningTeam === "number"
      ? payload.winningTeam
      : typeof payload?.winnerTeam === "number"
        ? payload.winnerTeam
        : null;
  const iWonRound = roundWinnerTeam === myTeam;

  // Split bubbles by sender position for layout
  const myBubbles = chatBubbles.filter((b) => b.isMe);
  const oppBubbles = chatBubbles.filter((b) => !b.isMe);

  return (
    <div
      data-theme={gameState.theme}
      className="min-h-screen min-h-[100dvh] flex flex-col bg-theme-page theme-pattern"
    >
      {/* Callout overlay */}
      {lastCallout && (
        <CalloutOverlay
          callout={lastCallout}
          payload={lastCalloutPayload}
          onDismiss={clearCallout}
        />
      )}

      {/* Toasts */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-xl bg-black/80 text-white text-sm font-medium shadow-lg ${
              t.phase === "in" ? "animate-toast-in" : "animate-toast-out"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Score bar */}
      <ScorePanel
        scores={gameState.scores}
        targetScore={gameState.targetScore}
        players={players}
        currentTurn={gameState.currentTurn}
        mySeat={mySeat}
      />

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/90 px-4 py-2 text-sm text-white text-center">
          {error}
        </div>
      )}

      {/* Main game area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Board felt area */}
        <div className="flex-1 flex flex-col relative min-h-0 theme-felt">
          {/* Light temperature + vignette overlay */}
          <div className="absolute inset-0 theme-light pointer-events-none z-[1]" />

          {/* Mute toggle — floats on board bottom-right */}
          <button
            onClick={toggleMute}
            className="absolute bottom-2 right-2 z-[3] w-8 h-8 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition-colors text-white/70 hover:text-white text-sm"
            title={muted ? "Activar sonido" : "Silenciar"}
          >
            {muted ? "🔇" : "🔊"}
          </button>

          {/* QuickChat toggle — floats on board bottom-left */}
          {!isGameEnded && (
            <div className="absolute bottom-2 left-2 z-[3]">
              <QuickChat
                onSend={sendChat}
                disabled={false}
              />
            </div>
          )}

          {/* My chat bubbles — above QuickChat button, left side */}
          <div className="absolute bottom-12 left-2 z-[4] flex flex-col-reverse gap-1.5 items-start max-w-[180px]">
            {myBubbles.map((b) => (
              <ChatBubbleDisplay
                key={b.id}
                bubble={b}
                accentColor={myPlayer?.avatar_color ?? "#6366f1"}
              />
            ))}
          </div>

          {/* Opponent chat bubbles — near opponent hand, left side */}
          <div className="absolute top-14 left-2 z-[4] flex flex-col gap-1.5 items-start max-w-[180px]">
            {oppBubbles.map((b) => (
              <ChatBubbleDisplay
                key={b.id}
                bubble={b}
                accentColor={oppPlayer?.avatar_color ?? "#999"}
              />
            ))}
          </div>

          {/* Location watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
            <p className="text-white/[0.05] text-2xl sm:text-3xl font-black tracking-[0.25em] uppercase -rotate-2">
              {gameState.theme === "barberia" && "BARBERÍA DON RAMÓN"}
              {gameState.theme === "colmado" && "COLMADO LA ESQUINA"}
              {gameState.theme === "patio" && "EL PATIO DE TÍA"}
            </p>
          </div>

          {/* Opponent hand (face-down tiles) */}
          {!isGameEnded && (
            <div className="px-3 sm:px-4 pt-2 sm:pt-3 pb-1 flex-shrink-0 z-[2]">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                    style={{
                      backgroundColor:
                        oppPlayer?.avatar_color ?? "#999",
                    }}
                  >
                    {oppPlayer?.nickname?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span className="text-white/60 text-xs font-medium truncate">
                    {oppPlayer?.nickname ?? "Oponente"} —{" "}
                    {oppHand.length} ficha
                    {oppHand.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {(gameState.boneyard?.length ?? 0) > 0 && (
                  <span className="text-amber-300/80 text-xs font-medium flex-shrink-0">
                    Pozo: {gameState.boneyard.length}
                  </span>
                )}
              </div>
              <div className="flex gap-0.5 overflow-hidden">
                {oppHand.map((_: Tile, i: number) => (
                  <TileDisplay
                    key={i}
                    tile={[0, 0]}
                    small
                    faceDown
                  />
                ))}
              </div>
            </div>
          )}

          {/* Board */}
          <Board board={board} />

          {/* ── Round Over overlay ── */}
          {isRoundOver && !lastCallout && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <div className="bg-[var(--score-bg)] text-[var(--score-text)] rounded-2xl p-6 sm:p-8 text-center max-w-xs w-full mx-6 shadow-2xl animate-callout-enter space-y-4">
                <p className="text-5xl">{iWonRound ? "🎉" : "😤"}</p>
                <h2 className="text-2xl font-black">
                  {iWonRound
                    ? "¡Ganaste la ronda!"
                    : "Perdiste la ronda"}
                </h2>

                {/* Pip breakdown */}
                <div className="bg-white/10 rounded-xl p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{myPlayer?.nickname ?? "Tú"}</span>
                    <span className="font-bold tabular-nums">
                      {typeof payload?.team0Pips === "number"
                        ? myTeam === 0
                          ? String(payload.team0Pips)
                          : String(payload.team1Pips)
                        : "—"}{" "}
                      pips
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{oppPlayer?.nickname ?? "Oponente"}</span>
                    <span className="font-bold tabular-nums">
                      {typeof payload?.team0Pips === "number"
                        ? oppTeam === 0
                          ? String(payload.team0Pips)
                          : String(payload.team1Pips)
                        : "—"}{" "}
                      pips
                    </span>
                  </div>
                </div>

                {/* Score update */}
                <div className="flex items-center justify-center gap-6 text-2xl font-black tabular-nums">
                  <span>{gameState.scores[myTeam]}</span>
                  <span className="text-sm font-normal opacity-50">–</span>
                  <span>{gameState.scores[oppTeam]}</span>
                </div>

                <button
                  onClick={handleNextRound}
                  disabled={nextRoundLoading}
                  className="w-full px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-base hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
                >
                  {nextRoundLoading ? "Preparando…" : "Siguiente Ronda →"}
                </button>
              </div>
            </div>
          )}

          {/* ── Game Over overlay ── */}
          {isFinished && !lastCallout && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
              <div className="bg-[var(--score-bg)] text-[var(--score-text)] rounded-2xl p-6 sm:p-8 text-center max-w-xs w-full mx-6 shadow-2xl animate-callout-enter space-y-5 relative overflow-hidden">
                {/* Confetti particles */}
                {gameState.winnerTeam === myTeam && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <span
                        key={i}
                        className="absolute text-xl animate-confetti"
                        style={{
                          left: `${8 + (i * 7.5) % 85}%`,
                          top: "-20px",
                          animationDelay: `${i * 0.12}s`,
                          animationDuration: `${1 + Math.random() * 0.5}s`,
                        }}
                      >
                        {["🎊", "🎉", "⭐", "🏆"][i % 4]}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-6xl relative z-10">
                  {gameState.winnerTeam === myTeam ? "🏆" : "💪"}
                </p>
                <h2 className="text-3xl font-black relative z-10">
                  {gameState.winnerTeam === myTeam
                    ? "¡GANASTE!"
                    : "Perdiste"}
                </h2>
                <p className="text-sm opacity-60 relative z-10">
                  {gameState.winnerTeam === myTeam
                    ? "¡Eso e' lo que hay!"
                    : "La próxima va pa' ti"}
                </p>

                {/* Final scores */}
                <div className="bg-white/10 rounded-xl p-4 space-y-2 relative z-10">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {myPlayer?.nickname ?? "Tú"}
                    </span>
                    <span className="text-2xl font-black tabular-nums">
                      {gameState.scores[myTeam]}
                    </span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {oppPlayer?.nickname ?? "Oponente"}
                    </span>
                    <span className="text-2xl font-black tabular-nums">
                      {gameState.scores[oppTeam]}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => router.push("/")}
                  className="w-full px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-base hover:brightness-110 transition-all active:scale-95 relative z-10"
                >
                  Jugar otra vez
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Player hand area */}
        {!isGameEnded && (
          <div
            className={`bg-theme-hand theme-hand-texture px-3 sm:px-4 py-3 sm:py-4 flex-shrink-0 transition-all duration-300 ${
              isMyTurn
                ? "border-t-2 border-[var(--accent)] animate-turn-glow"
                : "border-t border-black/10"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tu mano
              </p>
              {isMyTurn && (
                <span className="text-xs font-bold text-[var(--accent)] animate-pulse">
                  ¡Tu turno!
                </span>
              )}
            </div>
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
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Bubble Display ──────────────────────────────────────────────────────

interface ChatBubbleDisplayProps {
  bubble: ChatBubble;
  accentColor: string;
}

function ChatBubbleDisplay({ bubble, accentColor }: ChatBubbleDisplayProps) {
  const isEmote = bubble.type === "emote";
  const animClass =
    bubble.phase === "in"
      ? isEmote
        ? "animate-emote-pop"
        : "animate-chat-bubble-in"
      : "animate-chat-bubble-out";

  if (isEmote) {
    return (
      <div className={`text-3xl leading-none select-none ${animClass}`}>
        {bubble.payload}
      </div>
    );
  }

  return (
    <div
      className={`
        px-3 py-1.5 rounded-2xl text-white text-sm font-bold
        shadow-lg max-w-full break-words leading-tight
        ${animClass}
      `}
      style={{
        backgroundColor: accentColor,
        boxShadow: `0 2px 12px ${accentColor}55`,
      }}
    >
      {bubble.payload}
    </div>
  );
}
