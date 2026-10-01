import { describe, it, expect } from "vitest";
import { createInitialState, applyMove, startNewRound, placeTileOnBoard } from "../src/reducer";
import { validateMove } from "../src/validate";
import { CAPICUA_BONUS, VEINTICINCO_BONUS, SALIDA_BONUS } from "../src/scoring";
import { getNextSeat, getSeatsForGame, getTeam } from "../src/types";
import type { GameState, MoveIntent, Seat, Tile } from "../src/types";

/**
 * End-game flow simulation. Plays complete seeded games from the deal to
 * phase "finished" (1v1 and 2v2, targets 100 and 200) under several move
 * policies, and checks after every move:
 *   1. liveness: the seat on turn always has an intent validateMove accepts,
 *      the accepted set is exactly what the rules allow, and no other seat
 *      can act;
 *   2. progress: every game ends within MAX_ROUNDS and MAX_MOVES;
 *   3. round end: "round_over" below the target, "finished" for the side at
 *      it, and a +25 never reaches the target or ends the game;
 *   4. next round: startNewRound redeals only a round that ended, and the
 *      round winner opens it;
 *   5. coverage: every ending kind occurs in the corpus.
 * Every label carries the seed, format, target and policy, so a failure
 * reproduces with playGame(seed, is2v2, target, policy).
 */

// Deterministic RNG (mulberry32). The deal RNG is built before the state, so
// no draw the test depends on comes from an unseeded source.
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

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj as Record<string, unknown>)) deepFreeze(v);
  }
  return obj;
}

// Hundreds of thousands of states pass through here, so the common path is a
// plain comparison and expect() runs only on a failure, with a lazy message.
function check(cond: boolean, msg: () => string): void {
  if (!cond) expect(cond, msg()).toBe(true);
}

const ALL_SEATS: Seat[] = ["n", "e", "s", "w"];
const MAX_ROUNDS = 60;
const MAX_MOVES = 4000;
const GAMES_PER_POLICY = 60;
// startNewRound must not reshuffle anything but a round_over state.
const FORBIDDEN_RNG = (): number => {
  throw new Error("startNewRound dealt from a state that was not round_over");
};

const pips = (hand: Tile[]): number => hand.reduce((sum, t) => sum + t[0] + t[1], 0);
const fits = (t: Tile, end: number): boolean => t[0] === end || t[1] === end;
const keyOf = (i: MoveIntent): string =>
  i.type === "play" ? `play ${i.tile![0]}-${i.tile![1]} ${i.end}` : i.type;
const partnerOf = (seat: Seat): Seat => getNextSeat(getNextSeat(seat, true), true);

function candidateIntents(state: GameState, seat: Seat): MoveIntent[] {
  const out: MoveIntent[] = [];
  for (const tile of state.hands[seat] ?? []) {
    out.push({ type: "play", tile, end: "left" }, { type: "play", tile, end: "right" });
  }
  out.push({ type: "draw" }, { type: "pass" });
  return out;
}

function acceptedIntents(state: GameState, seat: Seat): MoveIntent[] {
  return candidateIntents(state, seat).filter((i) => validateMove(state, seat, i) === null);
}

// The rules, recomputed without the engine: play any tile that fits an end
// (any tile on an empty table); with nothing to play, draw in 1v1 while the
// boneyard has tiles; otherwise pass.
function rulesIntents(state: GameState): MoveIntent[] {
  const hand = state.hands[state.currentTurn] ?? [];
  const plays: MoveIntent[] = [];
  const left = state.board.length > 0 ? state.board[0][0] : -1;
  const right = state.board.length > 0 ? state.board[state.board.length - 1][1] : -1;
  for (const tile of hand) {
    if (state.board.length === 0 || fits(tile, left)) plays.push({ type: "play", tile, end: "left" });
    if (state.board.length === 0 || fits(tile, right)) plays.push({ type: "play", tile, end: "right" });
  }
  if (plays.length > 0) return plays;
  if (!state.is2v2 && state.boneyard.length > 0) return [{ type: "draw" }];
  return [{ type: "pass" }];
}

// ---------------------------------------------------------------- policies

