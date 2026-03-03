import { describe, it, expect } from "vitest";
import { validateMove, hasLegalPlay } from "@/lib/engine/validate";
import type { GameState } from "@/lib/engine/types";

const baseState: GameState = {
  phase: "playing",
  mode: "turn_based",
  theme: "barberia",
  is2v2: false,
  targetScore: 100,
  scores: [0, 0],
  roundIndex: 0,
  hands: {
    n: [[1, 2]],
    s: [[5, 5], [5, 1], [3, 4]],
    e: [],
    w: [],
  },
  board: [[5, 6], [6, 3]],
  boneyard: [],
  currentTurn: "s",
  consecutivePasses: 0,
  passesSinceLastPlay: 0,
  starterThisRound: "n",
  lastCallout: null,
  lastCalloutPayload: null,
  players: { n: null, e: null, s: null, w: null },
  winnerTeam: null,
  lastPlayedBy: "n",
};

describe("validateMove", () => {
  it("accepts legal play on right end", () => {
    const err = validateMove(baseState, "s", {
      type: "play",
      tile: [3, 4],
      end: "right",
    });
    expect(err).toBeNull();
  });

  it("rejects play on wrong end", () => {
    const err = validateMove(baseState, "s", {
      type: "play",
      tile: [3, 4],
      end: "left",
    });
    expect(err).not.toBeNull();
    expect(err).toContain("match");
  });

  it("rejects pass when legal play exists", () => {
    const err = validateMove(baseState, "s", { type: "pass" });
    expect(err).toContain("play");
  });

  it("accepts pass when no legal play", () => {
    const state: GameState = {
      ...baseState,
      hands: {
        ...baseState.hands,
        s: [[1, 1], [2, 2]],
      },
    };
    const err = validateMove(state, "s", { type: "pass" });
    expect(err).toBeNull();
  });
});

describe("hasLegalPlay", () => {
  it("returns true when tile matches left end", () => {
    expect(hasLegalPlay([[5, 1]], [[5, 6], [6, 3]])).toBe(true);
  });
  it("returns true when tile matches right end", () => {
    expect(hasLegalPlay([[3, 1]], [[5, 6], [6, 3]])).toBe(true);
  });
  it("returns false when no match", () => {
    expect(hasLegalPlay([[1, 1], [2, 2]], [[5, 6], [6, 3]])).toBe(false);
  });
});
