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
  it("lower side wins and takes every pip on the table (both sides)", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[1, 1]], // 2
        s: [[6, 6]], // 12
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
    // Whole table, not the difference: 2 + 12 = 14
    expect(r.pts).toBe(14);
  });
  it("tie: starter's team wins and takes the whole table", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[1, 2]], // 3
        s: [[1, 2]], // 3
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
    expect(r.pts).toBe(6);
  });
  it("tie: a starter on team 1 takes the whole table for team 1", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[2, 3]], // 5
        s: [[0, 5]], // 5
        e: [],
        w: [],
      },
      board: [],
      boneyard: [],
      currentTurn: "s",
      consecutivePasses: 2,
      passesSinceLastPlay: 2,
      starterThisRound: "s",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: null,
    };
    const r = scoreTrancao(state);
    expect(r.winnerTeam).toBe(1);
    expect(r.pts).toBe(10);
  });
});

describe("isCapicua", () => {
  it("true when both ends match and the tile is not a double", () => {
    expect(isCapicua([[4, 5], [5, 3], [3, 4]], [4, 3])).toBe(true);
  });
  it("false when tile is double", () => {
    expect(isCapicua([[3, 3]], [3, 3])).toBe(false);
  });
  it("false for the double blank (doubles are the only exclusion)", () => {
    expect(isCapicua([[0, 0]], [0, 0])).toBe(false);
  });
  it("true when the closing tile has a blank", () => {
    // Board ends 3 and 3; the closing tile [0,3] carries a blank and still counts.
    expect(isCapicua([[3, 5], [5, 0], [0, 3]], [0, 3])).toBe(true);
  });
  it("true when both open ends are blank", () => {
    // Board ends 0 and 0; the closing tile [5,0] is not a double.
    expect(isCapicua([[0, 3], [3, 5], [5, 0]], [5, 0])).toBe(true);
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
    // banks every remaining pip on the table, both opps AND the teammate.
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
  it("lower team wins and takes every pip on the table (both teams)", () => {
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
    // Team 0 = 2+4 = 6, Team 1 = 12+10 = 22. Team 0 takes 6 + 22 = 28.
    expect(r.winnerTeam).toBe(0);
    expect(r.pts).toBe(28);
  });
  it("tie: starter's team takes the whole table", () => {
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
        e: [[3, 0]],   // 3
        s: [[2, 2]],   // 4
        w: [[1, 2]],   // 3
      },
      board: [],
      boneyard: [],
      currentTurn: "e",
      consecutivePasses: 4,
      passesSinceLastPlay: 4,
      starterThisRound: "e",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: null,
    };
    const r = scoreTrancao(state);
    // Team 0 = 6, Team 1 = 6. Starter E is on team 1, which takes all 12.
    expect(r.winnerTeam).toBe(1);
    expect(r.pts).toBe(12);
  });
});
