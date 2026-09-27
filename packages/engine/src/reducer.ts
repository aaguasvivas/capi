import type {
  CalloutPayload,
  GameState,
  Seat,
  Tile,
  MoveIntent,
  MoveResult,
} from "./types";
import {
  boardEnds,
  getNextSeat,
  getTeam,
  getSeatsForGame,
} from "./types";
import { validateMove, hasLegalPlay, isBoardLocked } from "./validate";
import {
  scoreDomino,
  scoreTrancao,
  isCapicua,
  handPips,
  teamPips,
  CAPICUA_BONUS,
  VEINTICINCO_BONUS,
  SALIDA_BONUS,
} from "./scoring";

const ALL_TILES: Tile[] = (() => {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push([a as Tile[0], b as Tile[1]]);
    }
  }
  return tiles;
})();

export type Rng = () => number;

// Default deal randomness: the platform CSPRNG when available (Node and every
// browser), so a deal can never be predicted from earlier deals.
export function secureRandom(): number {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function tileEqual(a: Tile, b: Tile): boolean {
  return (
    (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])
  );
}

export function removeTileFromHand(hand: Tile[], tile: Tile): Tile[] {
  const idx = hand.findIndex((t) => tileEqual(t, tile));
  if (idx < 0) return hand;
  return [...hand.slice(0, idx), ...hand.slice(idx + 1)];
}

export function placeTileOnBoard(
  board: Tile[],
  tile: Tile,
  end: "left" | "right"
): Tile[] {
  const [a, b] = tile;
  if (board.length === 0) return [[a, b]];
  if (end === "left") {
    const leftEnd = board[0][0];
    const match = a === leftEnd ? b : a;
    return [[match, leftEnd], ...board];
  } else {
    const rightEnd = board[board.length - 1][1];
    const match = a === rightEnd ? b : a;
    return [...board, [rightEnd, match]];
  }
}

function findHighestDouble(hand: Tile[]): Tile | null {
  for (let d = 6; d >= 0; d--) {
    const t = hand.find(([a, b]) => a === d && b === d);
    if (t) return t;
  }
  return null;
}

function findHighestTile(hand: Tile[]): Tile | null {
  let best: Tile | null = null;
  let bestSum = -1;
  for (const t of hand) {
    const sum = t[0] + t[1];
    if (sum > bestSum) {
      best = t;
      bestSum = sum;
    }
  }
  return best;
}

export function createInitialState(params: {
  mode: GameState["mode"];
  theme: GameState["theme"];
  is2v2: boolean;
  targetScore?: number;
  // Seeded in tests for reproducible games; production uses secureRandom.
  rng?: Rng;
}): GameState {
  const { mode, theme, is2v2, targetScore = 100, rng = secureRandom } = params;
  const seats = getSeatsForGame(is2v2);
  const shuffled = shuffle(ALL_TILES, rng);
  const hands: Record<Seat, Tile[]> = {
    n: [],
    e: [],
    s: [],
    w: [],
  };
  let idx = 0;
  for (const seat of seats) {
    hands[seat] = shuffled.slice(idx, idx + 7);
    idx += 7;
  }
  const boneyard = shuffled.slice(idx);

  let starter: Seat = "n";
  let starterTile: Tile | null = null;
  for (const seat of seats) {
    const d = findHighestDouble(hands[seat]);
    if (d) {
      if (!starterTile || d[0] > starterTile[0]) {
        starter = seat;
        starterTile = d;
      }
    }
  }
  if (!starterTile) {
    let bestSum = -1;
    for (const seat of seats) {
      const t = findHighestTile(hands[seat]);
      if (t) {
        const sum = t[0] + t[1];
        if (sum > bestSum) {
          starter = seat;
          starterTile = t;
          bestSum = sum;
        }
      }
    }
  }

  if (starterTile) {
    hands[starter] = removeTileFromHand(hands[starter], starterTile);
  }

  return {
    phase: "playing",
    mode,
    theme,
    is2v2,
    targetScore,
    scores: [0, 0],
    roundIndex: 0,
    hands,
    board: starterTile ? [starterTile] : [],
    boneyard,
    currentTurn: getNextSeat(starter, is2v2),
    consecutivePasses: 0,
    passesSinceLastPlay: 0,
    starterThisRound: starter,
    lastCallout: null,
    lastCalloutPayload: null,
    players: { n: null, e: null, s: null, w: null },
    winnerTeam: null,
    lastPlayedBy: starter,
  };
}

