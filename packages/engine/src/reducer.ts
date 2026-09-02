import type { GameState, Seat, Tile, MoveIntent, MoveResult } from "./types";
import {
  getNextSeat,
  getTeam,
  getSeatsForGame,
} from "./types";
import { validateMove, hasLegalPlay } from "./validate";
import {
  scoreDomino,
  scoreTrancao,
  isCapicua,
  handPips,
  teamPips,
  CAPICUA_BONUS,
  VEINTICINCO_BONUS,
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

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function tileEqual(a: Tile, b: Tile): boolean {
  return (
    (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])
  );
}

function removeTileFromHand(hand: Tile[], tile: Tile): Tile[] {
  const idx = hand.findIndex((t) => tileEqual(t, tile));
  if (idx < 0) return hand;
  return [...hand.slice(0, idx), ...hand.slice(idx + 1)];
}

function placeTileOnBoard(
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
}): GameState {
  const { mode, theme, is2v2, targetScore = 100 } = params;
  const seats = getSeatsForGame(is2v2);
  const shuffled = shuffle(ALL_TILES);
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

function endRoundWithDomino(
  state: GameState,
  winningTeam: 0 | 1,
  lastTile: Tile
): GameState {
  let pts = scoreDomino(state, winningTeam);
  let callout: MoveResult["callout"] = "domino";
  const payload: Record<string, unknown> = {
    winningTeam,
    pipsAwarded: pts,
    team0Pips: teamPips(state, 0),
    team1Pips: teamPips(state, 1),
  };

  if (isCapicua(state.board, lastTile)) {
    pts += CAPICUA_BONUS;
    callout = "capicua";
    payload.capicuaBonus = CAPICUA_BONUS;
  }

  const newScores: [number, number] = [
    state.scores[0] + (winningTeam === 0 ? pts : 0),
    state.scores[1] + (winningTeam === 1 ? pts : 0),
  ];
  const winner =
    newScores[0] >= state.targetScore || newScores[1] >= state.targetScore
      ? (newScores[0] >= state.targetScore ? 0 : 1)
      : null;

  return {
    ...state,
    phase: winner !== null ? "finished" : "round_over",
    scores: newScores,
    winnerTeam: winner,
    lastCallout: callout,
    lastCalloutPayload: payload,
  };
}

function endRoundWithTrancao(state: GameState): GameState {
  const { winnerTeam, pts } = scoreTrancao(state);
  const newScores: [number, number] = [
    state.scores[0] + (winnerTeam === 0 ? pts : 0),
    state.scores[1] + (winnerTeam === 1 ? pts : 0),
  ];
  const winner =
    newScores[0] >= state.targetScore || newScores[1] >= state.targetScore
      ? (newScores[0] >= state.targetScore ? 0 : 1)
      : null;

  return {
    ...state,
    phase: winner !== null ? "finished" : "round_over",
    scores: newScores,
    winnerTeam: winner,
    lastCallout: "trancao",
    lastCalloutPayload: {
      winningTeam: winnerTeam,
      pts,
      team0Pips: teamPips(state, 0),
      team1Pips: teamPips(state, 1),
    },
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
    const newBoard = placeTileOnBoard(state.board, intent.tile, intent.end);

    const wentOut = newHand.length === 0;
    const winningTeam = getTeam(seat, state.is2v2);

    if (wentOut) {
      // Record who went out BEFORE ending the round: getRoundWinningSeat reads
      // lastPlayedBy to decide who leads the next round (the DOMINÓ/CAPICÚA
      // winner). Without this the field keeps the *previous* player's seat and
      // the loser would start next round.
      const newState = endRoundWithDomino(
        {
          ...state,
          hands: { ...state.hands, [seat]: newHand },
          board: newBoard,
          lastPlayedBy: seat,
        },
        winningTeam,
        intent.tile
      );
      return {
        success: true,
        newState,
        callout: newState.lastCallout ?? undefined,
        calloutPayload: newState.lastCalloutPayload ?? undefined,
      };
    }

    const nextTurn = getNextSeat(seat, state.is2v2);
    const newState: GameState = {
      ...state,
      hands: { ...state.hands, [seat]: newHand },
      board: newBoard,
      currentTurn: nextTurn,
      consecutivePasses: 0,
      passesSinceLastPlay: 0,
      lastPlayedBy: seat,
      // Clear any mid-round VEINTICINCO callout once play resumes.
      lastCallout: null,
      lastCalloutPayload: null,
    };
    return { success: true, newState };
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
    const passThreshold = state.is2v2 ? 4 : 2;
    const veinticincoThreshold = state.is2v2 ? 3 : 1;
    const nextTurn = getNextSeat(seat, state.is2v2);

    // VEINTICINCO ("pase corrido"): the cycle of forced passes returns to
    // `lastPlayedBy`. Award +25 to their team as a MID-ROUND bonus; the
    // round does NOT end. `lastPlayedBy` gets the next turn and must play
    // (or pass, which can stack into a TRANCAO below). VEINTICINCO can fire
    // multiple times in one round if the same player keeps forcing
    // pass-arounds with subsequent plays.
    if (
      state.lastPlayedBy !== null &&
      nextTurn === state.lastPlayedBy &&
      newPassesSincePlay === veinticincoThreshold
    ) {
      const winningTeam = getTeam(state.lastPlayedBy, state.is2v2);
      const newScores: [number, number] = [
        state.scores[0] + (winningTeam === 0 ? VEINTICINCO_BONUS : 0),
        state.scores[1] + (winningTeam === 1 ? VEINTICINCO_BONUS : 0),
      ];
      const winner =
        newScores[0] >= state.targetScore || newScores[1] >= state.targetScore
          ? (newScores[0] >= state.targetScore ? 0 : 1)
          : null;
      const payload: Record<string, unknown> = {
        winningTeam,
        veinticincoBonus: VEINTICINCO_BONUS,
        team0Pips: teamPips(state, 0),
        team1Pips: teamPips(state, 1),
      };
      const newState: GameState = {
        ...state,
        scores: newScores,
        currentTurn: nextTurn, // = lastPlayedBy, who must now play or pass
        consecutivePasses: newConsecutive,
        passesSinceLastPlay: newPassesSincePlay,
        lastCallout: "veinticinco",
        lastCalloutPayload: payload,
        winnerTeam: winner,
        phase: winner !== null ? "finished" : "playing",
      };
      return {
        success: true,
        newState,
        callout: "veinticinco",
        calloutPayload: payload,
      };
    }

    // TRANCAO: pass threshold reached. The board is truly locked because
    // nobody (including `lastPlayedBy`, whose pass got us here) can play.
    // The +25 from any preceding VEINTICINCO is already banked in state.scores;
    // TRANCAO adds pip-diff scoring on top.
    if (newConsecutive >= passThreshold) {
      const newState = endRoundWithTrancao({
        ...state,
        consecutivePasses: newConsecutive,
      });
      return {
        success: true,
        newState,
        callout: "trancao",
        calloutPayload: newState.lastCalloutPayload ?? undefined,
      };
    }

    // Normal pass: advance turn, no end-of-round event. Clear any prior
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
 * DOMINÓ/CAPICÚA/VEINTICINCO → the player who last played.
 * TRANCAO → the player with fewest individual pips on the winning team.
 */
function getRoundWinningSeat(state: GameState): Seat {
  const callout = state.lastCallout;

  if (callout === "domino" || callout === "capicua" || callout === "veinticinco") {
    return state.lastPlayedBy ?? state.starterThisRound;
  }

  if (callout === "trancao") {
    const winningTeam = (state.lastCalloutPayload?.winningTeam as number) ?? 0;
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
  existingPlayers: Record<Seat, GameState["players"][Seat]>
): GameState {
  const starter = getRoundWinningSeat(state);
  const seats = getSeatsForGame(state.is2v2);
  const shuffled = shuffle(ALL_TILES);
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
