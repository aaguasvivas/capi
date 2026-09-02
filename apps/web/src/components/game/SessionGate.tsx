"use client";

import { useState } from "react";
import Link from "next/link";
import type { Seat, Tile } from "@capi/engine";
import { getSeatsForGame } from "@capi/engine";
import { errorKeyFor } from "@capi/i18n";
import { useI18n } from "@/lib/i18n/context";
import type { EmbedSession as Session } from "@/lib/embedSession";

// Everything the game page shows when this browser holds no seat at the
// table: the join card while a seat is free, and the spectator chrome once
// the table is full.

// Same palette the home forms offer, so a joiner from a bare table link gets
// the same choices.
const AVATAR_COLORS = [
  "#ec4899",
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
];

interface SeatedPlayer {
  seat: string;
  nickname: string;
  avatar_color: string;
}

interface JoinCardProps {
  gameId: string;
  onJoined: (session: Session) => void | Promise<void>;
}

// One name field, then the same POST the home join form sends. The session
// is saved here under the key every other entry point uses.
export function JoinCard({ gameId, onJoined }: JoinCardProps) {
  const { s } = useI18n();
  const [nickname, setNickname] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = nickname.trim();
    if (!name || joining) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: name, avatarColor }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.playerId !== "string") {
        // Known API messages map to a localized key; anything else is a
        // generic join failure.
        const key = errorKeyFor(data.error, "errMoveFailed");
        setError(key === "errMoveFailed" ? s.failedJoin : s[key]);
        return;
      }
      const session: Session = {
        playerId: data.playerId,
        seat: data.seat,
        gameId,
      };
      localStorage.setItem(`capi_session_${gameId}`, JSON.stringify(session));
      await onJoined(session);
    } catch {
      setError(s.networkError);
    } finally {
      setJoining(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          {s.yourName}
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          autoFocus
          placeholder={s.joinNamePlaceholder}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition-all bg-gray-50/50"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          {s.yourColor}
        </label>
        <div className="flex gap-2.5">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAvatarColor(c)}
              aria-pressed={avatarColor === c}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                avatarColor === c
                  ? "border-gray-900 scale-110 shadow-md"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={joining || !nickname.trim()}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-40 hover:bg-gray-800 transition-all active:scale-[0.98] shadow-sm"
      >
        {joining ? s.joining : s.joinTable}
      </button>
    </form>
  );
}

interface SpectatorScoreBarProps {
  scores: [number, number];
  targetScore: number;
  players: SeatedPlayer[];
  currentTurn: Seat;
  is2v2: boolean;
}

// Score bar with no "you" on either side. ScorePanel tags whichever team it
// takes for the viewer's, so a spectator gets this neutral copy instead.
export function SpectatorScoreBar({
  scores,
  targetScore,
  players,
  currentTurn,
  is2v2,
}: SpectatorScoreBarProps) {
  const { s } = useI18n();
  const teams: [Seat[], Seat[]] = is2v2
    ? [
        ["n", "s"],
        ["e", "w"],
      ]
    : [["n"], ["s"]];
  const seated = (seats: Seat[]) =>
    seats
      .map((seat) => players.find((p) => p.seat === seat))
      .filter((p): p is SeatedPlayer => !!p);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-theme-score text-theme-score-text">
      <TeamSide
        players={seated(teams[0])}
        score={scores[0]}
        active={teams[0].includes(currentTurn)}
      />
      <div className="text-center flex-shrink-0">
        <div className="text-[10px] uppercase tracking-widest opacity-50">
          {s.firstTo}
        </div>
        <div className="text-lg font-black">{targetScore}</div>
      </div>
      <TeamSide
        players={seated(teams[1])}
        score={scores[1]}
        active={teams[1].includes(currentTurn)}
        align="right"
      />
    </div>
  );
}

function TeamSide({
  players,
  score,
  active,
  align = "left",
}: {
  players: SeatedPlayer[];
  score: number;
  active: boolean;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2 min-w-0 transition-opacity ${
        active ? "opacity-100" : "opacity-50"
      } ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      <div className="relative flex -space-x-2 flex-shrink-0">
        {players.map((p) => (
          <div
            key={p.seat}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-inner border-2 border-[var(--score-bg)]"
            style={{ backgroundColor: p.avatar_color ?? "#999" }}
          >
            {p.nickname?.[0]?.toUpperCase() ?? "?"}
          </div>
        ))}
        {active && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[var(--score-bg)] animate-pulse z-10" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium leading-tight truncate max-w-[80px]">
          {players.map((p) => p.nickname).join(" & ") || "…"}
        </p>
        <p className="text-xl font-black leading-tight tabular-nums">{score}</p>
      </div>
    </div>
  );
}

interface SpectatorSeatsProps {
  players: SeatedPlayer[];
  hands: Record<Seat, Tile[]>;
  currentTurn: Seat;
  is2v2: boolean;
  boneyardCount: number;
}

// Every seat with its tile count, since a spectator has no "across" or
// "beside" to arrange the table around.
export function SpectatorSeats({
  players,
  hands,
  currentTurn,
  is2v2,
  boneyardCount,
}: SpectatorSeatsProps) {
  const { s } = useI18n();
  return (
    <div className="px-3 sm:px-4 pt-2 sm:pt-3 pb-1 flex-shrink-0 z-[2]">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {getSeatsForGame(is2v2).map((seat) => {
          const p = players.find((pl) => pl.seat === seat);
          const onTurn = currentTurn === seat;
          return (
            <div key={seat} className="flex items-center gap-1.5 min-w-0">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${
                  onTurn ? "ring-2 ring-green-400" : ""
                }`}
                style={{ backgroundColor: p?.avatar_color ?? "#999" }}
              >
                {p?.nickname?.[0]?.toUpperCase() ?? "?"}
              </div>
              <span
                className={`text-xs font-medium truncate min-w-0 max-w-[120px] ${
                  onTurn ? "text-white" : "text-white/60"
                }`}
              >
                {p?.nickname ?? "?"}
                {" - "}
                {s.tileCount((hands[seat] ?? []).length)}
              </span>
            </div>
          );
        })}
        {!is2v2 && boneyardCount > 0 && (
          <span className="text-amber-300/80 text-xs font-medium flex-shrink-0">
            {s.boneyard}: {boneyardCount}
          </span>
        )}
      </div>
    </div>
  );
}

// Takes the hand area's place at the bottom for a viewer without a seat.
export function SpectatorBar({ embedded }: { embedded: boolean }) {
  const { s } = useI18n();
  return (
    <div
      className="bg-theme-hand theme-hand-texture px-4 py-3 flex-shrink-0 border-t border-black/10 flex flex-col items-center gap-1.5 text-center"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/10 text-gray-700 text-xs font-bold uppercase tracking-wider">
        <span aria-hidden>👀</span>
        {s.spectating}
      </span>
      <p className="text-xs text-gray-600">{s.spectatingHint}</p>
      {!embedded && (
        <Link
          href="/"
          className="text-xs font-semibold text-gray-500 underline hover:text-gray-700"
        >
          {s.leaveTable}
        </Link>
      )}
    </div>
  );
}
