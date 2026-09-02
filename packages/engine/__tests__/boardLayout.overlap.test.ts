import { describe, it, expect } from "vitest";
import {
  layoutBoard,
  tileHalfExtents,
  dimsForWidth,
  DEFAULT_DIMS,
  COMPACT_DIMS,
  type Placed,
  type TileDims,
} from "../src/boardLayout";
import { createInitialState, applyMove } from "../src/reducer";
import type { GameState, MoveIntent, Tile } from "../src/types";

// ───────────────────────────────────────────────────────────────────────────
// The board snake is the game's visual staple, and the one hard requirement
// is: NO TWO TILES MAY EVER OVERLAP, at any container width, at either dims
// tier, for any board the rules can actually produce. This suite enforces
// that as a property over the reachable game space (real games driven through
// createInitialState/applyMove) plus a set of adversarial crafted chains.
// Any layout regression fails here with a self-contained repro in the error
// message (board JSON + width + dims tier).
// ───────────────────────────────────────────────────────────────────────────

// Render widths to cover: narrow phones (compact tier), the 460 tier cutoff
// itself, and tablet/desktop (default tier). dimsForWidth picks the tier the
// app would really use at each width.
const WIDTHS = [320, 375, 390, 460, 500, 768, 1024, 1280];
// On top of dimsForWidth, both tiers are exercised explicitly at a middle
// width so each tier stays covered even if the tier cutoff ever moves.
const MID_WIDTH = 500;

// Edge-to-edge touching is legal; only positive-area intersection is a bug.
const EPS = 0.01;

function tierName(dims: TileDims): string {
  if (dims === DEFAULT_DIMS) return "DEFAULT_DIMS";
  if (dims === COMPACT_DIMS) return "COMPACT_DIMS";
  return JSON.stringify(dims);
}

/**
 * Axis-aligned intersection of two placements' bounding boxes.
 * ox/oy are the overlap depths on each axis; the rectangles truly overlap
 * (positive area) only when BOTH are positive.
 */
function bboxOverlap(
  a: Placed,
  b: Placed,
  dims: TileDims
): { ox: number; oy: number } {
  const ea = tileHalfExtents(a, dims);
  const eb = tileHalfExtents(b, dims);
  return {
    ox: ea.halfW + eb.halfW - Math.abs(a.x - b.x),
    oy: ea.halfH + eb.halfH - Math.abs(a.y - b.y),
  };
}

function bboxOf(p: Placed, dims: TileDims) {
  const { halfW, halfH } = tileHalfExtents(p, dims);
  return {
    tile: p.tile,
    rot: p.rot,
    left: p.x - halfW,
    right: p.x + halfW,
    top: p.y - halfH,
    bottom: p.y + halfH,
  };
}

/**
 * Lays out `board` at `availW`/`dims` and asserts:
 *  1. every tile got placed (guards against vacuously-empty layouts),
 *  2. no pair of tiles overlaps,
 *  3. every tile's bbox sits inside [0..contentW]×[0..contentH]
 *     (catches normalization bugs).
 * Failure messages carry the full repro: board JSON, width, dims tier, the
 * offending pair indices and their bboxes.
 */
function assertNoOverlaps(board: Tile[], availW: number, dims: TileDims): void {
  const repro = `repro: layoutBoard(${JSON.stringify(board)}, ${availW}, ${tierName(dims)})`;
  const { placements, contentW, contentH } = layoutBoard(board, availW, dims);

  if (placements.length !== board.length) {
    throw new Error(
      `layoutBoard placed ${placements.length}/${board.length} tiles ` +
        `at availW=${availW} dims=${tierName(dims)}\n  ${repro}`
    );
  }

  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const { ox, oy } = bboxOverlap(placements[i], placements[j], dims);
      if (ox > EPS && oy > EPS) {
        throw new Error(
          [
            `TILE OVERLAP: tiles #${i} and #${j} intersect ` +
              `(ox=${ox.toFixed(2)}px, oy=${oy.toFixed(2)}px) ` +
              `at availW=${availW} dims=${tierName(dims)}`,
            `bbox[#${i}]=${JSON.stringify(bboxOf(placements[i], dims))}`,
            `bbox[#${j}]=${JSON.stringify(bboxOf(placements[j], dims))}`,
            repro,
          ].join("\n  ")
        );
      }
    }
  }

  for (let i = 0; i < placements.length; i++) {
    const b = bboxOf(placements[i], dims);
    if (
      b.left < -EPS ||
      b.top < -EPS ||
      b.right > contentW + EPS ||
      b.bottom > contentH + EPS
    ) {
      throw new Error(
        [
          `TILE OUTSIDE CONTENT BOX: tile #${i} ` +
            `bbox=${JSON.stringify(b)} exceeds content ${contentW}×${contentH} ` +
            `at availW=${availW} dims=${tierName(dims)}`,
          repro,
        ].join("\n  ")
      );
    }
  }
}

