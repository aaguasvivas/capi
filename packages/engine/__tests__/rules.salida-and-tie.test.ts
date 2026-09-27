import { describe, expect, it } from "vitest";
import { applyMove, createInitialState, startNewRound } from "../src/reducer";
import { handPips, SALIDA_BONUS } from "../src/scoring";
import type { CalloutPayload, GameState, MoveIntent, MoveResult, Seat, Tile } from "../src/types";
import { getNextSeat, getTeam } from "../src/types";

// Owner decisions of 2026-09-27 (docs/research/rules-2026-09/salida-and-tie-2026-09-27.json):
// the pase de salida (parejas only) and the tranque tie to the player who
// opened the round.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const has = (hand: Tile[], pip: number) => hand.some((t) => t[0] === pip || t[1] === pip);
const partnerOf = (seat: Seat): Seat => getNextSeat(getNextSeat(seat, true), true);

// Each side's pips, summed seat by seat, for the expected payloads.
function sidePips(state: GameState, team: 0 | 1): number {
  const seats: Seat[] = state.is2v2 ? ["n", "e", "s", "w"] : ["n", "s"];
  return seats
    .filter((s) => getTeam(s, state.is2v2) === team)
    .reduce((sum, s) => sum + handPips(state.hands[s]), 0);
}

function anyLegal(state: GameState): MoveIntent {
  const hand = state.hands[state.currentTurn];
  const left = state.board[0][0];
  const right = state.board[state.board.length - 1][1];
  for (const tile of hand) {
    if (tile[0] === left || tile[1] === left) return { type: "play", tile, end: "left" };
    if (tile[0] === right || tile[1] === right) return { type: "play", tile, end: "right" };
  }
  return { type: "pass" };
}

function move(state: GameState, intent: MoveIntent): MoveResult {
  const r = applyMove(state, state.currentTurn, intent);
  expect(r.success, r.error).toBe(true);
  return r;
}

function make2v2(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: "playing",
    mode: "live",
    theme: "patio",
    is2v2: true,
    targetScore: 100,
    scores: [0, 0],
    roundIndex: 0,
    hands: { n: [], e: [], s: [], w: [] },
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
    ...overrides,
  };
}

function make1v1(overrides: Partial<GameState> = {}): GameState {
  return make2v2({ is2v2: false, currentTurn: "s", ...overrides });
}

