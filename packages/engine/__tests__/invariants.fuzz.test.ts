import { describe, it, expect, afterEach, vi } from "vitest";
import { createInitialState, applyMove, startNewRound } from "../src/reducer";
import { hasLegalPlay } from "../src/validate";
import { handPips, teamPips, CAPICUA_BONUS, VEINTICINCO_BONUS } from "../src/scoring";
import { getNextSeat, getSeatsForGame, getTeam } from "../src/types";
import type { GameState, MoveIntent, Seat, Tile } from "../src/types";

/**
 * Whole-game invariant fuzzing. Complements the unit suites: instead of
 * asserting specific scenarios, it drives hundreds of seeded random games
 * through the real reducer and checks structural truths after EVERY
 * transition. Any violation prints the seed, so failures reproduce exactly.
 */

// Deterministic RNG (mulberry32), passed straight into the engine's deal so
// whole games reproduce from a seed without touching any global.
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

afterEach(() => {
  vi.restoreAllMocks();
});

const canonKey = (t: Tile): string => `${Math.min(t[0], t[1])}-${Math.max(t[0], t[1])}`;
const ALL_KEYS: Set<string> = (() => {
  const s = new Set<string>();
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) s.add(`${a}-${b}`);
  return s;
})();

function collectKeys(state: GameState): string[] {
  const keys: string[] = [];
  for (const seat of ["n", "e", "s", "w"] as Seat[]) {
    for (const t of state.hands[seat] ?? []) keys.push(canonKey(t));
  }
  for (const t of state.board) keys.push(canonKey(t));
  for (const t of state.boneyard) keys.push(canonKey(t));
  return keys;
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj as Record<string, unknown>)) deepFreeze(v);
  }
  return obj;
}

function legalPlays(state: GameState): MoveIntent[] {
  const hand = state.hands[state.currentTurn] ?? [];
  const out: MoveIntent[] = [];
  if (state.board.length === 0) {
    for (const tile of hand) out.push({ type: "play", tile, end: "right" });
    return out;
  }
  const left = state.board[0][0];
  const right = state.board[state.board.length - 1][1];
  for (const tile of hand) {
    if (tile[0] === left || tile[1] === left) out.push({ type: "play", tile, end: "left" });
    if (tile[0] === right || tile[1] === right) out.push({ type: "play", tile, end: "right" });
  }
  return out;
}

function chooseIntent(state: GameState, rng: () => number): MoveIntent {
  const plays = legalPlays(state);
  if (plays.length > 0) return plays[Math.floor(rng() * plays.length)];
  if (!state.is2v2 && state.boneyard.length > 0) return { type: "draw" };
  return { type: "pass" };
}

function assertDealInvariants(state: GameState, label: string): void {
  const seats = getSeatsForGame(state.is2v2);
  const keys = collectKeys(state);
  expect(keys.length, `${label}: 28 tiles in play`).toBe(28);
  expect(new Set(keys).size, `${label}: no duplicate tiles`).toBe(28);
  expect(new Set(keys), label).toEqual(ALL_KEYS);
  if (state.is2v2) {
    expect(state.boneyard.length, `${label}: 2v2 has no boneyard`).toBe(0);
  } else {
    for (const seat of ["e", "w"] as Seat[]) {
      expect(state.hands[seat].length, `${label}: 1v1 unused seats empty`).toBe(0);
    }
  }
  expect(seats.includes(state.currentTurn), `${label}: turn is an active seat`).toBe(true);
}