interface Policy {
  name: string;
  choose(state: GameState, accepted: MoveIntent[], rng: () => number): MoveIntent;
}

const pick = <T>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];
const playsOf = (accepted: MoveIntent[]): MoveIntent[] => accepted.filter((i) => i.type === "play");
const tileSum = (i: MoveIntent): number => i.tile![0] + i.tile![1];

// Best plays by a score, ties broken by the RNG.
function bestBy(plays: MoveIntent[], score: (i: MoveIntent) => number, rng: () => number): MoveIntent {
  const top = Math.max(...plays.map(score));
  return pick(
    plays.filter((i) => score(i) === top),
    rng
  );
}

// Fallback when nothing is playable: the one non-play intent accepted.
function nonPlay(accepted: MoveIntent[]): MoveIntent | undefined {
  return accepted.find((i) => i.type === "pass") ?? accepted.find((i) => i.type === "draw");
}

// How many tiles the next seat could play after this placement.
function nextSeatOptions(state: GameState, intent: MoveIntent): number {
  const board = placeTileOnBoard(state.board, intent.tile!, intent.end!);
  const left = board[0][0];
  const right = board[board.length - 1][1];
  const next = getNextSeat(state.currentTurn, state.is2v2);
  return (state.hands[next] ?? []).filter((t) => fits(t, left) || fits(t, right)).length;
}

const POLICIES: Policy[] = [
  { name: "random", choose: (_s, accepted, rng) => pick(accepted, rng) },
  {
    name: "greedy-heavy",
    choose: (_s, accepted, rng) => {
      const plays = playsOf(accepted);
      return plays.length > 0 ? bestBy(plays, tileSum, rng) : (nonPlay(accepted) as MoveIntent);
    },
  },
  {
    // Takes a pass or a draw whenever the engine accepts one, and otherwise
    // keeps its heavy tiles (plays the lightest).
    name: "passive-light",
    choose: (_s, accepted, rng) => {
      const quiet = nonPlay(accepted);
      if (quiet) return quiet;
      return bestBy(playsOf(accepted), (i) => -tileSum(i), rng);
    },
  },
  {
    // Takes a pass or a draw whenever accepted, and otherwise plays to starve
    // the next seat (peeking at its hand), which drives pases and tranques.
    name: "blocker",
    choose: (state, accepted, rng) => {
      const quiet = nonPlay(accepted);
      if (quiet) return quiet;
      return bestBy(playsOf(accepted), (i) => -nextSeatOptions(state, i) * 100 + tileSum(i), rng);
    },
  },
];

// ---------------------------------------------------------------- tallies

const tally = new Map<string, number>();
function bump(fmt: string, kind: string): void {
  const k = `${fmt} ${kind}`;
  tally.set(k, (tally.get(k) ?? 0) + 1);
}
const count = (fmt: string, kind: string): number => tally.get(`${fmt} ${kind}`) ?? 0;

// First natural occurrence of each kind, replayed at the target edge below.
interface Sample {
  prev: GameState;
  seat: Seat;
  intent: MoveIntent;
  next: GameState;
  label: string;
}
const samples = new Map<string, Sample>();
function keep(fmt: string, kind: string, s: Sample): void {
  const k = `${fmt} ${kind}`;
  if (!samples.has(k)) samples.set(k, s);
}

// ---------------------------------------------------------------- checks

function assertLive(state: GameState, where: string): MoveIntent[] {
  const seat = state.currentTurn;
  check(getSeatsForGame(state.is2v2).includes(seat), () => `${where}: turn ${seat} is not an active seat`);
  for (const team of [0, 1] as const) {
    check(
      state.scores[team] < state.targetScore,
      () => `${where}: side ${team} at ${state.scores[team]} is at the target while play goes on`
    );
  }
  const accepted = acceptedIntents(state, seat);
  check(accepted.length > 0, () => `${where}: LIVENESS seat ${seat} has no accepted intent`);
  const got = accepted.map(keyOf).sort();
  const want = rulesIntents(state).map(keyOf).sort();
  check(
    got.join("|") === want.join("|"),
    () => `${where}: accepted intents [${got.join(", ")}] differ from the rules [${want.join(", ")}]`
  );
  for (const other of ALL_SEATS) {
    if (other === seat) continue;
    const extra = acceptedIntents(state, other);
    check(extra.length === 0, () => `${where}: seat ${other} off turn may ${extra.map(keyOf).join(", ")}`);
  }
  // Every intent validateMove accepts is one the reducer applies.
  for (const intent of accepted) {
    const r = applyMove(state, seat, intent);
    check(r.success, () => `${where}: applyMove refused accepted ${keyOf(intent)} (${r.error})`);
  }
  return accepted;
}

