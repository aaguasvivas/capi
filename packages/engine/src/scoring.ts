import type { GameState, Seat, Tile } from "./types";
import { getNextSeat, getTeam } from "./types";

export function tilePips(tile: Tile): number {
  return tile[0] + tile[1];
}

export function handPips(hand: Tile[]): number {
  return hand.reduce((sum, t) => sum + tilePips(t), 0);
}

export function teamPips(state: GameState, team: 0 | 1): number {
  const seats = state.is2v2
    ? (["n", "e", "s", "w"] as const)
    : (["n", "s"] as const);
  return seats.reduce((sum, seat) => {
    if (getTeam(seat, state.is2v2) === team) {
      return sum + handPips(state.hands[seat] ?? []);
    }
    return sum;
  }, 0);
}

/**
 * DOMINÓ: winner scores ALL remaining pips on the table, meaning the opposing
 * team's hands AND the winner's teammate's hand (in 2v2). The winner's own
 * hand is empty by definition (they just went out), so summing every hand
 * gives the correct total.
 *
 * In 1v1 there is no teammate, so this collapses to "opp pips" and matches
 * the simpler reading. The `winningTeam` parameter is kept for API
 * stability; it is no longer needed for the calculation itself.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function scoreDomino(state: GameState, winningTeam: 0 | 1): number {
  const seats = state.is2v2
    ? (["n", "e", "s", "w"] as const)
    : (["n", "s"] as const);
  return seats.reduce(
    (sum, seat) => sum + handPips(state.hands[seat] ?? []),
    0
  );
}

export interface TrancaoResult {
  winnerSeat: Seat;
  winnerTeam: 0 | 1;
  pts: number;
  blockerSeat: Seat;
  rivalSeat: Seat;
  blockerPips: number;
  rivalPips: number;
}

/**
 * TRANCAO (regla de patio): the blocker (the player who placed the locking
 * tile) compares the pips in his own hand with the rival, the next player to
 * his right, who is always an opponent. Fewer pips wins the round for that
 * player's side; a tie goes to the side that opened the round. The winning
 * side takes every pip left in every hand, like a dominó.
 */
export function scoreTrancao(state: GameState, blockerSeat: Seat): TrancaoResult {
  const rivalSeat = getNextSeat(blockerSeat, state.is2v2);
  const blockerPips = handPips(state.hands[blockerSeat] ?? []);
  const rivalPips = handPips(state.hands[rivalSeat] ?? []);
  const openingTeam = getTeam(state.starterThisRound, state.is2v2);
  const winnerSeat =
    blockerPips < rivalPips
      ? blockerSeat
      : rivalPips < blockerPips
      ? rivalSeat
      : getTeam(blockerSeat, state.is2v2) === openingTeam
      ? blockerSeat
      : rivalSeat;
  return {
    winnerSeat,
    winnerTeam: getTeam(winnerSeat, state.is2v2),
    pts: teamPips(state, 0) + teamPips(state, 1),
    blockerSeat,
    rivalSeat,
    blockerPips,
    rivalPips,
  };
}

/**
 * CAPICÚA: +25 bonus when the closing tile of a dominó fits both open ends
 * as they were just before it was placed. With ends 3 and 5 that is the 3-5;
 * with ends 5 and 5 any non-double with a 5 counts. A double never counts.
 */
export function isCapicua(
  endsBefore: { left: number; right: number },
  lastTile: Tile
): boolean {
  const [a, b] = lastTile;
  if (a === b) return false;
  const fits = (end: number) => a === end || b === end;
  return fits(endsBefore.left) && fits(endsBefore.right);
}

export const CAPICUA_BONUS = 25;
export const VEINTICINCO_BONUS = 25;