// Bank a round's points. Only the round-winning side scores, so only that
// side can reach the target: a game is won by winning a round.
function creditRound(
  state: GameState,
  winningTeam: 0 | 1,
  pts: number
): Pick<GameState, "phase" | "scores" | "winnerTeam"> {
  const scores: [number, number] = [
    state.scores[0] + (winningTeam === 0 ? pts : 0),
    state.scores[1] + (winningTeam === 1 ? pts : 0),
  ];
  const other: 0 | 1 = winningTeam === 0 ? 1 : 0;
  const t = state.targetScore;
  // Normally only the round winner can be at the target. A game saved before
  // the pase corrido cap can hold the other side there already (the old
  // engine banked +25 past the target mid-round); that side then wins when
  // the round ends, as it did under the old engine, and a tie of two sides
  // past the target goes to the higher score, then to the round winner.
  let winnerTeam: 0 | 1 | null = null;
  if (scores[winningTeam] >= t && scores[other] >= t) {
    winnerTeam = scores[other] > scores[winningTeam] ? other : winningTeam;
  } else if (scores[winningTeam] >= t) {
    winnerTeam = winningTeam;
  } else if (scores[other] >= t) {
    winnerTeam = other;
  }
  return {
    phase: winnerTeam !== null ? "finished" : "round_over",
    scores,
    winnerTeam,
  };
}

function endRoundWithDomino(
  state: GameState,
  winningTeam: 0 | 1,
  lastTile: Tile,
  endsBefore: { left: number; right: number }
): GameState {
  let pts = scoreDomino(state, winningTeam);
  let callout: MoveResult["callout"] = "domino";
  const payload: CalloutPayload = {
    winningTeam,
    pipsAwarded: pts,
    team0Pips: teamPips(state, 0),
    team1Pips: teamPips(state, 1),
  };

  if (isCapicua(endsBefore, lastTile)) {
    pts += CAPICUA_BONUS;
    callout = "capicua";
    payload.capicuaBonus = CAPICUA_BONUS;
  }

  return {
    ...state,
    ...creditRound(state, winningTeam, pts),
    lastCallout: callout,
    lastCalloutPayload: payload,
  };
}

function endRoundWithTrancao(state: GameState, blockerSeat: Seat): GameState {
  const t = scoreTrancao(state, blockerSeat);
  return {
    ...state,
    ...creditRound(state, t.winnerTeam, t.pts),
    lastCallout: "trancao",
    lastCalloutPayload: {
      winningTeam: t.winnerTeam,
      pts: t.pts,
      team0Pips: teamPips(state, 0),
      team1Pips: teamPips(state, 1),
      blockerSeat: t.blockerSeat,
      rivalSeat: t.rivalSeat,
      blockerPips: t.blockerPips,
      rivalPips: t.rivalPips,
      winnerSeat: t.winnerSeat,
    },
  };
}

function previousSeat(seat: Seat, is2v2: boolean): Seat {
  const seats = getSeatsForGame(is2v2);
  return seats[(seats.indexOf(seat) + seats.length - 1) % seats.length];
}

function roundEnded(newState: GameState): MoveResult {
  return {
    success: true,
    newState,
    callout: newState.lastCallout ?? undefined,
    calloutPayload: newState.lastCalloutPayload ?? undefined,
  };
}