// A round that ended (or a finished game) accepts nothing from any seat, and
// startNewRound leaves anything but round_over untouched.
function assertSettled(state: GameState, where: string): void {
  for (const seat of ALL_SEATS) {
    const any = acceptedIntents(state, seat);
    check(any.length === 0, () => `${where}: ${state.phase} still accepts ${seat} ${any.map(keyOf).join(", ")}`);
  }
  if (state.phase !== "round_over") {
    check(
      startNewRound(state, state.players, FORBIDDEN_RNG) === state,
      () => `${where}: startNewRound changed a ${state.phase} state`
    );
  }
}

function tranqueOracle(ended: GameState, blocker: Seat): { rival: Seat; winnerSeat: Seat; tie: boolean } {
  const rival = getNextSeat(blocker, ended.is2v2);
  const bp = pips(ended.hands[blocker] ?? []);
  const rp = pips(ended.hands[rival] ?? []);
  const winnerSeat = bp < rp ? blocker : rp < bp ? rival : ended.starterThisRound;
  return { rival, winnerSeat, tie: bp === rp };
}

interface Transition {
  prev: GameState;
  next: GameState;
  seat: Seat;
  intent: MoveIntent;
  where: string;
  fmt: string;
  label: string;
}

// The +25 rules: a pase corrido (third pass in a row hands the turn back to
// the player who placed the last tile) and a pase de salida (the opener's
// partner plays after the next seat passed on the opening tile) pay 25 only
// while that leaves the side below the target. Neither ends anything.
function assertBonus(t: Transition): void {
  const { prev, next, seat, intent, where, fmt } = t;
  const corrido =
    prev.is2v2 &&
    intent.type === "pass" &&
    prev.lastPlayedBy !== null &&
    getNextSeat(seat, true) === prev.lastPlayedBy &&
    prev.passesSinceLastPlay + 1 === 3;
  const salida =
    prev.is2v2 &&
    intent.type === "play" &&
    next.phase === "playing" &&
    prev.board.length === 1 &&
    prev.lastPlayedBy === prev.starterThisRound &&
    prev.passesSinceLastPlay === 1 &&
    seat === partnerOf(prev.starterThisRound);
  const payee = corrido ? prev.lastPlayedBy! : prev.starterThisRound;
  const team = getTeam(payee, prev.is2v2);
  const shaped = corrido || salida;
  const pays = shaped && prev.scores[team] + 25 < prev.targetScore;
  const d = [next.scores[0] - prev.scores[0], next.scores[1] - prev.scores[1]];

  if (next.lastCallout === "veinticinco") {
    const kind = next.lastCalloutPayload?.salida ? "pase de salida" : "pase corrido";
    bump(fmt, kind);
    keep(fmt, kind, t);
    check(pays, () => `${where}: ${kind} paid outside its shape or at the target`);
    check(kind === (salida ? "pase de salida" : "pase corrido"), () => `${where}: ${kind} on the wrong move`);
    check(next.phase === "playing", () => `${where}: a ${kind} ended the round (${next.phase})`);
    check(next.winnerTeam === null, () => `${where}: a ${kind} named a winner`);
    check(next.lastCalloutPayload?.winningTeam === team, () => `${where}: ${kind} paid the wrong side`);
    const bonus = kind === "pase de salida" ? SALIDA_BONUS : VEINTICINCO_BONUS;
    check(d[team] === bonus && d[1 - team] === 0, () => `${where}: ${kind} moved scores by ${d.join("/")}`);
    check(next.scores[team] < next.targetScore, () => `${where}: ${kind} took side ${team} to the target`);
    if (corrido) {
      check(next.currentTurn === prev.lastPlayedBy, () => `${where}: pase corrido did not hand the turn back`);
    }
  } else if (shaped && next.phase === "playing") {
    check(!pays, () => `${where}: ${corrido ? "pase corrido" : "pase de salida"} owed 25 and paid nothing`);
    check(d[0] === 0 && d[1] === 0, () => `${where}: a withheld +25 still moved scores ${d.join("/")}`);
    bump(fmt, "+25 withheld at the target");
  } else if (next.phase === "playing") {
    check(d[0] === 0 && d[1] === 0, () => `${where}: a plain ${intent.type} moved scores ${d.join("/")}`);
  }
}

