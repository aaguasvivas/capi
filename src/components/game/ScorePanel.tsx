"use client";

interface Props {
  scores: [number, number];
  targetScore: number;
  players: Array<{ seat: string; nickname: string; avatar_color: string }>;
  currentTurn: string;
  mySeat: string;
}

export default function ScorePanel({ scores, targetScore, players, currentTurn, mySeat }: Props) {
  const north = players.find((p) => p.seat === "n");
  const south = players.find((p) => p.seat === "s");

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      <PlayerScore
        player={north}
        score={scores[0]}
        target={targetScore}
        isActive={currentTurn === "n"}
        isMe={mySeat === "n"}
      />
      <div className="text-xs text-gray-400 text-center">
        first to {targetScore}
      </div>
      <PlayerScore
        player={south}
        score={scores[1]}
        target={targetScore}
        isActive={currentTurn === "s"}
        isMe={mySeat === "s"}
      />
    </div>
  );
}

function PlayerScore({
  player,
  score,
  target,
  isActive,
  isMe,
}: {
  player?: { nickname: string; avatar_color: string };
  score: number;
  target: number;
  isActive: boolean;
  isMe: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${isActive ? "opacity-100" : "opacity-50"}`}>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: player?.avatar_color ?? "#999" }}
      >
        {player?.nickname?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-900">
          {player?.nickname ?? "…"} {isMe && <span className="text-gray-400">(you)</span>}
        </p>
        <p className="text-sm font-bold text-gray-900">
          {score}
          <span className="text-xs text-gray-400 font-normal"> / {target}</span>
        </p>
      </div>
      {isActive && (
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      )}
    </div>
  );
}
