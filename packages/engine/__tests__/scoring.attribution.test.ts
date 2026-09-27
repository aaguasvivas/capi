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

const T = (a: number, b: number): Tile => [a, b] as Tile;

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

  it("the tile that locks the table credits team 0 when the blocker n holds fewer pips", () => {
    // Ends 5 and 0. n places [0,4]: the ends become 5 and 4 and no tile left
    // fits either, so the table locks on that play (TRANCAO).
    const state = base1v1({
      currentTurn: "n",
      lastPlayedBy: "s",
      board: [T(5, 0)],
      hands: { n: [T(0, 4), T(1, 2)], s: [T(3, 3)], e: [], w: [] },
    });
    const res = applyMove(state, "n", { type: "play", tile: T(0, 4), end: "right" });
    expect(res.success).toBe(true);
    expect(res.callout).toBe("trancao");
    expect(res.newState.phase).toBe("round_over");
    // n has 3 pips, s has 6. n wins and team 0 takes the whole table: 9.
    expect(res.newState.scores).toEqual([9, 0]);
    const payload = res.newState.lastCalloutPayload!;
    expect(payload.winningTeam).toBe(0);
    expect(payload.pts).toBe(9);
  });

  it("TRANCAO credits team 1 with the whole table when s is the lighter side", () => {
    const state = base1v1({
      currentTurn: "n",
      lastPlayedBy: "s",
      board: [T(5, 0)],
      hands: { n: [T(0, 4), T(6, 6)], s: [T(1, 1)], e: [], w: [] },
    });
    const res = applyMove(state, "n", { type: "play", tile: T(0, 4), end: "right" });
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

  it("TRANCAO credits team 1 when the blocker w beats n, the player to his right", () => {
    // w places [0,3]: the ends become 4 and 3 and nobody can follow.
    const state = base2v2({
      currentTurn: "w",
      lastPlayedBy: "s",
      board: [T(4, 0)],
      hands: {
        n: [T(6, 6)], // 12
        s: [T(5, 5)], // 10 (team 0 = 22)
        e: [T(1, 1)], // 2
        w: [T(0, 3), T(1, 2)], // 3 after the play (team 1 = 5)
      },
    });
    const res = applyMove(state, "w", { type: "play", tile: T(0, 3), end: "right" });
    expect(res.success).toBe(true);
    expect(res.callout).toBe("trancao");
    expect(res.newState.scores).toEqual([0, 22 + 5]);
  });

  it("TRANCAO tie credits the opening side (team 0) with the whole table", () => {
    // w places [0,6]: the ends become 4 and 6 and nobody can follow. w and n
    // both hold 3 pips; s opened the round, so team 0 wins.
    const state = base2v2({
      currentTurn: "w",
      lastPlayedBy: "s",
      starterThisRound: "s",
      board: [T(4, 0)],
      hands: {
        n: [T(1, 2)], // 3
        s: [T(2, 2)], // 4 (team 0 = 7)
        e: [T(5, 5)], // 10
        w: [T(0, 6), T(0, 3)], // 3 after the play (team 1 = 13)
      },
    });
    const res = applyMove(state, "w", { type: "play", tile: T(0, 6), end: "right" });
    expect(res.success).toBe(true);
    expect(res.callout).toBe("trancao");
    expect(res.newState.scores).toEqual([20, 0]);
    const payload = res.newState.lastCalloutPayload!;
    expect(payload.winningTeam).toBe(0);
    expect(payload).toMatchObject({ blockerSeat: "w", rivalSeat: "n", blockerPips: 3, rivalPips: 3 });
  });
});