/** The battery: structural truths that must hold across every transition. */
function assertTransition(
  prev: GameState,
  next: GameState,
  seat: Seat,
  intent: MoveIntent,
  seedLabel: string
): void {
  const L = (m: string) => `${seedLabel} [${intent.type} by ${seat}]: ${m}`;

  // Tile conservation, every step of every round.
  const keys = collectKeys(next);
  expect(keys.length, L("28 tiles total")).toBe(28);
  expect(new Set(keys).size, L("no tile duplicated or lost")).toBe(28);

  // Board is a valid chain: adjacent halves match.
  for (let i = 0; i + 1 < next.board.length; i++) {
    expect(next.board[i][1], L(`chain link ${i}`)).toBe(next.board[i + 1][0]);
  }

  // Scores never decrease and stay non-negative integers.
  for (const team of [0, 1] as const) {
    expect(next.scores[team], L("score monotonic")).toBeGreaterThanOrEqual(prev.scores[team]);
    expect(Number.isInteger(next.scores[team]), L("score integer")).toBe(true);
  }

  // Phase machine consistency.
  if (next.phase === "finished") {
    expect(next.winnerTeam, L("finished has winner")).not.toBeNull();
    expect(
      next.scores[next.winnerTeam as 0 | 1],
      L("winner reached target")
    ).toBeGreaterThanOrEqual(next.targetScore);
  } else if (next.phase === "playing") {
    expect(next.winnerTeam, L("playing has no winner")).toBeNull();
    const threshold = next.is2v2 ? 4 : 2;
    expect(next.consecutivePasses, L("passes below trancao threshold")).toBeLessThan(threshold);
  } else if (next.phase === "round_over") {
    expect(next.winnerTeam, L("round_over is not game end")).toBeNull();
    expect(["domino", "capicua", "trancao"]).toContain(next.lastCallout);
  }

  const delta0 = next.scores[0] - prev.scores[0];
  const delta1 = next.scores[1] - prev.scores[1];

  if (intent.type === "play") {
    // Actor's hand shrank by exactly the played tile; others untouched.
    expect(next.hands[seat].length, L("hand shrank by 1")).toBe(prev.hands[seat].length - 1);
    for (const s of getSeatsForGame(prev.is2v2)) {
      if (s !== seat) expect(next.hands[s], L(`hand ${s} untouched`)).toEqual(prev.hands[s]);
    }
    if (next.phase === "playing") {
      expect(next.currentTurn, L("turn advances after play")).toBe(getNextSeat(seat, prev.is2v2));
      expect(next.consecutivePasses, L("play resets passes")).toBe(0);
      expect(delta0 + delta1, L("no score change mid-round play")).toBe(0);
      expect(next.lastPlayedBy, L("lastPlayedBy updated")).toBe(seat);
    } else {
      // Round ended by this play: DOMINO or CAPICUA.
      expect(next.hands[seat].length, L("winner went out")).toBe(0);
      expect(["domino", "capicua"]).toContain(next.lastCallout);
      const winningTeam = getTeam(seat, prev.is2v2);
      const losingDelta = winningTeam === 0 ? delta1 : delta0;
      const winningDelta = winningTeam === 0 ? delta0 : delta1;
      expect(losingDelta, L("loser scores nothing on domino")).toBe(0);
      const allPips = getSeatsForGame(next.is2v2).reduce(
        (sum, s) => sum + handPips(next.hands[s] ?? []),
        0
      );
      const expected = allPips + (next.lastCallout === "capicua" ? CAPICUA_BONUS : 0);
      expect(winningDelta, L("domino awards remaining pips (+bonus)")).toBe(expected);
    }
  }

  if (intent.type === "draw") {
    const gained = next.hands[seat].length - prev.hands[seat].length;
    const consumed = prev.boneyard.length - next.boneyard.length;
    expect(gained, L("draw moved tiles hand<-boneyard")).toBe(consumed);
    expect(gained, L("draw takes at least one tile")).toBeGreaterThanOrEqual(1);
    expect(next.currentTurn, L("draw keeps the turn")).toBe(seat);
    expect(
      hasLegalPlay(next.hands[seat], next.board) || next.boneyard.length === 0,
      L("draw stops at playable tile or empty boneyard")
    ).toBe(true);
    expect(delta0 + delta1, L("draw never scores")).toBe(0);
  }

  if (intent.type === "pass") {
    expect(next.hands[seat], L("pass leaves hand untouched")).toEqual(prev.hands[seat]);
    expect(next.board, L("pass leaves board untouched")).toEqual(prev.board);
    if (next.lastCallout === "veinticinco") {
      // Pase corrido: +25 to the team of the last player, who plays next.
      const team = getTeam(prev.lastPlayedBy as Seat, prev.is2v2);
      expect(team === 0 ? delta0 : delta1, L("veinticinco pays 25")).toBe(VEINTICINCO_BONUS);
      expect(team === 0 ? delta1 : delta0, L("veinticinco pays one side")).toBe(0);
      if (next.phase === "playing") {
        expect(next.currentTurn, L("veinticinco returns turn to forcer")).toBe(prev.lastPlayedBy);
      }
    } else if (next.lastCallout === "trancao") {
      const t0 = teamPips(next, 0);
      const t1 = teamPips(next, 1);
      const pts = (next.lastCalloutPayload?.pts as number) ?? -1;
      const winner = (next.lastCalloutPayload?.winningTeam as number) ?? -1;
      // A trancao pays the whole table to the lighter side, like a domino.
      expect(pts, L("trancao pts = every pip on the table")).toBe(t0 + t1);
      if (t0 !== t1) {
        expect(winner, L("trancao lower pips wins")).toBe(t0 < t1 ? 0 : 1);
      } else {
        expect(winner, L("trancao tie goes to starter")).toBe(
          getTeam(next.starterThisRound, next.is2v2)
        );
      }
      expect(winner === 0 ? delta0 : delta1, L("trancao credits winner")).toBe(pts);
      expect(winner === 0 ? delta1 : delta0, L("trancao pays one side")).toBe(0);
    } else {
      expect(delta0 + delta1, L("plain pass never scores")).toBe(0);
      if (next.phase === "playing") {
        expect(next.currentTurn, L("pass advances turn")).toBe(getNextSeat(seat, prev.is2v2));
      }
    }
  }
}

