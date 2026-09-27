import { describe, it, expect, afterEach, vi } from "vitest";
import { createInitialState, applyMove, startNewRound } from "../src/reducer";
import { hasLegalPlay } from "../src/validate";
import { handPips, CAPICUA_BONUS, VEINTICINCO_BONUS, SALIDA_BONUS } from "../src/scoring";
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

// Recomputed here from first principles, not through the engine's helpers:
// the board is locked when no tile in any hand or the boneyard fits an end.
function boardLocked(state: GameState): boolean {
  if (state.board.length === 0) return false;
  const left = state.board[0][0];
  const right = state.board[state.board.length - 1][1];
  const outside = [...(["n", "e", "s", "w"] as Seat[]).flatMap((s) => state.hands[s] ?? []), ...state.boneyard];
  return !outside.some((t) => t[0] === left || t[1] === left || t[0] === right || t[1] === right);
}

// Tranque comparison, recomputed: the blocker against the next seat, fewer
// pips wins, a tie goes to the player who opened the round.
function expectedTranque(ended: GameState, blocker: Seat): { winnerSeat: Seat; rival: Seat } {
  const rival = getNextSeat(blocker, ended.is2v2);
  const bp = handPips(ended.hands[blocker] ?? []);
  const rp = handPips(ended.hands[rival] ?? []);
  const winnerSeat = bp < rp ? blocker : rp < bp ? rival : ended.starterThisRound;
  return { winnerSeat, rival };
}

