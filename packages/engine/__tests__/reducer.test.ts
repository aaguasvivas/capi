import { describe, it, expect } from "vitest";
import {
  createInitialState,
  applyMove,
  startNewRound,
} from "../src/reducer";
import type { GameState } from "../src/types";
import { handPips, isCapicua } from "../src/scoring";

describe("createInitialState", () => {
  it("starter has 6 tiles, other(s) have 7 in 1v1", () => {
    const state = createInitialState({
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
    });
    const starterCount = state.hands[state.starterThisRound].length;
    const other = state.starterThisRound === "n" ? "s" : "n";
    expect(starterCount).toBe(6);
    expect(state.hands[other]).toHaveLength(7);
  });

  it("starter has 6 tiles, others have 7 in 2v2", () => {
    const state = createInitialState({
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
    });
    const starterCount = state.hands[state.starterThisRound].length;
    expect(starterCount).toBe(6);
    const others = (["n", "e", "s", "w"] as const).filter((s) => s !== state.starterThisRound);
    for (const seat of others) {
      expect(state.hands[seat]).toHaveLength(7);
    }
  });

  it("boneyard has correct remainder", () => {
    const state = createInitialState({
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
    });
    expect(state.boneyard).toHaveLength(28 - 14);
  });

  it("board starts with one tile from starter", () => {
    const state = createInitialState({
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
    });
    expect(state.board).toHaveLength(1);
  });

  it("consecutivePasses and passesSinceLastPlay start at 0", () => {
    const state = createInitialState({
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
    });
    expect(state.consecutivePasses).toBe(0);
    expect(state.passesSinceLastPlay).toBe(0);
  });
});

describe("applyMove - validation", () => {
  it("rejects move out of turn", () => {
    const state = createInitialState({
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
    });
    const notCurrent = state.currentTurn === "n" ? "s" : "n";
    const result = applyMove(state, notCurrent, { type: "play", tile: [0, 0], end: "left" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("turn");
  });

  it("rejects pass when legal play exists", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: { n: [[1, 2]], s: [[3, 3], [3, 4]], e: [], w: [] },
      board: [[3, 5]],
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
    const result = applyMove(state, "s", { type: "pass" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("play");
  });

  it("rejects play with tile not in hand", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: { n: [[6, 6]], s: [[1, 2], [2, 3]], e: [], w: [] },
      board: [[4, 4]],
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
    const result = applyMove(state, "s", {
      type: "play",
      tile: [6, 6],
      end: "right",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("hand");
  });
});

describe("applyMove - play and pass", () => {
  it("accepts legal play", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: { n: [[1, 2]], s: [[3, 3], [3, 4], [4, 5], [5, 6], [6, 6], [0, 1], [1, 2]], e: [], w: [] },
      board: [[3, 5]],
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
    const result = applyMove(state, "s", {
      type: "play",
      tile: [3, 4],
      end: "left",
    });
    expect(result.success).toBe(true);
    expect(result.newState.board).toHaveLength(2);
    expect(result.newState.hands.s).toHaveLength(6);
  });

  it("resets consecutivePasses on play", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: { n: [[1, 2]], s: [[3, 3], [3, 4]], e: [], w: [] },
      board: [[3, 5]],
      boneyard: [],
      currentTurn: "s",
      consecutivePasses: 1,
      passesSinceLastPlay: 1,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    const r1 = applyMove(state, "s", {
      type: "play",
      tile: [3, 4],
      end: "left",
    });
    expect(r1.success).toBe(true);
    expect(r1.newState.consecutivePasses).toBe(0);
  });
});

describe("applyMove - TRANCAO", () => {
  it("triggers TRANCAO on 2 consecutive passes in 1v1 (boneyard empty)", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[6, 6], [5, 5]],
        s: [[1, 1], [2, 2]],
        e: [],
        w: [],
      },
      board: [[3, 3], [3, 4]],
      boneyard: [],
      currentTurn: "s",
      consecutivePasses: 1,
      passesSinceLastPlay: 1,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    const result = applyMove(state, "s", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.newState.lastCallout).toBe("trancao");
    expect(result.newState.phase).toBe("round_over");
  });
});

describe("applyMove - DOMINÓ scoring", () => {
  it("awards opponent pips to winner on DOMINÓ", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: { n: [[3, 4]], s: [[1, 2]], e: [], w: [] },
      board: [[5, 5], [5, 3], [3, 1]],
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
    const result = applyMove(state, "s", {
      type: "play",
      tile: [1, 2],
      end: "right",
    });
    expect(result.success).toBe(true);
    expect(result.newState.lastCallout).toBe("domino");
    const nPips = handPips(state.hands.n);
    expect(result.newState.scores[1]).toBe(nPips);
  });
});

describe("applyMove - TRANCAO scoring", () => {
  it("awards every pip on the table to the lower pip side on TRANCAO", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[6, 6], [5, 5]],
        s: [[1, 1], [2, 2]],
        e: [],
        w: [],
      },
      board: [[3, 3], [3, 4]],
      boneyard: [],
      currentTurn: "s",
      consecutivePasses: 1,
      passesSinceLastPlay: 1,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    const result = applyMove(state, "s", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.newState.lastCallout).toBe("trancao");
    // n holds 12 + 10 = 22, s holds 2 + 4 = 6. Team 1 is lighter and takes
    // the whole table, 22 + 6 = 28. Team 0 gets nothing.
    expect(result.newState.phase).toBe("round_over");
    expect(result.newState.scores).toEqual([0, 28]);
    const payload = result.newState.lastCalloutPayload as Record<string, unknown>;
    expect(payload.winningTeam).toBe(1);
    expect(payload.pts).toBe(28);
    expect(payload.team0Pips).toBe(22);
    expect(payload.team1Pips).toBe(6);
  });

  it("awards the whole table to team 0 when n is the lighter side", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[1, 1], [2, 2]], // 6
        s: [[6, 6], [5, 5]], // 22
        e: [],
        w: [],
      },
      board: [[3, 3], [3, 4]],
      boneyard: [],
      currentTurn: "s",
      consecutivePasses: 1,
      passesSinceLastPlay: 1,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    const result = applyMove(state, "s", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.callout).toBe("trancao");
    expect(result.newState.scores).toEqual([28, 0]);
  });
});