export function applyMove(
  state: GameState,
  seat: Seat,
  intent: MoveIntent
): MoveResult {
  const err = validateMove(state, seat, intent);
  if (err) {
    return { success: false, newState: state, error: err };
  }

  if (intent.type === "play" && intent.tile && intent.end !== undefined) {
    const hand = state.hands[seat] ?? [];
    const newHand = removeTileFromHand(hand, intent.tile);
    // Record who played BEFORE any round end: getRoundWinningSeat reads
    // lastPlayedBy to decide who leads after a DOMINÓ/CAPICÚA.
    const placed: GameState = {
      ...state,
      hands: { ...state.hands, [seat]: newHand },
      board: placeTileOnBoard(state.board, intent.tile, intent.end),
      lastPlayedBy: seat,
    };

    // Going out is a dominó even when the same tile locks the board.
    if (newHand.length === 0) {
      return roundEnded(
        endRoundWithDomino(
          placed,
          getTeam(seat, state.is2v2),
          intent.tile,
          boardEnds(state.board)
        )
      );
    }

    // TRANQUE: nothing outside the board fits either end any more. The round
    // ends on the spot and the player who placed the tile is the blocker.
    if (isBoardLocked(placed)) {
      return roundEnded(endRoundWithTrancao(placed, seat));
    }

    const newState: GameState = {
      ...placed,
      currentTurn: getNextSeat(seat, state.is2v2),
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      // Clear any mid-round VEINTICINCO callout once play resumes.
      lastCallout: null,
      lastCalloutPayload: null,
    };

    // PASE DE SALIDA (parejas only): the opening tile is alone on the board,
    // the seat after the opener passed on it, and the opener's partner now
    // plays. The opener's side gets +25 mid-round. If the partner passes
    // instead, nothing is paid here (a fourth pass is a pase corrido). Like
    // the pase corrido, it counts only while it leaves the side below the
    // target, and it travels as a VEINTICINCO callout marked `salida`.
    const opener = state.starterThisRound;
    if (
      state.is2v2 &&
      state.board.length === 1 &&
      state.lastPlayedBy === opener &&
      state.passesSinceLastPlay === 1 &&
      seat === getNextSeat(getNextSeat(opener, true), true)
    ) {
      const openerTeam = getTeam(opener, true);
      if (state.scores[openerTeam] + SALIDA_BONUS < state.targetScore) {
        const payload: CalloutPayload = {
          winningTeam: openerTeam,
          veinticincoBonus: SALIDA_BONUS,
          salida: true,
          team0Pips: teamPips(placed, 0),
          team1Pips: teamPips(placed, 1),
        };
        const paid: GameState = {
          ...newState,
          scores: [
            state.scores[0] + (openerTeam === 0 ? SALIDA_BONUS : 0),
            state.scores[1] + (openerTeam === 1 ? SALIDA_BONUS : 0),
          ],
          lastCallout: "veinticinco",
          lastCalloutPayload: payload,
        };
        return {
          success: true,
          newState: paid,
          callout: "veinticinco",
          calloutPayload: payload,
        };
      }
    }
    return { success: true, newState };
  }

  // A lock is caught when the locking tile is placed, so a live board is never
  // locked. A game saved before that rule can be: resolve it on the next draw
  // or pass, with the player who played last as the blocker.
  if ((intent.type === "draw" || intent.type === "pass") && isBoardLocked(state)) {
    const blocker = state.lastPlayedBy ?? previousSeat(seat, state.is2v2);
    return roundEnded(endRoundWithTrancao(state, blocker));
  }

  if (intent.type === "draw") {
    const hand = state.hands[seat] ?? [];
    const newBoneyard = [...state.boneyard];
    const newHand = [...hand];

    while (newBoneyard.length > 0) {
      const drawn = newBoneyard.pop()!;
      newHand.push(drawn);
      if (hasLegalPlay(newHand, state.board)) break;
    }

    const newState: GameState = {
      ...state,
      hands: { ...state.hands, [seat]: newHand },
      boneyard: newBoneyard,
      // Clear any mid-round VEINTICINCO callout: drawing is the active player
      // responding to the round, so the prior callout has been observed.
      lastCallout: null,
      lastCalloutPayload: null,
    };
    return { success: true, newState };
  }

  if (intent.type === "pass") {
    const newConsecutive = state.consecutivePasses + 1;
    const newPassesSincePlay = state.passesSinceLastPlay + 1;
    // Pase corrido is a parejas rule: it needs the three other seats to pass.
    // Heads-up, a pass is just a pass.
    const veinticincoThreshold = state.is2v2 ? 3 : Infinity;
    const nextTurn = getNextSeat(seat, state.is2v2);

    // VEINTICINCO ("pase corrido"): the cycle of forced passes returns to
    // `lastPlayedBy`. Award +25 to their team as a MID-ROUND bonus; the
    // round does NOT end, and `lastPlayedBy` must play next (the board is not
    // locked, and nobody else can follow). It can fire more than once in a
    // round. The bonus only counts while it leaves the team below the target:
    // a game is won by winning a round, never by a bonus. When it would reach
    // the target, the pass is a plain pass. After a pase de salida cancelled
    // by the partner's pass, the fourth pass is this pase corrido, so an
    // opening that nobody follows pays 25 once.
    if (
      state.lastPlayedBy !== null &&
      nextTurn === state.lastPlayedBy &&
      newPassesSincePlay === veinticincoThreshold
    ) {
      const winningTeam = getTeam(state.lastPlayedBy, state.is2v2);
      if (state.scores[winningTeam] + VEINTICINCO_BONUS < state.targetScore) {
        const newScores: [number, number] = [
          state.scores[0] + (winningTeam === 0 ? VEINTICINCO_BONUS : 0),
          state.scores[1] + (winningTeam === 1 ? VEINTICINCO_BONUS : 0),
        ];
        const payload: CalloutPayload = {
          winningTeam,
          veinticincoBonus: VEINTICINCO_BONUS,
          team0Pips: teamPips(state, 0),
          team1Pips: teamPips(state, 1),
        };
        const newState: GameState = {
          ...state,
          scores: newScores,
          currentTurn: nextTurn, // = lastPlayedBy, who must now play
          consecutivePasses: newConsecutive,
          passesSinceLastPlay: newPassesSincePlay,
          lastCallout: "veinticinco",
          lastCalloutPayload: payload,
        };
        return {
          success: true,
          newState,
          callout: "veinticinco",
          calloutPayload: payload,
        };
      }
    }

    // Plain pass: advance turn, no end-of-round event. Clear any prior
    // mid-round callout so it doesn't linger across the round.
    const newState: GameState = {
      ...state,
      currentTurn: nextTurn,
      consecutivePasses: newConsecutive,
      passesSinceLastPlay: newPassesSincePlay,
      lastCallout: null,
      lastCalloutPayload: null,
    };
    return { success: true, newState };
  }

  return { success: false, newState: state, error: "Invalid intent" };
}

