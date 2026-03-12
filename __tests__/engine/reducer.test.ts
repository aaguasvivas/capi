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