// Round end: the result kind, the points, and the phase rule at the target.
function assertRoundEnd(t: Transition): void {
  const { prev, next, seat, intent, where, fmt } = t;
  check(intent.type === "play", () => `${where}: a ${intent.type} ended the round`);
  const allPips = getSeatsForGame(next.is2v2).reduce((s, x) => s + pips(next.hands[x] ?? []), 0);
  const d = [next.scores[0] - prev.scores[0], next.scores[1] - prev.scores[1]];
  let roundTeam: 0 | 1;
  let kind: string;

  if ((next.hands[seat] ?? []).length === 0) {
    const tile = intent.tile!;
    const l = prev.board.length > 0 ? prev.board[0][0] : -1;
    const r = prev.board.length > 0 ? prev.board[prev.board.length - 1][1] : -1;
    const capicua = fits(tile, l) && fits(tile, r);
    kind = capicua ? "capicua" : "domino";
    check(next.lastCallout === kind, () => `${where}: going out called ${next.lastCallout}, rules say ${kind}`);
    roundTeam = getTeam(seat, next.is2v2);
    const pts = allPips + (capicua ? CAPICUA_BONUS : 0);
    check(d[roundTeam] === pts && d[1 - roundTeam] === 0, () => `${where}: ${kind} paid ${d.join("/")}, want ${pts}`);
    check(next.lastPlayedBy === seat, () => `${where}: the player who went out is not lastPlayedBy`);
  } else {
    check(next.lastCallout === "trancao", () => `${where}: ended with tiles in hand as ${next.lastCallout}`);
    const o = tranqueOracle(next, seat);
    const p = next.lastCalloutPayload;
    check(p?.blockerSeat === seat && p?.rivalSeat === o.rival, () => `${where}: tranque compared the wrong seats`);
    check(p?.winnerSeat === o.winnerSeat, () => `${where}: tranque winner ${p?.winnerSeat}, rules say ${o.winnerSeat}`);
    roundTeam = getTeam(o.winnerSeat, next.is2v2);
    check(d[roundTeam] === allPips && d[1 - roundTeam] === 0, () => `${where}: tranque paid ${d.join("/")}`);
    if (o.tie) {
      kind = "tranque tie to the opener";
      if (o.winnerSeat !== seat && o.winnerSeat !== o.rival) bump(fmt, "tranque tie to an opener who did not compare");
    } else {
      kind = o.winnerSeat === seat ? "tranque won by the blocker" : "tranque won by the rival";
    }
  }
  check(next.lastCalloutPayload?.winningTeam === roundTeam, () => `${where}: payload names the wrong round winner`);

  const atTarget = ([0, 1] as const).filter((x) => next.scores[x] >= next.targetScore);
  if (atTarget.length === 0) {
    check(next.phase === "round_over", () => `${where}: both sides below the target but phase ${next.phase}`);
    check(next.winnerTeam === null, () => `${where}: round_over carries winner ${next.winnerTeam}`);
  } else {
    check(next.phase === "finished", () => `${where}: side ${atTarget} at the target but phase ${next.phase}`);
    check(atTarget.length === 1, () => `${where}: both sides at the target ${next.scores.join("-")}`);
    check(next.winnerTeam === atTarget[0], () => `${where}: winner ${next.winnerTeam}, side at target ${atTarget[0]}`);
    check(atTarget[0] === roundTeam, () => `${where}: the game went to a side that did not win the round`);
    bump(fmt, `game won on a ${kind.startsWith("tranque") ? "tranque" : kind}`);
  }
  bump(fmt, kind);
  keep(fmt, kind, t);
}

