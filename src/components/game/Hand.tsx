"use client";

import { useState, useRef, useEffect } from "react";
import type { Tile } from "@/lib/engine/types";
import TileDisplay from "./TileDisplay";
import { useI18n } from "@/lib/i18n/context";

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
  const { s } = useI18n();
  const [selected, setSelected] = useState<Tile | null>(null);
  const prevCountRef = useRef(tiles.length);
  const [newTileCount, setNewTileCount] = useState(0);

  useEffect(() => {
    const prev = prevCountRef.current;
    const curr = tiles.length;
    if (curr > prev) {
      setNewTileCount(curr - prev);
      const timer = setTimeout(() => setNewTileCount(0), 1500);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = curr;
  }, [tiles.length]);

  useEffect(() => {
    prevCountRef.current = tiles.length;
  }, [tiles.length]);

  const hasLegalPlay =
    boardLeftEnd === -1
      ? tiles.length > 0
      : tiles.some(
          (t) =>
            tileMatchesEnd(t, boardLeftEnd) ||
            tileMatchesEnd(t, boardRightEnd)
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

  const matchesLeft = selected
    ? tileMatchesEnd(selected, boardLeftEnd)
    : false;
  const matchesRight = selected
    ? tileMatchesEnd(selected, boardRightEnd)
    : false;

  return (
    <div className="space-y-3">
      {isMyTurn && selected && (
        <div className="flex items-center justify-center gap-3 animate-slide-up">
          <button
            onClick={() => handleEndClick("left")}
            disabled={!matchesLeft}
            className="px-4 py-2 text-sm rounded-xl bg-[var(--accent)] text-white font-semibold disabled:opacity-30 hover:brightness-110 transition-all active:scale-95"
          >
            {s.leftEnd}
          </button>
          <button
            onClick={() => setSelected(null)}
            className="px-3 py-2 text-sm rounded-xl border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
          <button
            onClick={() => handleEndClick("right")}
            disabled={!matchesRight}
            className="px-4 py-2 text-sm rounded-xl bg-[var(--accent)] text-white font-semibold disabled:opacity-30 hover:brightness-110 transition-all active:scale-95"
          >
            {s.rightEnd}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 justify-center">
        {tiles.map((tile, i) => {
          const isPlayable =
            isMyTurn &&
            !selected &&
            (boardLeftEnd === -1 ||
              tileMatchesEnd(tile, boardLeftEnd) ||
              tileMatchesEnd(tile, boardRightEnd));

          const isNewTile =
            newTileCount > 0 && i >= tiles.length - newTileCount;
          const staggerIdx = isNewTile
            ? i - (tiles.length - newTileCount)
            : 0;

          return (
            <div
              key={i}
              className={isNewTile ? "animate-tile-enter" : ""}
              style={
                isNewTile
                  ? { animationDelay: `${staggerIdx * 150}ms` }
                  : undefined
              }
            >
              <TileDisplay
                tile={tile}
                selected={
                  !!selected &&
                  selected[0] === tile[0] &&
                  selected[1] === tile[1]
                }
                highlight={isPlayable}
                onClick={isMyTurn ? () => handleTileClick(tile) : undefined}
              />
            </div>
          );
        })}
      </div>

      {isMyTurn && !selected && !hasLegalPlay && boneyardCount > 0 && (
        <div className="flex justify-center pt-1">
          <button
            onClick={onDraw}
            className="px-6 py-2.5 text-sm rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-all active:scale-95 shadow-md"
          >
            {s.draw(boneyardCount)}
          </button>
        </div>
      )}

      {isMyTurn && !selected && !hasLegalPlay && boneyardCount === 0 && (
        <div className="flex justify-center pt-1">
          <button
            onClick={onPass}
            className="px-6 py-2.5 text-sm rounded-xl border-2 border-[var(--accent)] text-[var(--accent)] font-semibold hover:bg-[var(--accent)]/10 transition-all active:scale-95"
          >
            {s.pass}
          </button>
        </div>
      )}

      {!isMyTurn && (
        <p className="text-center text-sm text-gray-500 pt-1 select-none">
          {s.waitingTurn}
        </p>
      )}
    </div>
  );
}
