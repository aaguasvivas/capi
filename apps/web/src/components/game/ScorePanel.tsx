"use client";

import { useEffect, useRef, useState } from "react";
import { getOpponentTeam, getTeam, type Seat } from "@capi/engine";
import { useI18n } from "@/lib/i18n/context";

/**
 * Score number that pops when its value changes, so mid-round bonuses
 * (VEINTICINCO +25) are visible even if the banner is missed.
 */
function ScoreValue({ score }: { score: number }) {
  const [pop, setPop] = useState(false);
  const prevRef = useRef(score);

  useEffect(() => {
    if (score !== prevRef.current) {
      prevRef.current = score;
      setPop(true);
      const t = setTimeout(() => setPop(false), 650);
      return () => clearTimeout(t);
    }
  }, [score]);

  return (
    <p
      className={`text-xl font-black leading-tight tabular-nums ${
        pop ? "animate-score-pop" : ""
      }`}
    >
      {score}
    </p>
  );
}

interface Player {
  seat: string;
  nickname: string;
  avatar_color: string;
}

interface Props {
  scores: [number, number];
  targetScore: number;
  players: Player[];
  currentTurn: string;
  mySeat: string;
  is2v2?: boolean;
}

export default function ScorePanel({
  scores,
  targetScore,
  players,
  currentTurn,
  mySeat,
  is2v2 = false,
}: Props) {
  const { s } = useI18n();

  // My side always reads left to right: me (or my team), the target, them.
  const myTeam = getTeam(mySeat as Seat, is2v2);
  const oppTeam = getOpponentTeam(myTeam);
  const turnTeam = getTeam(currentTurn as Seat, is2v2);
  const teamPlayers = (team: 0 | 1) =>
    players.filter((p) => getTeam(p.seat as Seat, is2v2) === team);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-theme-score text-theme-score-text">
      <TeamScore
        players={teamPlayers(myTeam)}
        score={scores[myTeam]}
        isActive={turnTeam === myTeam}
        youTag={s.youTag}
      />

      <div className="text-center flex-shrink-0">
        <div className="text-[10px] uppercase tracking-widest opacity-50">
          {s.firstTo}
        </div>
        <div className="text-lg font-black">{targetScore}</div>
      </div>

      <TeamScore
        players={teamPlayers(oppTeam)}
        score={scores[oppTeam]}
        isActive={turnTeam === oppTeam}
        align="right"
      />
    </div>
  );
}

function TeamScore({
  players,
  score,
  isActive,
  youTag,
  align = "left",
}: {
  players: Player[];
  score: number;
  isActive: boolean;
  youTag?: string;
  align?: "left" | "right";
}) {
  const stacked = players.length > 1;
  const name =
    players.length > 0 ? players.map((p) => p.nickname).join(" & ") : "…";

  return (
    <div
      className={`flex-1 min-w-0 flex items-center gap-2 transition-opacity ${
        isActive ? "opacity-100" : "opacity-50"
      } ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`relative flex flex-shrink-0 ${stacked ? "-space-x-2" : ""}`}
      >
        {(players.length > 0 ? players : [null]).map((p, i) => (
          <div
            key={p?.seat ?? i}
            className={`rounded-full flex items-center justify-center text-white font-bold shadow-inner ${
              stacked
                ? "w-7 h-7 text-[10px] border-2 border-[var(--score-bg)]"
                : "w-8 h-8 text-xs"
            }`}
            style={{ backgroundColor: p?.avatar_color ?? "#999" }}
          >
            {p?.nickname?.[0]?.toUpperCase() ?? "?"}
          </div>
        ))}
        {isActive && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[var(--score-bg)] animate-pulse z-10" />
        )}
      </div>

      <div className={`min-w-0 ${align === "right" ? "text-right" : ""}`}>
        {/* Two names rarely fit one phone-width line, so a team name may
            wrap once; a single name stays on one line. */}
        <p
          className={`font-medium leading-tight ${
            stacked
              ? "text-[10px] line-clamp-2 break-words"
              : "text-xs truncate"
          }`}
        >
          {name}
          {youTag && (
            <span className="opacity-40 ml-1 text-[10px]">{youTag}</span>
          )}
        </p>
        <ScoreValue score={score} />
      </div>
    </div>
  );
}
