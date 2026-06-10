import { describe, it, expect } from "vitest";
import {
  tilePips,
  handPips,
  teamPips,
  scoreDomino,
  scoreTrancao,
  isCapicua,
} from "../src/scoring";
import type { GameState } from "../src/types";

describe("tilePips", () => {
  it("sums both pips", () => {
    expect(tilePips([3, 5])).toBe(8);
    expect(tilePips([0, 0])).toBe(0);
  });
});

describe("handPips", () => {
  it("sums all tiles", () => {
    expect(handPips([[1, 2], [3, 4]])).toBe(10);
  });
});

describe("teamPips", () => {
  it("sums team hands in 1v1", () => {
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
        s: [[3, 4]],
        e: [],
        w: [],
      },
      board: [],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: null,
    };
    expect(teamPips(state, 0)).toBe(3);
    expect(teamPips(state, 1)).toBe(7);
  });
});

describe("scoreDomino", () => {
  it("returns opponent pips", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[1, 2], [3, 4]],
        s: [],
        e: [],
        w: [],
      },
      board: [],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: null,
    };
    expect(scoreDomino(state, 1)).toBe(10);
  });
});

describe("scoreTrancao", () => {
  it("lower team wins difference", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[1, 1]],
        s: [[6, 6]],
        e: [],
        w: [],
      },
      board: [],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 2,
      passesSinceLastPlay: 2,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: null,
    };
    const r = scoreTrancao(state);
    expect(r.winnerTeam).toBe(0);
    expect(r.pts).toBe(10);
  });
  it("tie: starter wins, 0 pts", () => {
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
        s: [[1, 2]],
        e: [],
        w: [],
      },
      board: [],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 2,
      passesSinceLastPlay: 2,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: null,
    };
    const r = scoreTrancao(state);
    expect(r.winnerTeam).toBe(0);
    expect(r.pts).toBe(0);
  });
});

describe("isCapicua", () => {
  it("true when both ends match, tile not double/blank", () => {
    expect(isCapicua([[4, 5], [5, 3], [3, 4]], [4, 3])).toBe(true);
  });
  it("false when tile is double", () => {
    expect(isCapicua([[3, 3]], [3, 3])).toBe(false);
  });
  it("false when tile has blank", () => {
    expect(isCapicua([[0, 1], [1, 2], [2, 0]], [0, 4])).toBe(false);
  });
  it("false when ends differ", () => {
    expect(isCapicua([[3, 4], [4, 5]], [5, 2])).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2v2 Scoring Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("2v2 - teamPips", () => {
  it("sums N+S for team 0 and E+W for team 1", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[1, 2]],   // 3
        e: [[3, 4]],   // 7
        s: [[5, 6]],   // 11
        w: [[6, 6]],   // 12
      },
      board: [],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: null,
    };
    expect(teamPips(state, 0)).toBe(14); // N(3) + S(11)
    expect(teamPips(state, 1)).toBe(19); // E(7) + W(12)
  });
});

describe("2v2 - scoreDomino", () => {
  it("returns the sum of ALL remaining hands (opps + winner's teammate)", () => {
    // Winner N went out (hand empty). Per Dominican rules the winner's team
    // banks every remaining pip on the table — both opps AND the teammate.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [], // winner, went out
        e: [[3, 4], [5, 5]], // 7 + 10 = 17
        s: [[1, 2]], // 3 (winner's teammate)
        w: [[6, 6]], // 12
      },
      board: [],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: null,
    };
    // 17 + 3 + 12 = 32
    expect(scoreDomino(state, 0)).toBe(32);
  });
});

describe("2v2 - scoreTrancao", () => {
  it("compares team pip totals", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[1, 1]],   // 2
        e: [[6, 6]],   // 12
        s: [[2, 2]],   // 4
        w: [[5, 5]],   // 10
      },
      board: [],
      boneyard: [],
      currentTurn: "n",
      consecutivePasses: 4,
      passesSinceLastPlay: 4,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: null,
    };
    const r = scoreTrancao(state);
    // Team 0 = 2+4 = 6, Team 1 = 12+10 = 22
    expect(r.winnerTeam).toBe(0);
    expect(r.pts).toBe(16);
  });
});