// ---------------------------------------------------------------- games

interface GameLog {
  moves: number;
  rounds: number;
  maxRoundMoves: number;
}

function playGame(seed: number, is2v2: boolean, targetScore: number, policy: Policy): GameLog {
  const fmt = is2v2 ? "2v2" : "1v1";
  const label = `seed=${seed} ${fmt} target=${targetScore} policy=${policy.name}`;
  const dealRng = mulberry32(seed);
  const choiceRng = mulberry32(seed ^ 0x5bd1e995);
  let state = createInitialState({ mode: "live", theme: "barberia", is2v2, targetScore, rng: dealRng });
  let moves = 0;
  let maxRoundMoves = 0;

  for (;;) {
    let roundMoves = 0;
    let emptiedBy: Seat | null = null;
    while (state.phase === "playing") {
      const where = `${label} round=${state.roundIndex} move=${moves}`;
      deepFreeze(state);
      const accepted = assertLive(state, where);
      if (roundMoves === 0) {
        check(
          startNewRound(state, state.players, FORBIDDEN_RNG) === state,
          () => `${where}: startNewRound redealt a live round`
        );
      }
      const seat = state.currentTurn;
      const intent = policy.choose(state, accepted, choiceRng);
      const result = applyMove(state, seat, intent);
      check(result.success, () => `${where}: ${keyOf(intent)} refused (${result.error})`);
      const next = result.newState;
      const t: Transition = { prev: state, next, seat, intent, where, fmt, label };
      assertBonus(t);
      if (next.phase !== "playing") assertRoundEnd(t);

      // 1v1: a draw that takes the last boneyard tile and still finds nothing
      // to play leaves the seat on turn, and its only intent is a pass.
      if (emptiedBy !== null) {
        check(seat === emptiedBy && intent.type === "pass", () => `${where}: emptied boneyard not followed by a pass`);
        bump(fmt, "draw empties the boneyard, then a pass");
        emptiedBy = null;
      }
      if (intent.type === "draw" && next.boneyard.length === 0) {
        check(next.currentTurn === seat, () => `${where}: the drawer lost the turn`);
        const playable = rulesIntents(next).some((i) => i.type === "play");
        if (playable) bump(fmt, "draw empties the boneyard on a playable tile");
        else emptiedBy = seat;
      }

      moves++;
      roundMoves++;
      check(moves <= MAX_MOVES, () => `${label}: PROGRESS over ${MAX_MOVES} moves`);
      state = next;
    }
    maxRoundMoves = Math.max(maxRoundMoves, roundMoves);
    const where = `${label} round=${state.roundIndex} end`;
    deepFreeze(state);
    assertSettled(state, where);
    if (state.phase === "finished") break;

    // Next round: the round winner opens on an empty table, scores carried.
    const ended = state;
    const opener =
      ended.lastCallout === "trancao" ? (ended.lastCalloutPayload?.winnerSeat as Seat) : (ended.lastPlayedBy as Seat);
    state = startNewRound(ended, ended.players, dealRng);
    check(state.phase === "playing", () => `${where}: next round phase ${state.phase}`);
    check(state.board.length === 0, () => `${where}: next round board not empty`);
    check(state.roundIndex === ended.roundIndex + 1, () => `${where}: roundIndex ${state.roundIndex}`);
    check(
      state.scores[0] === ended.scores[0] && state.scores[1] === ended.scores[1],
      () => `${where}: scores not carried`
    );
    check(state.currentTurn === opener, () => `${where}: next round opens with ${state.currentTurn}, winner ${opener}`);
    check(state.starterThisRound === opener, () => `${where}: starterThisRound ${state.starterThisRound}, winner ${opener}`);
    check(
      state.lastPlayedBy === null && state.passesSinceLastPlay === 0 && state.consecutivePasses === 0,
      () => `${where}: next round carries pass state`
    );
    check(state.lastCallout === null && state.winnerTeam === null, () => `${where}: next round carries a callout`);
    for (const seat of getSeatsForGame(is2v2)) {
      check(state.hands[seat].length === 7, () => `${where}: ${seat} dealt ${state.hands[seat].length}`);
    }
    check(state.boneyard.length === (is2v2 ? 0 : 14), () => `${where}: boneyard ${state.boneyard.length}`);
    check(state.roundIndex < MAX_ROUNDS, () => `${label}: PROGRESS over ${MAX_ROUNDS} rounds`);
  }

  check(state.winnerTeam !== null, () => `${label}: finished without a winner`);
  return { moves, rounds: state.roundIndex + 1, maxRoundMoves };
}

