"use client";

import type { Tile } from "@/lib/engine/types";

interface Props {
  tile: Tile;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  faceDown?: boolean;
  highlight?: boolean;
}

const PIP_POSITIONS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[30, 28], [70, 72]],
  3: [[30, 24], [50, 50], [70, 76]],
  4: [[30, 28], [70, 28], [30, 72], [70, 72]],
  5: [[30, 24], [70, 24], [50, 50], [30, 76], [70, 76]],
  6: [[30, 22], [70, 22], [30, 50], [70, 50], [30, 78], [70, 78]],
};

function PipHalf({ pips }: { pips: number }) {
  const positions = PIP_POSITIONS[pips] ?? [];
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full block">
      {positions.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={10} fill="#1a1a1a" />
      ))}
    </svg>
  );
}

export default function TileDisplay({
  tile,
  selected,
  onClick,
  small = false,
  faceDown = false,
  highlight = false,
}: Props) {
  const isDouble = tile[0] === tile[1];
  const sizeClasses = small ? "w-9 h-[72px]" : "w-11 h-[88px]";

  if (faceDown) {
    return (
      <div
        className={`
          ${sizeClasses} rounded-lg
          bg-gradient-to-br from-[#1e3a5f] via-[#1a3355] to-[#152a4a]
          border-2 border-[#0f1f35]
          flex items-center justify-center shadow-md
        `}
      >
        <div
          className={`
            ${small ? "w-5 h-12" : "w-7 h-16"}
            rounded-md border border-[#2a5a8c]/30
            bg-gradient-to-br from-[#2a5a8c]/20 to-transparent
          `}
        />
      </div>
    );
  }

  const tileBg = isDouble
    ? "bg-gradient-to-br from-[#F2EBDA] via-[#ECE4CC] to-[#E5DDC0]"
    : "bg-gradient-to-br from-[#FBF8ED] via-[#F7F2E0] to-[#F0EAD2]";

  const doubleBorder = isDouble
    ? "border-[#8a7d60] border-[3px]"
    : "border-[#c8bc9e] border-2";

  const borderShadow = selected
    ? "border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.5)] scale-110 -translate-y-2 z-10"
    : highlight
      ? `${doubleBorder} ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5),0_0_4px_rgba(52,211,153,0.25)_inset] -translate-y-0.5`
      : isDouble
        ? "border-[#8a7d60] shadow-[0_2px_6px_rgba(0,0,0,0.22)]"
        : "border-[#c8bc9e] shadow-[0_2px_4px_rgba(0,0,0,0.12)]";

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        ${sizeClasses} rounded-lg flex flex-col items-center justify-center
        relative select-none transition-all duration-150
        ${tileBg}
        ${highlight || selected ? "" : isDouble ? "border-[3px]" : "border-2"}
        ${borderShadow}
        ${
          onClick && !selected
            ? "hover:scale-105 hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.18)] cursor-pointer active:scale-[0.98] active:translate-y-0"
            : "cursor-default"
        }
      `}
    >
      <div className="flex-1 w-full">
        <PipHalf pips={tile[0]} />
      </div>

      <div
        className={`w-[70%] flex-shrink-0 bg-gradient-to-r from-transparent to-transparent ${
          isDouble
            ? "h-[2.5px] via-[#8a7d60]"
            : small
              ? "h-[1.5px] via-[#b8a882]"
              : "h-[2px] via-[#b8a882]"
        }`}
      />

      <div className="flex-1 w-full">
        <PipHalf pips={tile[1]} />
      </div>
    </button>
  );
}