/** The full width spread with real tier selection, plus both explicit tiers. */
function assertNoOverlapsEverywhere(board: Tile[]): void {
  for (const w of WIDTHS) assertNoOverlaps(board, w, dimsForWidth(w));
  assertNoOverlaps(board, MID_WIDTH, DEFAULT_DIMS);
  assertNoOverlaps(board, MID_WIDTH, COMPACT_DIMS);
}

// Seeded PRNG (mulberry32) so move selection is deterministic and cheap.
// NOTE: the deal inside createInitialState uses the engine's Math.random
// shuffle, so the exact games differ run to run, that is fine, because any
// failure logs the generated BOARD, which is the complete repro input for
// layoutBoard (layout depends only on board + width + dims).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The reducer's board invariant: consecutive tiles share the connecting pip. */
function isLegalChain(board: Tile[]): boolean {
  for (let i = 0; i + 1 < board.length; i++) {
    if (board[i][1] !== board[i + 1][0]) return false;
  }
  return true;
}

const GAMES = 200;
const MAX_MOVES = 60;

interface GameRunStats {
  moves: number;
  boardStates: number;
  maxBoardLen: number;
}

/**
 * Plays one real game through the server-authoritative reducer: uniformly
 * random choice among all legal (tile, end) plays; when stuck, draw if legal
 * (1v1 with tiles left in the boneyard), else pass. Calls `onBoard` with the
 * opening board and after every move until the round ends or MAX_MOVES.
 */
function playRandomGame(
  rand: () => number,
  is2v2: boolean,
  onBoard: (board: Tile[]) => void
): GameRunStats {
  let state: GameState = createInitialState({
    mode: "turn_based",
    theme: "barberia",
    is2v2,
  });
  const stats: GameRunStats = { moves: 0, boardStates: 0, maxBoardLen: 0 };
  const check = (board: Tile[]) => {
    if (!isLegalChain(board)) {
      throw new Error(
        `reducer produced a non-chained board: ${JSON.stringify(board)}`
      );
    }
    onBoard(board);
    stats.boardStates++;
    if (board.length > stats.maxBoardLen) stats.maxBoardLen = board.length;
  };

  check(state.board); // starter's opening tile is already on the board

  while (state.phase === "playing" && stats.moves < MAX_MOVES) {
    const seat = state.currentTurn;
    const hand = state.hands[seat] ?? [];
    const left = state.board[0][0];
    const right = state.board[state.board.length - 1][1];

    const plays: MoveIntent[] = [];
    for (const tile of hand) {
      if (tile[0] === left || tile[1] === left) {
        plays.push({ type: "play", tile, end: "left" });
      }
      if (tile[0] === right || tile[1] === right) {
        plays.push({ type: "play", tile, end: "right" });
      }
    }

    let intent: MoveIntent;
    if (plays.length > 0) {
      intent = plays[Math.floor(rand() * plays.length)];
    } else if (!is2v2 && state.boneyard.length > 0) {
      intent = { type: "draw" };
    } else {
      intent = { type: "pass" };
    }

    const result = applyMove(state, seat, intent);
    if (!result.success) {
      throw new Error(
        `generator made an illegal move (${result.error}): seat=${seat} ` +
          `intent=${JSON.stringify(intent)} board=${JSON.stringify(state.board)}`
      );
    }
    state = result.newState;
    stats.moves++;
    check(state.board);
  }
  return stats;
}