describe("applyMove - 1v1 pass (no pase corrido)", () => {
  it("opponent's pass after your play is a plain pass: turn advances, no score, no callout", () => {
    // N played, leaving the board ends at 6 and 2. S has no matching tile and
    // the boneyard is empty, so S passes. Heads-up there is no VEINTICINCO:
    // nothing is banked, the turn simply returns to N and the round goes on.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[2, 4], [0, 0]],
        s: [[1, 1], [3, 3], [4, 4]], // no match for ends 6 / 2
        e: [],
        w: [],
      },
      board: [[6, 6], [6, 5], [5, 2]],
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
    const result = applyMove(state, "s", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.callout).toBeUndefined();
    expect(result.newState.lastCallout).toBeNull();
    expect(result.newState.lastCalloutPayload).toBeNull();
    expect(result.newState.phase).toBe("playing");
    expect(result.newState.scores).toEqual([0, 0]);
    expect(result.newState.currentTurn).toBe("n");
    expect(result.newState.consecutivePasses).toBe(1);
    expect(result.newState.passesSinceLastPlay).toBe(1);

    // N plays [2,4] on the right: the pass counter resets and S is up again.
    const next = applyMove(result.newState, "n", { type: "play", tile: [2, 4], end: "right" });
    expect(next.success).toBe(true);
    expect(next.newState.phase).toBe("playing");
    expect(next.newState.scores).toEqual([0, 0]);
    expect(next.newState.currentTurn).toBe("s");
    expect(next.newState.consecutivePasses).toBe(0);
    expect(next.newState.passesSinceLastPlay).toBe(0);
  });
});

describe("applyMove - draw from boneyard", () => {
  it("draws tiles until a playable one is found", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[6, 6]],
        s: [[1, 1]],
        e: [],
        w: [],
      },
      board: [[3, 5]],
      boneyard: [[2, 2], [4, 4], [5, 6]],
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
    const result = applyMove(state, "s", { type: "draw" });
    expect(result.success).toBe(true);
    expect(result.newState.hands.s.length).toBeGreaterThan(1);
    expect(result.newState.boneyard.length).toBeLessThan(3);
    expect(result.newState.currentTurn).toBe("s");
  });

  it("draws all tiles when none are playable", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[6, 6]],
        s: [[1, 1]],
        e: [],
        w: [],
      },
      board: [[3, 5]],
      boneyard: [[2, 2], [4, 4]],
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
    const result = applyMove(state, "s", { type: "draw" });
    expect(result.success).toBe(true);
    expect(result.newState.hands.s).toHaveLength(3);
    expect(result.newState.boneyard).toHaveLength(0);
    expect(result.newState.currentTurn).toBe("s");
  });

  it("rejects pass when boneyard has tiles in 1v1", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[6, 6]],
        s: [[1, 1]],
        e: [],
        w: [],
      },
      board: [[3, 5]],
      boneyard: [[2, 2]],
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
    const result = applyMove(state, "s", { type: "pass" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("draw");
  });
});

