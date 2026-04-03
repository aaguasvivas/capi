import { describe, it, expect } from "vitest";
import {
  createInitialState,
  applyMove,
} from "@/lib/engine/reducer";
import type { GameState } from "@/lib/engine/types";
import { handPips, isCapicua } from "@/lib/engine/scoring";

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
  it("awards difference to lower pip team on TRANCAO", () => {
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
    const team0 = handPips(state.hands.n);
    const team1 = handPips(state.hands.s);
    const diff = Math.abs(team0 - team1);
    const winner = team0 < team1 ? 0 : 1;
    expect(result.newState.scores[winner]).toBe(diff);
  });
});

describe("applyMove - VEINTICINCO", () => {
  it("triggers VEINTICINCO in 1v1 when opponent passes after your play", () => {
    // N plays, leaving the board with right end = 2
    // S has no matching tiles → S passes → VEINTICINCO for N (team 0)
    const stateAfterNPlay: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[4, 5]],
        s: [[1, 1], [2, 2], [3, 3]],
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
    // S cannot match left end (6) or right end (2) with [1,1],[2,2],[3,3]
    // Wait — [2,2] matches right end 2. Use tiles that don't match.
    const state: GameState = {
      ...stateAfterNPlay,
      hands: {
        ...stateAfterNPlay.hands,
        s: [[1, 1], [3, 3], [4, 4]],
      },
    };
    const result = applyMove(state, "s", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.newState.lastCallout).toBe("veinticinco");
    expect(result.newState.phase).toBe("round_over");
    // N (team 0) wins: 25 bonus + opponent pips
    const opponentPips = handPips([[1, 1]]) + handPips([[3, 3]]) + handPips([[4, 4]]);
    const expectedScore = 25 + opponentPips;
    expect(result.newState.scores[0]).toBe(expectedScore);
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

  it("scores TRANCAO with team pip totals (N+S vs E+W) — tie goes to starter", () => {
    // Team 0 (N+S): [6,6] + [1,1] = 12+2 = 14
    // Team 1 (E+W): [5,5] + [4,4] = 10+8 = 18 ... nah, let's make tie
    // Team 0 (N+S): [6,6] + [1,1] = 14, Team 1 (E+W): [5,5] + [2,2] = 14
    // W has [2,2], board left=3, right=0 → no match → pass OK
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
    // Tie → starter (e, team 1) wins with 0 pts
    expect(result.newState.scores).toEqual([0, 0]);
  });

  it("scores TRANCAO to lower pip team in 2v2", () => {
    // Team 0 (N+S): [1,1] + [1,2] = 2+3 = 5
    // Team 1 (E+W): [6,6] + [5,5] = 12+10 = 22
    // Diff = 17 → team 0 wins
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
    expect(result.newState.scores[0]).toBe(17);
    expect(result.newState.scores[1]).toBe(0);
  });
});

describe("2v2 - VEINTICINCO", () => {
  it("triggers VEINTICINCO when 3 others pass after a play", () => {
    // N played last → E, S, W all pass → next turn is N → VEINTICINCO for N
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
    expect(result.newState.phase).toBe("round_over");
    // N (team 0) wins: 25 + opponent pips (E+W = 4+4+0+0 = 8)
    const oppPips = handPips([[4, 4]]) + handPips([[0, 0]]);
    expect(result.newState.scores[0]).toBe(25 + oppPips);
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

  it("awards VEINTICINCO to team 1 when E plays and N,S,W pass", () => {
    // E played last, then S, W, N all pass (3 passes)
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
    // E is team 1 → team 1 wins
    // Opp pips = team 0 = N+S = 12+8 = 20
    expect(result.newState.scores[1]).toBe(25 + 20);
  });
});

describe("2v2 - DOMINÓ scoring", () => {
  it("awards opponent TEAM pips (both players) on DOMINÓ", () => {
    // S (team 0) goes out. Team 1 pips = E hand + W hand
    // Board: [4,3] → left=4, right=3. S plays [3,1] on right → board ends [4,...,1]
    // Not capicúa because left=4 ≠ right=1
    const state = make2v2State({
      currentTurn: "s",
      hands: {
        n: [[1, 1]],
        e: [[6, 5]],
        s: [[3, 1]],
        w: [[4, 3]],
      },
      board: [[4, 3]],
    });
    const result = applyMove(state, "s", { type: "play", tile: [3, 1], end: "right" });
    expect(result.success).toBe(true);
    expect(result.callout).toBe("domino");
    // Team 0 wins: opponent team 1 pips = E(11) + W(7) = 18
    expect(result.newState.scores[0]).toBe(18);
  });

  it("awards to team 1 when E goes out", () => {
    const state = make2v2State({
      currentTurn: "e",
      hands: {
        n: [[6, 6]],
        e: [[5, 2]],
        s: [[4, 4]],
        w: [[3, 3]],
      },
      board: [[3, 5]],
    });
    const result = applyMove(state, "e", { type: "play", tile: [5, 2], end: "right" });
    expect(result.success).toBe(true);
    expect(result.callout).toBe("domino");
    // Team 1 wins: opponent team 0 pips = N(12) + S(8) = 20
    expect(result.newState.scores[1]).toBe(20);
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
