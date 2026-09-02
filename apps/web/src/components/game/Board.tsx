"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Tile } from "@capi/engine";
import { layoutBoard, dimsForWidth, type LayoutResult } from "@capi/engine";
import TileDisplay, { TileGradientDefs } from "./TileDisplay";
import { useI18n } from "@/lib/i18n/context";

interface Props {
  board: Tile[];
  /** Emerald halo on the open ends (index 0 and last) while it's your turn. */
  endsGlow?: boolean;
  /** The local hand. When given, only the ends this hand can play on glow. */
  hand?: Tile[];
  /** Tile waiting on the end chooser: the ends it fits pulse, the rest go quiet. */
  selectedTile?: Tile | null;
}

const EMPTY_LAYOUT: LayoutResult = { placements: [], contentW: 0, contentH: 0 };

const NEWEST_RING = {
  borderRadius: "0.5rem",
  boxShadow: "0 0 0 2px rgba(251,191,36,0.55), 0 0 14px rgba(251,191,36,0.3)",
};

const END_GLOW = {
  borderRadius: "0.5rem",
  boxShadow: "0 0 0 2px rgba(52,211,153,0.55), 0 0 12px rgba(52,211,153,0.35)",
};

function matchesEnd(tile: Tile, pip: number): boolean {
  return tile[0] === pip || tile[1] === pip;
}

function sameTile(a: Tile | null, b: Tile | null): boolean {
  if (!a || !b) return a === b;
  return a[0] === b[0] && a[1] === b[1];
}

// The chain grows at either end: a tile played on the left lands at index 0,
// on the right at the last index. Comparing the first tile against the
// previous board tells which end grew. Kept as state that is updated during
// render (React's "information from previous renders" pattern) so the
// newest-tile derivation stays pure and survives unrelated re-renders.
interface Growth {
  len: number;
  first: Tile | null;
  newest: number; // index of the latest play, -1 after a round reset
  grew: boolean;
}

function Board({ board, endsGlow, hand, selectedTile }: Props) {
  const { s } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Observe the scroll container's size so layout recalculates on resize.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compact tiles on narrow screens so more fit per row and the chain stays
  // short; full size on tablet/desktop.
  const dims = dimsForWidth(size.w);
  const layout = useMemo(
    () =>
      board.length > 0 && size.w > 0
        ? layoutBoard(board, size.w, dims)
        : EMPTY_LAYOUT,
    [board, size.w, dims]
  );

  // The inner content div is at least the size of the visible viewport, so
  // short chains sit centered instead of stuck in the top-left corner.
  // Once the chain outgrows the viewport, the inner div grows beyond it and
  // the outer scrolls.
  const innerW = Math.max(layout.contentW, size.w);
  const innerH = Math.max(layout.contentH, size.h);
  const xOffset = (innerW - layout.contentW) / 2;
  const yOffset = (innerH - layout.contentH) / 2;

  const [growth, setGrowth] = useState<Growth>({
    len: 0,
    first: null,
    newest: -1,
    grew: false,
  });
  const first = board.length > 0 ? board[0] : null;
  if (board.length !== growth.len || !sameTile(first, growth.first)) {
    const grew = board.length > growth.len;
    const newest = grew
      ? growth.len > 0 && !sameTile(first, growth.first)
        ? 0
        : board.length - 1
      : -1;
    setGrowth({ len: board.length, first, newest, grew });
  }
  const newestIndex = growth.newest;

  // Auto-scroll to keep the latest played tile in view. Only fires when the
  // chain grows, not on resize and not on round resets.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !growth.grew || layout.placements.length === 0) return;

    // If the whole chain fits in the viewport, no scroll needed.
    if (layout.contentW <= size.w && layout.contentH <= size.h) return;

    const target =
      layout.placements[growth.newest] ??
      layout.placements[layout.placements.length - 1];
    const targetLeft = target.x + xOffset - el.clientWidth / 2;
    const targetTop = target.y + yOffset - el.clientHeight / 2;
    el.scrollTo({
      left: Math.max(0, targetLeft),
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [growth]);

  // Open ends of the serpentine chain are always index 0 (left end, pip
  // board[0][0]) and the last index (right end, pip board[last][1]). A
  // 1-tile board is one tile that is both ends.
  const lastIndex = layout.placements.length - 1;
  const leftPip = board.length > 0 ? board[0][0] : -1;
  const rightPip = board.length > 0 ? board[board.length - 1][1] : -1;
  const playable = useMemo(
    () => ({
      left: hand ? hand.some((t) => matchesEnd(t, leftPip)) : true,
      right: hand ? hand.some((t) => matchesEnd(t, rightPip)) : true,
    }),
    [hand, leftPip, rightPip]
  );
  const fits = {
    left: !!selectedTile && matchesEnd(selectedTile, leftPip),
    right: !!selectedTile && matchesEnd(selectedTile, rightPip),
  };

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-h-0 w-full relative overflow-auto z-0 board-scroll"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <TileGradientDefs />
      {board.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm italic select-none z-[2] pointer-events-none">
          {s.emptyTable}
        </div>
      )}
      <div
        className="relative"
        style={{
          width: innerW,
          height: innerH,
        }}
      >
        {layout.placements.map((p, i) => {
          const isNewest = i === newestIndex;
          const isLeftEnd = i === 0;
          const isRightEnd = i === lastIndex;
          // While a tile waits on the chooser, only the ends it fits light
          // up, and they pulse. Otherwise the amber newest-ring wins over
          // the resting your-turn glow when a tile is both newest and an end.
          const pulse =
            (isLeftEnd && fits.left) || (isRightEnd && fits.right);
          const glow =
            !selectedTile &&
            !!endsGlow &&
            ((isLeftEnd && playable.left) || (isRightEnd && playable.right));
          return (
            <div
              // Re-key the newest tile per play so its slam animation
              // re-triggers even when the same index grows twice in a row
              // (two consecutive plays on the same end).
              key={isNewest ? `n-${i}-${board.length}` : `t-${i}`}
              className={pulse ? "absolute end-pulse" : "absolute"}
              style={{
                left: p.x + xOffset,
                top: p.y + yOffset,
                transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
                willChange: "transform",
              }}
            >
              <div
                className={isNewest && growth.grew ? "animate-tile-slam" : ""}
                style={
                  pulse
                    ? undefined
                    : isNewest
                      ? NEWEST_RING
                      : glow
                        ? END_GLOW
                        : undefined
                }
              >
                <TileDisplay tile={p.tile} w={dims.TW} h={dims.TH} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(Board);