describe("scoring - isCapicua", () => {
  it("returns true when both ends match and tile is not double/blank", () => {
    expect(isCapicua([[4, 5] as [4,5], [5, 3] as [5,3], [3, 4] as [3,4]], [4, 3] as [4,3])).toBe(true);
  });
  it("returns false for double", () => {
    expect(isCapicua([[3, 3] as [3,3]], [3, 3] as [3,3])).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2v2 (Con Tu Frente) Tests
// ═══════════════════════════════════════════════════════════════════════════════

function make2v2State(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: "playing",
    mode: "turn_based",
    theme: "barberia",
    is2v2: true,
    targetScore: 100,
    scores: [0, 0],
    roundIndex: 0,
    hands: {
      n: [[1, 2], [2, 3]],
      e: [[4, 5], [5, 6]],
      s: [[3, 4], [6, 1]],
      w: [[2, 2], [0, 1]],
    },
    board: [[3, 5]],
    boneyard: [],
    currentTurn: "n",
    consecutivePasses: 0,
    passesSinceLastPlay: 0,
    starterThisRound: "n",
    lastCallout: null,
    lastCalloutPayload: null,
    players: { n: null, e: null, s: null, w: null },
    winnerTeam: null,
    lastPlayedBy: "n",
    ...overrides,
  };
}

describe("2v2 - createInitialState", () => {
  it("deals 7 tiles to each of 4 players (starter has 6)", () => {
    const state = createInitialState({ mode: "live", theme: "colmado", is2v2: true });
    const seats = ["n", "e", "s", "w"] as const;
    const starter = state.starterThisRound;
    for (const s of seats) {
      expect(state.hands[s].length).toBe(s === starter ? 6 : 7);
    }
  });

  it("has empty boneyard in 2v2 (28 tiles = 4×7)", () => {
    const state = createInitialState({ mode: "live", theme: "barberia", is2v2: true });
    const totalInHands = (["n", "e", "s", "w"] as const).reduce(
      (sum, s) => sum + state.hands[s].length, 0
    );
    expect(totalInHands + state.board.length).toBe(28);
    expect(state.boneyard).toHaveLength(0);
  });

  it("board starts with one tile (starter's highest double/tile)", () => {
    const state = createInitialState({ mode: "live", theme: "patio", is2v2: true });
    expect(state.board).toHaveLength(1);
  });
});

describe("2v2 - turn order", () => {
  it("follows N → E → S → W cycle", () => {
    const state = make2v2State({
      currentTurn: "n",
      hands: {
        n: [[3, 4], [1, 1]],
        e: [[5, 6], [2, 2]],
        s: [[4, 5], [6, 6]],
        w: [[1, 2], [3, 3]],
      },
      board: [[3, 5]],
    });

    const r1 = applyMove(state, "n", { type: "play", tile: [3, 4], end: "left" });
    expect(r1.success).toBe(true);
    expect(r1.newState.currentTurn).toBe("e");

    const r2 = applyMove(r1.newState, "e", { type: "play", tile: [5, 6], end: "right" });
    expect(r2.success).toBe(true);
    expect(r2.newState.currentTurn).toBe("s");

    const r3 = applyMove(r2.newState, "s", { type: "play", tile: [4, 5], end: "left" });
    expect(r3.success).toBe(true);
    expect(r3.newState.currentTurn).toBe("w");
  });

  it("rejects out-of-turn moves in 2v2", () => {
    const state = make2v2State({ currentTurn: "e" });
    const result = applyMove(state, "n", { type: "play", tile: [1, 2], end: "left" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("turn");
  });
});

describe("2v2 - TRANCAO", () => {
  it("triggers TRANCAO after 4 consecutive passes", () => {
    const state = make2v2State({
      currentTurn: "w",
      consecutivePasses: 3,
      passesSinceLastPlay: 3,
      hands: {
        n: [[6, 6]],
        e: [[5, 5]],
        s: [[4, 4]],
        w: [[1, 1]],
      },
      board: [[3, 2]],
    });
    const result = applyMove(state, "w", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.callout).toBe("trancao");
    expect(result.newState.phase).toBe("round_over");
  });

  it("does NOT trigger TRANCAO after only 3 passes in 2v2", () => {
    const state = make2v2State({
      currentTurn: "s",
      consecutivePasses: 2,
      passesSinceLastPlay: 2,
      hands: {
        n: [[6, 6]],
        e: [[5, 5]],
        s: [[4, 4]],
        w: [[1, 1]],
      },
      board: [[3, 2]],
    });
    const result = applyMove(state, "s", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.newState.phase).toBe("playing");
    expect(result.newState.consecutivePasses).toBe(3);
  });

  it("scores TRANCAO with team pip totals (N+S vs E+W): a tie goes to the starter's team and pays the whole table", () => {
    // Team 0 (N+S): [6,6] + [1,1] = 14. Team 1 (E+W): [5,5] + [2,2] = 14.
    // W has [2,2], board left=3, right=0: no match, so the pass is legal.
    const state = make2v2State({
      currentTurn: "w",
      consecutivePasses: 3,
      passesSinceLastPlay: 3,
      starterThisRound: "e",
      hands: {
        n: [[6, 6]],
        e: [[5, 5]],
        s: [[1, 1]],
        w: [[2, 2]],
      },
      board: [[3, 0]],
    });
    const result = applyMove(state, "w", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.newState.lastCallout).toBe("trancao");
    // Tie: starter E (team 1) takes every pip on the table, 14 + 14 = 28.
    expect(result.newState.scores).toEqual([0, 28]);
    const payload = result.newState.lastCalloutPayload as Record<string, unknown>;
    expect(payload.winningTeam).toBe(1);
    expect(payload.pts).toBe(28);
  });

  it("scores TRANCAO to the lower pip team in 2v2 with the whole table", () => {
    // Team 0 (N+S): [1,1] + [1,2] = 5. Team 1 (E+W): [6,6] + [5,5] = 22.
    // Team 0 is lighter and takes 5 + 22 = 27.
    const state = make2v2State({
      currentTurn: "w",
      consecutivePasses: 3,
      passesSinceLastPlay: 3,
      hands: {
        n: [[1, 1]],
        e: [[6, 6]],
        s: [[1, 2]],
        w: [[5, 5]],
      },
      board: [[3, 2]],
    });
    const result = applyMove(state, "w", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.newState.scores[0]).toBe(27);
    expect(result.newState.scores[1]).toBe(0);
  });

  it("pays the whole table to team 1 when E+W are the lighter side", () => {
    // Team 0 (N+S): [6,6] + [5,5] = 22. Team 1 (E+W): [1,1] + [1,2] = 5.
    const state = make2v2State({
      currentTurn: "w",
      consecutivePasses: 3,
      passesSinceLastPlay: 3,
      hands: {
        n: [[6, 6]],
        e: [[1, 1]],
        s: [[5, 5]],
        w: [[1, 2]],
      },
      board: [[3, 4]],
    });
    const result = applyMove(state, "w", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.callout).toBe("trancao");
    expect(result.newState.scores).toEqual([0, 27]);
  });
});

describe("2v2 - VEINTICINCO", () => {
  it("triggers VEINTICINCO when 3 others pass after a play (mid-round +25, round continues)", () => {
    // N played last → E, S, W all pass → next turn is N → +25 bonus to team 0,
    // round continues with currentTurn = N.
    const state = make2v2State({
      currentTurn: "w",
      consecutivePasses: 2,
      passesSinceLastPlay: 2,
      lastPlayedBy: "n",
      hands: {
        n: [[1, 2]],
        e: [[4, 4]],
        s: [[6, 6]],
        w: [[0, 0]],
      },
      board: [[3, 2]],
    });
    const result = applyMove(state, "w", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.callout).toBe("veinticinco");
    expect(result.newState.phase).toBe("playing");
    expect(result.newState.scores[0]).toBe(25);
    expect(result.newState.currentTurn).toBe("n"); // back to lastPlayedBy
  });

  it("does NOT trigger VEINTICINCO after only 2 passes in 2v2", () => {
    const state = make2v2State({
      currentTurn: "s",
      consecutivePasses: 1,
      passesSinceLastPlay: 1,
      lastPlayedBy: "n",
      hands: {
        n: [[1, 2]],
        e: [[4, 4]],
        s: [[6, 6]],
        w: [[0, 0]],
      },
      board: [[3, 2]],
    });
    const result = applyMove(state, "s", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.newState.phase).toBe("playing");
    expect(result.newState.consecutivePasses).toBe(2);
  });

  it("awards VEINTICINCO to team 1 when E plays and N,S,W pass (mid-round +25)", () => {
    // E played last, then S, W, N pass; the cycle returns to E → +25 to team 1.
    const state = make2v2State({
      currentTurn: "n",
      consecutivePasses: 2,
      passesSinceLastPlay: 2,
      lastPlayedBy: "e",
      hands: {
        n: [[6, 6]],
        e: [[1, 2]],
        s: [[4, 4]],
        w: [[0, 0]],
      },
      board: [[3, 2]],
    });
    const result = applyMove(state, "n", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.callout).toBe("veinticinco");
    expect(result.newState.phase).toBe("playing");
    expect(result.newState.scores[1]).toBe(25);
    expect(result.newState.currentTurn).toBe("e");
  });
});

describe("2v2 - DOMINÓ scoring", () => {
  it("awards ALL remaining pips on the table (opps + winner's teammate) on DOMINÓ", () => {
    // S (team 0) goes out playing [3,1]. After the play S has 0 pips.
    // Winning team banks every other hand: N (teammate) + E + W.
    const state = make2v2State({
      currentTurn: "s",
      hands: {
        n: [[1, 1]], // 2  (winner's teammate)
        e: [[6, 5]], // 11
        s: [[3, 1]], // 0 after play
        w: [[4, 3]], // 7
      },
      board: [[4, 3]],
    });
    const result = applyMove(state, "s", { type: "play", tile: [3, 1], end: "right" });
    expect(result.success).toBe(true);
    expect(result.callout).toBe("domino");
    // 2 + 11 + 7 = 20
    expect(result.newState.scores[0]).toBe(20);
  });

  it("awards to team 1 when E goes out: N (opp) + S (opp) + W (teammate) all banked", () => {
    const state = make2v2State({
      currentTurn: "e",
      hands: {
        n: [[6, 6]], // 12
        e: [[5, 2]], // 0 after play
        s: [[4, 4]], // 8
        w: [[3, 3]], // 6  (winner's teammate)
      },
      board: [[3, 5]],
    });
    const result = applyMove(state, "e", { type: "play", tile: [5, 2], end: "right" });
    expect(result.success).toBe(true);
    expect(result.callout).toBe("domino");
    // 12 + 8 + 6 = 26
    expect(result.newState.scores[1]).toBe(26);
  });
});

describe("2v2 - draw rejection", () => {
  it("rejects draw intent in 2v2", () => {
    const state = make2v2State({
      currentTurn: "n",
      hands: {
        n: [[1, 1]],
        e: [[2, 2]],
        s: [[4, 4]],
        w: [[6, 6]],
      },
      board: [[3, 5]],
      boneyard: [[0, 0]],
    });
    const result = applyMove(state, "n", { type: "draw" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("2v2");
  });
});

describe("2v2 - pass allowed without boneyard check", () => {
  it("allows pass in 2v2 even though boneyard is empty (no boneyard gate)", () => {
    const state = make2v2State({
      currentTurn: "n",
      hands: {
        n: [[1, 1]],
        e: [[2, 2]],
        s: [[4, 4]],
        w: [[6, 6]],
      },
      board: [[3, 5]],
      boneyard: [],
    });
    const result = applyMove(state, "n", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.newState.currentTurn).toBe("e");
  });
});

describe("2v2 - game to 100", () => {
  it("finishes game when team score reaches target", () => {
    const state = make2v2State({
      scores: [95, 50],
      currentTurn: "s",
      hands: {
        n: [[1, 1]],
        e: [[6, 6]],
        s: [[5, 3]],
        w: [[5, 5]],
      },
      board: [[3, 5]],
    });
    const result = applyMove(state, "s", { type: "play", tile: [5, 3], end: "right" });
    expect(result.success).toBe(true);
    // Team 1 pips = E(12) + W(10) = 22 → team 0 score = 95 + 22 = 117 ≥ 100
    expect(result.newState.phase).toBe("finished");
    expect(result.newState.winnerTeam).toBe(0);
  });
});

describe("2v2 - play resets consecutivePasses", () => {
  it("resets passes counter on play in 2v2", () => {
    const state = make2v2State({
      currentTurn: "s",
      consecutivePasses: 2,
      passesSinceLastPlay: 2,
      hands: {
        n: [[1, 1]],
        e: [[2, 2]],
        s: [[3, 4], [6, 6]],
        w: [[4, 4]],
      },
      board: [[3, 5]],
    });
    const result = applyMove(state, "s", { type: "play", tile: [3, 4], end: "left" });
    expect(result.success).toBe(true);
    expect(result.newState.consecutivePasses).toBe(0);
    expect(result.newState.passesSinceLastPlay).toBe(0);
    expect(result.newState.lastPlayedBy).toBe("s");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Audit batch B: cascade-pass behavior, draw mechanics, round transitions, phase
// gates, and the rule-stacking corner cases. Added per the dominoes-rules audit
// (2026-05-27); rule model corrected 2026-09-02.
//
// Dominican rule model encoded here:
//
//   VEINTICINCO ("pase corrido") is a parejas (2v2) rule only. When the three
//   other seats pass after a play, +25 goes to that player's team MID-ROUND and
//   the round continues: `lastPlayedBy` gets the next turn and must play or
//   pass. The bonus never ends the game, even when it crosses targetScore.
//   Heads-up (1v1) there is no pase corrido: an opponent's pass is a plain
//   pass (turn advances, nothing banked, no callout).
//
//   TRANCAO: the board is locked when every seat passes in a row (1v1: 2
//   passes; 2v2: 4, so `lastPlayedBy` failed to play as well). The side with
//   fewer pips wins and takes the SUM of every pip left on the table (both
//   sides), the same whole-table payout as a DOMINÓ. A tie goes to the
//   starter's team, which also takes the full total. The payout stacks on top
//   of any +25 already banked earlier in the same round.
//
//   Game end: only a round end (DOMINÓ, CAPICÚA, or TRANCAO) with a score at
//   or above targetScore finishes the game. A live board is never abandoned
//   with hands still full.
//
//   CAPICÚA: the closing tile fits both open ends. A tile with a blank counts;
//   only doubles are excluded.
//
//   Stacking: VEINTICINCO can fire multiple times per round (each forced
//   pass-around adds another +25). It can also coexist with DOMINÓ / CAPICÚA on
//   the closing play; all bonuses bank into the same score column.
// ═══════════════════════════════════════════════════════════════════════════════

describe("audit/B: 1v1 cascade pass behavior", () => {
  // After N plays, lastPlayedBy=N, currentTurn=S, counters=0. S holds nothing
  // that matches the board ends 4/6 and the boneyard is empty.
  function afterNPlays(): GameState {
    return {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[1, 2], [3, 4]],
        s: [[1, 1], [2, 2]], // neither matches board ends 4/6
        e: [],
        w: [],
      },
      board: [[4, 6]],
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
  }

  it("opponent's first pass after a play is a plain pass (no pase corrido heads-up)", () => {
    const result = applyMove(afterNPlays(), "s", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.callout).toBeUndefined();
    expect(result.newState.lastCallout).toBeNull();
    expect(result.newState.phase).toBe("playing");
    expect(result.newState.scores).toEqual([0, 0]);
    expect(result.newState.currentTurn).toBe("n");
    expect(result.newState.consecutivePasses).toBe(1);
    expect(result.newState.passesSinceLastPlay).toBe(1);
  });

  it("a play in between resets the counter; two passes in a row lock the table for the lighter side", () => {
    // S passes (plain). N plays [3,4] on the left: ends become 3/6 and the
    // counter resets. S still cannot follow and passes (plain again). N holds
    // only [1,2] and passes too: TRANCAO. N has 3 pips, S has 6, so team 0
    // takes the whole table, 3 + 6 = 9.
    const p1 = applyMove(afterNPlays(), "s", { type: "pass" });
    const play = applyMove(p1.newState, "n", { type: "play", tile: [3, 4], end: "left" });
    expect(play.success).toBe(true);
    expect(play.newState.board).toEqual([[3, 4], [4, 6]]);
    expect(play.newState.consecutivePasses).toBe(0);

    const p2 = applyMove(play.newState, "s", { type: "pass" });
    expect(p2.success).toBe(true);
    expect(p2.callout).toBeUndefined();
    expect(p2.newState.phase).toBe("playing");
    expect(p2.newState.consecutivePasses).toBe(1);

    const locked = applyMove(p2.newState, "n", { type: "pass" });
    expect(locked.success).toBe(true);
    expect(locked.callout).toBe("trancao");
    expect(locked.newState.phase).toBe("round_over");
    expect(locked.newState.scores).toEqual([9, 0]);
  });

  it("opponent cannot pass while boneyard has tiles (must draw first)", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[1, 2]],
        s: [[1, 1], [2, 2]],
        e: [],
        w: [],
      },
      board: [[4, 6]],
      boneyard: [[3, 3]],
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
    const result = applyMove(state, "s", { type: "pass" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("draw");
  });
});

describe("audit/B: 2v2 cascade pass behavior", () => {
  it("third opponent pass after a play triggers VEINTICINCO mid-round (round continues)", () => {
    // N plays. E,S,W each lack a 6. Three consecutive passes return to N
    // → +25 to team 0, round stays "playing", N gets the next turn.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[6, 0]],
        e: [[1, 1], [2, 2]],
        s: [[3, 3], [4, 4]],
        w: [[5, 5]],
      },
      board: [[6, 6]], // both ends 6, no one else has a 6
      boneyard: [],
      currentTurn: "e",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    const r1 = applyMove(state, "e", { type: "pass" });
    expect(r1.success).toBe(true);
    expect(r1.newState.phase).toBe("playing");
    expect(r1.newState.consecutivePasses).toBe(1);

    const r2 = applyMove(r1.newState, "s", { type: "pass" });
    expect(r2.success).toBe(true);
    expect(r2.newState.phase).toBe("playing");
    expect(r2.newState.consecutivePasses).toBe(2);

    const r3 = applyMove(r2.newState, "w", { type: "pass" });
    expect(r3.success).toBe(true);
    expect(r3.callout).toBe("veinticinco");
    expect(r3.newState.phase).toBe("playing");
    expect(r3.newState.scores[0]).toBe(25);
    expect(r3.newState.currentTurn).toBe("n");
  });

  it("VEINTICINCO triggers for any seat as last-player (cycle always returns at pass 3)", () => {
    // E played last. S,W,N pass in order → cycle returns to E.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[1, 1]],
        e: [[3, 4]],
        s: [[2, 2]],
        w: [[5, 5]],
      },
      board: [[6, 0]], // ends 6,0: none of [1,1],[2,2],[5,5] match
      boneyard: [],
      currentTurn: "s",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "e",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "e",
    };
    const r1 = applyMove(state, "s", { type: "pass" });
    const r2 = applyMove(r1.newState, "w", { type: "pass" });
    const r3 = applyMove(r2.newState, "n", { type: "pass" });
    expect(r3.callout).toBe("veinticinco");
    expect(r3.newState.phase).toBe("playing");
    expect(r3.newState.scores[1]).toBe(25);
    expect(r3.newState.currentTurn).toBe("e");
  });
});

describe("audit/B: draw mechanics", () => {
  it("draw stops at first playable tile; turn does not advance", () => {
    // Board ends 3 and 5. Boneyard popped from end: [5,6] first → matches end 5 → stop.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: { n: [[6, 6]], s: [[1, 1]], e: [], w: [] },
      board: [[3, 5]],
      boneyard: [[2, 2], [4, 4], [5, 6]],
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
    const r = applyMove(state, "s", { type: "draw" });
    expect(r.success).toBe(true);
    expect(r.newState.hands.s).toHaveLength(2); // [1,1] + [5,6]
    expect(r.newState.boneyard).toHaveLength(2); // [2,2], [4,4] remain
    expect(r.newState.currentTurn).toBe("s");
  });

  it("draw exhausts boneyard without finding a match; subsequent pass is allowed", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: { n: [[6, 6]], s: [[1, 1]], e: [], w: [] },
      board: [[3, 5]],
      boneyard: [[2, 2], [4, 4]], // neither matches 3 or 5
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
    const drew = applyMove(state, "s", { type: "draw" });
    expect(drew.success).toBe(true);
    expect(drew.newState.hands.s).toHaveLength(3);
    expect(drew.newState.boneyard).toHaveLength(0);
    expect(drew.newState.currentTurn).toBe("s");

    // Now pass is allowed (boneyard empty + no legal play). Heads-up this is a
    // plain pass: no callout, nothing banked, the turn goes to N.
    const passed = applyMove(drew.newState, "s", { type: "pass" });
    expect(passed.success).toBe(true);
    expect(passed.callout).toBeUndefined();
    expect(passed.newState.lastCallout).toBeNull();
    expect(passed.newState.phase).toBe("playing");
    expect(passed.newState.scores).toEqual([0, 0]);
    expect(passed.newState.currentTurn).toBe("n");
    expect(passed.newState.consecutivePasses).toBe(1);
  });

  it("drawn tiles count against you when the table locks right after", () => {
    // Same setup: S draws [4,4] and [2,2] without finding a match and passes.
    // N holds [6,6] with no match either, so N's pass locks the table.
    // S now holds 2 + 4 + 8 = 14 pips against N's 12: team 0 takes all 26.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: { n: [[6, 6]], s: [[1, 1]], e: [], w: [] },
      board: [[3, 5]],
      boneyard: [[2, 2], [4, 4]], // neither matches 3 or 5
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
    const drew = applyMove(state, "s", { type: "draw" });
    const passed = applyMove(drew.newState, "s", { type: "pass" });
    const locked = applyMove(passed.newState, "n", { type: "pass" });
    expect(locked.success).toBe(true);
    expect(locked.callout).toBe("trancao");
    expect(locked.newState.phase).toBe("round_over");
    expect(locked.newState.scores).toEqual([26, 0]);
    const payload = locked.newState.lastCalloutPayload as Record<string, unknown>;
    expect(payload.team0Pips).toBe(12);
    expect(payload.team1Pips).toBe(14);
  });
});

describe("audit/B: game-end transitions", () => {
  it("DOMINÓ crossing target finishes the game (phase=finished, winnerTeam set)", () => {
    // Scores [85,50]. N about to play [1,2] on board [[5,2]]'s right end.
    // S holds [3,4]+[5,6] = 7+11 = 18. New N score = 85+18 = 103.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [85, 50],
      roundIndex: 0,
      hands: { n: [[1, 2]], s: [[3, 4], [5, 6]], e: [], w: [] },
      board: [[5, 2]],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "s",
    };
    const r = applyMove(state, "n", { type: "play", tile: [1, 2], end: "right" });
    expect(r.success).toBe(true);
    expect(r.callout).toBe("domino");
    expect(r.newState.phase).toBe("finished");
    expect(r.newState.winnerTeam).toBe(0);
    expect(r.newState.scores[0]).toBe(85 + handPips([[3, 4], [5, 6]]));
  });

  it("CAPICÚA at game-winning DOMINÓ awards bonus AND finishes game", () => {
    // Board [[2,6],[6,5]] left=2 right=5. N plays [2,5] on right →
    // newBoard=[[2,6],[6,5],[5,2]] new ends both 2 → capicúa.
    // Scores [70,50]. Opp pips = [3,4]+[6,6] = 7+12 = 19. Bonus +25. Final = 70+44 = 114.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [70, 50],
      roundIndex: 0,
      hands: { n: [[2, 5]], s: [[3, 4], [6, 6]], e: [], w: [] },
      board: [[2, 6], [6, 5]],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "s",
    };
    const r = applyMove(state, "n", { type: "play", tile: [2, 5], end: "right" });
    expect(r.success).toBe(true);
    expect(r.callout).toBe("capicua");
    expect(r.newState.phase).toBe("finished");
    expect(r.newState.winnerTeam).toBe(0);
    expect(r.newState.scores[0]).toBe(70 + 19 + 25);
    // Sanity: isCapicua on the resulting board agrees
    expect(isCapicua(r.newState.board, [2, 5])).toBe(true);
  });
});

describe("audit/B: startNewRound", () => {
  it("resets pass counters and callout, increments roundIndex, preserves scores", () => {
    const ended: GameState = {
      phase: "round_over",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [30, 12],
      roundIndex: 0,
      hands: { n: [], s: [[1, 2]], e: [], w: [] },
      board: [[3, 3]],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "s",
      lastCallout: "domino",
      lastCalloutPayload: { winningTeam: 0 },
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    const next = startNewRound(ended, ended.players);
    expect(next.phase).toBe("playing");
    expect(next.roundIndex).toBe(1);
    expect(next.scores).toEqual([30, 12]);
    expect(next.consecutivePasses).toBe(0);
    expect(next.passesSinceLastPlay).toBe(0);
    expect(next.lastCallout).toBeNull();
    expect(next.lastCalloutPayload).toBeNull();
    expect(next.winnerTeam).toBeNull();
    expect(next.lastPlayedBy).toBeNull();
    expect(next.board).toEqual([]); // empty board, no auto-play in subsequent rounds
    // Hands re-dealt from a full set
    const total =
      next.hands.n.length + next.hands.s.length + next.boneyard.length;
    expect(total).toBe(28);
  });

  it("round-2 starter is the DOMINÓ winner (last player to play)", () => {
    const ended: GameState = {
      phase: "round_over",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [10, 30],
      roundIndex: 0,
      hands: { n: [[1, 2]], s: [], e: [], w: [] },
      board: [[3, 3]],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: "domino",
      lastCalloutPayload: { winningTeam: 1 },
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "s",
    };
    const next = startNewRound(ended, ended.players);
    expect(next.currentTurn).toBe("s");
    expect(next.starterThisRound).toBe("s");
  });

  it("after TRANCAO, round-2 starter is the lowest-pip seat on the winning team (2v2)", () => {
    // TRANCAO won by team 0 (N+S). N has 2 pips, S has 7 → N starts.
    const ended: GameState = {
      phase: "round_over",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      scores: [10, 0],
      roundIndex: 0,
      hands: {
        n: [[1, 1]], // 2 pips
        e: [[5, 5]],
        s: [[3, 4]], // 7 pips
        w: [[6, 6]],
      },
      board: [[3, 2]],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 4,
      passesSinceLastPlay: 4,
      starterThisRound: "e",
      lastCallout: "trancao",
      lastCalloutPayload: { winningTeam: 0 },
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "e",
    };
    const next = startNewRound(ended, ended.players);
    expect(next.currentTurn).toBe("n");
    expect(next.starterThisRound).toBe("n");
  });
});

describe("audit/B: round winner leads next round (via applyMove, not fixtures)", () => {
  it("1v1: the seat that goes out on DOMINÓ starts the next round", () => {
    // Regression: the wentOut branch previously omitted lastPlayedBy, so the
    // PREVIOUS player (n) leaked through as next-round starter instead of the
    // winner (s). This drives the win through applyMove, the path that the
    // hand-set fixtures below never exercised.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: { n: [[3, 4]], s: [[1, 2]], e: [], w: [] },
      board: [[5, 5], [5, 3], [3, 1]], // left end 5, right end 1
      boneyard: [],
      currentTurn: "s",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n", // the previous player, must NOT leak through
    };
    const r = applyMove(state, "s", { type: "play", tile: [1, 2], end: "right" });
    expect(r.success).toBe(true);
    expect(r.callout).toBe("domino");
    expect(r.newState.lastPlayedBy).toBe("s");

    const next = startNewRound(r.newState, r.newState.players);
    expect(next.starterThisRound).toBe("s");
    expect(next.currentTurn).toBe("s");
  });

  it("2v2: the seat that goes out on DOMINÓ starts the next round", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[6, 6]],
        e: [[5, 2]], // goes out
        s: [[4, 4]],
        w: [[3, 3]],
      },
      board: [[3, 5]], // right end 5
      boneyard: [],
      currentTurn: "e",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    const r = applyMove(state, "e", { type: "play", tile: [5, 2], end: "right" });
    expect(r.success).toBe(true);
    expect(r.callout).toBe("domino");
    expect(r.newState.lastPlayedBy).toBe("e");

    const next = startNewRound(r.newState, r.newState.players);
    expect(next.starterThisRound).toBe("e");
    expect(next.currentTurn).toBe("e");
  });

  it("CAPICÚA winner (via applyMove) starts the next round", () => {
    // Board [[2,6],[6,5]] left=2 right=5; N plays [2,5] on right →
    // ends become 2 and 2 → capicúa DOMINÓ. N must start next round.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: { n: [[2, 5]], s: [[3, 4]], e: [], w: [] },
      board: [[2, 6], [6, 5]],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "s",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "s",
    };
    const r = applyMove(state, "n", { type: "play", tile: [2, 5], end: "right" });
    expect(r.success).toBe(true);
    expect(r.callout).toBe("capicua");
    expect(r.newState.lastPlayedBy).toBe("n");

    const next = startNewRound(r.newState, r.newState.players);
    expect(next.starterThisRound).toBe("n");
    expect(next.currentTurn).toBe("n");
  });
});