interface CorpusStats {
  games: number;
  maxMoves: number;
  maxMovesGame: string;
  maxRounds: number;
  maxRoundsGame: string;
  maxRoundMoves: number;
  totalMoves: number;
}

const corpus = new Map<string, CorpusStats>();
function runCorpus(is2v2: boolean, target: number): CorpusStats {
  const key = `${is2v2 ? "2v2" : "1v1"} ${target}`;
  const done = corpus.get(key);
  if (done) return done;
  const stats: CorpusStats = {
    games: 0,
    maxMoves: 0,
    maxMovesGame: "",
    maxRounds: 0,
    maxRoundsGame: "",
    maxRoundMoves: 0,
    totalMoves: 0,
  };
  const base = 100_000 + (is2v2 ? 50_000 : 0) + target * 100;
  POLICIES.forEach((policy, p) => {
    for (let i = 0; i < GAMES_PER_POLICY; i++) {
      const seed = base + p * 1000 + i;
      const log = playGame(seed, is2v2, target, policy);
      const game = `seed=${seed} ${policy.name}`;
      stats.games++;
      stats.totalMoves += log.moves;
      if (log.moves > stats.maxMoves) [stats.maxMoves, stats.maxMovesGame] = [log.moves, game];
      if (log.rounds > stats.maxRounds) [stats.maxRounds, stats.maxRoundsGame] = [log.rounds, game];
      stats.maxRoundMoves = Math.max(stats.maxRoundMoves, log.maxRoundMoves);
    }
  });
  corpus.set(key, stats);
  return stats;
}

const FORMATS = [false, true];
const TARGETS = [100, 200];
const runAll = (): void => FORMATS.forEach((is2v2) => TARGETS.forEach((t) => runCorpus(is2v2, t)));