// Pase de salida shape, recomputed before a move: parejas, the opening tile
// alone on the board, and exactly one pass since the opener placed it. The
// seat that acts next in that shape is the opener's partner (across the table).
function salidaShape(prev: GameState): boolean {
  return (
    prev.is2v2 &&
    prev.board.length === 1 &&
    prev.lastPlayedBy === prev.starterThisRound &&
    prev.passesSinceLastPlay === 1
  );
}
function partnerOf(seat: Seat): Seat {
  const order: Seat[] = ["n", "e", "s", "w"];
  return order[(order.indexOf(seat) + 2) % 4];
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

// How often the seeded games reached each rule path. An invariant that never
// fires proves nothing, so each suite checks that its paths were exercised.
const reached = new Map<string, number>();
function reach(path: string): void {
  reached.set(path, (reached.get(path) ?? 0) + 1);
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

  // The engine's own +25 callouts, read from its output (every move clears
  // the previous callout, so a veinticinco here was set by this move).
  if (next.lastCallout === "veinticinco") {
    reach(next.lastCalloutPayload?.salida ? "engine paid a salida" : "engine paid a pase corrido");
  }

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

  // Phase machine consistency. Only a round win scores enough to reach the
  // target, so while no side has won the game both sit below it.
  if (next.phase === "finished") {
    expect(next.winnerTeam, L("finished has winner")).not.toBeNull();
    expect(["domino", "capicua", "trancao"], L("game ends on a round end")).toContain(next.lastCallout);
    expect(next.winnerTeam, L("game goes to the round winner")).toBe(next.lastCalloutPayload?.winningTeam);
    expect(
      next.scores[next.winnerTeam as 0 | 1],
      L("winner reached target")
    ).toBeGreaterThanOrEqual(next.targetScore);
  } else {
    expect(next.winnerTeam, L("no winner before the game ends")).toBeNull();
    for (const team of [0, 1] as const) {
      expect(next.scores[team], L("scores stay below target until a round wins it")).toBeLessThan(next.targetScore);
    }
  }
  if (next.phase === "playing") {
    // A lock ends the round on placement, so a live board is never locked
    // and passes never go all the way around the table.
    expect(boardLocked(next), L("live board is never locked")).toBe(false);
    expect(next.consecutivePasses, L("passes never complete a cycle")).toBeLessThan(
      getSeatsForGame(next.is2v2).length
    );
  } else if (next.phase === "round_over") {
    expect(["domino", "capicua", "trancao"]).toContain(next.lastCallout);
  }

  const delta0 = next.scores[0] - prev.scores[0];
  const delta1 = next.scores[1] - prev.scores[1];
  const allPips = getSeatsForGame(next.is2v2).reduce(
    (sum, s) => sum + handPips(next.hands[s] ?? []),
    0
  );

  if (intent.type === "play") {
    // Actor's hand shrank by exactly the played tile; others untouched.
    expect(next.hands[seat].length, L("hand shrank by 1")).toBe(prev.hands[seat].length - 1);
    for (const s of getSeatsForGame(prev.is2v2)) {
      if (s !== seat) expect(next.hands[s], L(`hand ${s} untouched`)).toEqual(prev.hands[s]);
    }
    expect(next.lastPlayedBy, L("lastPlayedBy updated")).toBe(seat);
    if (next.phase === "playing") {
      expect(next.currentTurn, L("turn advances after play")).toBe(getNextSeat(seat, prev.is2v2));
      expect(next.consecutivePasses, L("play resets passes")).toBe(0);
      // Pase de salida: the opener's partner plays after the next seat passed
      // on the opening tile. It pays 25 to the opener's side while that leaves
      // the side below the target. Any other mid-round play scores nothing.
      const salida = salidaShape(prev) && seat === partnerOf(prev.starterThisRound);
      const team = getTeam(prev.starterThisRound, prev.is2v2);
      const paid = salida && prev.scores[team] + SALIDA_BONUS < prev.targetScore;
      if (salida) reach(paid ? "pase de salida paid" : "pase de salida not paid at the target");
      if (paid) {
        expect(next.lastCallout, L("pase de salida travels as veinticinco")).toBe("veinticinco");
        expect(next.lastCalloutPayload, L("pase de salida payload")).toMatchObject({
          winningTeam: team,
          veinticincoBonus: SALIDA_BONUS,
          salida: true,
        });
        expect(team === 0 ? delta0 : delta1, L("pase de salida pays 25")).toBe(SALIDA_BONUS);
        expect(team === 0 ? delta1 : delta0, L("pase de salida pays one side")).toBe(0);
      } else {
        expect(next.lastCallout, L("a plain play carries no callout")).toBeNull();
        expect(delta0 + delta1, L("no score change mid-round play")).toBe(0);
      }
    } else if (next.hands[seat].length === 0) {
      // Going out is a DOMINÓ, or a CAPICÚA when the tile is no double and
      // fits both ends as they were before it was placed. It wins over a lock.
      const tile = intent.tile as Tile;
      const left = prev.board.length > 0 ? prev.board[0][0] : -1;
      const right = prev.board.length > 0 ? prev.board[prev.board.length - 1][1] : -1;
      const fits = (end: number) => tile[0] === end || tile[1] === end;
      const capicua = tile[0] !== tile[1] && fits(left) && fits(right);
      expect(next.lastCallout, L("capicúa iff the last tile fits both ends")).toBe(
        capicua ? "capicua" : "domino"
      );
      if (capicua) reach(left === right ? "capicua on equal ends" : "capicua");
      const winningTeam = getTeam(seat, prev.is2v2);
      const losingDelta = winningTeam === 0 ? delta1 : delta0;
      const winningDelta = winningTeam === 0 ? delta0 : delta1;
      expect(losingDelta, L("loser scores nothing on domino")).toBe(0);
      const expected = allPips + (capicua ? CAPICUA_BONUS : 0);
      expect(winningDelta, L("domino awards remaining pips (+bonus once)")).toBe(expected);
    } else {
      // TRANQUE on placement: the player who placed the tile is the blocker.
      expect(next.lastCallout, L("a round that ends with tiles in hand is a tranque")).toBe("trancao");
      expect(boardLocked(next), L("tranque only on a locked board")).toBe(true);
      const { winnerSeat, rival } = expectedTranque(next, seat);
      const winner = getTeam(winnerSeat, next.is2v2);
      const payload = next.lastCalloutPayload;
      expect(payload?.blockerSeat, L("blocker is the placer")).toBe(seat);
      expect(payload?.rivalSeat, L("rival is the next seat")).toBe(rival);
      expect(payload?.blockerPips, L("blocker pips")).toBe(handPips(next.hands[seat]));
      expect(payload?.rivalPips, L("rival pips")).toBe(handPips(next.hands[rival]));
      expect(payload?.winningTeam, L("lighter of blocker and rival wins")).toBe(winner);
      expect(payload?.capicuaBonus, L("no capicúa on a tranque")).toBeUndefined();
      // A tranque pays every pip left in the hands to the winning side.
      expect(payload?.pts, L("trancao pts = every pip in the hands")).toBe(allPips);
      expect(winner === 0 ? delta0 : delta1, L("trancao credits winner")).toBe(allPips);
      expect(winner === 0 ? delta1 : delta0, L("trancao pays one side")).toBe(0);
      expect(payload?.winnerSeat, L("tranque names its winner")).toBe(winnerSeat);
      const tie = payload?.blockerPips === payload?.rivalPips;
      if (tie) {
        reach("tranque tie");
        if (winnerSeat !== seat && winnerSeat !== rival) reach("tranque tie won by an opener who did not compare");
      } else {
        reach(winnerSeat === seat ? "tranque won by blocker" : "tranque won by rival");
      }
    }
  }

  if (intent.type === "draw") {
    const gained = next.hands[seat].length - prev.hands[seat].length;
    const consumed = prev.boneyard.length - next.boneyard.length;
    expect(next.phase, L("a draw never ends the round")).toBe("playing");
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
    expect(next.phase, L("a pass never ends the round")).toBe("playing");
    expect(next.hands[seat], L("pass leaves hand untouched")).toEqual(prev.hands[seat]);
    expect(next.board, L("pass leaves board untouched")).toEqual(prev.board);
    expect(next.currentTurn, L("pass advances turn")).toBe(getNextSeat(seat, prev.is2v2));
    // Pase corrido: the third pass in a row after a play returns the turn to
    // the player who made it. It pays 25 to his side only while that leaves
    // the side below the target; otherwise the pass is plain.
    const forcer = prev.lastPlayedBy;
    const cycle =
      prev.is2v2 &&
      forcer !== null &&
      next.currentTurn === forcer &&
      prev.passesSinceLastPlay + 1 === 3;
    const team = forcer ? getTeam(forcer, prev.is2v2) : 0;
    const paid = cycle && prev.scores[team] + VEINTICINCO_BONUS < prev.targetScore;
    if (cycle) reach(paid ? "pase corrido paid" : "pase corrido not paid at the target");
    // The partner's pass cancels the pase de salida; if the fourth seat then
    // passes too, the pase corrido pays the opening 25 once.
    if (salidaShape(prev) && seat === partnerOf(prev.starterThisRound)) {
      reach("pase de salida cancelled by the partner");
    }
    if (paid && prev.board.length === 1 && forcer === prev.starterThisRound) {
      reach("salida cancelled then pase corrido");
    }
    if (paid) {
      expect(next.lastCallout, L("pase corrido fires")).toBe("veinticinco");
      expect(team === 0 ? delta0 : delta1, L("veinticinco pays 25")).toBe(VEINTICINCO_BONUS);
      expect(team === 0 ? delta1 : delta0, L("veinticinco pays one side")).toBe(0);
    } else {
      expect(next.lastCallout, L("no pase corrido")).toBeNull();
      expect(delta0 + delta1, L("plain pass never scores")).toBe(0);
    }
  }
}

/** Expected starter of the next round, recomputed independently. */
function expectedNextStarter(ended: GameState): Seat {
  const lastPlayer = (ended.lastPlayedBy ?? ended.starterThisRound) as Seat;
  if (ended.lastCallout === "domino" || ended.lastCallout === "capicua") return lastPlayer;
  // trancao: whoever won the comparison, the blocker (who placed the locking
  // tile, the last player) or the rival on his right.
  return expectedTranque(ended, lastPlayer).winnerSeat;
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

  const SHARED_PATHS = [
    "capicua",
    "capicua on equal ends",
    "tranque won by blocker",
    "tranque won by rival",
    "tranque tie",
  ];
  // Parejas rules. The oracle tallies these only in 2v2, so they are checked
  // for reach in the 2v2 runs only.
  const PAREJAS_PATHS = [
    "pase corrido paid",
    "pase corrido not paid at the target",
    "pase de salida paid",
    "pase de salida cancelled by the partner",
    "pase de salida not paid at the target",
    "salida cancelled then pase corrido",
    "tranque tie won by an opener who did not compare",
  ];
  // The engine's +25 callouts, tallied from its output, not the oracle's.
  const ENGINE_BONUS_PATHS = ["engine paid a pase corrido", "engine paid a salida"];

  it("1v1: 60 seeded games hold every invariant at every step", () => {
    reached.clear();
    for (let i = 0; i < 60; i++) {
      playFullGame({ seed: 1000 + i, is2v2: false, targetScore: TARGETS[i % TARGETS.length] });
    }
    for (const path of SHARED_PATHS) expect(reached.has(path), `1v1 seeds reach: ${path}`).toBe(true);
    // Heads-up the engine pays no +25 mid-round. The salida shape does not
    // come up in these deals (the next seat draws instead of passing), so
    // rules.salida-and-tie.test.ts covers a heads-up pass on the opening tile.
    for (const path of ENGINE_BONUS_PATHS) expect(reached.has(path), `never heads-up: ${path}`).toBe(false);
  });

  // Deals where the holder of the 6-6 holds all seven sixes: the only way
  // nobody follows the opening tile without locking the board, so the
  // partner's pass is followed by the pase corrido. Found by a seed search
  // (about one deal in 300,000).
  const WHOLE_SUIT_SEEDS = [59313, 83322, 282144, 645301];

  it("2v2: 64 seeded games hold every invariant at every step", () => {
    reached.clear();
    for (let i = 0; i < 60; i++) {
      playFullGame({ seed: 2000 + i, is2v2: true, targetScore: TARGETS[i % TARGETS.length] });
    }
    WHOLE_SUIT_SEEDS.forEach((seed, i) => {
      playFullGame({ seed, is2v2: true, targetScore: [100, 50, 200, 25][i] });
    });
    for (const path of [...SHARED_PATHS, ...PAREJAS_PATHS, ...ENGINE_BONUS_PATHS]) {
      expect(reached.has(path), `2v2 seeds reach: ${path}`).toBe(true);
    }
  });

  // The pase de salida lives in the opening, so this drill replays many round
  // openings: the auto-placed 6-6 of round 1 and a free opening dealt by
  // startNewRound, each from scores near and far from the target (75 + 25
  // lands exactly on it).
  it("2v2: 2000 seeded round openings hold every invariant", () => {
    reached.clear();
    const SCORES: [number, number][] = [[0, 0], [74, 0], [0, 74], [75, 75], [40, 90]];
    const seats = getSeatsForGame(true);
    for (let i = 0; i < 1000; i++) {
      const seed = 50000 + i;
      const dealRng = mulberry32(seed);
      const choiceRng = mulberry32(seed ^ 0x9e3779b9);
      const scores = SCORES[i % SCORES.length];
      const first: GameState = {
        ...createInitialState({ mode: "live", theme: "patio", is2v2: true, targetScore: 100, rng: dealRng }),
        scores,
      };
      const ended: GameState = {
        ...first,
        phase: "round_over",
        lastCallout: "domino",
        lastCalloutPayload: { winningTeam: 0, team0Pips: 0, team1Pips: 0 },
        lastPlayedBy: seats[i % 4],
      };
      const free = startNewRound(ended, ended.players, dealRng);
      for (const [name, start] of [["round 1", first], ["free opening", free]] as const) {
        const label = `seed=${seed} 2v2 ${name} scores=${scores.join("-")}`;
        let state = start;
        // Play past the opening: until a third tile lands or the round ends.
        while (state.phase === "playing" && state.board.length < 3) {
          const seat = state.currentTurn;
          const intent = chooseIntent(state, choiceRng);
          deepFreeze(state);
          const result = applyMove(state, seat, intent);
          expect(result.success, `${label}: legal intent accepted (${result.error ?? ""})`).toBe(true);
          assertTransition(state, result.newState, seat, intent, label);
          state = result.newState;
        }
      }
    }
    for (const path of [
      "pase de salida paid",
      "pase de salida cancelled by the partner",
      "pase de salida not paid at the target",
      "engine paid a salida",
    ]) {
      expect(reached.has(path), `2v2 openings reach: ${path}`).toBe(true);
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
