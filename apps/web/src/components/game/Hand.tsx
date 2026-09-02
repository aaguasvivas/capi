"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { Tile } from "@capi/engine";
import TileDisplay, { TileGradientDefs } from "./TileDisplay";
import { useI18n } from "@/lib/i18n/context";

type End = "left" | "right";

interface Props {
  tiles: Tile[];
  isMyTurn: boolean;
  boardLeftEnd: number;
  boardRightEnd: number;
  boneyardCount: number;
  onPlay: (tile: Tile, end: End) => void;
  onPass: () => void;
  onDraw: () => void;
  /** Fires with the tile waiting on the end chooser, or null once it closes. */
  onSelect?: (tile: Tile | null) => void;
}

// From this many tiles on, the hand uses the small preset so a drawn-up
// 1v1 hand still fits inside its capped height.
const SMALL_HAND_AT = 9;

const END_BUTTON =
  "min-h-[40px] px-4 text-sm rounded-xl bg-[var(--accent)] text-white font-semibold hover:brightness-110 transition-all active:scale-95";

function matchesEnd(tile: Tile, pip: number): boolean {
  return tile[0] === pip || tile[1] === pip;
}

function sameTile(a: Tile, b: Tile): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function tileKey(tile: Tile): string {
  return `${tile[0]}-${tile[1]}`;
}

function Hand({
  tiles,
  isMyTurn,
  boardLeftEnd,
  boardRightEnd,
  boneyardCount,
  onPlay,
  onPass,
  onDraw,
  onSelect,
}: Props) {
  const { s } = useI18n();
  const [selected, setSelected] = useState<Tile | null>(null);
  // The tile that was tapped but fits nowhere. n re-keys it so a second tap
  // restarts the shake even mid-animation; the finished animation rests at
  // the identity frame, so the entry can linger until the next shake.
  const [shake, setShake] = useState<{ key: string; n: number } | null>(null);
  const prevCountRef = useRef(tiles.length);
  const [newTileCount, setNewTileCount] = useState(0);

  useEffect(() => {
    const added = tiles.length - prevCountRef.current;
    prevCountRef.current = tiles.length;
    if (added <= 0) return;
    setNewTileCount(added);
    const timer = setTimeout(() => setNewTileCount(0), 1500);
    return () => clearTimeout(timer);
  }, [tiles.length]);

  const select = useCallback(
    (tile: Tile | null) => {
      setSelected(tile);
      onSelect?.(tile);
    },
    [onSelect]
  );

  // Clear any stale tile selection when it's no longer my turn or a new
  // round starts with an empty board.
  useEffect(() => {
    if (selected && (!isMyTurn || boardLeftEnd === -1)) select(null);
  }, [selected, isMyTurn, boardLeftEnd, select]);

  const boardEmpty = boardLeftEnd === -1;
  const hasLegalPlay = boardEmpty
    ? tiles.length > 0
    : tiles.some(
        (t) => matchesEnd(t, boardLeftEnd) || matchesEnd(t, boardRightEnd)
      );

  // Play the end the tap meant. One matching end plays at once. Two matching
  // ends showing the same pip are the same play, so that goes at once too.
  // Only two different pips need the chooser. A tile that fits nowhere
  // shakes instead of opening a dead-end panel.
  const handleTileClick = useCallback(
    (tile: Tile) => {
      if (!isMyTurn) return;
      if (boardEmpty) {
        onPlay(tile, "left");
        return;
      }
      if (selected && sameTile(selected, tile)) {
        select(null);
        return;
      }
      const left = matchesEnd(tile, boardLeftEnd);
      const right = matchesEnd(tile, boardRightEnd);
      if (!left && !right) {
        const key = tileKey(tile);
        setShake((prev) => ({ key, n: (prev?.n ?? 0) + 1 }));
        return;
      }
      if (left && right && boardLeftEnd !== boardRightEnd) {
        select(tile);
        return;
      }
      onPlay(tile, right ? "right" : "left");
      if (selected) select(null);
    },
    [isMyTurn, boardEmpty, boardLeftEnd, boardRightEnd, onPlay, select, selected]
  );

  function handleEndClick(end: End) {
    if (!selected) return;
    onPlay(selected, end);
    select(null);
  }

  const small = tiles.length >= SMALL_HAND_AT;
  const chooser = isMyTurn && selected;

  return (
    <div className="hand-cap flex flex-col gap-2">
      <TileGradientDefs />

      {/* Top padding leaves room for the raised selected tile inside the
          scroll clip; the list wraps and scrolls once the cap is reached. */}
      <div className="min-h-0 overflow-y-auto overscroll-contain flex flex-wrap content-start justify-center gap-1.5 px-0.5 pt-4 pb-1">
        {tiles.map((tile, i) => {
          const key = tileKey(tile);
          const isSelected = !!selected && sameTile(selected, tile);
          const isPlayable =
            isMyTurn &&
            !selected &&
            (boardEmpty ||
              matchesEnd(tile, boardLeftEnd) ||
              matchesEnd(tile, boardRightEnd));
          const isNewTile =
            newTileCount > 0 && i >= tiles.length - newTileCount;
          const staggerIdx = isNewTile
            ? i - (tiles.length - newTileCount)
            : 0;
          const shaking = shake?.key === key;

          return (
            <div
              key={shaking ? `${key}-shake-${shake.n}` : key}
              className={
                shaking
                  ? "animate-tile-shake"
                  : isNewTile
                    ? "animate-tile-enter"
                    : undefined
              }
              style={
                isNewTile && !shaking
                  ? { animationDelay: `${staggerIdx * 150}ms` }
                  : undefined
              }
            >
              <TileDisplay
                tile={tile}
                small={small}
                selected={isSelected}
                highlight={isPlayable}
                onClick={isMyTurn ? handleTileClick : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* One fixed-height action row: the chooser, draw, pass, or the
          waiting note all take the same slot, so the hand never jumps. */}
      <div className="h-11 flex-shrink-0 flex items-center justify-center">
        {chooser ? (
          <div className="flex items-center gap-3 animate-slide-up">
            <button
              type="button"
              onClick={() => handleEndClick("left")}
              className={END_BUTTON}
            >
              {s.playOnEnd(boardLeftEnd)}
            </button>
            <button
              type="button"
              onClick={() => select(null)}
              aria-label={s.closeTray}
              className="min-w-[40px] min-h-[40px] px-3 text-sm rounded-xl border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => handleEndClick("right")}
              className={END_BUTTON}
            >
              {s.playOnEnd(boardRightEnd)}
            </button>
          </div>
        ) : isMyTurn && !hasLegalPlay && boneyardCount > 0 ? (
          <button
            type="button"
            onClick={onDraw}
            className="min-h-[40px] px-6 text-sm rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-all active:scale-95 shadow-md"
          >
            {s.draw(boneyardCount)}
          </button>
        ) : isMyTurn && !hasLegalPlay ? (
          <button
            type="button"
            onClick={onPass}
            className="min-h-[40px] px-6 text-sm rounded-xl border-2 border-[var(--accent)] text-[var(--accent)] font-semibold hover:bg-[var(--accent)]/10 transition-all active:scale-95"
          >
            {s.pass}
          </button>
        ) : !isMyTurn ? (
          <p className="text-sm text-gray-500 select-none">{s.waitingTurn}</p>
        ) : null}
      </div>
    </div>
  );
}

export default memo(Hand);
