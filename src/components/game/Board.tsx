"use client";

import { useRef, useState, useEffect } from "react";
import type { Tile } from "@/lib/engine/types";
import TileDisplay from "./TileDisplay";
import { useI18n } from "@/lib/i18n/context";

interface Props {
  board: Tile[];
}

// Tile dimensions when rendered at TileDisplay's `small` size (w-9 h-[72px]).
// All math below assumes the tile is in its natural standing-upright pose;
// rotation is applied via CSS transform around the tile center.
const TW = 36; // short side
const TH = 72; // long side
const GAP = 6; // between adjacent tiles (in row, and around corners)
const EDGE = 28; // padding inside the inner content div
// Vertical distance between successive row centerlines.
// Must work even when the tile bordering the corner is a DOUBLE in the
// current row AND the first tile of the next row is also a double — both
// extend TH/2 above and below their centerline (vs TW/2 for horizontals).
// Worst-case spacing:
//   double's half-height (TH/2) + gap + corner-tile (TH) + gap + double's half-height (TH/2)
//   = TH + TH + 2·GAP = 156
const ROW_STEP = TH + TH + 2 * GAP;

interface Placed {
  tile: Tile;
  x: number;
  y: number;
  rot: number; // 0 for vertical (doubles + corners), ±90 for horizontal row tiles
}

interface LayoutResult {
  placements: Placed[];
  contentW: number;
  contentH: number;
}

/**
 * Approach A — fixed-size tiles, scroll when the chain overflows.
 *
 * Tiles never scale. The chain is laid along a deterministic S-curve:
 *   row 0 goes left → right
 *   the next tile that won't fit + corner-reserve becomes the corner
 *     (placed vertically, bridging row 0 and row 1)
 *   row 1 goes right → left
 *   …and so on, alternating direction.
 *
 * Every tile's position depends only on the tiles before it, so the layout
 * is stable: adding tile N+1 never moves tiles 0..N. The whole content
 * group is shifted+centered within the visible canvas; when content exceeds
 * canvas, the scroll container handles it and we auto-pan to the latest play.
 */
function layoutBoard(board: Tile[], availW: number): LayoutResult {
  const empty: LayoutResult = { placements: [], contentW: 0, contentH: 0 };
  if (!board.length || availW < 200) return empty;

  const isDbl = (t: Tile) => t[0] === t[1];
  const tileLen = (t: Tile) => (isDbl(t) ? TW : TH);

  // A "row" is the horizontal lane that tiles fill before wrapping.
  // We use as much of the visible width as is sensible, but always leave
  // room at the trailing edge for the perpendicular corner tile.
  // Minimum sensible row: at least one horizontal tile plus the corner reserve.
  const minRow = TH + GAP + TW;
  const rowMaxW = Math.max(minRow, availW - EDGE * 2);

  const placements: Placed[] = [];
  let row = 0;
  let dir: 1 | -1 = 1; // 1 = left-to-right, -1 = right-to-left
  // `cursor` is the leading edge of the next tile placement. For LTR it's
  // the left edge, for RTL it's the right edge.
  let cursor = 0;
  let placedInRow = 0;

  for (let i = 0; i < board.length; i++) {
    const tile = board[i];
    const len = tileLen(tile);
    const isLast = i === board.length - 1;
    // Space we need to reserve for the perpendicular corner tile after this
    // one. If this is the final tile in the chain, we don't need to reserve.
    const reserve = isLast ? 0 : GAP + TW;

    const fitsInRow =
      dir === 1
        ? cursor + len + reserve <= rowMaxW
        : cursor - len - reserve >= 0;

    if (!fitsInRow && placedInRow > 0) {
      // This tile bridges the chain into the next row. Place it vertically
      // at the row trailing edge, then flip direction and continue with the
      // next tile starting the new row.
      const cornerX = dir === 1 ? cursor + TW / 2 : cursor - TW / 2;
      const cornerY = row * ROW_STEP + ROW_STEP / 2;
      placements.push({ tile, x: cornerX, y: cornerY, rot: 0 });

      row++;
      dir = (dir === 1 ? -1 : 1) as 1 | -1;
      placedInRow = 0;
      // New row's leading edge aligns with the corner's centerline so the
      // visual flow continues smoothly from the corner into the row below.
      cursor = dir === 1 ? cornerX - TW / 2 + TW + GAP : cornerX + TW / 2 - TW - GAP;
      // Clamp so we never start a row mid-canvas if the corner happened far
      // in from the edge — keep behavior identical to "anchor at row edge."
      // (This usually no-ops; only the geometry of the corner placement.)
      continue;
    }

    // Regular row placement: horizontal tile (or a double which is naturally vertical).
    const cx = dir === 1 ? cursor + len / 2 : cursor - len / 2;
    const cy = row * ROW_STEP;
    placements.push({
      tile,
      x: cx,
      y: cy,
      rot: isDbl(tile) ? 0 : dir === 1 ? -90 : 90,
    });

    if (dir === 1) cursor += len + GAP;
    else cursor -= len + GAP;
    placedInRow++;
  }

  // Compute the actual bounding box of all placed tiles (rotation-aware).
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of placements) {
    const isVert = p.rot === 0;
    const halfW = isVert ? TW / 2 : TH / 2;
    const halfH = isVert ? TH / 2 : TW / 2;
    if (p.x - halfW < minX) minX = p.x - halfW;
    if (p.x + halfW > maxX) maxX = p.x + halfW;
    if (p.y - halfH < minY) minY = p.y - halfH;
    if (p.y + halfH > maxY) maxY = p.y + halfH;
  }

  // Normalize so the top-left of the bbox sits at (EDGE, EDGE) within the
  // content area. This makes the inner div easy to size and position.
  for (const p of placements) {
    p.x = p.x - minX + EDGE;
    p.y = p.y - minY + EDGE;
  }

  const contentW = maxX - minX + EDGE * 2;
  const contentH = maxY - minY + EDGE * 2;
  return { placements, contentW, contentH };
}

export default function Board({ board }: Props) {
  const { s } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const lastBoardLenRef = useRef(0);

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

  // Auto-scroll to keep the latest played tile in view. Only fires when the
  // tile count grows — not on resize, not on round resets.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || layout.placements.length === 0) return;
    const prevLen = lastBoardLenRef.current;
    const currLen = layout.placements.length;
    lastBoardLenRef.current = currLen;
    if (currLen <= prevLen) return; // round reset or no change

    // If the whole chain fits in the viewport, no scroll needed.
    if (layout.contentW <= size.w && layout.contentH <= size.h) return;

    const last = layout.placements[currLen - 1];
    const targetLeft = last.x + xOffset - el.clientWidth / 2;
    const targetTop = last.y + yOffset - el.clientHeight / 2;
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
        {layout.placements.map((p, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: p.x + xOffset,
              top: p.y + yOffset,
              transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
              willChange: "transform",
            }}
          >
            <TileDisplay tile={p.tile} small />
          </div>
        ))}
      </div>
    </div>
  );
}
