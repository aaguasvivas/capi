import type { Tile } from "@/lib/engine/types";

// Tile + spacing dimensions for the board chain, in layout px. Two tiers:
// the full-size desktop/tablet set and a crisp compact set for narrow phones,
// where smaller tiles fit more per row and keep the snake from scrolling far.
// (All values stay integers so tiles render sharp — we shrink the tile, we
// don't CSS-scale it.)
export interface TileDims {
  TW: number; // short side
  TH: number; // long side
  GAP: number; // between adjacent tiles within a row, and around corners
  EDGE: number; // padding inside the inner content div
  // Clear air kept between the tiles of one row and the next — see note below.
  VGAP: number;
}

export const DEFAULT_DIMS: TileDims = { TW: 36, TH: 72, GAP: 6, EDGE: 28, VGAP: 24 };
export const COMPACT_DIMS: TileDims = { TW: 28, TH: 56, GAP: 5, EDGE: 18, VGAP: 18 };

// Container widths below this use the compact tile set.
export const COMPACT_MAX_WIDTH = 460;

export function dimsForWidth(availW: number): TileDims {
  return availW < COMPACT_MAX_WIDTH ? COMPACT_DIMS : DEFAULT_DIMS;
}

// Back-compat default constants (used by tests and any caller that wants the
// full-size numbers without threading dims through).
export const { TW, TH, GAP, EDGE, VGAP } = DEFAULT_DIMS;

// Why row spacing is content-aware rather than a fixed pitch:
// a crosswise double reaches TH/2 from its line while a horizontal tile reaches
// only TW/2, so the gap a double needs is double what a plain tile needs. A
// single pitch tuned for plain rows lets two stacked doubles overlap; one tuned
// for doubles leaves plain rows looking sparse. Instead each row's vertical
// half-extent is measured from its actual tiles (TH/2 if it holds any double,
// else TW/2) and consecutive rows are spaced so exactly VGAP of air sits
// between their nearest edges — uniform clearance everywhere, nothing overlaps.

export interface Placed {
  tile: Tile;
  x: number;
  y: number;
  rot: number; // 0 for vertical (doubles + corners), ±90 for horizontal row tiles
}

export interface LayoutResult {
  placements: Placed[];
  contentW: number;
  contentH: number;
}

/**
 * Fixed-size tiles, scroll when the chain overflows.
 *
 * Tiles never scale mid-layout. The chain is laid along a deterministic
 * S-curve:
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
export function layoutBoard(
  board: Tile[],
  availW: number,
  dims: TileDims = DEFAULT_DIMS
): LayoutResult {
  const empty: LayoutResult = { placements: [], contentW: 0, contentH: 0 };
  const { TW, TH, GAP, EDGE, VGAP } = dims;
  if (!board.length || availW < TH * 2) return empty;

  const isDbl = (t: Tile) => t[0] === t[1];
  const tileLen = (t: Tile) => (isDbl(t) ? TW : TH);

  // A "row" is the horizontal lane that tiles fill before wrapping.
  // We use as much of the visible width as is sensible, but always leave
  // room at the trailing edge for the perpendicular corner tile.
  // Minimum sensible row: at least one horizontal tile plus the corner reserve.
  const minRow = TH + GAP + TW;
  const rowMaxW = Math.max(minRow, availW - EDGE * 2);

  // ── Pass 1: assign each tile a row, x-center and orientation. No Y yet —
  // vertical positions depend on each row's tallest tile, which we only know
  // once the whole chain is laid out.
  interface Pre {
    tile: Tile;
    x: number;
    rot: number;
    rowIndex: number;
    // A corner lives on the midline BETWEEN rowIndex and rowIndex+1.
    isCorner: boolean;
  }
  const pre: Pre[] = [];
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
      // Turn the corner with a vertical tile. Y is resolved in pass 3 to the
      // midline between this row and the next, so its body bridges both — top
      // half meeting the last tile of this row, bottom half the first tile of
      // the next. This is how a real domino train rounds a corner; the chain
      // stays visually unbroken instead of leaving a void at the turn.
      const cornerX = dir === 1 ? cursor + TW / 2 : cursor - TW / 2;
      pre.push({ tile, x: cornerX, rot: 0, rowIndex: row, isCorner: true });

      row++;
      dir = (dir === 1 ? -1 : 1) as 1 | -1;
      placedInRow = 0;
      // Next row resumes one gap inward from the corner, flowing back the
      // other way directly beneath it.
      cursor = dir === 1 ? cornerX + TW / 2 + GAP : cornerX - TW / 2 - GAP;
      continue;
    }

    // Regular row placement: horizontal tile (or a double which is naturally vertical).
    const cx = dir === 1 ? cursor + len / 2 : cursor - len / 2;
    pre.push({
      tile,
      x: cx,
      rot: isDbl(tile) ? 0 : dir === 1 ? -90 : 90,
      rowIndex: row,
      isCorner: false,
    });

    if (dir === 1) cursor += len + GAP;
    else cursor -= len + GAP;
    placedInRow++;
  }

  // ── Pass 2: each row's vertical half-extent — TH/2 if it carries any
  // crosswise double, otherwise TW/2. Corners straddle rows and don't count.
  const rowCount =
    pre.reduce(
      (m, p) => Math.max(m, p.isCorner ? p.rowIndex + 1 : p.rowIndex),
      0
    ) + 1;
  const halfExtent = new Array<number>(rowCount).fill(TW / 2);
  for (const p of pre) {
    if (p.isCorner) continue;
    const h = p.rot === 0 ? TH / 2 : TW / 2;
    if (h > halfExtent[p.rowIndex]) halfExtent[p.rowIndex] = h;
  }

  // Cumulative row centerlines: nearest edges of consecutive rows stay exactly
  // VGAP apart, whatever each row holds.
  const centerY = new Array<number>(rowCount);
  centerY[0] = 0;
  for (let r = 1; r < rowCount; r++) {
    centerY[r] = centerY[r - 1] + halfExtent[r - 1] + VGAP + halfExtent[r];
  }

  // ── Pass 3: resolve Y. Row tiles sit on their centerline; corners on the
  // midline between the row they leave and the one they enter.
  const placements: Placed[] = pre.map((p) => ({
    tile: p.tile,
    x: p.x,
    y: p.isCorner
      ? (centerY[p.rowIndex] + centerY[p.rowIndex + 1]) / 2
      : centerY[p.rowIndex],
    rot: p.rot,
  }));

  // Compute the actual bounding box of all placed tiles (rotation-aware).
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of placements) {
    const { halfW, halfH } = tileHalfExtents(p, dims);
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

/** Half-width/half-height of a placed tile's axis-aligned bounding box. */
export function tileHalfExtents(
  p: Placed,
  dims: TileDims = DEFAULT_DIMS
): { halfW: number; halfH: number } {
  const isVert = p.rot === 0;
  return {
    halfW: isVert ? dims.TW / 2 : dims.TH / 2,
    halfH: isVert ? dims.TH / 2 : dims.TW / 2,
  };
}