describe("audit/B: TRANCAO scoring on a tie", () => {
  it("1v1 TRANCAO on a tie: starter's team takes the whole table", () => {
    // S opened with [6,6], N could not follow and passed, and now S cannot
    // follow either: the second pass in a row locks the table. Both sides hold
    // 5 pips, so the tie goes to the starter S (team 1), who takes 5 + 5 = 10.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: { n: [[2, 3]], s: [[0, 5]], e: [], w: [] }, // both 5 pips
      board: [[6, 6]],
      boneyard: [],
      currentTurn: "s",
      consecutivePasses: 1,
      passesSinceLastPlay: 1,
      starterThisRound: "s",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "s",
    };
    const r = applyMove(state, "s", { type: "pass" });
    expect(r.success).toBe(true);
    expect(r.callout).toBe("trancao");
    expect(r.newState.phase).toBe("round_over");
    expect(r.newState.scores).toEqual([0, 10]);
    const payload = r.newState.lastCalloutPayload as Record<string, unknown>;
    expect(payload.winningTeam).toBe(1);
    expect(payload.pts).toBe(10);
  });
});

describe("audit/B: VEINTICINCO + TRANCAO stacking (true game lock)", () => {
  it("1v1: no pase corrido; the second pass in a row locks the table and pays the whole table", () => {
    // N played, S has no match and passes: a plain pass, nothing banked.
    // currentTurn returns to N, but N has no match either and passes:
    // consecutivePasses reaches 2, TRANCAO. The lighter side takes every pip.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[6, 6]], // 12 pips, no match for ends 3/5
        s: [[1, 1]], // 2 pips, no match
        e: [],
        w: [],
      },
      board: [[3, 5]],
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
    // First pass: plain, no VEINTICINCO heads-up
    const r1 = applyMove(state, "s", { type: "pass" });
    expect(r1.success).toBe(true);
    expect(r1.callout).toBeUndefined();
    expect(r1.newState.lastCallout).toBeNull();
    expect(r1.newState.phase).toBe("playing");
    expect(r1.newState.scores).toEqual([0, 0]);
    expect(r1.newState.currentTurn).toBe("n");

    // Second pass (by N who also can't play): TRANCAO
    const r2 = applyMove(r1.newState, "n", { type: "pass" });
    expect(r2.success).toBe(true);
    expect(r2.callout).toBe("trancao");
    expect(r2.newState.phase).toBe("round_over");
    // Team 0 holds 12, team 1 holds 2: team 1 takes the whole table, 14.
    expect(r2.newState.scores).toEqual([0, 14]);
  });

  it("2v2: forcer's own pass after the +25 triggers TRANCAO; the whole table stacks on top", () => {
    // N played [6,6], everyone else lacks a 6. E,S,W pass → VEINTICINCO (+25
    // to team 0). N also has no 6 → passes → TRANCAO. The lighter team takes
    // every pip on the table; the +25 stays banked.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        // Team 0: N=[1,2]=3, S=[3,3]+[4,4]=14 → total 17
        n: [[1, 2]],
        s: [[3, 3], [4, 4]],
        // Team 1: E=[1,1]+[2,2]=6, W=[5,5]=10 → total 16 (lower)
        e: [[1, 1], [2, 2]],
        w: [[5, 5]],
      },
      board: [[6, 6]], // both ends 6, nobody has another 6
      boneyard: [],
      currentTurn: "e",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    const r1 = applyMove(state, "e", { type: "pass" });
    const r2 = applyMove(r1.newState, "s", { type: "pass" });
    const r3 = applyMove(r2.newState, "w", { type: "pass" });
    expect(r3.callout).toBe("veinticinco");
    expect(r3.newState.scores[0]).toBe(25);
    expect(r3.newState.currentTurn).toBe("n");

    // N now must pass too (no 6 in hand) → fourth pass → TRANCAO
    const r4 = applyMove(r3.newState, "n", { type: "pass" });
    expect(r4.callout).toBe("trancao");
    expect(r4.newState.phase).toBe("round_over");
    // VEINTICINCO bonus still banked; TRANCAO pays the whole table (17 + 16 = 33)
    // to the lighter team 1.
    expect(r4.newState.scores[0]).toBe(25);
    expect(r4.newState.scores[1]).toBe(33);
  });
});