describe("PASE DE SALIDA: the next seat passes on the opening tile and the opener's partner plays", () => {
  it("round 1: pays 25 to the opener's side on the auto-placed 6-6", () => {
    // First seeded deal where the seat after the 6-6 holds no six and the
    // opener's partner holds one.
    let deal: GameState | null = null;
    for (let seed = 1; seed < 5000 && !deal; seed++) {
      const s = createInitialState({ mode: "live", theme: "patio", is2v2: true, rng: mulberry32(seed) });
      const next = getNextSeat(s.starterThisRound, true);
      if (!has(s.hands[next], 6) && has(s.hands[partnerOf(s.starterThisRound)], 6)) deal = s;
    }
    expect(deal).not.toBeNull();
    const start = deal as GameState;
    const opener = start.starterThisRound;
    const team = getTeam(opener, true);
    expect(start.board).toEqual([[6, 6]]);

    const pass = move(start, { type: "pass" });
    expect(pass.callout).toBeUndefined();
    expect(pass.newState.scores).toEqual([0, 0]);
    expect(pass.newState.currentTurn).toBe(partnerOf(opener));

    const six = pass.newState.hands[partnerOf(opener)].find((t) => t[0] === 6 || t[1] === 6) as Tile;
    const play = move(pass.newState, { type: "play", tile: six, end: "right" });
    const after = play.newState;
    const expected: CalloutPayload = {
      winningTeam: team,
      veinticincoBonus: SALIDA_BONUS,
      salida: true,
      team0Pips: sidePips(after, 0),
      team1Pips: sidePips(after, 1),
    };
    expect(SALIDA_BONUS).toBe(25);
    expect(play.callout).toBe("veinticinco");
    expect(play.calloutPayload).toEqual(expected);
    expect(after.lastCallout).toBe("veinticinco");
    expect(after.lastCalloutPayload).toEqual(expected);
    expect(after.scores[team]).toBe(25);
    expect(after.scores[team === 0 ? 1 : 0]).toBe(0);
    expect(after.phase).toBe("playing");
    expect(after.currentTurn).toBe(getNextSeat(partnerOf(opener), true));

    // The next move clears the callout and scores nothing.
    const next = move(after, anyLegal(after));
    expect(next.callout).toBeUndefined();
    expect(next.newState.lastCallout).toBeNull();
    expect(next.newState.lastCalloutPayload).toBeNull();
    expect(next.newState.scores).toEqual(after.scores);
  });

  it("a later round: pays 25 after a pass on a free opening tile", () => {
    // E won the last round and opens with a free tile that S cannot follow
    // and W can. The first seeded redeal with that shape.
    const ended = make2v2({
      phase: "round_over",
      lastCallout: "domino",
      lastCalloutPayload: { winningTeam: 1, team0Pips: 0, team1Pips: 0 },
      lastPlayedBy: "e",
      scores: [30, 40],
    });
    let found: { state: GameState; tile: Tile } | null = null;
    for (let seed = 1; seed < 5000 && !found; seed++) {
      const s = startNewRound(ended, ended.players, mulberry32(seed));
      const tile = s.hands.e.find(
        (t) => !has(s.hands.s, t[0]) && !has(s.hands.s, t[1]) && (has(s.hands.w, t[0]) || has(s.hands.w, t[1]))
      );
      if (tile) found = { state: s, tile };
    }
    expect(found).not.toBeNull();
    const { state, tile } = found as { state: GameState; tile: Tile };
    expect(state.roundIndex).toBe(1);
    expect(state.starterThisRound).toBe("e");
    expect(state.board).toEqual([]);

    const opened = move(state, { type: "play", tile, end: "right" });
    expect(opened.callout).toBeUndefined();
    const pass = move(opened.newState, { type: "pass" });
    expect(pass.newState.currentTurn).toBe("w");
    const play = move(pass.newState, anyLegal(pass.newState));
    expect(play.callout).toBe("veinticinco");
    expect(play.calloutPayload).toMatchObject({ winningTeam: 1, veinticincoBonus: 25, salida: true });
    expect(play.newState.scores).toEqual([30, 65]);
  });

  it("is cancelled when the partner passes too, and the fourth seat's play pays nothing", () => {
    const state = make2v2({
      hands: {
        n: [[6, 1], [2, 3]],
        e: [[1, 1], [2, 2]],
        s: [[3, 3], [4, 4]],
        w: [[6, 5], [5, 5]],
      },
    });
    const e = move(state, { type: "pass" });
    const s = move(e.newState, { type: "pass" });
    expect(s.callout).toBeUndefined();
    expect(s.newState.lastCallout).toBeNull();
    expect(s.newState.scores).toEqual([0, 0]);
    const w = move(s.newState, { type: "play", tile: [6, 5], end: "right" });
    expect(w.callout).toBeUndefined();
    expect(w.newState.lastCallout).toBeNull();
    expect(w.newState.scores).toEqual([0, 0]);
  });

  it("partner's pass, then the fourth pass: the pase corrido pays 25 once, not 50", () => {
    const state = make2v2({
      hands: {
        n: [[6, 1], [2, 3]],
        e: [[1, 1]],
        s: [[3, 3]],
        w: [[5, 5]],
      },
    });
    const e = move(state, { type: "pass" });
    const s = move(e.newState, { type: "pass" });
    expect(s.newState.scores).toEqual([0, 0]);
    const w = move(s.newState, { type: "pass" });
    expect(w.callout).toBe("veinticinco");
    expect(w.calloutPayload?.salida).toBeUndefined();
    expect(w.newState.scores).toEqual([25, 0]);
    expect(w.newState.currentTurn).toBe("n");
    // The opener plays again on the lone opening tile: no second bonus.
    const n = move(w.newState, { type: "play", tile: [6, 1], end: "right" });
    expect(n.callout).toBeUndefined();
    expect(n.newState.lastCallout).toBeNull();
    expect(n.newState.scores).toEqual([25, 0]);
  });

  it("is not paid when it would reach the target: plain play at 75 of 100, paid at 74", () => {
    const shape = (scores: [number, number]) =>
      move(
        make2v2({
          scores,
          currentTurn: "s",
          consecutivePasses: 1,
          passesSinceLastPlay: 1,
          hands: {
            n: [[6, 1], [2, 3]],
            e: [[1, 1], [2, 2]],
            s: [[6, 4], [3, 3]],
            w: [[5, 5], [4, 0]],
          },
        }),
        { type: "play", tile: [6, 4], end: "right" }
      );
    const capped = shape([75, 90]);
    expect(capped.callout).toBeUndefined();
    expect(capped.calloutPayload).toBeUndefined();
    expect(capped.newState.lastCallout).toBeNull();
    expect(capped.newState.lastCalloutPayload).toBeNull();
    expect(capped.newState.scores).toEqual([75, 90]);
    expect(capped.newState.phase).toBe("playing");

    const paid = shape([74, 90]);
    expect(paid.callout).toBe("veinticinco");
    expect(paid.newState.scores).toEqual([99, 90]);
    expect(paid.newState.phase).toBe("playing");
    expect(paid.newState.winnerTeam).toBeNull();
  });

  it("heads-up there is none: the rival passes on an empty boneyard, the opener plays, nothing is paid", () => {
    const state = make1v1({
      hands: { n: [[6, 1], [2, 2]], s: [[1, 3], [4, 4]], e: [], w: [] },
    });
    const s = move(state, { type: "pass" });
    expect(s.newState.currentTurn).toBe("n");
    expect(s.newState.passesSinceLastPlay).toBe(1);
    const n = move(s.newState, { type: "play", tile: [6, 1], end: "right" });
    expect(n.callout).toBeUndefined();
    expect(n.newState.lastCallout).toBeNull();
    expect(n.newState.scores).toEqual([0, 0]);

    // Heads-up the seat across from N in the four-seat order is his rival S.
    // Not reachable in live play; a saved state with S on turn in the salida
    // shape must not pay either.
    const saved = make1v1({
      consecutivePasses: 1,
      passesSinceLastPlay: 1,
      hands: { n: [[1, 3], [2, 2]], s: [[6, 1], [4, 4]], e: [], w: [] },
    });
    const rival = move(saved, { type: "play", tile: [6, 1], end: "right" });
    expect(rival.callout).toBeUndefined();
    expect(rival.newState.scores).toEqual([0, 0]);
  });

  it("a later pass in the round never counts, even with the opener as the last player", () => {
    // E, S and W pass on the 6-6 (pase corrido), N plays again, E passes and
    // S plays: the opening tile is no longer alone on the board.
    let state = make2v2({
      hands: {
        n: [[6, 1], [6, 2]],
        e: [[3, 3], [4, 4]],
        s: [[1, 5], [0, 0]],
        w: [[5, 5]],
      },
    });
    for (const intent of [
      { type: "pass" },
      { type: "pass" },
      { type: "pass" },
      { type: "play", tile: [6, 1], end: "right" },
      { type: "pass" },
    ] as MoveIntent[]) {
      state = move(state, intent).newState;
    }
    expect(state.scores).toEqual([25, 0]);
    expect(state.lastPlayedBy).toBe("n");
    expect(state.passesSinceLastPlay).toBe(1);
    expect(state.currentTurn).toBe("s");
    const s = move(state, { type: "play", tile: [1, 5], end: "right" });
    expect(s.callout).toBeUndefined();
    expect(s.newState.scores).toEqual([25, 0]);
  });

  it("only the partner's play pays: another seat playing in the salida shape scores nothing", () => {
    // Not reachable in live play (one pass always hands the turn to the
    // partner); a saved state that says otherwise must not pay.
    const state = make2v2({
      currentTurn: "w",
      consecutivePasses: 1,
      passesSinceLastPlay: 1,
      hands: {
        n: [[6, 1], [2, 3]],
        e: [[1, 1], [2, 2]],
        s: [[3, 3], [4, 4]],
        w: [[6, 5], [5, 5]],
      },
    });
    const w = move(state, { type: "play", tile: [6, 5], end: "right" });
    expect(w.callout).toBeUndefined();
    expect(w.newState.scores).toEqual([0, 0]);
  });

  // The partner S plays [6,4] on the lone 6-6 after one pass; the overrides
  // bend one guard at a time.
  function partnerPlays(overrides: Partial<GameState> = {}): MoveResult {
    const state = make2v2({
      currentTurn: "s",
      consecutivePasses: 1,
      passesSinceLastPlay: 1,
      hands: {
        n: [[6, 1], [2, 3]],
        e: [[1, 1], [2, 2]],
        s: [[6, 4], [3, 3]],
        w: [[5, 5], [0, 0]],
      },
      ...overrides,
    });
    return move(state, { type: "play", tile: [6, 4], end: "right" });
  }

  function expectNoSalida(r: MoveResult) {
    expect(r.callout).toBeUndefined();
    expect(r.newState.lastCallout).toBeNull();
    expect(r.newState.scores).toEqual([0, 0]);
  }

  it("the opener must be the last to play: a saved state with no last player pays nothing", () => {
    // Not reachable in live play: at one tile on the board the opener always
    // played last.
    expect(partnerPlays().newState.scores).toEqual([25, 0]);
    expectNoSalida(partnerPlays({ lastPlayedBy: null }));
  });

  it("exactly one pass: a saved state with none, or with two or more, pays nothing", () => {
    // Not reachable in live play: the partner is on turn at one tile only
    // after exactly one pass.
    expect(partnerPlays().newState.scores).toEqual([25, 0]);
    expectNoSalida(partnerPlays({ passesSinceLastPlay: 0 }));
    expectNoSalida(partnerPlays({ passesSinceLastPlay: 2 }));
    expectNoSalida(partnerPlays({ passesSinceLastPlay: 5 }));
  });
});