/**
 * Determine which seat won the round and should start next.
 * DOMINÓ/CAPICÚA → the player who went out (the last to play).
 * TRANCAO → the payload's winnerSeat: the blocker or the rival, or on equal
 * pips the player who opened the round.
 */
function getRoundWinningSeat(state: GameState): Seat {
  const callout = state.lastCallout;

  if (callout === "domino" || callout === "capicua") {
    return state.lastPlayedBy ?? state.starterThisRound;
  }

  if (callout === "trancao") {
    const payload = state.lastCalloutPayload;
    if (payload?.winnerSeat) return payload.winnerSeat;
    const winningTeam = payload?.winningTeam ?? 0;
    // A tranque saved before winnerSeat existed: the compared seat on the
    // winning side opens, as it did then.
    if (payload?.blockerSeat && payload.rivalSeat) {
      return getTeam(payload.blockerSeat, state.is2v2) === winningTeam
        ? payload.blockerSeat
        : payload.rivalSeat;
    }
    // A tranque saved before the comparison fields existed: the lightest
    // hand on the winning side opens, as it did then.
    const seats = getSeatsForGame(state.is2v2);
    let bestSeat: Seat = seats[0];
    let bestPips = Infinity;
    for (const seat of seats) {
      if (getTeam(seat, state.is2v2) === winningTeam) {
        const pips = handPips(state.hands[seat] ?? []);
        if (pips < bestPips) {
          bestPips = pips;
          bestSeat = seat;
        }
      }
    }
    return bestSeat;
  }

  return state.starterThisRound;
}

/**
 * Start a new round. The winner of the previous round goes first
 * with free choice (no auto-play). Board starts empty.
 */
export function startNewRound(
  state: GameState,
  existingPlayers: Record<Seat, GameState["players"][Seat]>,
  rng: Rng = secureRandom
): GameState {
  // Only a round that actually ended can be redealt; a finished game stays
  // finished and a live round is never reshuffled underneath the players.
  if (state.phase !== "round_over") return state;
  const starter = getRoundWinningSeat(state);
  const seats = getSeatsForGame(state.is2v2);
  const shuffled = shuffle(ALL_TILES, rng);
  const hands: Record<Seat, Tile[]> = { n: [], e: [], s: [], w: [] };
  let idx = 0;
  for (const seat of seats) {
    hands[seat] = shuffled.slice(idx, idx + 7);
    idx += 7;
  }
  const boneyard = shuffled.slice(idx);

  return {
    phase: "playing",
    mode: state.mode,
    theme: state.theme,
    is2v2: state.is2v2,
    targetScore: state.targetScore,
    scores: state.scores,
    roundIndex: state.roundIndex + 1,
    hands,
    board: [],
    boneyard,
    currentTurn: starter,
    consecutivePasses: 0,
    passesSinceLastPlay: 0,
    starterThisRound: starter,
    lastCallout: null,
    lastCalloutPayload: null,
    players: existingPlayers,
    winnerTeam: null,
    lastPlayedBy: null,
  };
}
