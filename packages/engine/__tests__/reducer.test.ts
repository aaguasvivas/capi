import { describe, it, expect } from "vitest";
import {
  createInitialState,
  applyMove,
  startNewRound,
} from "../src/reducer";
import type { GameState, Seat, Tile } from "../src/types";
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
      hands: { n: [[1, 2], [5, 6]], s: [[3, 3], [3, 4]], e: [], w: [] },
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

describe("applyMove - TRANCAO from a game saved before placement locks", () => {
  it("a board that is already locked ends as a tranque on the next pass (1v1)", () => {
    // Saved under the old rules: n played, s passed, and nobody can follow
    // the 3 or the 4. n's pass now resolves the lock with n as the blocker.
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
      currentTurn: "n",
      consecutivePasses: 1,
      passesSinceLastPlay: 1,
      starterThisRound: "n",
      lastCallout: null,
      lastCalloutPayload: null,
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "n",
    };
    const result = applyMove(state, "n", { type: "pass" });
    expect(result.success).toBe(true);
    expect(result.newState.lastCallout).toBe("trancao");
    expect(result.newState.phase).toBe("round_over");
    // n (22) against s (6): s wins and takes 22 + 6 = 28.
    expect(result.newState.scores).toEqual([0, 28]);
    expect(result.newState.lastCalloutPayload).toMatchObject({
      winningTeam: 1,
      pts: 28,
      blockerSeat: "n",
      rivalSeat: "s",
      blockerPips: 22,
      rivalPips: 6,
    });
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

// A board whose both ends show 6 once no other 6 is left: [6,3] [3,2] [2,6].
const SIX_LOCK_BOARD: Tile[] = [[6, 3], [3, 2], [2, 6]];

function make1v1State(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: "playing",
    mode: "turn_based",
    theme: "barberia",
    is2v2: false,
    targetScore: 100,
    scores: [0, 0],
    roundIndex: 0,
    hands: { n: [], s: [], e: [], w: [] },
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
    lastPlayedBy: "s",
    ...overrides,
  };
}

describe("applyMove - TRANCAO on placement (1v1)", () => {
  it("the tile that leaves nothing playable ends the round, even with tiles in the boneyard", () => {
    // n places the last 6. s holds no 6 and neither does the boneyard, so the
    // board is locked the moment the tile lands. No pass, no draw.
    const state = make1v1State({
      hands: { n: [[6, 6], [1, 1]], s: [[4, 5]], e: [], w: [] },
      board: SIX_LOCK_BOARD,
      boneyard: [[0, 0], [1, 2]],
    });
    const result = applyMove(state, "n", { type: "play", tile: [6, 6], end: "left" });
    expect(result.success).toBe(true);
    expect(result.callout).toBe("trancao");
    expect(result.newState.phase).toBe("round_over");
    // Blocker n holds 2, rival s holds 9: n wins. Hands only: 2 + 9 = 11.
    expect(result.newState.scores).toEqual([11, 0]);
    expect(result.newState.lastCalloutPayload).toEqual({
      winningTeam: 0,
      pts: 11,
      team0Pips: 2,
      team1Pips: 9,
      blockerSeat: "n",
      rivalSeat: "s",
      blockerPips: 2,
      rivalPips: 9,
      winnerSeat: "n",
    });
    // The boneyard stays as it was.
    expect(result.newState.boneyard).toEqual([[0, 0], [1, 2]]);
  });

  it("the rival wins with the lighter hand", () => {
    const state = make1v1State({
      hands: { n: [[6, 6], [5, 5]], s: [[1, 1]], e: [], w: [] },
      board: SIX_LOCK_BOARD,
      boneyard: [[0, 0]],
    });
    const result = applyMove(state, "n", { type: "play", tile: [6, 6], end: "right" });
    expect(result.callout).toBe("trancao");
    // n holds 10, s holds 2: s wins and takes 12.
    expect(result.newState.scores).toEqual([0, 12]);
    expect(result.newState.lastCalloutPayload).toMatchObject({
      winningTeam: 1,
      blockerSeat: "n",
      rivalSeat: "s",
    });
    const next = startNewRound(result.newState, result.newState.players);
    expect(next.currentTurn).toBe("s");
  });

  it("no lock while the boneyard still holds a tile that fits", () => {
    const state = make1v1State({
      hands: { n: [[6, 6], [1, 1]], s: [[4, 5]], e: [], w: [] },
      board: SIX_LOCK_BOARD,
      boneyard: [[0, 0], [6, 0]],
    });
    const result = applyMove(state, "n", { type: "play", tile: [6, 6], end: "left" });
    expect(result.success).toBe(true);
    expect(result.callout).toBeUndefined();
    expect(result.newState.phase).toBe("playing");
    expect(result.newState.currentTurn).toBe("s");
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
        n: [[6, 6], [5, 6]],
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

describe("applyMove - CAPICÚA (the last tile fits both ends before it is placed)", () => {
  function goOut(board: Tile[], tile: Tile, end: "left" | "right") {
    const state = make1v1State({
      hands: { n: [tile], s: [[1, 1], [0, 4]], e: [], w: [] },
      board,
    });
    return applyMove(state, "n", { type: "play", tile, end });
  }

  it("3-5 on ends 3 and 5 is capicúa, on either end", () => {
    for (const end of ["left", "right"] as const) {
      const r = goOut([[3, 4], [4, 5]], [3, 5], end);
      expect(r.success).toBe(true);
      expect(r.callout).toBe("capicua");
      // s holds 2 + 4 = 6; the bonus is added once: 6 + 25.
      expect(r.newState.scores).toEqual([31, 0]);
      expect(r.newState.lastCalloutPayload).toEqual({
        winningTeam: 0,
        pipsAwarded: 6,
        capicuaBonus: 25,
        team0Pips: 0,
        team1Pips: 6,
      });
    }
  });

  it("5-6 on ends 5 and 5 is capicúa", () => {
    const r = goOut([[5, 3], [3, 4], [4, 5]], [5, 6], "left");
    expect(r.callout).toBe("capicua");
    expect(r.newState.scores).toEqual([31, 0]);
  });

  it("the double 5-5 on ends 5 and 5 is a plain dominó", () => {
    const r = goOut([[5, 3], [3, 4], [4, 5]], [5, 5], "right");
    expect(r.callout).toBe("domino");
    expect(r.newState.scores).toEqual([6, 0]);
    expect(r.newState.lastCalloutPayload?.capicuaBonus).toBeUndefined();
  });

  it("a tile that fits only one end is a plain dominó", () => {
    const r = goOut([[3, 4], [4, 5]], [5, 2], "right");
    expect(r.callout).toBe("domino");
    expect(r.newState.scores).toEqual([6, 0]);
  });

  it("a tile that fits both ends but is not the last one is no capicúa: when it locks, it is a tranque", () => {
    // Ends 6 and 2. n places [2,6] on the right: both ends become 6 and no 6
    // is left outside the board. n still holds a tile, so this is a tranque.
    const state = make1v1State({
      hands: { n: [[2, 6], [0, 1]], s: [[4, 4]], e: [], w: [] },
      board: [[6, 3], [3, 2]],
    });
    const r = applyMove(state, "n", { type: "play", tile: [2, 6], end: "right" });
    expect(r.callout).toBe("trancao");
    expect(r.newState.lastCalloutPayload?.capicuaBonus).toBeUndefined();
    // n (1) against s (8): n wins 9, and nothing more.
    expect(r.newState.scores).toEqual([9, 0]);
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

describe("2v2 - TRANCAO on placement: the blocker against the player to his right", () => {
  // The blocker places [6,6] on SIX_LOCK_BOARD: both ends show 6 and no 6 is
  // left in any hand, so the round ends on that play.
  function lockBy(
    blocker: Seat,
    hands: GameState["hands"],
    overrides: Partial<GameState> = {}
  ) {
    const state = make2v2State({
      currentTurn: blocker,
      lastPlayedBy: getPrev(blocker),
      board: SIX_LOCK_BOARD,
      hands,
      ...overrides,
    });
    return applyMove(state, blocker, { type: "play", tile: [6, 6], end: "left" });
  }
  function getPrev(seat: Seat): Seat {
    return ({ n: "w", e: "n", s: "e", w: "s" } as const)[seat];
  }

  it("ends the round on the locking tile: no passes and no pase corrido first", () => {
    const r = lockBy("n", {
      n: [[6, 6], [1, 0]], // 1 left after the play
      e: [[4, 4]], // 8
      s: [[2, 1]], // 3
      w: [[5, 0]], // 5
    });
    expect(r.success).toBe(true);
    expect(r.callout).toBe("trancao");
    expect(r.newState.phase).toBe("round_over");
    expect(r.newState.consecutivePasses).toBe(0);
    // n (1) against e (8): n wins for team 0 and takes 1 + 8 + 3 + 5 = 17.
    expect(r.newState.scores).toEqual([17, 0]);
    expect(r.newState.lastCalloutPayload).toEqual({
      winningTeam: 0,
      pts: 17,
      team0Pips: 4,
      team1Pips: 13,
      blockerSeat: "n",
      rivalSeat: "e",
      blockerPips: 1,
      rivalPips: 8,
      winnerSeat: "n",
    });
  });

  it("the blocker's own hand decides, even when his side holds more pips", () => {
    // Team 0 holds 2 + 20 = 22 against team 1's 5 + 1 = 6, but the blocker n
    // holds 2 against e's 5, so team 0 wins the tranque.
    const r = lockBy("n", {
      n: [[6, 6], [1, 1]],
      e: [[5, 0]],
      s: [[5, 5], [4, 4], [2, 0]],
      w: [[1, 0]],
    });
    expect(r.callout).toBe("trancao");
    expect(r.newState.lastCalloutPayload).toMatchObject({
      winningTeam: 0,
      team0Pips: 22,
      team1Pips: 6,
      blockerPips: 2,
      rivalPips: 5,
    });
    expect(r.newState.scores).toEqual([28, 0]);
  });

  it("the rival wins with the lighter hand, and he opens the next round", () => {
    const r = lockBy("n", {
      n: [[6, 6], [5, 4]], // 9
      e: [[1, 0]], // 1
      s: [[0, 0]], // 0
      w: [[5, 5]], // 10
    });
    expect(r.newState.lastCalloutPayload).toMatchObject({
      winningTeam: 1,
      blockerSeat: "n",
      rivalSeat: "e",
      blockerPips: 9,
      rivalPips: 1,
      pts: 20,
    });
    expect(r.newState.scores).toEqual([0, 20]);
    // e won the comparison, so e opens, although s holds the lightest hand.
    const next = startNewRound(r.newState, r.newState.players);
    expect(next.starterThisRound).toBe("e");
    expect(next.currentTurn).toBe("e");
  });

  it("the blocker who wins the comparison opens the next round", () => {
    const r = lockBy("n", {
      n: [[6, 6], [1, 0]], // 1
      e: [[4, 4]],
      s: [[0, 0]], // 0: lighter than n, but s did not win the comparison
      w: [[5, 0]],
    });
    expect(r.newState.lastCalloutPayload?.winningTeam).toBe(0);
    expect(startNewRound(r.newState, r.newState.players).currentTurn).toBe("n");
  });

  it("the rival is always the next seat: W blocks, N compares", () => {
    const r = lockBy("w", {
      n: [[5, 5]], // 10
      e: [[1, 1]],
      s: [[2, 2]],
      w: [[6, 6], [3, 4]], // 7
    });
    expect(r.newState.lastCalloutPayload).toMatchObject({
      blockerSeat: "w",
      rivalSeat: "n",
      blockerPips: 7,
      rivalPips: 10,
      winningTeam: 1,
    });
    expect(r.newState.scores).toEqual([0, 10 + 2 + 4 + 7]);
  });

  it("a tie goes to the player who opened the round, and he opens next", () => {
    const hands: GameState["hands"] = {
      n: [[6, 6], [0, 5]], // 5
      e: [[4, 1]], // 5
      s: [[0, 0]],
      w: [[1, 1]],
    };
    const eOpened = lockBy("n", hands, { starterThisRound: "e" });
    expect(eOpened.newState.lastCalloutPayload).toMatchObject({
      winningTeam: 1,
      blockerPips: 5,
      rivalPips: 5,
      pts: 12,
    });
    expect(eOpened.newState.scores).toEqual([0, 12]);
    expect(startNewRound(eOpened.newState, eOpened.newState.players).currentTurn).toBe("e");

    // S opened: he is neither the blocker nor the rival, and he opens next.
    const sOpened = lockBy("n", hands, { starterThisRound: "s" });
    expect(sOpened.newState.lastCalloutPayload).toMatchObject({ winningTeam: 0, winnerSeat: "s" });
    expect(sOpened.newState.scores).toEqual([12, 0]);
    expect(startNewRound(sOpened.newState, sOpened.newState.players).currentTurn).toBe("s");
  });

  it("locking the board with the last tile is a dominó, not a tranque", () => {
    const r = lockBy("n", {
      n: [[6, 6]],
      e: [[4, 4]],
      s: [[2, 1]],
      w: [[5, 0]],
    });
    // A double on ends 6 and 6 is no capicúa: a plain dominó for 8 + 3 + 5.
    expect(r.callout).toBe("domino");
    expect(r.newState.scores).toEqual([16, 0]);
    expect(r.newState.lastCalloutPayload?.blockerSeat).toBeUndefined();
  });

  it("locking the board with a last tile that fits both ends is a capicúa", () => {
    // Ends 6 and 2; n goes out with [2,6] and both ends become 6.
    const state = make2v2State({
      board: [[6, 3], [3, 2]],
      hands: { n: [[2, 6]], e: [[4, 4]], s: [[1, 1]], w: [[5, 0]] },
    });
    const r = applyMove(state, "n", { type: "play", tile: [2, 6], end: "right" });
    expect(r.callout).toBe("capicua");
    expect(r.newState.scores).toEqual([8 + 2 + 5 + 25, 0]);
  });
});

describe("2v2 - TRANCAO from a game saved before placement locks", () => {
  it("a locked board ends as a tranque on the next pass, with the last player as blocker", () => {
    // Saved mid-round: n placed the last 6 and nobody can follow. e's pass
    // resolves it instead of starting a pass-around.
    const state = make2v2State({
      currentTurn: "e",
      lastPlayedBy: "n",
      board: [[6, 6], ...SIX_LOCK_BOARD],
      hands: { n: [[1, 1]], e: [[4, 4]], s: [[1, 3]], w: [[0, 0]] },
    });
    const r = applyMove(state, "e", { type: "pass" });
    expect(r.success).toBe(true);
    expect(r.callout).toBe("trancao");
    expect(r.newState.phase).toBe("round_over");
    // n (2) against e (8): team 0 takes 2 + 8 + 4 + 0 = 14. No +25 first.
    expect(r.newState.scores).toEqual([14, 0]);
    expect(r.newState.lastCalloutPayload).toMatchObject({ blockerSeat: "n", rivalSeat: "e" });
  });

  it("a saved state that already paid the pase corrido ends on the forcer's pass", () => {
    const state = make2v2State({
      scores: [25, 0],
      currentTurn: "n",
      lastPlayedBy: "n",
      consecutivePasses: 3,
      passesSinceLastPlay: 3,
      board: [[6, 6], ...SIX_LOCK_BOARD],
      hands: { n: [[5, 5]], e: [[1, 1]], s: [[1, 3]], w: [[0, 0]] },
    });
    const r = applyMove(state, "n", { type: "pass" });
    expect(r.callout).toBe("trancao");
    // n (10) against e (2): team 1 takes 10 + 2 + 4 + 0 = 16. The +25 stays.
    expect(r.newState.scores).toEqual([25, 16]);
  });

  it("with no last player on record, the seat before the passer is the blocker", () => {
    const state = make2v2State({
      currentTurn: "e",
      lastPlayedBy: null,
      board: [[6, 6], ...SIX_LOCK_BOARD],
      hands: { n: [[1, 1]], e: [[4, 4]], s: [[1, 3]], w: [[0, 0]] },
    });
    const r = applyMove(state, "e", { type: "pass" });
    expect(r.newState.lastCalloutPayload).toMatchObject({ blockerSeat: "n", rivalSeat: "e" });
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
        w: [[5, 6]], // fits the 5, so the board is not locked
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
// (2026-05-27); rule model corrected 2026-09-02 and 2026-09-26 (patio rules,
// docs/research/rules-2026-09/README.md).
//
// Dominican rule model encoded here:
//
//   VEINTICINCO ("pase corrido") is a parejas (2v2) rule only. When the three
//   other seats pass after a play, +25 goes to that player's team MID-ROUND and
//   the round continues: `lastPlayedBy` gets the next turn and must play (the
//   board is not locked, and nobody else can follow). The bonus is paid only
//   while it leaves the team below targetScore; otherwise the pass is plain.
//   Heads-up (1v1) there is no pase corrido: an opponent's pass is a plain
//   pass (turn advances, nothing banked, no callout).
//
//   TRANCAO: the board is locked the moment a tile is placed and no tile in
//   any hand or the boneyard fits either end. The player who placed it is the
//   blocker; he compares his own hand pips with the next player (to his
//   right, always an opponent). Fewer pips wins for that player's side, which
//   takes every pip left in every hand. On a tie the player who opened the
//   round wins, even when he is neither of the two. The winner opens the next
//   round. Going out with the locking tile is a DOMINÓ.
//
//   PASE DE SALIDA is a parejas rule too: when the seat after the opener
//   passes on the opening tile and the opener's partner then plays, +25 goes
//   to the opener's side mid-round, under the same target cap. A partner's
//   pass cancels it; a fourth pass is then a pase corrido.
//
//   Game end: only a round end (DOMINÓ, CAPICÚA, or TRANCAO) finishes the
//   game, and only for the side that won the round, once it reaches
//   targetScore.
//
//   CAPICÚA: the closing tile fits both open ends as they were before it was
//   placed, and is not a double. A tile with a blank counts.
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

  it("after a plain pass, the play that leaves nothing playable locks the table at once", () => {
    // S passes (plain). N plays [3,4] on the left: ends become 3/6, and no
    // tile left anywhere has a 3 or a 6. The round ends on that play, with N
    // as the blocker: N holds 3 pips, S holds 6, so team 0 takes 3 + 6 = 9.
    const p1 = applyMove(afterNPlays(), "s", { type: "pass" });
    const locked = applyMove(p1.newState, "n", { type: "play", tile: [3, 4], end: "left" });
    expect(locked.success).toBe(true);
    expect(locked.newState.board).toEqual([[3, 4], [4, 6]]);
    expect(locked.callout).toBe("trancao");
    expect(locked.newState.phase).toBe("round_over");
    expect(locked.newState.scores).toEqual([9, 0]);
    expect(locked.newState.lastCalloutPayload).toMatchObject({
      blockerSeat: "n",
      rivalSeat: "s",
      blockerPips: 3,
      rivalPips: 6,
    });
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
        e: [[0, 3]], // the forcer can still follow the 0
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
      hands: { n: [[6, 6], [5, 6]], s: [[1, 1]], e: [], w: [] },
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
    // S holds [0,0] and draws [4,4] and [2,2] without finding a 3 or a 5,
    // then passes. N plays [5,1]: the ends become 3 and 1 and nothing left
    // fits, so the table locks. S now holds 0 + 8 + 4 = 12 pips against N's
    // 10: N wins and team 0 takes all 22.
    const state: GameState = {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: false,
      targetScore: 100,
      scores: [0, 0],
      roundIndex: 0,
      hands: { n: [[5, 1], [5, 5]], s: [[0, 0]], e: [], w: [] },
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
    expect(drew.newState.hands.s).toHaveLength(3);
    const passed = applyMove(drew.newState, "s", { type: "pass" });
    expect(passed.newState.phase).toBe("playing");
    const locked = applyMove(passed.newState, "n", { type: "play", tile: [5, 1], end: "right" });
    expect(locked.success).toBe(true);
    expect(locked.callout).toBe("trancao");
    expect(locked.newState.phase).toBe("round_over");
    expect(locked.newState.scores).toEqual([22, 0]);
    const payload = locked.newState.lastCalloutPayload!;
    expect(payload.team0Pips).toBe(10);
    expect(payload.team1Pips).toBe(12);
    expect(payload.rivalPips).toBe(12);
  });

  it("a board saved already locked ends on the next draw, before any tile is drawn", () => {
    // Saved under the old rules: nobody holds a 3 or a 5 and the boneyard has
    // none either. S's draw resolves the lock with N (who played last) as the
    // blocker, and S does not take the boneyard tiles into hand.
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
    const r = applyMove(state, "s", { type: "draw" });
    expect(r.success).toBe(true);
    expect(r.callout).toBe("trancao");
    expect(r.newState.boneyard).toEqual([[2, 2], [4, 4]]);
    expect(r.newState.hands.s).toEqual([[1, 1]]);
    // N (12) against S (2): team 1 takes 14.
    expect(r.newState.scores).toEqual([0, 14]);
    expect(r.newState.lastCalloutPayload).toMatchObject({ blockerSeat: "n", rivalSeat: "s" });
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
    // Sanity: isCapicua on the ends before the play agrees
    expect(isCapicua({ left: 2, right: 5 }, [2, 5])).toBe(true);
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
      lastCalloutPayload: { team0Pips: 0, team1Pips: 0, winningTeam: 0 },
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
      lastCalloutPayload: { team0Pips: 0, team1Pips: 0, winningTeam: 1 },
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "s",
    };
    const next = startNewRound(ended, ended.players);
    expect(next.currentTurn).toBe("s");
    expect(next.starterThisRound).toBe("s");
  });

  it("after a TRANCAO saved without the comparison, the lowest-pip seat on the winning team starts (2v2)", () => {
    // TRANCAO won by team 0 (N+S) before blockerSeat/rivalSeat existed.
    // N has 2 pips, S has 7 → N starts.
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
      lastCalloutPayload: { team0Pips: 0, team1Pips: 0, winningTeam: 0 },
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "e",
    };
    const next = startNewRound(ended, ended.players);
    expect(next.currentTurn).toBe("n");
    expect(next.starterThisRound).toBe("n");
  });

  it("after a TRANCAO, the winner of the comparison starts, not the lightest hand on his side", () => {
    // Team 0 won: the rival s beat the blocker e. N holds fewer pips than S,
    // but S won the comparison, so S opens.
    const ended: GameState = {
      phase: "round_over",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      scores: [30, 0],
      roundIndex: 0,
      hands: { n: [[1, 0]], e: [[5, 5]], s: [[3, 4]], w: [[6, 6]] },
      board: [[3, 2]],
      boneyard: [],
      currentTurn: "s",
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      starterThisRound: "e",
      lastCallout: "trancao",
      lastCalloutPayload: {
        winningTeam: 0,
        pts: 30,
        team0Pips: 8,
        team1Pips: 22,
        blockerSeat: "e",
        rivalSeat: "s",
        blockerPips: 10,
        rivalPips: 7,
      },
      players: { n: null, e: null, s: null, w: null },
      winnerTeam: null,
      lastPlayedBy: "e",
    };
    const next = startNewRound(ended, ended.players);
    expect(next.currentTurn).toBe("s");
    expect(next.starterThisRound).toBe("s");
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
  it("1v1 TRANCAO on a tie: the side that opened takes the whole table", () => {
    // Saved under the old rules: S opened with [6,6], N could not follow and
    // passed, and S cannot follow either, so S's pass resolves the lock with S
    // as the blocker. Both hold 5 pips, so the tie goes to the opener S
    // (team 1), who takes 5 + 5 = 10.
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
    const payload = r.newState.lastCalloutPayload!;
    expect(payload.winningTeam).toBe(1);
    expect(payload.pts).toBe(10);
  });
});

describe("audit/B: VEINTICINCO and TRANCAO no longer stack", () => {
  it("2v2: the tile that locks pays the tranque alone, with no pase corrido first", () => {
    // N places the last 6 on SIX_LOCK_BOARD. Under the old pass count, E, S
    // and W would have passed (+25 to team 0) before N's own pass locked it.
    const state = make2v2State({
      board: SIX_LOCK_BOARD,
      hands: {
        n: [[6, 6], [1, 2]], // 3 after the play
        e: [[1, 1], [2, 2]], // 6
        s: [[3, 3], [4, 4]], // 14
        w: [[5, 5]], // 10
      },
    });
    const r = applyMove(state, "n", { type: "play", tile: [6, 6], end: "left" });
    expect(r.callout).toBe("trancao");
    // n (3) against e (6): team 0 takes 3 + 6 + 14 + 10 = 33 and nothing more.
    expect(r.newState.scores).toEqual([33, 0]);
  });

  it("2v2: after a pase corrido the forcer always has a play, so he cannot pass", () => {
    const state = make2v2State({
      board: [[6, 6]],
      hands: { n: [[6, 0]], e: [[1, 1]], s: [[3, 3]], w: [[5, 5]] },
      currentTurn: "e",
      lastPlayedBy: "n",
    });
    const r1 = applyMove(state, "e", { type: "pass" });
    const r2 = applyMove(r1.newState, "s", { type: "pass" });
    const r3 = applyMove(r2.newState, "w", { type: "pass" });
    expect(r3.callout).toBe("veinticinco");
    expect(r3.newState.currentTurn).toBe("n");
    const r4 = applyMove(r3.newState, "n", { type: "pass" });
    expect(r4.success).toBe(false);
    expect(r4.error).toContain("Must play");
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
        n: [[6, 5]], // last tile, fits the 6 end only
        e: [[1, 1], [2, 2]],
        s: [[4, 4]],
        w: [[0, 0]],
      },
      board: [[6, 6], [6, 3]], // ends 6 and 3
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

    // N plays last tile → DOMINÓ (not capicúa: [6,5] does not fit the 3)
    const out = applyMove(v.newState, "n", {
      type: "play",
      tile: [6, 5],
      end: "left",
    });
    expect(out.success).toBe(true);
    expect(out.callout).toBe("domino");
    expect(out.newState.phase).toBe("round_over");
    // All hands: E=2+4=6, S=8, W=0 → 14. Team 0 final = 25 + 14 = 39.
    expect(out.newState.scores[0]).toBe(25 + handPips([[1, 1], [2, 2]]) + handPips([[4, 4]]) + handPips([[0, 0]]));
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

describe("audit/B: VEINTICINCO near the target score", () => {
  // 2v2, target 100. N played [6,6] and nobody else holds a 6, so E, S, W
  // pass in turn and the cycle returns to N, who still holds a 6.
  function nearTargetState(scores: [number, number], nHand: Tile[] = [[6, 5]]): GameState {
    return {
      phase: "playing",
      mode: "turn_based",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      scores,
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

  it("pays the +25 when it leaves the side below the target (74 + 25 = 99)", () => {
    const v = passAround(nearTargetState([74, 50]));
    expect(v.callout).toBe("veinticinco");
    expect(v.newState.scores).toEqual([99, 50]);
    expect(v.newState.phase).toBe("playing");
    expect(v.newState.currentTurn).toBe("n");
  });

  it("pays nothing when the +25 would land exactly on the target (75 + 25 = 100)", () => {
    const v = passAround(nearTargetState([75, 50]));
    expect(v.success).toBe(true);
    expect(v.callout).toBeUndefined();
    expect(v.newState.lastCallout).toBeNull();
    expect(v.newState.lastCalloutPayload).toBeNull();
    expect(v.newState.scores).toEqual([75, 50]);
    // The pass sequence goes on as usual: N is next and must play.
    expect(v.newState.phase).toBe("playing");
    expect(v.newState.currentTurn).toBe("n");
    expect(v.newState.consecutivePasses).toBe(3);
    // The round is still live: a redeal is refused until the round really ends.
    expect(startNewRound(v.newState, v.newState.players)).toBe(v.newState);
  });

  it("pays nothing when the +25 would pass the target (80 + 25 = 105)", () => {
    const v = passAround(nearTargetState([80, 50]));
    expect(v.callout).toBeUndefined();
    expect(v.newState.scores).toEqual([80, 50]);
  });

  it("the game is won by winning the round: N goes out and finishes it", () => {
    const v = passAround(nearTargetState([80, 50], [[6, 5]]));
    // [6,5] on ends 6 and 6 is a capicúa: 80 + (2 + 4 + 0) + 25 = 111.
    const out = applyMove(v.newState, "n", { type: "play", tile: [6, 5], end: "left" });
    expect(out.success).toBe(true);
    expect(out.callout).toBe("capicua");
    expect(out.newState.scores).toEqual([111, 50]);
    expect(out.newState.phase).toBe("finished");
    expect(out.newState.winnerTeam).toBe(0);
  });
});

describe("audit/B: a game saved past the target by the old pase corrido", () => {
  // The old engine banked +25 past the target mid-round and played on. Such a
  // saved game ends when the current round ends, the way the old engine
  // ended it, so no table keeps playing with a side already over the target.
  function saved(scores: [number, number]): GameState {
    return make2v2State({
      scores,
      currentTurn: "e",
      lastPlayedBy: "n",
      board: [[3, 5]],
      hands: { n: [[1, 1]], e: [[5, 2]], s: [[4, 4]], w: [[6, 0]] },
    });
  }

  it("the side already past the target wins when the other side wins the round below it", () => {
    const r = applyMove(saved([105, 50]), "e", { type: "play", tile: [5, 2], end: "right" });
    expect(r.callout).toBe("domino");
    // Team 1 takes 2 + 8 + 6 = 16 → 66, below the target; team 0 sits at 105.
    expect(r.newState.scores).toEqual([105, 66]);
    expect(r.newState.phase).toBe("finished");
    expect(r.newState.winnerTeam).toBe(0);
  });

  it("when both sides end up past the target, the higher score wins", () => {
    const r = applyMove(saved([110, 90]), "e", { type: "play", tile: [5, 2], end: "right" });
    expect(r.newState.scores).toEqual([110, 106]);
    expect(r.newState.phase).toBe("finished");
    expect(r.newState.winnerTeam).toBe(0);
  });

  it("a tie of two sides past the target goes to the round winner", () => {
    const r = applyMove(saved([106, 90]), "e", { type: "play", tile: [5, 2], end: "right" });
    expect(r.newState.scores).toEqual([106, 106]);
    expect(r.newState.winnerTeam).toBe(1);
  });

  it("a normal game still ends only when the round winner reaches the target", () => {
    const r = applyMove(saved([60, 50]), "e", { type: "play", tile: [5, 2], end: "right" });
    expect(r.newState.scores).toEqual([60, 66]);
    expect(r.newState.phase).toBe("round_over");
    expect(r.newState.winnerTeam).toBeNull();
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
      lastCalloutPayload: { team0Pips: 0, team1Pips: 0, winningTeam: 0, veinticincoBonus: 25 },
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
