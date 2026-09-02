import { describe, expect, it } from "vitest";
import { applyMove, createInitialState, startNewRound } from "../src/reducer";
import type { GameState, MoveIntent, Seat, Tile } from "../src/types";
import { getSeatsForGame } from "../src/types";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canon = (t: Tile) => `${Math.min(t[0], t[1])}-${Math.max(t[0], t[1])}`;

function tileKeys(state: GameState): string[] {
  const keys: string[] = [];
  for (const seat of ["n", "e", "s", "w"] as Seat[]) {
    for (const t of state.hands[seat] ?? []) keys.push(canon(t));
  }
  for (const t of state.board) keys.push(canon(t));
  for (const t of state.boneyard) keys.push(canon(t));
  return keys;
}

function legalPlays(state: GameState): MoveIntent[] {
  const hand = state.hands[state.currentTurn] ?? [];
  if (state.board.length === 0) return hand.map((tile) => ({ type: "play", tile, end: "right" }));
  const left = state.board[0][0];
  const right = state.board[state.board.length - 1][1];
  const out: MoveIntent[] = [];
  for (const tile of hand) {
    if (tile[0] === left || tile[1] === left) out.push({ type: "play", tile, end: "left" });
    if (tile[0] === right || tile[1] === right) out.push({ type: "play", tile, end: "right" });
  }
  return out;
}

function stepLegal(state: GameState, rng: () => number): GameState {
  const plays = legalPlays(state);
  const intent: MoveIntent =
    plays.length > 0
      ? plays[Math.floor(rng() * plays.length)]
      : !state.is2v2 && state.boneyard.length > 0
      ? { type: "draw" }
      : { type: "pass" };
  const r = applyMove(state, state.currentTurn, intent);
  expect(r.success).toBe(true);
  return r.newState;
}

describe("adversarial intents never touch the tile set", () => {
  // Shapes a raw HTTP client could send that the type system would reject.
  const BAD_ENDS: unknown[] = ["middle", "", null, 0, "LEFT", "rightt", ["right"]];

  it("a tile in hand with a bogus end is rejected and conserves all 28 tiles", () => {
    for (let i = 0; i < 40; i++) {
      const rng = mulberry32(500 + i);
      let state = createInitialState({ mode: "live", theme: "barberia", is2v2: i % 2 === 0, rng });
      for (let s = 0; s < 5 && state.phase === "playing"; s++) state = stepLegal(state, rng);
      if (state.phase !== "playing") continue;
      const hand = state.hands[state.currentTurn];
      // The double-six style cheat: a tile that fits neither end.
      const left = state.board[0][0];
      const right = state.board[state.board.length - 1][1];
      const unfit = hand.find((t) => t[0] !== left && t[1] !== left && t[0] !== right && t[1] !== right);
      const before = JSON.stringify(state);
      for (const end of BAD_ENDS) {
        const intent = { type: "play", tile: unfit ?? hand[0], end } as unknown as MoveIntent;
        const r = applyMove(state, state.currentTurn, intent);
        expect(r.success, `seed ${500 + i} end=${JSON.stringify(end)}`).toBe(false);
        expect(JSON.stringify(r.newState)).toBe(before);
        expect(new Set(tileKeys(r.newState)).size).toBe(28);
      }
    }
  });

  it("non-canonical tile shapes are rejected", () => {
    const rng = mulberry32(77);
    const state = createInitialState({ mode: "live", theme: "barberia", is2v2: false, rng });
    const bad: unknown[] = [[7, 1], [-1, 2], [1], [1, 2, 3], "1-2", null];
    for (const tile of bad) {
      const r = applyMove(state, state.currentTurn, { type: "play", tile, end: "right" } as unknown as MoveIntent);
      expect(r.success, JSON.stringify(tile)).toBe(false);
    }
  });
});

describe("every callout is still reachable", () => {
  it("seeded games produce domino, capicua, trancao and (in 2v2) veinticinco", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const rng = mulberry32(9000 + i);
      const is2v2 = i % 2 === 1;
      let state = createInitialState({ mode: "live", theme: "patio", is2v2, targetScore: 200, rng });
      let guard = 0;
      while (state.phase !== "finished" && guard++ < 5000) {
        if (state.phase === "round_over") {
          state = startNewRound(state, state.players, rng);
          continue;
        }
        state = stepLegal(state, rng);
        if (state.lastCallout) seen.add(`${is2v2 ? "2v2" : "1v1"}:${state.lastCallout}`);
      }
    }
    expect(seen.has("1v1:domino")).toBe(true);
    expect(seen.has("1v1:trancao")).toBe(true);
    expect([...seen].some((k) => k.endsWith(":capicua"))).toBe(true);
    expect(seen.has("2v2:veinticinco")).toBe(true);
    // Pase corrido is a parejas rule; heads-up it must never fire.
    expect(seen.has("1v1:veinticinco")).toBe(false);
  });
});

describe("phase machine guards", () => {
  it("startNewRound is a no-op unless the round is over", () => {
    const rng = mulberry32(1);
    const live = createInitialState({ mode: "live", theme: "colmado", is2v2: false, rng });
    expect(startNewRound(live, live.players, rng)).toBe(live);
    const finished: GameState = { ...live, phase: "finished", winnerTeam: 0 };
    expect(startNewRound(finished, finished.players, rng)).toBe(finished);
  });

  it("a veinticinco that crosses the target never ends the game mid-round", () => {
    // 2v2, team 0 sits at 90 of 100; N played last, E and S have passed, W passes now.
    const rng = mulberry32(3);
    const base = createInitialState({ mode: "live", theme: "colmado", is2v2: true, targetScore: 100, rng });
    const state: GameState = {
      ...base,
      scores: [90, 0],
      lastPlayedBy: "n",
      currentTurn: "w",
      consecutivePasses: 2,
      passesSinceLastPlay: 2,
      hands: { ...base.hands, w: [[6, 6]] },
      board: [[1, 2], [2, 3]],
    };
    const r = applyMove(state, "w", { type: "pass" });
    expect(r.success).toBe(true);
    expect(r.callout).toBe("veinticinco");
    expect(r.newState.scores[0]).toBe(115);
    expect(r.newState.phase).toBe("playing");
    expect(r.newState.winnerTeam).toBeNull();
    expect(getSeatsForGame(true)).toContain(r.newState.currentTurn);
  });
});