describe("audit/B: VEINTICINCO stacking (multiple bonuses in one round)", () => {
  it("2v2: same player can earn VEINTICINCO twice in one round (50 total)", () => {
    // N forces a pass-around with their first play → +25.
    // N plays a second tile that also forces a pass-around → +25 again.
    // After this sequence, scores[0] = 50.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 200,
      scores: [0, 0],
      roundIndex: 0,
      // N's plays after the existing [6,6] will keep both ends in the 3..6 range.
      // E/S/W are intentionally stocked with only blanks/ones/twos so they can't match.
      hands: {
        n: [[6, 3], [6, 5]],
        e: [[1, 1], [2, 2]],
        s: [[0, 0]],
        w: [[0, 1]],
      },
      board: [[6, 6]],
      boneyard: [],
      currentTurn: "e",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    // First cycle: E,S,W pass → VEINTICINCO #1
    const v1 = applyMove(
      applyMove(applyMove(state, "e", { type: "pass" }).newState, "s", {
        type: "pass",
      }).newState,
      "w",
      { type: "pass" }
    );
    expect(v1.callout).toBe("veinticinco");
    expect(v1.newState.scores[0]).toBe(25);
    expect(v1.newState.currentTurn).toBe("n");
    expect(v1.newState.lastCallout).toBe("veinticinco");

    // N plays [6,3] on left → board ends become 3, 6. Callout clears.
    const p1 = applyMove(v1.newState, "n", {
      type: "play",
      tile: [6, 3],
      end: "left",
    });
    expect(p1.success).toBe(true);
    expect(p1.newState.lastCallout).toBeNull();
    expect(p1.newState.scores[0]).toBe(25); // bonus still banked

    // Second cycle: ends 3,6; E/S/W still cannot match (only blanks/ones/twos)
    const v2 = applyMove(
      applyMove(applyMove(p1.newState, "e", { type: "pass" }).newState, "s", {
        type: "pass",
      }).newState,
      "w",
      { type: "pass" }
    );
    expect(v2.callout).toBe("veinticinco");
    expect(v2.newState.scores[0]).toBe(50); // stacked
    expect(v2.newState.currentTurn).toBe("n");
  });
});