/** Expected starter of the next round, recomputed independently. */
function expectedNextStarter(ended: GameState): Seat {
  if (ended.lastCallout === "domino" || ended.lastCallout === "capicua") {
    return (ended.lastPlayedBy ?? ended.starterThisRound) as Seat;
  }
  // trancao: fewest individual pips on the winning team, first in seat order.
  const winningTeam = (ended.lastCalloutPayload?.winningTeam as number) ?? 0;
  let best: Seat = getSeatsForGame(ended.is2v2)[0];
  let bestPips = Infinity;
  for (const seat of getSeatsForGame(ended.is2v2)) {
    if (getTeam(seat, ended.is2v2) === winningTeam) {
      const pips = handPips(ended.hands[seat] ?? []);
      if (pips < bestPips) {
        bestPips = pips;
        best = seat;
      }
    }
  }
  return best;
}

const MAX_STEPS_PER_ROUND = 400;
const MAX_ROUNDS = 200;

function playFullGame(opts: {
  seed: number;
  is2v2: boolean;
  targetScore: number;
}): GameState {
  const { seed, is2v2, targetScore } = opts;
  const label = `seed=${seed} ${is2v2 ? "2v2" : "1v1"} target=${targetScore}`;
  const dealRng = mulberry32(seed);
  const choiceRng = mulberry32(seed ^ 0x9e3779b9);

  let state = createInitialState({ mode: "live", theme: "colmado", is2v2, targetScore, rng: dealRng });
  assertDealInvariants(state, `${label} initial deal`);
  // createInitialState auto-plays the starter's opening tile.
  expect(state.board.length, `${label}: opening tile placed`).toBe(1);
  expect(state.lastPlayedBy, `${label}: starter recorded`).toBe(state.starterThisRound);

  let rounds = 0;
  while (state.phase !== "finished") {
    let steps = 0;
    while (state.phase === "playing") {
      steps++;
      expect(steps, `${label}: round terminates`).toBeLessThan(MAX_STEPS_PER_ROUND);
      const seat = state.currentTurn;
      const intent = chooseIntent(state, choiceRng);
      deepFreeze(state); // any in-place mutation by the reducer throws
      const result = applyMove(state, seat, intent);
      expect(result.success, `${label}: legal intent accepted (${result.error ?? ""})`).toBe(true);
      assertTransition(state, result.newState, seat, intent, label);
      state = result.newState;
    }

    // Terminal states accept no further moves.
    const probe = applyMove(state, state.currentTurn, { type: "pass" });
    expect(probe.success, `${label}: no moves after round end`).toBe(false);
    expect(probe.newState, `${label}: rejected move changes nothing`).toEqual(state);

    // Round-end state survives JSON persistence (supabase JSONB).
    expect(JSON.parse(JSON.stringify(state)), `${label}: serializable`).toEqual(state);

    if (state.phase === "round_over") {
      const starter = expectedNextStarter(state);
      const prevScores = state.scores;
      const prevRound = state.roundIndex;
      state = startNewRound(state, state.players, dealRng);
      assertDealInvariants(state, `${label} round ${state.roundIndex} deal`);
      expect(state.currentTurn, `${label}: round winner leads next round`).toBe(starter);
      expect(state.starterThisRound, `${label}: starter recorded`).toBe(starter);
      expect(state.roundIndex, `${label}: round index increments`).toBe(prevRound + 1);
      expect(state.scores, `${label}: scores carry over`).toEqual(prevScores);
      expect(state.board.length, `${label}: new round starts with free choice`).toBe(0);
      for (const seat of getSeatsForGame(state.is2v2)) {
        expect(state.hands[seat].length, `${label}: fresh 7-tile hands`).toBe(7);
      }
    }
    rounds++;
    expect(rounds, `${label}: game terminates`).toBeLessThan(MAX_ROUNDS);
  }

  expect(state.winnerTeam, `${label}: finished game has a winner`).not.toBeNull();
  expect(
    Math.max(state.scores[0], state.scores[1]),
    `${label}: winner crossed target`
  ).toBeGreaterThanOrEqual(state.targetScore);
  return state;
}

