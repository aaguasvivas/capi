"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRealtimeGame } from "@/hooks/useRealtimeGame";
import Board from "@/components/game/Board";
import Hand from "@/components/game/Hand";
import ScorePanel from "@/components/game/ScorePanel";
import type { Tile } from "@/lib/engine/types";

interface Session {
  playerId: string;
  seat: string;
  gameId: string;
}

const CALLOUT_LABELS: Record<string, string> = {
  domino: "DOMINÓ! 🀱",
  trancao: "¡TRANCAO! 🔒",
  capicua: "¡CAPICÚA! 🔥",
  veinticinco: "¡VEINTICINCO! 😤",
};

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [copied, setCopied] = useState(false);

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
    loading,
    error,
    lastCallout,
    lastCalloutPayload,
    submitMove,
    clearCallout,
  } = useRealtimeGame(id, session);

  function handlePlay(tile: Tile, end: "left" | "right") {
    submitMove({ type: "play", tile, end });
  }

  function handlePass() {
    submitMove({ type: "pass" });
  }

  function handleDraw() {
    submitMove({ type: "draw" });
  }

  async function copyInvite() {
    const inviteUrl = `${window.location.origin}?join=${id}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading game…</p>
      </div>
    );
  }

  if (error && !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-indigo-600 underline"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  // Waiting for second player
  if (!gameState || gameState.phase === "waiting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Waiting for opponent…</h2>
          <p className="text-sm text-gray-500">Share this invite link:</p>
          <button
            onClick={copyInvite}
            className="w-full px-4 py-2.5 bg-gray-100 rounded-lg text-sm font-mono text-gray-700 hover:bg-gray-200 transition-colors"
          >
            {copied ? "Copied!" : `${window.location.origin}?join=${id}`}
          </button>
          <p className="text-xs text-gray-400">
            This page will update when they join.
          </p>
        </div>
      </div>
    );
  }

  const mySeat = session?.seat ?? "n";
  const myHand = gameState.hands[mySeat as keyof typeof gameState.hands] ?? [];
  const isMyTurn = gameState.currentTurn === mySeat;
  const board = gameState.board;
  const boardLeftEnd = board.length > 0 ? board[0][0] : -1;
  const boardRightEnd = board.length > 0 ? board[board.length - 1][1] : -1;

  const isFinished = gameState.phase === "finished" || gameState.phase === "round_over";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Callout overlay */}
      {lastCallout && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={clearCallout}
        >
          <div className="bg-white rounded-2xl p-10 text-center max-w-sm w-full shadow-2xl space-y-4">
            <p className="text-4xl font-black tracking-tight text-gray-900">
              {CALLOUT_LABELS[lastCallout] ?? lastCallout.toUpperCase()}
            </p>
            {lastCalloutPayload && (
              <div className="text-sm text-gray-500 space-y-1">
                {typeof lastCalloutPayload.pipsAwarded === "number" && (
                  <p>+{lastCalloutPayload.pipsAwarded} pts</p>
                )}
                {typeof lastCalloutPayload.capicuaBonus === "number" && (
                  <p>+{lastCalloutPayload.capicuaBonus} Capicúa bonus</p>
                )}
                {typeof lastCalloutPayload.veinticincoBonus === "number" && (
                  <p>+{lastCalloutPayload.veinticincoBonus} Veinticinco bonus</p>
                )}
              </div>
            )}
            <p className="text-xs text-gray-400">Tap to continue</p>
          </div>
        </div>
      )}

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
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Board */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-gray-200 bg-white">
          <p className="text-xs text-gray-400 px-4 pt-2">Board</p>
          <Board board={board} />
        </div>

        {/* Round/Game over banner */}
        {isFinished && (
          <div className="m-4 rounded-xl bg-gray-900 text-white p-6 text-center space-y-2">
            {gameState.phase === "finished" ? (
              <>
                <p className="text-xl font-black">
                  {gameState.winnerTeam === (mySeat === "n" ? 0 : 1)
                    ? "You win! 🏆"
                    : "Better luck next time."}
                </p>
                <p className="text-sm text-gray-300">
                  Final score: {gameState.scores[0]} – {gameState.scores[1]}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-black">Round over</p>
                <p className="text-sm text-gray-300">
                  Score: {gameState.scores[0]} – {gameState.scores[1]}
                </p>
              </>
            )}
          </div>
        )}

        {/* Opponent hand + boneyard info */}
        {!isFinished && (
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            {(() => {
              const oppSeat = mySeat === "n" ? "s" : "n";
              const oppPlayer = players.find((p) => p.seat === oppSeat);
              const oppCount = gameState.hands[oppSeat as keyof typeof gameState.hands]?.length ?? 0;
              return (
                <div className="text-xs text-gray-500">
                  {oppPlayer?.nickname ?? "Opponent"} — {oppCount} tile{oppCount !== 1 ? "s" : ""}
                </div>
              );
            })()}
            {(gameState.boneyard?.length ?? 0) > 0 && (
              <div className="text-xs text-amber-600 font-medium">
                Boneyard: {gameState.boneyard.length}
              </div>
            )}
          </div>
        )}

        {/* Your hand */}
        {!isFinished && (
          <div className="px-4 pb-6 mt-auto">
            <p className="text-xs text-gray-500 mb-2">Your hand</p>
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
