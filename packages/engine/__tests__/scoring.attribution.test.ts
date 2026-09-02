import { describe, it, expect } from "vitest";
import { applyMove, createInitialState } from "../src/reducer";
import { getTeam } from "../src/types";
import type { GameState, Tile } from "../src/types";

// Regression suite for the report "I won but the other side got my points":
// every round-ending path must credit scores[getTeam(winner)] and leave the
// other side untouched. The engine proved correct on prod (the confusion was
// the round-over UI), but these pin the attribution forever.

function base1v1(overrides: Partial<GameState>): GameState {
  const state = createInitialState({
    mode: "turn_based",
    theme: "barberia",
    is2v2: false,
  });
  return { ...state, phase: "playing", scores: [0, 0], boneyard: [], ...overrides };
}

function base2v2(overrides: Partial<GameState>): GameState {
  const state = createInitialState({
    mode: "turn_based",
    theme: "barberia",
    is2v2: true,
  });
  return { ...state, phase: "playing", scores: [0, 0], boneyard: [], ...overrides };
}

const T = (a: number, b: number): Tile => [a, b];

describe("score attribution: 1v1", () => {
  it("getTeam maps n to 0, s to 1", () => {
    expect(getTeam("n", false)).toBe(0);
    expect(getTeam("s", false)).toBe(1);
  });

  it("DOMINÓ by seat n credits team 0 with the loser's pips", () => {
    const state = base1v1({
      currentTurn: "n",
      board: [T(3, 4)],
      hands: { n: [T(4, 5)], s: [T(6, 6), T(2, 2)], e: [], w: [] },
    });
    const res = applyMove(state, "n", { type: "play", tile: T(4, 5), end: "right" });
    expect(res.success).toBe(true);
    expect(res.callout).toBe("domino");
    expect(res.newState.scores).toEqual([16, 0]);
  });

  it("DOMINÓ by seat s credits team 1 with the loser's pips", () => {
    const state = base1v1({
      currentTurn: "s",
      board: [T(3, 4)],
      hands: { n: [T(6, 6), T(2, 2)], s: [T(4, 5)], e: [], w: [] },
    });
    const res = applyMove(state, "s", { type: "play", tile: T(4, 5), end: "right" });
    expect(res.success).toBe(true);
    expect(res.newState.scores).toEqual([0, 16]);
  });

  it("CAPICÚA adds the +25 to the SAME team that won", () => {
    const state = base1v1({
      currentTurn: "n",
      board: [T(3, 4)],
      hands: { n: [T(3, 4)], s: [T(5, 5)], e: [], w: [] },
    });
    const res = applyMove(state, "n", { type: "play", tile: T(3, 4), end: "right" });
    expect(res.success).toBe(true);
    expect(res.callout).toBe("capicua");
    expect(res.newState.scores).toEqual([10 + 25, 0]);
  });

  it("two passes in a row lock the table; the whole table goes to the lighter side (team 0)", () => {
    // n played last; s can't play. Heads-up there is no pase corrido, so the
    // pass is plain: nothing is banked and the turn returns to n. n can't play
    // either, so the second pass locks the table (TRANCAO).
    const state = base1v1({
      currentTurn: "s",
      lastPlayedBy: "n",
      passesSinceLastPlay: 0,
      board: [T(0, 0)],
      hands: { n: [T(1, 2)], s: [T(3, 4)], e: [], w: [] },
    });
    const r1 = applyMove(state, "s", { type: "pass" });
    expect(r1.success).toBe(true);
    expect(r1.callout).toBeUndefined();
    expect(r1.newState.lastCallout).toBeNull();
    expect(r1.newState.scores).toEqual([0, 0]);
    expect(r1.newState.phase).toBe("playing");
    expect(r1.newState.currentTurn).toBe("n");

    const r2 = applyMove(r1.newState, "n", { type: "pass" });
    expect(r2.success).toBe(true);
    expect(r2.callout).toBe("trancao");
    expect(r2.newState.phase).toBe("round_over");
    // n has 3 pips, s has 7. Team 0 is lighter and takes the whole table: 10.
    expect(r2.newState.scores).toEqual([10, 0]);
    const payload = r2.newState.lastCalloutPayload as Record<string, unknown>;
    expect(payload.winningTeam).toBe(0);
    expect(payload.pts).toBe(10);
  });

  it("TRANCAO credits team 1 with the whole table when s is the lighter side", () => {
    // n played, s passed (plain), now n passes too: the table locks.
    const state = base1v1({
      currentTurn: "n",
      lastPlayedBy: "n",
      consecutivePasses: 1,
      passesSinceLastPlay: 1,
      board: [T(3, 5)],
      hands: { n: [T(6, 6)], s: [T(1, 1)], e: [], w: [] },
    });
    const res = applyMove(state, "n", { type: "pass" });
    expect(res.success).toBe(true);
    expect(res.callout).toBe("trancao");
    // n has 12 pips, s has 2. Team 1 takes 12 + 2 = 14; team 0 gets nothing.
    expect(res.newState.scores).toEqual([0, 14]);
  });

  it("an opponent's pass after your play is a plain pass (no pase corrido heads-up)", () => {
    const state = base1v1({
      currentTurn: "s",
      lastPlayedBy: "n",
      passesSinceLastPlay: 0,
      board: [T(0, 0)],
      hands: { n: [T(0, 5), T(0, 1)], s: [T(1, 2)], e: [], w: [] },
    });
    const res = applyMove(state, "s", { type: "pass" });
    expect(res.success).toBe(true);
    expect(res.callout).toBeUndefined();
    expect(res.newState.lastCallout).toBeNull();
    expect(res.newState.scores).toEqual([0, 0]);
    expect(res.newState.phase).toBe("playing");
    expect(res.newState.currentTurn).toBe("n");
    expect(res.newState.consecutivePasses).toBe(1);
    expect(res.newState.passesSinceLastPlay).toBe(1);
  });
});

