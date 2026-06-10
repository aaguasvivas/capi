"use client";

import { useRef, useState, useEffect } from "react";
import type { Tile } from "@/lib/engine/types";
import TileDisplay from "./TileDisplay";
import { useI18n } from "@/lib/i18n/context";
import { layoutBoard } from "./boardLayout";

interface Props {
  board: Tile[];
}

export default function Board({ board }: Props) {
  const { s } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const lastBoardLenRef = useRef(0);
  const prevFirstTileRef = useRef<Tile | null>(null);

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

  const layout =
    board.length > 0 && size.w > 0
      ? layoutBoard(board, size.w)
      : { placements: [], contentW: 0, contentH: 0 };

  // The inner content div is at least the size of the visible viewport, so
  // short chains sit centered instead of stuck in the top-left corner.
  // Once the chain outgrows the viewport, the inner div grows beyond it and
  // the outer scrolls.
  const innerW = Math.max(layout.contentW, size.w);
  const innerH = Math.max(layout.contentH, size.h);
  const xOffset = (innerW - layout.contentW) / 2;
  const yOffset = (innerH - layout.contentH) / 2;

  // The chain grows at either end: a tile played on the left end lands at
  // index 0, on the right end at the last index. Detect which end grew by
  // comparing the first tile against the previous render, and remember it
  // so the last-move highlight survives unrelated re-renders.
  const newestIndexRef = useRef(-1);
  const prevLen = lastBoardLenRef.current;
  const grew = board.length > prevLen;
  if (grew) {
    const prevFirst = prevFirstTileRef.current;
    newestIndexRef.current =
      prevLen > 0 &&
      prevFirst &&
      (board[0][0] !== prevFirst[0] || board[0][1] !== prevFirst[1])
        ? 0
        : board.length - 1;
  } else if (board.length < prevLen) {
    newestIndexRef.current = -1; // round reset
  }
  const newestIndex = newestIndexRef.current;

  useEffect(() => {
    lastBoardLenRef.current = board.length;
    prevFirstTileRef.current = board.length > 0 ? board[0] : null;
  }, [board]);

  // Auto-scroll to keep the latest played tile in view. Only fires when the
  // tile count grows — not on resize, not on round resets.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || layout.placements.length === 0 || !grew) return;

    // If the whole chain fits in the viewport, no scroll needed.
    if (layout.contentW <= size.w && layout.contentH <= size.h) return;

    const target = layout.placements[newestIndex] ?? layout.placements[layout.placements.length - 1];
    const targetLeft = target.x + xOffset - el.clientWidth / 2;
    const targetTop = target.y + yOffset - el.clientHeight / 2;
    el.scrollTo({
      left: Math.max(0, targetLeft),
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.length, layout.contentW, layout.contentH, size.w, size.h]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-h-0 w-full relative overflow-auto z-0 board-scroll"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
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
          return (
            <div
              // Re-key the newest tile per play so its slam animation
              // re-triggers even when the same index grows twice in a row
              // (two consecutive plays on the same end).
              key={isNewest ? `n-${i}-${board.length}` : `t-${i}`}
              className="absolute"
              style={{
                left: p.x + xOffset,
                top: p.y + yOffset,
                transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
                willChange: "transform",
              }}
            >
              <div
                className={isNewest && grew ? "animate-tile-slam" : ""}
                style={
                  isNewest
                    ? {
                        borderRadius: "0.5rem",
                        boxShadow:
                          "0 0 0 2px rgba(251,191,36,0.55), 0 0 14px rgba(251,191,36,0.3)",
                      }
                    : undefined
                }
              >
                <TileDisplay tile={p.tile} small />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
