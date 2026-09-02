"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useRealtimeGame } from "@/hooks/useRealtimeGame";
import type { ChatMessage } from "@/hooks/useRealtimeGame";
import Board from "@/components/game/Board";
import Hand from "@/components/game/Hand";
import ScorePanel from "@/components/game/ScorePanel";
import CalloutOverlay from "@/components/game/CalloutOverlay";
import TileDisplay from "@/components/game/TileDisplay";
import QuickChat from "@/components/game/QuickChat";
import BugReportButton from "@/components/game/BugReportButton";
import TablePresence from "@/components/game/TablePresence";
import {
  JoinCard,
  SpectatorBar,
  SpectatorScoreBar,
  SpectatorSeats,
} from "@/components/game/SessionGate";
import type { Tile, Seat, Theme } from "@capi/engine";
import { getTeam, getOpponentTeam, getSeatsForGame } from "@capi/engine";
import { chatText, errorKeyFor } from "@capi/i18n";
import { useI18n } from "@/lib/i18n/context";
import { isImessageEmbed, embedLang } from "@/lib/embed";
import { parseSessionFragment } from "@/lib/embedSession";
import type { EmbedSession as Session } from "@/lib/embedSession";
import { postToExtension } from "@/lib/imessageBridge";
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

interface Toast {
  id: number;
  message: string;
  phase: "in" | "out";
}

interface ChatBubble extends ChatMessage {
  phase: "in" | "out";
}

const SEATS: readonly string[] = ["n", "e", "s", "w"];
const THEMES: readonly string[] = [
  "barberia",
  "colmado",
  "patio",
  "quisqueya",
  "larimar",
  "noche",
];

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value);
}

