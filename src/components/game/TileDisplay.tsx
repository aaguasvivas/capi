"use client";

import type { Tile } from "@/lib/engine/types";

interface Props {
  tile: Tile;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  faceDown?: boolean;
}

const PIP_POSITIONS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

function PipHalf({ pips, small }: { pips: number; small: boolean }) {
  const size = small ? 32 : 44;
  const pipR = small ? 3 : 4;
  const positions = PIP_POSITIONS[pips] ?? [];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {positions.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={pipR * (100 / size)} fill="currentColor" />
      ))}
    </svg>
  );
}

export default function TileDisplay({ tile, selected, onClick, small = false, faceDown = false }: Props) {
  const base = small ? "w-8 h-16" : "w-11 h-24";
  const dividerH = small ? "h-px" : "h-px";

  if (faceDown) {
    return (
      <div
        className={`${base} rounded bg-gray-800 border border-gray-600 flex items-center justify-center`}
      >
        <div className="w-3/4 h-3/4 rounded border border-gray-600 opacity-30" />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        ${base} rounded border-2 flex flex-col items-center justify-around
        bg-white text-gray-900 font-bold select-none transition-all
        ${selected ? "border-indigo-500 shadow-lg scale-105" : "border-gray-300"}
        ${onClick ? "hover:border-indigo-400 hover:scale-105 cursor-pointer" : "cursor-default"}
      `}
    >
      <PipHalf pips={tile[0]} small={small} />
      <div className={`w-3/4 ${dividerH} bg-gray-300`} />
      <PipHalf pips={tile[1]} small={small} />
    </button>
  );
}
