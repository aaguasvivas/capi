import { describe, it, expect } from "vitest";
import {
  layoutBoard,
  tileHalfExtents,
  DEFAULT_DIMS,
  COMPACT_DIMS,
  TW,
  VGAP,
  type Placed,
  type TileDims,
} from "../src/boardLayout";
import type { Tile } from "../src/types";

// Both tile tiers must be overlap-free.
const TIERS: TileDims[] = [DEFAULT_DIMS, COMPACT_DIMS];

// Axis-aligned overlap test between two placed tiles, with a tiny epsilon so
// edge-to-edge touching is not counted as overlap.
function overlap(a: Placed, b: Placed, dims: TileDims): boolean {
  const ea = tileHalfExtents(a, dims);
  const eb = tileHalfExtents(b, dims);
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const EPS = 0.01;
  return dx < ea.halfW + eb.halfW - EPS && dy < ea.halfH + eb.halfH - EPS;
}

function assertNoOverlaps(board: Tile[], availW: number) {
  for (const dims of TIERS) {
    const { placements } = layoutBoard(board, availW, dims);
    expect(placements.length).toBe(board.length);
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        if (overlap(placements[i], placements[j], dims)) {
          throw new Error(
            `tiles ${i} and ${j} overlap at width ${availW} ` +
              `(tile ${dims.TW}x${dims.TH}): ` +
              JSON.stringify(placements[i]) +
              " vs " +
              JSON.stringify(placements[j]) +
              ` (board=${JSON.stringify(board)})`
          );
        }
      }
    }
  }
}

const FULL_SET: Tile[] = (() => {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push([a, b]);
  return tiles;
})();

const DOUBLES: Tile[] = [
  [0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6],
];

// A spread of viewport widths, including the narrow mobile case where the
// chain wraps most aggressively (and rows pack tightest).
const WIDTHS = [320, 375, 414, 600, 800, 1024];

describe("boardLayout, no overlaps", () => {
  it("all seven doubles in a row never overlap (the reported bug class)", () => {
    for (const w of WIDTHS) assertNoOverlaps(DOUBLES, w);
  });

  it("alternating double / non-double chain never overlaps", () => {
    const board: Tile[] = [];
    for (let i = 0; i < 14; i++) {
      board.push(i % 2 === 0 ? [i % 7, i % 7] : [(i + 1) % 7, (i + 3) % 7]);
    }
    for (const w of WIDTHS) assertNoOverlaps(board, w);
  });

  it("a real connected chain (matching ends) with several doubles never overlaps", () => {
    // 6-6 6-3 3-3 3-1 1-1 1-5 5-5 5-0 0-0 0-2 2-2 2-4 4-4
    const board: Tile[] = [
      [6, 6], [6, 3], [3, 3], [3, 1], [1, 1], [1, 5], [5, 5],
      [5, 0], [0, 0], [0, 2], [2, 2], [2, 4], [4, 4],
    ];
    for (const w of WIDTHS) assertNoOverlaps(board, w);
  });

  it("randomized chains (1000 boards) never overlap at any width", () => {
    // Deterministic PRNG so failures reproduce.
    let seed = 1234567;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let t = 0; t < 1000; t++) {
      const len = 1 + Math.floor(rnd() * FULL_SET.length);
      // Shuffle a copy of the full set and take `len`.
      const pool = [...FULL_SET];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const board = pool.slice(0, len);
      const w = WIDTHS[Math.floor(rnd() * WIDTHS.length)];
      assertNoOverlaps(board, w);
    }
  });

  it("the full 28-tile set never overlaps at any width", () => {
    for (const w of WIDTHS) assertNoOverlaps(FULL_SET, w);
  });
});

describe("boardLayout, spacing invariants", () => {
  it("keeps an ordinary all-horizontal row pair at the tuned 60px pitch", () => {
    // A long non-double chain on a narrow board wraps into stacked horizontal
    // rows; their centerlines should sit TW/2 + VGAP + TW/2 = 60 apart.
    const board: Tile[] = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0],
    ];
    const { placements } = layoutBoard(board, 320);
    const rowYs = [
      ...new Set(
        placements.filter((p) => p.rot !== 0).map((p) => Math.round(p.y))
      ),
    ].sort((a, b) => a - b);
    if (rowYs.length >= 2) {
      // Horizontal tiles reach TW/2 from their line; consecutive rows sit
      // TW/2 + VGAP + TW/2 apart.
      expect(rowYs[1] - rowYs[0]).toBe(TW / 2 + VGAP + TW / 2);
    }
  });

  it("returns empty layout for an empty board or a too-narrow canvas", () => {
    expect(layoutBoard([], 800).placements).toHaveLength(0);
    expect(layoutBoard([[3, 4]], 100).placements).toHaveLength(0);
  });
});