// The session this browser holds for one table. Anything malformed is
// dropped so the page falls back to join or spectate instead of guessing
// a seat.
function readStoredSession(gameId: string): Session | null {
  const key = `capi_session_${gameId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (
      typeof parsed.playerId === "string" &&
      typeof parsed.seat === "string" &&
      SEATS.includes(parsed.seat)
    ) {
      return { playerId: parsed.playerId, seat: parsed.seat, gameId };
    }
  } catch {
    /* fall through and drop it */
  }
  localStorage.removeItem(key);
  return null;
}

// Seats around the table from one player's point of view. 1v1 has only the
// opponent across; 2v2 puts the partner across and the opponents on the sides.
function getRelativeSeats(
  mySeat: Seat,
  is2v2: boolean
): { top: Seat; left: Seat | null; right: Seat | null } {
  if (!is2v2) return { top: mySeat === "n" ? "s" : "n", left: null, right: null };
  switch (mySeat) {
    case "n": return { top: "s", left: "w", right: "e" };
    case "e": return { top: "w", left: "n", right: "s" };
    case "s": return { top: "n", left: "e", right: "w" };
    case "w": return { top: "e", left: "s", right: "n" };
  }
}

// iMessage bubble markers survive remounts: a finished game reopened later
// must not post its bubble again. A table finishes once, and each round ends
// once, so rounds are keyed by index. state_version is not stable enough for
// this: a rematch request bumps it on the finished game.
interface BridgeMarks {
  roundOver?: number;
  gameOver?: boolean;
}

function readBridgeMarks(gameId: string): BridgeMarks {
  try {
    const raw = localStorage.getItem(`capi_bridge_${gameId}`);
    return raw ? (JSON.parse(raw) as BridgeMarks) : {};
  } catch {
    return {};
  }
}

function writeBridgeMarks(gameId: string, marks: BridgeMarks) {
  try {
    localStorage.setItem(`capi_bridge_${gameId}`, JSON.stringify(marks));
  } catch {
    /* storage blocked: worst case is one repeated bubble */
  }
}

let toastId = 0;

function GameContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Embed mode hides share chrome because bubble taps replace invite links.
  const embedded = isImessageEmbed(searchParams);
  const { s, setLang } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [muted, setMutedState] = useState(() => isMuted());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [nextRoundLoading, setNextRoundLoading] = useState(false);
  const [rematchLoading, setRematchLoading] = useState(false);
  const [chatBubbles, setChatBubbles] = useState<ChatBubble[]>([]);
  const [waitingTheme, setWaitingTheme] = useState<Theme | null>(null);

  // Track which chat message IDs we've already displayed
  const seenChatIdsRef = useRef<Set<string>>(new Set());
  // Timer refs per bubble for cleanup
  const bubbleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Refs for detecting changes
  const prevBoardLenRef = useRef(0);
  const prevOppHandLenRef = useRef(-1);
  const prevRoundRef = useRef(-1);

  useEffect(() => {
    loadMuteState();
    setMutedState(isMuted());
    preloadSounds();
  }, []);

  useEffect(() => {
    const boot = parseSessionFragment(window.location.hash, id);
    if (boot) {
      localStorage.setItem(`capi_session_${id}`, JSON.stringify(boot));
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setSession(readStoredSession(id));
  }, [id]);

  // The extension passes the device language via ?lang=; adopt it once on
  // mount so the native drawer chrome and this embedded table agree. Guarded
  // by a ref so it never re-fires from an in-page language switch.
  const langSyncedRef = useRef(false);
  useEffect(() => {
    if (langSyncedRef.current || !embedded) return;
    langSyncedRef.current = true;
    const wanted = embedLang(searchParams);
    if (wanted) setLang(wanted);
  }, [embedded, searchParams, setLang]);

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
    refetch,
  } = useRealtimeGame(id, session);

  // No session means no seat: the page joins or watches, never plays as "n".
  const mySeat: Seat | null = session ? (session.seat as Seat) : null;
  const is2v2 = gameState?.is2v2 ?? gameSettings?.is2v2 ?? false;
  const myTeam: 0 | 1 | null = mySeat ? getTeam(mySeat, is2v2) : null;

  // Round outcome, shared by the round-over card and the bridge effect. The
  // callout payload names the winning team; without it the winner is unknown.
  const payload = gameState?.lastCalloutPayload ?? lastCalloutPayload;
  const winningTeamRaw = payload?.winningTeam;
  const roundWinnerTeam: 0 | 1 | null =
    winningTeamRaw === 0 ? 0 : winningTeamRaw === 1 ? 1 : null;

  // API failures arrive as fixed English messages; known ones map to a
  // localized key, anything else gets the caller's context-specific fallback.
  function apiErrorText(message: unknown, fallback: string): string {
    const key = errorKeyFor(message, "errMoveFailed");
    return key === "errMoveFailed" ? fallback : s[key];
  }

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
          bubbleTimersRef.current.delete(`${msg.id}-rm`);
        }, 350);
        bubbleTimersRef.current.set(`${msg.id}-rm`, removeTimer);
      }, 2500);
      bubbleTimersRef.current.set(msg.id, fadeTimer);
    }
  }, [chatMessages]);

  // Cleanup bubble timers on unmount
  useEffect(() => {
    const timers = bubbleTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  function handlePlay(tile: Tile, end: "left" | "right") {
    if (!mySeat) return;
    playSlam();
    void submitMove({ type: "play", tile, end });
  }

  function handlePass() {
    if (!mySeat) return;
    void submitMove({ type: "pass" });
  }

  function handleDraw() {
    if (!mySeat) return;
    playDrawSound();
    void submitMove({ type: "draw" });
  }

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  }

  async function handleJoined(next: Session) {
    setSession(next);
    await refetch();
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
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          // Another player already started the round (or our snapshot is
          // stale), which is success from the user's perspective, just sync.
          await refetch();
        } else {
          showToast(apiErrorText(data.error, s.errorStartRound));
        }
      } else {
        await refetch();
      }
    } catch {
      showToast(s.connectionError);
    } finally {
      setNextRoundLoading(false);
    }
  }

  // Detect board changes (a tile landed) to play the slam sound
  const boardLen = gameState?.board.length ?? 0;
  useEffect(() => {
    if (prevBoardLenRef.current > 0 && boardLen > prevBoardLenRef.current) {
      playSlam();
    }
    prevBoardLenRef.current = boardLen;
  }, [boardLen]);

  // Detect opponent drawing tiles to show toast (1v1 only - no boneyard in
  // 2v2). A new deal refills every hand, so the comparison restarts per round.
  useEffect(() => {
    if (!gameState || !mySeat || gameState.is2v2) return;
    const oppSeat: Seat = mySeat === "n" ? "s" : "n";
    const oppLen = (gameState.hands[oppSeat] ?? []).length;
    if (gameState.roundIndex !== prevRoundRef.current) {
      prevRoundRef.current = gameState.roundIndex;
      prevOppHandLenRef.current = oppLen;
      return;
    }
    if (prevOppHandLenRef.current >= 0 && oppLen > prevOppHandLenRef.current) {
      showToast(s.opponentDrew(oppLen - prevOppHandLenRef.current));
    }
    prevOppHandLenRef.current = oppLen;
  }, [gameState, mySeat, showToast, s]);

  // Play callout sound when a callout appears
  useEffect(() => {
    if (lastCallout) {
      playCallout();
    }
  }, [lastCallout]);

  // Notify the iMessage extension shell exactly once each time the
  // round-over or game-over card becomes visible, so it can refresh the
  // turn bubble. These mirror the isRoundOver/isFinished + !lastCallout
  // conditions the overlays further down use to show those same cards.
  // The ref guards block re-emits from unrelated re-renders (gameState gets
  // a new object reference on every realtime sync) while the card stays up;
  // the stored marks block re-emits across remounts of the same card.
  const roundOverVisible = gameState?.phase === "round_over" && !lastCallout;
  const roundOverNotifiedRef = useRef(false);
  useEffect(() => {
    if (!roundOverVisible) {
      roundOverNotifiedRef.current = false;
      return;
    }
    if (roundOverNotifiedRef.current || !gameState || myTeam === null) return;
    roundOverNotifiedRef.current = true;
    const marks = readBridgeMarks(id);
    if (marks.roundOver === gameState.roundIndex) return;
    writeBridgeMarks(id, { ...marks, roundOver: gameState.roundIndex });
    postToExtension({
      type: "roundOver",
      iWon: roundWinnerTeam === myTeam,
      myScore: gameState.scores[myTeam],
      oppScore: gameState.scores[getOpponentTeam(myTeam)],
    });
  }, [roundOverVisible, gameState, myTeam, roundWinnerTeam, id]);

  const gameOverVisible = gameState?.phase === "finished" && !lastCallout;
  const gameOverNotifiedRef = useRef(false);
  useEffect(() => {
    if (!gameOverVisible) {
      gameOverNotifiedRef.current = false;
      return;
    }
    if (gameOverNotifiedRef.current || !gameState || myTeam === null) return;
    gameOverNotifiedRef.current = true;
    const marks = readBridgeMarks(id);
    if (marks.gameOver) return;
    writeBridgeMarks(id, { ...marks, gameOver: true });
    postToExtension({
      type: "gameOver",
      iWon: gameState.winnerTeam === myTeam,
      myScore: gameState.scores[myTeam],
      oppScore: gameState.scores[getOpponentTeam(myTeam)],
    });
  }, [gameOverVisible, gameState, myTeam, id]);

  // The waiting room has no game_state yet, so the table's theme comes from
  // the game row itself.
  const inWaitingRoom = !loading && !errorKey && !gameState;
  useEffect(() => {
    if (!inWaitingRoom || waitingTheme) return;
    let cancelled = false;
    fetch(`/api/games/${id}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && isTheme(data?.game?.theme)) {
          setWaitingTheme(data.game.theme);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, inWaitingRoom, waitingTheme]);

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">{s.loading}</p>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (errorKey && !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
        <div className="text-center space-y-3">
          <p className="text-red-600 font-medium">{s[errorKey]}</p>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-indigo-600 underline"
          >
            {s.backToHome}
          </button>
        </div>
      </div>
    );
  }

  // --- Waiting for players ---
  if (!gameState || gameState.phase === "waiting") {
    const maxPlayers = is2v2 ? 4 : 2;
    const seatOrder = getSeatsForGame(is2v2);
    const seatLabels: Record<Seat, string> = { n: s.seatNorth, e: s.seatEast, s: s.seatSouth, w: s.seatWest };
    const playersNeeded = Math.max(0, maxPlayers - players.length);
    // A visitor with no seat can take a free one from right here.
    const canJoin = !session && playersNeeded > 0;

    return (
      <div
        data-theme={waitingTheme ?? "barberia"}
        className="min-h-screen flex items-center justify-center bg-theme-page p-4"
      >
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">{is2v2 ? "👥" : "🎲"}</div>
          <h2 className="text-lg font-black text-gray-900">
            {playersNeeded > 0
              ? s.waitingForPlayers(playersNeeded)
              : s.preparing}
          </h2>
          {is2v2 && (
            <p className="text-xs text-indigo-600 font-semibold">
              2v2 - {s.conTuFrente}
            </p>
          )}

          {/* Seat slots */}
          <div className="grid gap-2 grid-cols-2">
            {seatOrder.map((seat) => {
              const p = players.find((pl) => pl.seat === seat);
              const isMe = !!p && p.id === session?.playerId;
              return (
                <div
                  key={seat}
                  className={`px-3 py-3 rounded-xl border-2 transition-all min-w-0 ${
                    p
                      ? "border-green-300 bg-green-50"
                      : "border-dashed border-gray-300 bg-gray-50"
                  }`}
                >
                  {p ? (
                    <div className="flex items-center gap-2 justify-center min-w-0">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: p.avatar_color ?? "#999" }}
                      >
                        {p.nickname?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <span className="text-sm font-medium text-gray-800 truncate min-w-0">
                        {p.nickname}
                        {isMe && <span className="text-[10px] text-gray-400 ml-1">{s.youTag}</span>}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 justify-center min-w-0">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-400 text-xs">?</span>
                      </div>
                      <span className="text-sm text-gray-400 truncate min-w-0">
                        {seatLabels[seat]}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {is2v2 && (
            <div className="flex justify-center gap-4 text-[10px] text-gray-400">
              <span>N-S: {s.team1}</span>
              <span>E-W: {s.team2}</span>
            </div>
          )}

          {canJoin && <JoinCard gameId={id} onJoined={handleJoined} />}

          {session && !embedded && (
            <>
              {/* Primary action: copy the deep link */}
              <button
                onClick={async () => {
                  const inviteUrl = `${window.location.origin}?join=${id}`;
                  try {
                    await navigator.clipboard.writeText(inviteUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    /* clipboard blocked, the code chip below is the fallback */
                  }
                }}
                className={`w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  copied
                    ? "bg-green-500 text-white"
                    : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                {copied ? (
                  <>
                    <span aria-hidden>✓</span>
                    {s.copied}
                  </>
                ) : (
                  <>
                    <span aria-hidden>🔗</span>
                    {s.copyLink}
                  </>
                )}
              </button>

              {/* Secondary: the short code, for typing in by hand */}
              {inviteCode && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400">{s.orShareCode}</p>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteCode);
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                      } catch {
                        /* no-op */
                      }
                    }}
                    className="mx-auto block px-5 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors active:scale-[0.98]"
                    title={s.copyLink}
                  >
                    <span className="font-mono text-2xl font-black tracking-[0.3em] text-gray-900 pl-[0.3em]">
                      {inviteCode}
                    </span>
                  </button>
                  {codeCopied && (
                    <p className="text-xs text-green-600 font-semibold">
                      {s.codeCopied}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <p className="text-xs text-gray-400">{s.autoRefresh}</p>

          <div className="flex items-center justify-center gap-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                void refetch();
              }}
              className="text-indigo-600 hover:text-indigo-800"
            >
              {s.refresh}
            </button>
            {!embedded && (
              <Link href="/" className="text-gray-400 hover:text-gray-600">
                {s.leaveTable}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Active game ---
  const board = gameState.board;
  const boardLeftEnd = board.length > 0 ? board[0][0] : -1;
  const boardRightEnd =
    board.length > 0 ? board[board.length - 1][1] : -1;
  const myHand = mySeat ? gameState.hands[mySeat] ?? [] : [];
  const isMyTurn = mySeat !== null && gameState.currentTurn === mySeat;

  const myPlayer = mySeat ? players.find((p) => p.seat === mySeat) : undefined;

  // Seated view: opponent (1v1) or partner (2v2) across, opponents on the
  // sides in 2v2. A spectator has no vantage point; SpectatorSeats lists all.
  const relSeats = mySeat ? getRelativeSeats(mySeat, is2v2) : null;
  const topSeat = relSeats?.top ?? null;
  const topPlayer = topSeat ? players.find((p) => p.seat === topSeat) : undefined;
  const topHand = topSeat ? gameState.hands[topSeat] ?? [] : [];

  const leftSeat = relSeats?.left ?? null;
  const rightSeat = relSeats?.right ?? null;
  const leftPlayer = leftSeat ? players.find((p) => p.seat === leftSeat) : null;
  const rightPlayer = rightSeat ? players.find((p) => p.seat === rightSeat) : null;
  const leftHand = leftSeat ? (gameState.hands[leftSeat] ?? []) : [];
  const rightHand = rightSeat ? (gameState.hands[rightSeat] ?? []) : [];

  const isRoundOver = gameState.phase === "round_over";
  const isFinished = gameState.phase === "finished";
  const isGameEnded = isRoundOver || isFinished;

  // Team A is mine when seated (team 0 for a spectator), team B the other.
  // In 1v1 N=team0, S=team1. In 2v2 N+S=team0 vs E+W=team1.
  const teamA: 0 | 1 = myTeam ?? 0;
  const teamB = getOpponentTeam(teamA);
  const teamLabel = (team: 0 | 1): string => {
    const seats: Seat[] = is2v2
      ? team === 0
        ? ["n", "s"]
        : ["e", "w"]
      : [team === 0 ? "n" : "s"];
    const names = seats
      .map((seat) => players.find((p) => p.seat === seat)?.nickname)
      .filter(Boolean);
    if (names.length > 0) return names.join(" & ");
    if (myTeam === null) return team === 0 ? s.team1 : s.team2;
    return team === myTeam ? s.you : s.opponent;
  };
  const teamAName = teamLabel(teamA);
  const teamBName = teamLabel(teamB);

  // A seated player gets won/lost wording only when the winner is known.
  const roundOutcomeKnown = myTeam !== null && roundWinnerTeam !== null;
  const iWonRound = roundOutcomeKnown && roundWinnerTeam === myTeam;

  // Points credited this round (dominó/capicúa carry pipsAwarded [+bonus],
  // trancao carries pts) and who they went to, headlined in the round-over
  // modal so the pips table can't be misread as the score.
  const roundAward =
    (typeof payload?.pipsAwarded === "number"
      ? payload.pipsAwarded
      : typeof payload?.pts === "number"
        ? payload.pts
        : 0) +
    (typeof payload?.capicuaBonus === "number" ? payload.capicuaBonus : 0);
  const pipsFor = (team: 0 | 1): string => {
    const value = team === 0 ? payload?.team0Pips : payload?.team1Pips;
    return typeof value === "number" ? String(value) : "-";
  };

  const winnerTeam: 0 | 1 | null =
    gameState.winnerTeam === 0 ? 0 : gameState.winnerTeam === 1 ? 1 : null;
  const iWonGame = myTeam !== null && winnerTeam === myTeam;

  // Split bubbles by sender position for layout
  const myBubbles = chatBubbles.filter((b) => b.isMe);
  const oppBubbles = chatBubbles.filter((b) => !b.isMe);

  // VEINTICINCO awarded mid-round (round keeps playing) shows as a passing
  // banner so it never blocks the forcer's next move. Round-ending callouts
  // (DOMINÓ, CAPICÚA, TRANCAO, or a +25 that wins the game) keep the
  // full-screen overlay.
  const isMidRoundCallout =
    lastCallout === "veinticinco" && gameState.phase === "playing";
  const bannerTeamName =
    roundWinnerTeam === null ? null : teamLabel(roundWinnerTeam);

  return (
    <div
      data-theme={gameState.theme}
      className="h-screen h-[100dvh] overflow-hidden flex flex-col bg-theme-page theme-pattern select-game-none"
    >
      {/* Callout: mid-round bonus banner vs round-ending overlay */}
      {lastCallout &&
        (isMidRoundCallout ? (
          <VeinticincoBanner teamName={bannerTeamName} onDone={clearCallout} />
        ) : (
          <CalloutOverlay
            callout={lastCallout}
            payload={lastCalloutPayload}
            onDismiss={clearCallout}
          />
        ))}

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
      {mySeat ? (
        <ScorePanel
          scores={gameState.scores}
          targetScore={gameState.targetScore}
          players={players}
          currentTurn={gameState.currentTurn}
          mySeat={mySeat}
          is2v2={is2v2}
        />
      ) : (
        <SpectatorScoreBar
          scores={gameState.scores}
          targetScore={gameState.targetScore}
          players={players}
          currentTurn={gameState.currentTurn}
          is2v2={is2v2}
        />
      )}

      {/* Connection, turn, and away status */}
      <TablePresence
        connection={connection}
        presence={presence}
        currentTurn={gameState.currentTurn}
        playing={gameState.phase === "playing"}
        mySeat={mySeat}
        players={players}
      />

      {/* Error banner */}
      {errorKey && (
        <div className="bg-red-500/90 px-4 py-2 text-sm text-white text-center">
          {s[errorKey]}
        </div>
      )}

      {/* Main game area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Board felt area */}
        <div className="flex-1 flex flex-col relative min-h-0 theme-felt">
          {/* Light temperature + vignette overlay */}
          <div className="absolute inset-0 theme-light pointer-events-none z-[1]" />

          {/* Bottom-right utility cluster: bug report + mute */}
          {!embedded && (
            <div className="absolute bottom-2 right-2 z-[3] flex items-center gap-1.5">
              <BugReportButton
                gameId={id}
                playerId={session?.playerId}
                gameState={gameState}
                stateVersion={stateVersion}
              />
              <button
                onClick={toggleMute}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition-colors text-white/70 hover:text-white text-sm"
                title={muted ? s.enableSound : s.muteSound}
              >
                {muted ? "🔇" : "🔊"}
              </button>
            </div>
          )}

          {/* QuickChat toggle - floats on board bottom-left */}
          {!embedded && mySeat && !isGameEnded && (
            <div className="absolute bottom-2 left-2 z-[3]">
              <QuickChat
                onSend={sendChat}
                disabled={false}
              />
            </div>
          )}

          {/* My chat bubbles - above QuickChat button, left side */}
          <div className="absolute bottom-12 left-2 z-[4] flex flex-col-reverse gap-1.5 items-start max-w-[180px]">
            {myBubbles.map((b) => (
              <ChatBubbleDisplay
                key={b.id}
                bubble={b}
                accentColor={myPlayer?.avatar_color ?? "#6366f1"}
              />
            ))}
          </div>

          {/* Opponent chat bubbles - near top hand */}
          <div className="absolute top-14 left-2 z-[4] flex flex-col gap-1.5 items-start max-w-[180px]">
            {oppBubbles.map((b) => {
              const sender = players.find((p) => p.seat === b.seat);
              return (
                <ChatBubbleDisplay
                  key={b.id}
                  bubble={b}
                  accentColor={sender?.avatar_color ?? "#999"}
                />
              );
            })}
          </div>

          {/* Location watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
            <p className="text-white/[0.05] text-2xl sm:text-3xl font-black tracking-[0.25em] uppercase -rotate-2">
              {gameState.theme === "barberia" && "BARBERÍA DON RAMÓN"}
              {gameState.theme === "colmado" && "COLMADO LA ESQUINA"}
              {gameState.theme === "patio" && "EL PATIO DE TÍA"}
              {gameState.theme === "quisqueya" && "QUISQUEYA LA BELLA"}
              {gameState.theme === "larimar" && "LARIMAR"}
              {gameState.theme === "noche" && "CAPI NOCHE"}
            </p>
          </div>

          {/* Top row: the player across (partner in 2v2, opponent in 1v1),
              or every seat for a spectator */}
          {!isGameEnded &&
            (mySeat ? (
              <div className="px-3 sm:px-4 pt-2 sm:pt-3 pb-1 flex-shrink-0 z-[2]">
                <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${
                        gameState.currentTurn === topSeat ? "ring-2 ring-green-400" : ""
                      }`}
                      style={{
                        backgroundColor:
                          topPlayer?.avatar_color ?? "#999",
                      }}
                    >
                      {topPlayer?.nickname?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span className="text-white/60 text-xs font-medium truncate min-w-0">
                      {topPlayer?.nickname ?? (is2v2 ? s.partner : s.opponent)}
                      {is2v2 && <span className="opacity-60 ml-1">{s.partnerTag}</span>}
                      {" - "}
                      {s.tileCount(topHand.length)}
                    </span>
                  </div>
                  {!is2v2 && (gameState.boneyard?.length ?? 0) > 0 && (
                    <span className="text-amber-300/80 text-xs font-medium flex-shrink-0">
                      {s.boneyard}: {gameState.boneyard.length}
                    </span>
                  )}
                </div>
                <div className="flex gap-0.5 overflow-hidden justify-center">
                  {topHand.map((_: Tile, i: number) => (
                    <TileDisplay
                      key={i}
                      tile={[0, 0]}
                      small
                      faceDown
                    />
                  ))}
                </div>
              </div>
            ) : (
              <SpectatorSeats
                players={players}
                hands={gameState.hands}
                currentTurn={gameState.currentTurn}
                is2v2={is2v2}
                boneyardCount={gameState.boneyard?.length ?? 0}
              />
            ))}

          {/* Board + side hands for a seated 2v2 player */}
          {is2v2 && mySeat && !isGameEnded ? (
            <div className="flex-1 flex min-h-0 relative">
              {/* Left opponent */}
              <div className="w-12 sm:w-14 flex-shrink-0 flex flex-col items-center justify-center gap-2 z-[2] py-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md transition-all ${
                      gameState.currentTurn === leftSeat
                        ? "ring-2 ring-green-400 ring-offset-1 ring-offset-black/50 scale-110"
                        : ""
                    }`}
                    style={{ backgroundColor: leftPlayer?.avatar_color ?? "#999" }}
                  >
                    {leftPlayer?.nickname?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span className="text-white/60 text-[9px] font-medium truncate max-w-[52px] text-center leading-tight">
                    {leftPlayer?.nickname ?? "?"}
                  </span>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-2 py-1.5 flex flex-col items-center border border-white/10 shadow-lg">
                  <span className="text-white font-black text-lg tabular-nums leading-none">{leftHand.length}</span>
                  <span className="text-white/50 text-[8px] leading-tight mt-0.5">{s.tilesLabel}</span>
                </div>
              </div>

              {/* Board (centered) */}
              <div className="flex-1 min-w-0 flex flex-col">
                <Board board={board} endsGlow={isMyTurn} />
              </div>

              {/* Right opponent */}
              <div className="w-12 sm:w-14 flex-shrink-0 flex flex-col items-center justify-center gap-2 z-[2] py-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md transition-all ${
                      gameState.currentTurn === rightSeat
                        ? "ring-2 ring-green-400 ring-offset-1 ring-offset-black/50 scale-110"
                        : ""
                    }`}
                    style={{ backgroundColor: rightPlayer?.avatar_color ?? "#999" }}
                  >
                    {rightPlayer?.nickname?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span className="text-white/60 text-[9px] font-medium truncate max-w-[52px] text-center leading-tight">
                    {rightPlayer?.nickname ?? "?"}
                  </span>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-2 py-1.5 flex flex-col items-center border border-white/10 shadow-lg">
                  <span className="text-white font-black text-lg tabular-nums leading-none">{rightHand.length}</span>
                  <span className="text-white/50 text-[8px] leading-tight mt-0.5">{s.tilesLabel}</span>
                </div>
              </div>
            </div>
          ) : (
            <Board board={board} endsGlow={isMyTurn} />
          )}

          {/* ── Round Over overlay ── */}
          {isRoundOver && !lastCallout && (
            <div className="absolute inset-0 bg-black/60 flex overflow-y-auto py-6 px-6 z-10">
              <div className="m-auto bg-[var(--score-bg)] text-[var(--score-text)] rounded-2xl p-6 sm:p-8 text-center max-w-xs w-full shadow-2xl animate-callout-enter space-y-4">
                <p className="text-5xl">
                  {roundOutcomeKnown ? (iWonRound ? "🎉" : "😤") : "🎲"}
                </p>
                <h2 className="text-2xl font-black">
                  {roundOutcomeKnown
                    ? iWonRound
                      ? s.wonRound
                      : s.lostRound
                    : s.roundEnded}
                </h2>

                {/* Points awarded is the headline. Without it the pips table
                    below reads like a scoreboard and the loser's counted
                    pips look like points credited to the loser. Hidden when
                    the winner is unknown rather than guessed. */}
                {roundWinnerTeam !== null && (
                  <p className="text-3xl font-black text-[var(--accent)] tabular-nums leading-tight">
                    +{roundAward}
                    <span className="block text-xs font-bold opacity-70 mt-0.5">
                      {s.awardedTo} {teamLabel(roundWinnerTeam)}
                    </span>
                  </p>
                )}

                {/* Pip breakdown */}
                <div className="bg-white/10 rounded-xl p-3 space-y-1 text-sm">
                  <div className="text-[9px] uppercase tracking-widest opacity-50 text-center pb-1">
                    {s.pipsInHand}
                  </div>
                  <div className="flex justify-between min-w-0">
                    <span className="truncate mr-2">{teamAName}</span>
                    <span className="font-bold tabular-nums flex-shrink-0">
                      {pipsFor(teamA)}
                    </span>
                  </div>
                  <div className="flex justify-between min-w-0">
                    <span className="truncate mr-2">{teamBName}</span>
                    <span className="font-bold tabular-nums flex-shrink-0">
                      {pipsFor(teamB)}
                    </span>
                  </div>
                </div>

                {/* Score update */}
                <div className="flex items-center justify-center gap-6 text-2xl font-black tabular-nums">
                  <span>{gameState.scores[teamA]}</span>
                  <span className="text-sm font-normal opacity-50">·</span>
                  <span>{gameState.scores[teamB]}</span>
                </div>

                {mySeat && (
                  <button
                    onClick={handleNextRound}
                    disabled={nextRoundLoading}
                    className="w-full px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-base hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {nextRoundLoading ? s.nextRoundLoading : s.nextRound}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Game Over overlay ── */}
          {isFinished && !lastCallout && (
            <div className="absolute inset-0 bg-black/70 flex overflow-y-auto py-6 px-6 z-10">
              <div className="m-auto bg-[var(--score-bg)] text-[var(--score-text)] rounded-2xl p-6 sm:p-8 text-center max-w-xs w-full shadow-2xl animate-callout-enter space-y-5 relative overflow-hidden">
                {/* Confetti particles */}
                {iWonGame && (
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
                  {myTeam === null || iWonGame ? "🏆" : "💪"}
                </p>
                <h2 className="text-3xl font-black relative z-10">
                  {myTeam !== null
                    ? iWonGame
                      ? s.won
                      : s.lost
                    : winnerTeam !== null
                      ? teamLabel(winnerTeam)
                      : s.roundEnded}
                </h2>
                {myTeam !== null && (
                  <p className="text-sm opacity-60 relative z-10">
                    {iWonGame ? s.wonFlavor : s.lostFlavor}
                  </p>
                )}

                {/* Final scores */}
                <div className="bg-white/10 rounded-xl p-4 space-y-2 relative z-10">
                  <div className="flex justify-between items-center min-w-0">
                    <span className="font-medium truncate mr-2">
                      {teamAName}
                    </span>
                    <span className="text-2xl font-black tabular-nums">
                      {gameState.scores[teamA]}
                    </span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex justify-between items-center min-w-0">
                    <span className="font-medium truncate mr-2">
                      {teamBName}
                    </span>
                    <span className="text-2xl font-black tabular-nums">
                      {gameState.scores[teamB]}
                    </span>
                  </div>
                </div>

                {gameState.rematchGameId && (
                  <p className="text-sm font-bold text-[var(--accent-light)] relative z-10">
                    {s.rematchReady}
                  </p>
                )}

                {mySeat && (
                  <button
                    disabled={rematchLoading}
                    onClick={async () => {
                      if (!session) return;
                      setRematchLoading(true);
                      let navigating = false;
                      try {
                        const res = await fetch(`/api/games/${id}/rematch`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ playerId: session.playerId }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (res.ok && data.gameId) {
                          localStorage.setItem(
                            `capi_session_${data.gameId}`,
                            JSON.stringify({
                              playerId: data.playerId,
                              seat: data.seat,
                              gameId: data.gameId,
                            })
                          );
                          navigating = true;
                          router.push(`/game/${data.gameId}`);
                        } else {
                          showToast(apiErrorText(data.error, s.failedCreate));
                        }
                      } catch {
                        showToast(s.connectionError);
                      } finally {
                        // Keep the button disabled while navigating away;
                        // re-enable it on any failure so the user can retry.
                        if (!navigating) setRematchLoading(false);
                      }
                    }}
                    className="w-full px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-base hover:brightness-110 transition-all active:scale-95 relative z-10 disabled:opacity-60"
                  >
                    {rematchLoading
                      ? s.creatingRematch
                      : gameState.rematchGameId
                      ? s.joinRematch
                      : s.playAgain}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Player hand area, or the spectator strip in its place */}
        {!isGameEnded &&
          (mySeat ? (
            <div
              className={`bg-theme-hand theme-hand-texture px-3 sm:px-4 py-3 sm:py-4 flex-shrink-0 max-h-[38dvh] overflow-y-auto transition-all duration-300 ${
                isMyTurn
                  ? "border-t-2 border-[var(--accent)] animate-turn-glow"
                  : "border-t border-black/10"
              }`}
              style={{
                paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {s.yourHand}
                </p>
                {isMyTurn && (
                  <span className="text-xs font-bold text-[var(--accent)] animate-pulse">
                    {s.yourTurn}
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
          ) : (
            <SpectatorBar embedded={embedded} />
          ))}
      </div>
    </div>
  );
}

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  // A fresh mount per table: rematch navigation must not carry refs, timers,
  // or seen-message sets from the finished game into the new one.
  return (
    <Suspense>
      <GameContent key={id} id={id} />
    </Suspense>
  );
}

// ─── Mid-round VEINTICINCO banner ────────────────────────────────────────────
// Non-blocking, auto-dismissing. The round continues underneath; the forcer
// needs the board free to play their next tile.

function VeinticincoBanner({
  teamName,
  onDone,
}: {
  teamName: string | null;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setLeaving(true), 2300);
    const doneTimer = setTimeout(onDone, 2650);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div
        className={`px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-700 border border-purple-400/70 shadow-2xl flex items-center gap-2.5 ${
          leaving ? "animate-toast-out" : "animate-toast-in"
        }`}
      >
        <span className="text-2xl drop-shadow">💥</span>
        <div className="text-white">
          <p className="font-black leading-tight tracking-tight">
            ¡VEINTICINCO!
          </p>
          <p className="text-xs text-purple-100/90 font-semibold leading-tight">
            +25{teamName ? ` · ${teamName}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Chat Bubble Display ──────────────────────────────────────────────────────
// Payloads are canonical phrase ids (or emotes); each viewer renders the
// phrase in their own language.

interface ChatBubbleDisplayProps {
  bubble: ChatBubble;
  accentColor: string;
}

function ChatBubbleDisplay({ bubble, accentColor }: ChatBubbleDisplayProps) {
  const { lang } = useI18n();
  const isEmote = bubble.type === "emote";
  const text = chatText(bubble.type, bubble.payload, lang);
  const animClass =
    bubble.phase === "in"
      ? isEmote
        ? "animate-emote-pop"
        : "animate-chat-bubble-in"
      : "animate-chat-bubble-out";

  if (isEmote) {
    return (
      <div className={`text-3xl leading-none select-none ${animClass}`}>
        {text}
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
      {text}
    </div>
  );
}