// SIX_LOCK_BOARD shows 6 at both ends once the [6,6] lands on its left.
const SIX_LOCK_BOARD: Tile[] = [[6, 3], [3, 2], [2, 6]];

describe("TRANQUE tie: the player who opened the round wins and opens the next", () => {
  function lockBy(blocker: Seat, hands: GameState["hands"], overrides: Partial<GameState> = {}) {
    return move(make2v2({ currentTurn: blocker, lastPlayedBy: null, board: SIX_LOCK_BOARD, hands, ...overrides }), {
      type: "play",
      tile: [6, 6],
      end: "left",
    });
  }

  it("2v2: opener N, blocker S, rival W on equal pips: N wins for his side and opens next", () => {
    const r = lockBy(
      "s",
      {
        n: [[5, 5]], // 10
        e: [[0, 1]], // 1
        s: [[6, 6], [0, 4]], // 4 after the play
        w: [[1, 3]], // 4
      },
      { starterThisRound: "n" }
    );
    expect(r.callout).toBe("trancao");
    expect(r.newState.lastCalloutPayload).toEqual({
      winningTeam: 0,
      pts: 19,
      team0Pips: 14,
      team1Pips: 5,
      blockerSeat: "s",
      rivalSeat: "w",
      blockerPips: 4,
      rivalPips: 4,
      winnerSeat: "n",
    });
    expect(r.newState.scores).toEqual([19, 0]);
    const next = startNewRound(r.newState, r.newState.players, mulberry32(7));
    expect(next.starterThisRound).toBe("n");
    expect(next.currentTurn).toBe("n");
  });

  it("2v2: opener W, blocker N, rival E on equal pips: W's side takes it and W opens next", () => {
    const r = lockBy(
      "n",
      {
        n: [[6, 6], [2, 3]], // 5
        e: [[4, 1]], // 5
        s: [[0, 0]],
        w: [[5, 5]],
      },
      { starterThisRound: "w" }
    );
    expect(r.newState.lastCalloutPayload).toMatchObject({ winningTeam: 1, winnerSeat: "w", pts: 20 });
    expect(r.newState.scores).toEqual([0, 20]);
    expect(startNewRound(r.newState, r.newState.players, mulberry32(7)).starterThisRound).toBe("w");
  });

  it("1v1: a tie goes to whichever of the two opened the round", () => {
    const hands: GameState["hands"] = { n: [[6, 6], [1, 2]], s: [[0, 3]], e: [], w: [] };
    const base: Partial<GameState> = {
      is2v2: false,
      currentTurn: "n",
      lastPlayedBy: "s",
      board: SIX_LOCK_BOARD,
      boneyard: [[0, 0]],
      hands,
    };
    const sOpened = move(make2v2({ ...base, starterThisRound: "s" }), { type: "play", tile: [6, 6], end: "left" });
    expect(sOpened.callout).toBe("trancao");
    expect(sOpened.newState.lastCalloutPayload).toMatchObject({ winningTeam: 1, winnerSeat: "s", pts: 6 });
    expect(sOpened.newState.scores).toEqual([0, 6]);
    expect(startNewRound(sOpened.newState, sOpened.newState.players, mulberry32(7)).currentTurn).toBe("s");

    const nOpened = move(make2v2({ ...base, starterThisRound: "n" }), { type: "play", tile: [6, 6], end: "left" });
    expect(nOpened.newState.lastCalloutPayload).toMatchObject({ winningTeam: 0, winnerSeat: "n" });
    expect(startNewRound(nOpened.newState, nOpened.newState.players, mulberry32(7)).currentTurn).toBe("n");
  });

  it("without a tie, winnerSeat is the lighter of blocker and rival, whoever opened", () => {
    const blockerWins = lockBy(
      "n",
      { n: [[6, 6], [1, 0]], e: [[4, 4]], s: [[0, 0]], w: [[5, 0]] },
      { starterThisRound: "s" }
    );
    expect(blockerWins.newState.lastCalloutPayload).toMatchObject({ winningTeam: 0, winnerSeat: "n" });
    const rivalWins = lockBy(
      "n",
      { n: [[6, 6], [5, 4]], e: [[1, 0]], s: [[0, 0]], w: [[5, 5]] },
      { starterThisRound: "w" }
    );
    expect(rivalWins.newState.lastCalloutPayload).toMatchObject({ winningTeam: 1, winnerSeat: "e" });
    expect(startNewRound(rivalWins.newState, rivalWins.newState.players, mulberry32(7)).currentTurn).toBe("e");
  });

  it("a tranque saved by the previous engine (no winnerSeat) keeps its old next opener", () => {
    // A tie of blocker N and rival E with S as the opener: the previous
    // engine gave the round to the compared seat on the opening side, N.
    const ended = make2v2({
      phase: "round_over",
      lastCallout: "trancao",
      lastCalloutPayload: {
        winningTeam: 0,
        pts: 12,
        team0Pips: 5,
        team1Pips: 7,
        blockerSeat: "n",
        rivalSeat: "e",
        blockerPips: 5,
        rivalPips: 5,
      },
      starterThisRound: "s",
      lastPlayedBy: "n",
    });
    expect(startNewRound(ended, ended.players, mulberry32(7)).starterThisRound).toBe("n");
    // The same tranque written by this engine names S and S opens.
    const current = { ...ended, lastCalloutPayload: { ...ended.lastCalloutPayload!, winnerSeat: "s" as Seat } };
    expect(startNewRound(current, current.players, mulberry32(7)).starterThisRound).toBe("s");
  });
});
