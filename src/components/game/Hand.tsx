"use client";

import { useState } from "react";
import type { Tile } from "@/lib/engine/types";
import TileDisplay from "./TileDisplay";

interface Props {
  tiles: Tile[];
  isMyTurn: boolean;
  boardLeftEnd: number;
  boardRightEnd: number;
  boneyardCount: number;
  onPlay: (tile: Tile, end: "left" | "right") => void;
  onPass: () => void;
  onDraw: () => void;
}

function tileMatchesEnd(tile: Tile, pip: number): boolean {
  return tile[0] === pip || tile[1] === pip;
}

export default function Hand({
  tiles,
  isMyTurn,
  boardLeftEnd,
  boardRightEnd,
  boneyardCount,
  onPlay,
  onPass,
  onDraw,
}: Props) {
  const [selected, setSelected] = useState<Tile | null>(null);

  const hasLegalPlay =
    boardLeftEnd === -1
      ? tiles.length > 0
      : tiles.some(
          (t) => tileMatchesEnd(t, boardLeftEnd) || tileMatchesEnd(t, boardRightEnd)
        );

  function handleTileClick(tile: Tile) {
    if (!isMyTurn) return;
    setSelected((prev) =>
      prev && prev[0] === tile[0] && prev[1] === tile[1] ? null : tile
    );
  }

  function handleEndClick(end: "left" | "right") {
    if (!selected) return;
    onPlay(selected, end);
    setSelected(null);
  }

  const matchesLeft = selected ? tileMatchesEnd(selected, boardLeftEnd) : false;
  const matchesRight = selected ? tileMatchesEnd(selected, boardRightEnd) : false;

  return (
    <div className="space-y-3">
      {isMyTurn && selected && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => handleEndClick("left")}
            disabled={!matchesLeft}
            className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-30 hover:bg-indigo-700 transition-colors"
          >
            ← Play left
          </button>
          <button
            onClick={() => setSelected(null)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleEndClick("right")}
            disabled={!matchesRight}
            className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-30 hover:bg-indigo-700 transition-colors"
          >
            Play right →
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        {tiles.map((tile, i) => (
          <TileDisplay
            key={i}
            tile={tile}
            selected={!!selected && selected[0] === tile[0] && selected[1] === tile[1]}
            onClick={isMyTurn ? () => handleTileClick(tile) : undefined}
          />
        ))}
      </div>

      {isMyTurn && !selected && !hasLegalPlay && boneyardCount > 0 && (
        <div className="flex justify-center pt-1">
          <button
            onClick={onDraw}
            className="px-6 py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            Draw ({boneyardCount} left)
          </button>
        </div>
      )}

      {isMyTurn && !selected && !hasLegalPlay && boneyardCount === 0 && (
        <div className="flex justify-center pt-1">
          <button
            onClick={onPass}
            className="px-6 py-2 text-sm rounded-lg border border-gray-400 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Pass
          </button>
        </div>
      )}

      {!isMyTurn && (
        <p className="text-center text-sm text-gray-500 pt-1">
          Waiting for opponent…
        </p>
      )}
    </div>
  );
}
