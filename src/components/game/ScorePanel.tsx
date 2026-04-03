"use client";

import { useI18n } from "@/lib/i18n/context";

interface Props {
  scores: [number, number];
  targetScore: number;
  players: Array<{ seat: string; nickname: string; avatar_color: string }>;
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

  if (is2v2) {
    const team0Seats = ["n", "s"];
    const team1Seats = ["e", "w"];
    const team0Players = team0Seats.map((seat) => players.find((p) => p.seat === seat)).filter(Boolean);
    const team1Players = team1Seats.map((seat) => players.find((p) => p.seat === seat)).filter(Boolean);
    const myTeam = mySeat === "n" || mySeat === "s" ? 0 : 1;
    const team0Active = team0Seats.includes(currentTurn);
    const team1Active = team1Seats.includes(currentTurn);

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-theme-score text-theme-score-text">
        <TeamScore
          teamPlayers={team0Players as Array<{ nickname: string; avatar_color: string }>}
          score={scores[0]}
          isActive={team0Active}
          isMyTeam={myTeam === 0}
          youTag={s.youTag}
        />

        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest opacity-50">
            {s.firstTo}
          </div>
          <div className="text-lg font-black">{targetScore}</div>
        </div>

        <TeamScore
          teamPlayers={team1Players as Array<{ nickname: string; avatar_color: string }>}
          score={scores[1]}
          isActive={team1Active}
          isMyTeam={myTeam === 1}
          youTag={s.youTag}
          align="right"
        />
      </div>
    );
  }

  const north = players.find((p) => p.seat === "n");
  const south = players.find((p) => p.seat === "s");

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-theme-score text-theme-score-text">
      <PlayerScore
        player={north}
        score={scores[0]}
        isActive={currentTurn === "n"}
        isMe={mySeat === "n"}
        youTag={s.youTag}
      />

      <div className="text-center">
        <div className="text-[10px] uppercase tracking-widest opacity-50">
          {s.firstTo}
        </div>
        <div className="text-lg font-black">{targetScore}</div>
      </div>

      <PlayerScore
        player={south}
        score={scores[1]}
        isActive={currentTurn === "s"}
        isMe={mySeat === "s"}
        youTag={s.youTag}
        align="right"
      />
    </div>
  );
}

function TeamScore({
  teamPlayers,
  score,
  isActive,
  isMyTeam,
  youTag,
  align = "left",
}: {
  teamPlayers: Array<{ nickname: string; avatar_color: string }>;
  score: number;
  isActive: boolean;
  isMyTeam: boolean;
  youTag: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2 transition-opacity ${
        isActive ? "opacity-100" : "opacity-50"
      } ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      <div className="relative flex -space-x-2">
        {teamPlayers.map((p, i) => (
          <div
            key={i}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-inner border-2 border-[var(--score-bg)]"
            style={{ backgroundColor: p.avatar_color ?? "#999" }}
          >
            {p.nickname?.[0]?.toUpperCase() ?? "?"}
          </div>
        ))}
        {isActive && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[var(--score-bg)] animate-pulse z-10" />
        )}
      </div>

      <div className={align === "right" ? "text-right" : ""}>
        <p className="text-[10px] font-medium leading-tight truncate max-w-[80px]">
          {teamPlayers.map((p) => p.nickname).join(" & ")}
          {isMyTeam && (
            <span className="opacity-40 ml-1 text-[9px]">{youTag}</span>
          )}
        </p>
        <p className="text-xl font-black leading-tight tabular-nums">
          {score}
        </p>
      </div>
    </div>
  );
}

function PlayerScore({
  player,
  score,
  isActive,
  isMe,
  youTag,
  align = "left",
}: {
  player?: { nickname: string; avatar_color: string };
  score: number;
  isActive: boolean;
  isMe: boolean;
  youTag: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2 transition-opacity ${
        isActive ? "opacity-100" : "opacity-50"
      } ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      <div className="relative">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-inner"
          style={{ backgroundColor: player?.avatar_color ?? "#999" }}
        >
          {player?.nickname?.[0]?.toUpperCase() ?? "?"}
        </div>
        {isActive && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[var(--score-bg)] animate-pulse" />
        )}
      </div>

      <div className={align === "right" ? "text-right" : ""}>
        <p className="text-xs font-medium leading-tight">
          {player?.nickname ?? "…"}
          {isMe && (
            <span className="opacity-40 ml-1 text-[10px]">{youTag}</span>
          )}
        </p>
        <p className="text-xl font-black leading-tight tabular-nums">
          {score}
        </p>
      </div>
    </div>
  );
}