describe("boardLayout overlap property, random legal games", () => {
  it(`${GAMES} reducer-driven games: every board after every move, all widths + both tiers`, () => {
    // Coverage: for ALL 200 games (alternating 1v1 / 2v2), EVERY board state
    // (the opening tile plus the board after every single move) is checked at
    // all 8 widths via dimsForWidth(w) AND at both explicit tiers at width
    // 500, 10 layout checks per board state, ~5k board states / ~50k layout
    // checks per run (~4.7k moves, chains up to 27 tiles). No sampling: full
    // coverage runs in under a second, so no final-boards-only fallback.
    let totalMoves = 0;
    let totalStates = 0;
    let deepestChain = 0;
    for (let g = 0; g < GAMES; g++) {
      const rand = mulberry32(0xcab1 + g * 7919);
      const s = playRandomGame(rand, g % 2 === 1, assertNoOverlapsEverywhere);
      totalMoves += s.moves;
      totalStates += s.boardStates;
      if (s.maxBoardLen > deepestChain) deepestChain = s.maxBoardLen;
    }
    // The generator must genuinely explore: games play out and some chains
    // get long enough to wrap several rows at phone widths.
    expect(totalStates).toBeGreaterThanOrEqual(GAMES * 2);
    expect(deepestChain).toBeGreaterThanOrEqual(14);
    if (process.env.CAPI_OVERLAP_COVERAGE) {
      console.log(
        `[overlap property] games=${GAMES} moves=${totalMoves} ` +
          `boardStates=${totalStates} layoutChecksPerState=${WIDTHS.length + 2} ` +
          `deepestChain=${deepestChain}`
      );
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Adversarial crafted chains, worst known shapes, always run everywhere.
// ───────────────────────────────────────────────────────────────────────────

// Every double in one chain, each bridged by a connector. At narrow widths
// this wraps multiple rows with crosswise doubles landing next to corners, // the tightest vertical-spacing case the layout has to survive.
const MAX_DOUBLES_CHAIN: Tile[] = [
  [0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3],
  [3, 4], [4, 4], [4, 5], [5, 5], [5, 6], [6, 6],
];

// Longest practical no-doubles chain: every tile lies horizontal in a row,
// maximizing row length and corner turns.
const HORIZONTAL_CHAIN: Tile[] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0],
  [0, 2], [2, 4], [4, 6], [6, 1], [1, 3], [3, 5], [5, 0],
];

const TINY_BOARDS: Tile[][] = [
  [[3, 4]], // single horizontal tile
  [[6, 6]], // single crosswise double
  [[3, 4], [4, 6]], // two horizontals
  [[3, 4], [4, 4]], // horizontal + double
];

describe("boardLayout overlap property, adversarial fixed boards", () => {
  it("crafted fixtures are themselves legal chains (ends connect)", () => {
    for (const board of [MAX_DOUBLES_CHAIN, HORIZONTAL_CHAIN, ...TINY_BOARDS]) {
      expect(isLegalChain(board)).toBe(true);
    }
  });

  it("maximal-doubles chain (all 7 doubles, doubles adjacent to corners) never overlaps", () => {
    assertNoOverlapsEverywhere(MAX_DOUBLES_CHAIN);
  });

  it("14-tile all-horizontal chain never overlaps", () => {
    assertNoOverlapsEverywhere(HORIZONTAL_CHAIN);
  });

  it("single tile, single double, and two-tile boards never overlap", () => {
    for (const board of TINY_BOARDS) assertNoOverlapsEverywhere(board);
  });

  it("row-wrap boundary at 375px compact: full row, corner tile, first tile of row 2", () => {
    // Find by trial the smallest prefix of the horizontal chain that wraps at
    // width 375 with COMPACT_DIMS. The chain has no doubles, so any rot=0
    // placement is the corner tile that starts row 2.
    let firstWrapped = -1;
    for (let len = 1; len <= HORIZONTAL_CHAIN.length; len++) {
      const prefix = HORIZONTAL_CHAIN.slice(0, len);
      const { placements } = layoutBoard(prefix, 375, COMPACT_DIMS);
      if (placements.some((p) => p.rot === 0)) {
        firstWrapped = len;
        break;
      }
    }
    // The boundary must exist inside the 14-tile chain, and there must be a
    // non-trivial single-row prefix before it.
    expect(firstWrapped).toBeGreaterThan(1);
    expect(firstWrapped).toBeLessThanOrEqual(HORIZONTAL_CHAIN.length);

    const lens = [
      firstWrapped - 1, // exactly fills one row, no corner yet
      firstWrapped, // the corner appears
      Math.min(firstWrapped + 1, HORIZONTAL_CHAIN.length), // first tile of row 2
    ];
    for (const len of lens) {
      const prefix = HORIZONTAL_CHAIN.slice(0, len);
      assertNoOverlaps(prefix, 375, COMPACT_DIMS);
      assertNoOverlapsEverywhere(prefix);
    }
  });
});
