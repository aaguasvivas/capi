"use client";

import type { Tile } from "@/lib/engine/types";
import TileDisplay from "./TileDisplay";

interface Props {
  board: Tile[];
}

export default function Board({ board }: Props) {
  if (board.length === 0) {
    return (
      <div className="flex items-center justify-center h-28 text-gray-400 text-sm">
        No tiles played yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto py-2">
      <div className="flex items-center gap-1 min-w-max px-2">
        {board.map((tile, i) => (
          <TileDisplay key={i} tile={tile} small />
        ))}
      </div>
    </div>
  );
}