describe("invariant fuzz: full random games through the real reducer", () => {
  // 100 and 200 are the production targets; the short ones exercise the
  // game-over transitions many more times per run.
  const TARGETS = [25, 50, 100, 200];

  it("1v1: 60 seeded games hold every invariant at every step", () => {
    for (let i = 0; i < 60; i++) {
      playFullGame({ seed: 1000 + i, is2v2: false, targetScore: TARGETS[i % TARGETS.length] });
    }
  });

  it("2v2: 60 seeded games hold every invariant at every step", () => {
    for (let i = 0; i < 60; i++) {
      playFullGame({ seed: 2000 + i, is2v2: true, targetScore: TARGETS[i % TARGETS.length] });
    }
  });
});

describe("invariant fuzz: illegal intents are rejected without side effects", () => {
  function expectRejected(state: GameState, seat: Seat, intent: MoveIntent, why: string): void {
    const before = JSON.parse(JSON.stringify(state));
    const result = applyMove(state, seat, intent);
    expect(result.success, why).toBe(false);
    expect(result.error, `${why}: has error message`).toBeTruthy();
    expect(result.newState, `${why}: state unchanged`).toEqual(before);
  }

  it("out-of-turn, foreign-tile, wrong-end, bad-draw and bad-pass all bounce", () => {
    for (let i = 0; i < 30; i++) {
      const is2v2 = i % 2 === 0;
      const choiceRng = mulberry32(9000 + i);
      let state = createInitialState({
        mode: "live",
        theme: "patio",
        is2v2,
        targetScore: 100,
        rng: mulberry32(3000 + i),
      });

      // Walk a few random legal steps so states are mid-game, then attack.
      for (let step = 0; step < 6 && state.phase === "playing"; step++) {
        const seats = getSeatsForGame(is2v2);
        const turn = state.currentTurn;
        const wrongSeat = seats.find((s) => s !== turn) as Seat;
        const hand = state.hands[turn];
        const plays = legalPlays(state);

        // 1. Right intent, wrong seat.
        const wrongSeatIntent: MoveIntent =
          (state.hands[wrongSeat]?.length ?? 0) > 0
            ? { type: "play", tile: state.hands[wrongSeat][0], end: "right" }
            : { type: "pass" };
        expectRejected(state, wrongSeat, wrongSeatIntent, `seed ${3000 + i}: out of turn`);

        // 2. Tile not in hand.
        const foreign = state.boneyard[0] ?? state.hands[wrongSeat]?.[0];
        if (foreign) {
          expectRejected(
            state,
            turn,
            { type: "play", tile: foreign, end: "right" },
            `seed ${3000 + i}: foreign tile`
          );
        }

        // 3. Wrong end for a one-sided tile.
        if (state.board.length > 0) {
          const left = state.board[0][0];
          const right = state.board[state.board.length - 1][1];
          const oneSided = hand.find(
            (t) =>
              (t[0] === left || t[1] === left) && t[0] !== right && t[1] !== right
          );
          if (oneSided) {
            expectRejected(
              state,
              turn,
              { type: "play", tile: oneSided, end: "right" },
              `seed ${3000 + i}: wrong end`
            );
          }
        }

        // 4. Draw when it is not allowed.
        if (is2v2) {
          expectRejected(state, turn, { type: "draw" }, `seed ${3000 + i}: draw in 2v2`);
        } else if (plays.length > 0) {
          expectRejected(state, turn, { type: "draw" }, `seed ${3000 + i}: draw with legal play`);
        }

        // 5. Pass while holding a legal play.
        if (plays.length > 0) {
          expectRejected(state, turn, { type: "pass" }, `seed ${3000 + i}: pass with legal play`);
        }

        const intent = chooseIntent(state, choiceRng);
        const result = applyMove(state, state.currentTurn, intent);
        expect(result.success).toBe(true);
        state = result.newState;
      }
      vi.restoreAllMocks();
    }
  });
});

describe("invariant fuzz: determinism under a seeded shuffle", () => {
  it("same seed produces the same deal and the same full game", () => {
    for (const seed of [42, 777, 31337]) {
      for (const is2v2 of [false, true]) {
        const runs: GameState[] = [];
        for (let run = 0; run < 2; run++) {
          runs.push(playFullGame({ seed, is2v2, targetScore: 50 }));
        }
        expect(runs[0], `seed ${seed} ${is2v2 ? "2v2" : "1v1"} reproducible`).toEqual(runs[1]);
      }
    }
  });
});