describe("end-game flow: complete seeded games to the final score", () => {
  for (const is2v2 of FORMATS) {
    for (const target of TARGETS) {
      it(`${is2v2 ? "2v2" : "1v1"} to ${target}: ${GAMES_PER_POLICY} games per policy stay live and finish in bounds`, () => {
        const s = runCorpus(is2v2, target);
        expect(s.games, "every game finished").toBe(GAMES_PER_POLICY * POLICIES.length);
        expect(s.maxMoves, `max moves (${s.maxMovesGame})`).toBeLessThanOrEqual(MAX_MOVES);
        expect(s.maxRounds, `max rounds (${s.maxRoundsGame})`).toBeLessThanOrEqual(MAX_ROUNDS);
      }, 120_000);
    }
  }

  it("every ending kind occurs in the corpus", () => {
    runAll();
    const SHARED = [
      "domino",
      "capicua",
      "tranque won by the blocker",
      "tranque won by the rival",
      "tranque tie to the opener",
    ];
    for (const fmt of ["1v1", "2v2"]) {
      for (const kind of SHARED) expect(count(fmt, kind), `${fmt} reaches: ${kind}`).toBeGreaterThan(0);
    }
    expect(count("2v2", "pase corrido"), "2v2 reaches: pase corrido").toBeGreaterThan(0);
    expect(count("2v2", "pase de salida"), "2v2 reaches: pase de salida").toBeGreaterThan(0);
    expect(count("1v1", "draw empties the boneyard, then a pass"), "1v1 reaches: boneyard emptied then pass").toBeGreaterThan(0);
    // Heads-up never pays a +25.
    expect(count("1v1", "pase corrido") + count("1v1", "pase de salida"), "1v1 pays no +25").toBe(0);

    const lines = [...corpus.entries()].map(
      ([k, s]) =>
        `${k}: ${s.games} games, avg ${Math.round(s.totalMoves / s.games)} moves, max ${s.maxMoves} moves (${s.maxMovesGame}), max ${s.maxRounds} rounds (${s.maxRoundsGame}), max ${s.maxRoundMoves} moves in a round`
    );
    const kinds = [...tally.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k}: ${n}`);
    console.log(["end-game corpus", ...lines, "ending kinds", ...kinds].join("\n"));
  }, 300_000);
});

// Natural round ends and +25 bonuses, replayed from the same pre-move state
// with the scoring side moved to the edge of the target.
describe("end-game flow: natural endings replayed at the target edge", () => {
  function sample(fmt: string, kind: string): Sample {
    runAll();
    const s = samples.get(`${fmt} ${kind}`);
    expect(s, `a natural ${fmt} ${kind} was captured`).toBeDefined();
    return s as Sample;
  }
  function replay(s: Sample, scores: [number, number]): GameState {
    const prev: GameState = { ...s.prev, scores };
    const r = applyMove(prev, s.seat, s.intent);
    expect(r.success, `${s.label}: replay accepted (${r.error ?? ""})`).toBe(true);
    return r.newState;
  }

  for (const fmt of ["1v1", "2v2"]) {
    for (const kind of ["domino", "capicua", "tranque won by the blocker", "tranque won by the rival", "tranque tie to the opener"]) {
      it(`${fmt} ${kind}: one point short is round_over, the exact total is finished`, () => {
        const s = sample(fmt, kind);
        const team = s.next.lastCalloutPayload!.winningTeam;
        const pts = s.next.scores[team] - s.prev.scores[team];
        const target = s.prev.targetScore;
        // Only the round winner scores; the other side sits just below the
        // target in both runs and must never be named the winner.
        const at = (mine: number): [number, number] =>
          team === 0 ? [mine, target - 1] : [target - 1, mine];
        if (pts > 0) {
          const short = replay(s, at(target - pts - 1));
          expect(short.phase, `${s.label}: one point short`).toBe("round_over");
          expect(short.winnerTeam).toBeNull();
          expect(short.scores[team]).toBe(target - 1);
        }
        const exact = replay(s, at(target - pts));
        expect(exact.phase, `${s.label}: exact total`).toBe("finished");
        expect(exact.winnerTeam).toBe(team);
        expect(exact.scores[team]).toBe(target);
        expect(exact.scores[1 - team]).toBe(target - 1);
        expect(startNewRound(exact, exact.players, FORBIDDEN_RNG)).toBe(exact);
      });
    }
  }

  for (const kind of ["pase corrido", "pase de salida"]) {
    it(`2v2 ${kind}: pays at 26 short, a plain move at 25 short, and never ends the game`, () => {
      const s = sample("2v2", kind);
      const team = s.next.lastCalloutPayload!.winningTeam;
      const target = s.prev.targetScore;
      const at = (mine: number): [number, number] => (team === 0 ? [mine, target - 1] : [target - 1, mine]);

      const paid = replay(s, at(target - 26));
      expect(paid.lastCallout, `${s.label}: 26 short pays`).toBe("veinticinco");
      expect(paid.scores[team]).toBe(target - 1);
      expect(paid.phase).toBe("playing");
      expect(paid.winnerTeam).toBeNull();

      for (const mine of [target - 25, target - 1]) {
        const plain = replay(s, at(mine));
        expect(plain.lastCallout, `${s.label}: ${target - mine} short is a plain move`).toBeNull();
        expect(plain.scores).toEqual(at(mine));
        expect(plain.phase).toBe("playing");
        expect(plain.winnerTeam).toBeNull();
        expect(plain.currentTurn).toBe(s.next.currentTurn);
        // The table plays on: the seat on turn still has a move.
        expect(acceptedIntents(plain, plain.currentTurn).length).toBeGreaterThan(0);
      }
    });
  }
});