describe("score attribution: 2v2", () => {
  it("getTeam maps n/s to 0, e/w to 1", () => {
    expect(getTeam("n", true)).toBe(0);
    expect(getTeam("s", true)).toBe(0);
    expect(getTeam("e", true)).toBe(1);
    expect(getTeam("w", true)).toBe(1);
  });

  it("DOMINÓ by seat e credits team 1 with ALL remaining pips (partner included)", () => {
    const state = base2v2({
      currentTurn: "e",
      board: [T(1, 2)],
      hands: {
        n: [T(6, 6)], // 12 (opponent)
        s: [T(1, 1)], // 2 (opponent)
        e: [T(2, 3)], // winner, goes out
        w: [T(5, 0)], // 5 (winner's own partner, counted per house rules)
      },
    });
    const res = applyMove(state, "e", { type: "play", tile: T(2, 3), end: "right" });
    expect(res.success).toBe(true);
    expect(res.callout).toBe("domino");
    expect(res.newState.scores).toEqual([0, 12 + 2 + 5]);
  });

  it("DOMINÓ by seat n credits team 0", () => {
    const state = base2v2({
      currentTurn: "n",
      board: [T(1, 2)],
      hands: {
        n: [T(2, 3)],
        s: [T(4, 4)], // 8 partner
        e: [T(3, 3)], // 6
        w: [T(1, 0)], // 1
      },
    });
    const res = applyMove(state, "n", { type: "play", tile: T(2, 3), end: "right" });
    expect(res.success).toBe(true);
    expect(res.newState.scores).toEqual([8 + 6 + 1, 0]);
  });

  it("TRANCAO credits the lighter team (team 1) with the whole table", () => {
    // w played last, n/e/s passed, and w's own pass is the fourth: the lock.
    const state = base2v2({
      currentTurn: "w",
      lastPlayedBy: "w",
      consecutivePasses: 3,
      passesSinceLastPlay: 3,
      board: [T(4, 4)],
      hands: {
        n: [T(6, 6)], // 12
        s: [T(5, 5)], // 10 (team 0 = 22)
        e: [T(1, 1)], // 2
        w: [T(1, 2)], // 3 (team 1 = 5)
      },
    });
    const res = applyMove(state, "w", { type: "pass" });
    expect(res.success).toBe(true);
    expect(res.callout).toBe("trancao");
    expect(res.newState.scores).toEqual([0, 22 + 5]);
  });

  it("TRANCAO tie credits the starter's team (team 0) with the whole table", () => {
    const state = base2v2({
      currentTurn: "w",
      lastPlayedBy: "w",
      consecutivePasses: 3,
      passesSinceLastPlay: 3,
      starterThisRound: "s",
      board: [T(4, 5)],
      hands: {
        n: [T(1, 1)], // 2
        s: [T(2, 2)], // 4 (team 0 = 6)
        e: [T(3, 0)], // 3
        w: [T(1, 2)], // 3 (team 1 = 6)
      },
    });
    const res = applyMove(state, "w", { type: "pass" });
    expect(res.success).toBe(true);
    expect(res.callout).toBe("trancao");
    expect(res.newState.scores).toEqual([12, 0]);
    const payload = res.newState.lastCalloutPayload as Record<string, unknown>;
    expect(payload.winningTeam).toBe(0);
  });
});
