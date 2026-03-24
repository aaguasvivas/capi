"use client";

interface Props {
  scores: [number, number];
  targetScore: number;
  players: Array<{ seat: string; nickname: string; avatar_color: string }>;
  currentTurn: string;
  mySeat: string;
}

export default function ScorePanel({
  scores,
  targetScore,
  players,
  currentTurn,
  mySeat,
}: Props) {
  const north = players.find((p) => p.seat === "n");
  const south = players.find((p) => p.seat === "s");

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-theme-score text-theme-score-text">
      <PlayerScore
        player={north}
        score={scores[0]}
        isActive={currentTurn === "n"}
        isMe={mySeat === "n"}
      />

      <div className="text-center">
        <div className="text-[10px] uppercase tracking-widest opacity-50">
          Primero a
        </div>
        <div className="text-lg font-black">{targetScore}</div>
      </div>

      <PlayerScore
        player={south}
        score={scores[1]}
        isActive={currentTurn === "s"}
        isMe={mySeat === "s"}
        align="right"
      />
    </div>
  );
}

function PlayerScore({
  player,
  score,
  isActive,
  isMe,
  align = "left",
}: {
  player?: { nickname: string; avatar_color: string };
  score: number;
  isActive: boolean;
  isMe: boolean;
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
            <span className="opacity-40 ml-1 text-[10px]">(tú)</span>
          )}
        </p>
        <p className="text-xl font-black leading-tight tabular-nums">
          {score}
        </p>
      </div>
    </div>
  );
}
