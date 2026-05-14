"use client";

import { useRef, useState, useEffect } from "react";
import type { Tile } from "@/lib/engine/types";
import TileDisplay from "./TileDisplay";
import { useI18n } from "@/lib/i18n/context";

interface Props {
  board: Tile[];
}

// Tile dimensions in upright orientation (must match TileDisplay's `small` size: w-9 h-[72px])
const TW = 36; // short side (width upright)
const TH = 72; // long side (height upright)

interface Placed {
  tile: Tile;
  x: number; // canvas-space center, after centering + scaling
  y: number; // canvas-space center, after centering + scaling
  rot: number; // 0, 90, or -90 deg
  scale: number;
}

/**
 * Lay tiles along a deterministic S-curve path that never overlaps itself.
 *
 *   ROW LAYOUT
 *   Each "row" is a horizontal lane of tiles. A row tile is rendered
 *   horizontally (rotated ±90°), so its rendered height = TW.
 *
 *   CORNER / TURN TILE
 *   When a row fills, the very next tile becomes the "corner" — placed
 *   vertically (rot=0, rendered height = TH) bridging two consecutive rows.
 *   The direction of the next row flips (LTR → RTL or vice-versa).
 *
 *   ROW SPACING
 *   ROW_STEP is the vertical distance between successive row centerlines.
 *   It must accommodate:
 *     half a horizontal tile (TW/2)
 *   + GAP
 *   + full vertical corner tile (TH)
 *   + GAP
 *   + half a horizontal tile (TW/2)
 *   = TW + TH + 2·GAP
 *   This is the fix for the prior overlap bug where ROW_STEP was set to
 *   TH + 12 = 84, causing the corner tile to crash into both adjacent rows.
 *
 *   PRE-ALLOCATION
 *   Tile positions are computed in a single forward pass; each tile's
 *   coordinates depend only on the tiles before it. The whole chain is
 *   then translated to center within the canvas, and scaled down only if
 *   the bounding box exceeds the canvas.
 */
function layout(board: Tile[], cw: number, ch: number): Placed[] {
  if (!board.length || cw < 100 || ch < 60) return [];

  const isDbl = (t: Tile) => t[0] === t[1];
  const tileLen = (t: Tile) => (isDbl(t) ? TW : TH);

  const GAP = 4;
  const EDGE = 16;
  const ROW_STEP = TW + TH + 2 * GAP; // 116

  // ─── Single-row attempt ─────────────────────────────────────────────────
  const chainLen =
    board.reduce((s, t) => s + tileLen(t), 0) + (board.length - 1) * GAP;

  if (chainLen <= cw - 2 * EDGE) {
    const startX = (cw - chainLen) / 2;
    const y = ch / 2;
    const placed: Placed[] = [];
    let x = startX;
    for (const tile of board) {
      const len = tileLen(tile);
      placed.push({
        tile,
        x: x + len / 2,
        y,
        rot: isDbl(tile) ? 0 : -90,
        scale: 1,
      });
      x += len + GAP;
    }
    return placed;
  }

  // ─── Multi-row S-curve ─────────────────────────────────────────────────
  // A row must hold at least one horizontal tile (TH) plus room reserved
  // at the far end for a corner (GAP + TW). If not, we still attempt a
  // single line — it'll be scaled down to fit at the end.
  const canSnake = cw - 2 * EDGE >= TH + GAP + TW;

  const placed: Placed[] = [];

  if (!canSnake) {
    // Fallback: lay out as a single horizontal line; final scaling shrinks it.
    let x = 0;
    const y = 0;
    for (const tile of board) {
      const len = tileLen(tile);
      placed.push({
        tile,
        x: x + len / 2,
        y,
        rot: isDbl(tile) ? 0 : -90,
        scale: 1,
      });
      x += len + GAP;
    }
  } else {
    let i = 0;
    let row = 0;
    let dir: 1 | -1 = 1; // 1 = left→right, -1 = right→left

    while (i < board.length) {
      const rowY = row * ROW_STEP; // center y of this row

      // Leading edge cursor: for LTR, this is the LEFT edge of next tile.
      // For RTL, this is the RIGHT edge of next tile.
      let cursor = dir === 1 ? EDGE : cw - EDGE;
      let placedInRow = 0;

      // Lay tiles in this row until next one wouldn't fit (with corner reserve)
      while (i < board.length) {
        const tile = board[i];
        const len = tileLen(tile);
        const hasMoreAfter = i < board.length - 1;
        const reserve = hasMoreAfter ? GAP + TW : 0; // space for corner + gap

        let fits: boolean;
        if (dir === 1) {
          fits = cursor + len + reserve <= cw - EDGE;
        } else {
          fits = cursor - len - reserve >= EDGE;
        }

        if (!fits && placedInRow > 0) break;

        const cx = dir === 1 ? cursor + len / 2 : cursor - len / 2;
        placed.push({
          tile,
          x: cx,
          y: rowY,
          rot: isDbl(tile) ? 0 : dir === 1 ? -90 : 90,
          scale: 1,
        });

        if (dir === 1) cursor += len + GAP;
        else cursor -= len + GAP;
        placedInRow++;
        i++;
      }

      if (i < board.length) {
        // Place corner tile: vertical, bridging this row and the next
        const tile = board[i];
        const cornerX = dir === 1 ? cursor + TW / 2 : cursor - TW / 2;
        const cornerY = rowY + ROW_STEP / 2;
        placed.push({
          tile,
          x: cornerX,
          y: cornerY,
          rot: 0,
          scale: 1,
        });
        i++;
        row++;
        dir = (dir === 1 ? -1 : 1) as 1 | -1;
      }
    }
  }

  if (!placed.length) return [];

  // ─── Center bounding box + scale to fit ─────────────────────────────────
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of placed) {
    const halfW = p.rot === 0 ? TW / 2 : TH / 2;
    const halfH = p.rot === 0 ? TH / 2 : TW / 2;
    minX = Math.min(minX, p.x - halfW);
    maxX = Math.max(maxX, p.x + halfW);
    minY = Math.min(minY, p.y - halfH);
    maxY = Math.max(maxY, p.y + halfH);
  }

  const bboxW = maxX - minX;
  const bboxH = maxY - minY;

  const PAD = 14;
  const availW = Math.max(1, cw - 2 * PAD);
  const availH = Math.max(1, ch - 2 * PAD);

  const sx = availW / bboxW;
  const sy = availH / bboxH;
  const scale = Math.min(1, sx, sy);

  const bboxCx = (minX + maxX) / 2;
  const bboxCy = (minY + maxY) / 2;

  for (const p of placed) {
    p.x = cw / 2 + (p.x - bboxCx) * scale;
    p.y = ch / 2 + (p.y - bboxCy) * scale;
    p.scale = scale;
  }

  return placed;
}

export default function Board({ board }: Props) {
  const { s } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tiles =
    board.length > 0 && size.w > 0 ? layout(board, size.w, size.h) : [];

  return (
    <div
      ref={ref}
      className="flex-1 min-h-0 w-full relative overflow-hidden z-0"
    >
      {board.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm italic select-none">
          {s.emptyTable}
        </div>
      )}
      {tiles.map((p, i) => (
        <div
          key={i}
          className="absolute transition-transform duration-200 ease-out"
          style={{
            left: p.x,
            top: p.y,
            transform: `translate(-50%, -50%) rotate(${p.rot}deg) scale(${p.scale})`,
          }}
        >
          <TileDisplay tile={p.tile} small />
        </div>
      ))}
    </div>
  );
}