describe("audit/B: VEINTICINCO + DOMINÓ / CAPICÚA stacking", () => {
  it("VEINTICINCO bonus stays banked when forcer goes out on the next play (DOMINÓ)", () => {
    // After E,S,W pass, N gets +25 then plays last tile to DOMINÓ.
    // Final score = 25 (VEINTICINCO) + opp pips (DOMINÓ).
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 200,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[6, 5]], // last tile, matches the 6 end after VEINTICINCO
        e: [[1, 1], [2, 2]],
        s: [[3, 3]],
        w: [[0, 0]],
      },
      board: [[6, 6]],
      boneyard: [],
      currentTurn: "e",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    // Force the pass-around: E, S, W
    const v = applyMove(
      applyMove(applyMove(state, "e", { type: "pass" }).newState, "s", {
        type: "pass",
      }).newState,
      "w",
      { type: "pass" }
    );
    expect(v.callout).toBe("veinticinco");
    expect(v.newState.scores[0]).toBe(25);

    // N plays last tile → DOMINÓ (not capicúa: new ends are 5 and 6)
    const out = applyMove(v.newState, "n", {
      type: "play",
      tile: [6, 5],
      end: "left",
    });
    expect(out.success).toBe(true);
    expect(out.callout).toBe("domino");
    expect(out.newState.phase).toBe("round_over");
    // Opp pips: E=2+4=6, W=0 → 6. Team 0 final = 25 + 6 = 31.
    expect(out.newState.scores[0]).toBe(25 + handPips([[1, 1], [2, 2]]) + handPips([[3, 3]]) + handPips([[0, 0]]));
  });

  it("max stack: VEINTICINCO + DOMINÓ + CAPICÚA all bank into the same column", () => {
    // E,S,W pass → +25. Then N plays last tile [3,5] on left of board
    // [[3,4],[4,5]] → new board [[5,3],[3,4],[4,5]] with both ends = 5 → CAPICÚA DOMINÓ.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 200,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[3, 5]],
        e: [[1, 1]],
        s: [[6, 6]], // 6 pips don't match ends 3 or 5
        w: [[2, 2]],
      },
      board: [[3, 4], [4, 5]],
      boneyard: [],
      currentTurn: "e",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    const v = applyMove(
      applyMove(applyMove(state, "e", { type: "pass" }).newState, "s", {
        type: "pass",
      }).newState,
      "w",
      { type: "pass" }
    );
    expect(v.callout).toBe("veinticinco");
    expect(v.newState.scores[0]).toBe(25);

    const out = applyMove(v.newState, "n", {
      type: "play",
      tile: [3, 5],
      end: "left",
    });
    expect(out.success).toBe(true);
    expect(out.callout).toBe("capicua");
    expect(out.newState.phase).toBe("round_over");
    // 25 (VEINTICINCO) + opp pips + 25 (CAPICÚA)
    // Opp pips: E=2, S=12, W=4 → 18
    expect(out.newState.scores[0]).toBe(25 + 18 + 25);
  });
});

