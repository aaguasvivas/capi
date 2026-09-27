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

describe("scoreTrancao (blocker against the player to his right)", () => {
  it("the lighter hand wins and takes every pip left in the hands", () => {
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
    // Blocker n (2) against the rival on his right, s (12): n wins.
    const r = scoreTrancao(state, "n");
    expect(r.winnerSeat).toBe("n");
    expect(r.winnerTeam).toBe(0);
    expect(r).toMatchObject({ blockerSeat: "n", rivalSeat: "s", blockerPips: 2, rivalPips: 12 });
    // Whole table, not the difference: 2 + 12 = 14
    expect(r.pts).toBe(14);
    // Heads-up the rival of s is n, so the lighter hand still wins.
    const fromS = scoreTrancao(state, "s");
    expect(fromS).toMatchObject({ winnerSeat: "n", winnerTeam: 0, rivalSeat: "n", pts: 14 });
  });
  it("tie: the side that opened the round wins and takes the whole table", () => {
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
    const r = scoreTrancao(state, "s");
    expect(r.winnerSeat).toBe("n");
    expect(r.winnerTeam).toBe(0);
    expect(r.pts).toBe(6);
  });
  it("tie: an opener on team 1 takes the whole table for team 1", () => {
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
    const r = scoreTrancao(state, "n");
    expect(r.winnerSeat).toBe("s");
    expect(r.winnerTeam).toBe(1);
    expect(r.pts).toBe(10);
  });
});

describe("isCapicua (ends just before the closing tile)", () => {
  it("true for the tile that carries both different ends: 3-5 on ends 3 and 5", () => {
    expect(isCapicua({ left: 3, right: 5 }, [3, 5])).toBe(true);
    expect(isCapicua({ left: 3, right: 5 }, [5, 3])).toBe(true);
  });
  it("true for a non-double on two equal ends: 5-6 on ends 5 and 5", () => {
    expect(isCapicua({ left: 5, right: 5 }, [5, 6])).toBe(true);
  });
  it("false for a double, even on two equal ends: 5-5 on ends 5 and 5", () => {
    expect(isCapicua({ left: 5, right: 5 }, [5, 5])).toBe(false);
    expect(isCapicua({ left: 0, right: 0 }, [0, 0])).toBe(false);
  });
  it("true when the closing tile has a blank", () => {
    expect(isCapicua({ left: 3, right: 0 }, [0, 3])).toBe(true);
    expect(isCapicua({ left: 0, right: 0 }, [5, 0])).toBe(true);
  });
  it("false when the tile fits only one end", () => {
    expect(isCapicua({ left: 3, right: 5 }, [5, 2])).toBe(false);
    expect(isCapicua({ left: 4, right: 4 }, [5, 2])).toBe(false);
  });
  it("false on an empty table", () => {
    expect(isCapicua({ left: -1, right: -1 }, [3, 5])).toBe(false);
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
  it("the lighter of blocker and rival wins and takes every pip in all four hands", () => {
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
    // Blocker n (2) against e (12), the player on his right: n wins.
    const r = scoreTrancao(state, "n");
    expect(r).toMatchObject({ winnerSeat: "n", winnerTeam: 0, rivalSeat: "e" });
    // Every hand counts: 2 + 12 + 4 + 10 = 28.
    expect(r.pts).toBe(28);
    // Blocker w (10) against n (2): n wins for team 0 again.
    expect(scoreTrancao(state, "w")).toMatchObject({ winnerSeat: "n", winnerTeam: 0, rivalSeat: "n" });
  });
  it("the blocker's own hand decides, not his side's total", () => {
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: {
        n: [[1, 1]], // 2
        e: [[5, 0]], // 5
        s: [[6, 6], [4, 4]], // 20 (team 0 = 22)
        w: [[1, 0]], // 1 (team 1 = 6)
      },
      board: [],
      boneyard: [],
      currentTurn: "e",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "e",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    // Team 0 holds far more pips, but n (2) beats e (5) and wins for team 0.
    expect(scoreTrancao(state, "n")).toMatchObject({
      winnerSeat: "n",
      winnerTeam: 0,
      blockerPips: 2,
      rivalPips: 5,
      pts: 28,
    });
  });
  it("tie of blocker and rival: the pair that opened takes the whole table", () => {
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
    // Blocker w (3) against n (2) is no tie: n wins.
    expect(scoreTrancao(state, "w")).toMatchObject({ winnerSeat: "n", winnerTeam: 0 });
    // Blocker e (3) against s (4) is no tie either: e wins.
    expect(scoreTrancao(state, "e")).toMatchObject({ winnerSeat: "e", winnerTeam: 1 });
    // Tie of the two players: blocker n holds [1,2] = 3, like e.
    const tie: GameState = { ...state, hands: { ...state.hands, n: [[1, 2]] } };
    const r = scoreTrancao(tie, "n");
    // The player who opened the round (E, team 1) wins and his pair takes
    // the whole table.
    expect(r).toMatchObject({ winnerSeat: "e", winnerTeam: 1, blockerPips: 3, rivalPips: 3 });
    expect(r.pts).toBe(3 + 3 + 4 + 3);
    // With S opening, the same tie goes to S himself, neither blocker nor rival.
    expect(scoreTrancao({ ...tie, starterThisRound: "s" }, "n")).toMatchObject({
      winnerSeat: "s",
      winnerTeam: 0,
    });
  });
});