describe("audit/B: VEINTICINCO at target score", () => {
  // 2v2, scores [80, 50], target 100. N played [6,6] and nobody else holds a
  // 6, so E, S, W pass in turn and the +25 lands on team 0 at 105.
  function atTargetState(nHand: GameState["hands"]["n"]): GameState {
    return {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      scores: [80, 50],
      roundIndex: 3,
      hands: {
        n: nHand,
        e: [[1, 1]], // 2
        s: [[2, 2]], // 4
        w: [[0, 0]], // 0
      },
      board: [[6, 6]],
      boneyard: [],
      currentTurn: "e",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
  }

  function passAround(state: GameState) {
    const r1 = applyMove(state, "e", { type: "pass" });
    const r2 = applyMove(r1.newState, "s", { type: "pass" });
    return applyMove(r2.newState, "w", { type: "pass" });
  }

  it("+25 that crosses targetScore does NOT end the game: phase stays playing, winnerTeam null", () => {
    const v = passAround(atTargetState([[6, 5]]));
    expect(v.success).toBe(true);
    expect(v.callout).toBe("veinticinco");
    expect(v.newState.scores).toEqual([105, 50]);
    expect(v.newState.phase).toBe("playing");
    expect(v.newState.winnerTeam).toBeNull();
    expect(v.newState.currentTurn).toBe("n");
    // The round is still live: a redeal is refused until the round really ends.
    expect(startNewRound(v.newState, v.newState.players)).toBe(v.newState);
  });

  it("the DOMINÓ that ends the round afterwards finishes the game at or above target", () => {
    const v = passAround(atTargetState([[6, 5]]));
    // N goes out with [6,5]: 105 + (E 2 + S 4 + W 0) = 111.
    const out = applyMove(v.newState, "n", { type: "play", tile: [6, 5], end: "left" });
    expect(out.success).toBe(true);
    expect(out.callout).toBe("domino");
    expect(out.newState.scores).toEqual([111, 50]);
    expect(out.newState.phase).toBe("finished");
    expect(out.newState.winnerTeam).toBe(0);
  });

  it("a TRANCAO that ends the round afterwards finishes the game, even when the other team wins the lock", () => {
    // N holds [5,4] and cannot follow a 6 either: N's pass is the fourth in a
    // row. Team 0 holds 9, team 1 holds 2 + 4 + 0 = 6, so team 1 is lighter
    // and takes the whole table (15). Team 0 still sits at 105, so it wins.
    const v = passAround(atTargetState([[5, 4]]));
    const locked = applyMove(v.newState, "n", { type: "pass" });
    expect(locked.success).toBe(true);
    expect(locked.callout).toBe("trancao");
    expect(locked.newState.scores).toEqual([105, 65]);
    expect(locked.newState.phase).toBe("finished");
    expect(locked.newState.winnerTeam).toBe(0);
  });
});

describe("audit/B: VEINTICINCO callout clears on next move", () => {
  it("forcer's next play clears the VEINTICINCO callout from state", () => {
    // After VEINTICINCO, lastCallout is "veinticinco". The next play by
    // anyone (the forcer themselves, here) should reset lastCallout so the
    // UI doesn't keep showing the overlay across the rest of the round.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 200,
      scores: [25, 0], // already +25 from a prior VEINTICINCO in this round
      roundIndex: 0,
      hands: {
        n: [[6, 3], [6, 5]],
        e: [[1, 1]],
        s: [[2, 2]],
        w: [[0, 0]],
      },
      board: [[6, 6]],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 3,
      passesSinceLastPlay: 3,
      starterThisRound: "n",
      lastCallout: "veinticinco",
      lastCalloutPayload: { winningTeam: 0, veinticincoBonus: 25 },
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    const r = applyMove(state, "n", {
      type: "play",
      tile: [6, 3],
      end: "left",
    });
    expect(r.success).toBe(true);
    expect(r.newState.lastCallout).toBeNull();
    expect(r.newState.lastCalloutPayload).toBeNull();
    // Counters reset, lastPlayedBy stays N (just played again)
    expect(r.newState.consecutivePasses).toBe(0);
    expect(r.newState.passesSinceLastPlay).toBe(0);
    expect(r.newState.lastPlayedBy).toBe("n");
  });
});

describe("audit/B: validateMove phase gates", () => {
  it("rejects play during round_over", () => {
    const state: GameState = {
      phase: "round_over",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [10, 0],
      roundIndex: 0,
      hands: { n: [[1, 2]], s: [], e: [], w: [] },
      board: [[3, 3]],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: "domino",
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "s",
    };
    const r = applyMove(state, "n", { type: "play", tile: [1, 2], end: "left" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("not in play");
  });

  it("rejects play during finished", () => {
    const state: GameState = {
      phase: "finished",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [110, 50],
      roundIndex: 2,
      hands: { n: [[1, 2]], s: [], e: [], w: [] },
      board: [[3, 3]],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: "domino",
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: 0,
      lastPlayedBy: "s",
    };
    const r = applyMove(state, "n", { type: "play", tile: [1, 2], end: "left" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("not in play");
  });
});
