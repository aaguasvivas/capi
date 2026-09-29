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
 * player. On equal pips the player who opened the round (la mano) wins, even
 * when he is neither the blocker nor the rival. The winner's side takes every
 * pip left in every hand, like a dominó, and the winner opens the next round.
 */
export function scoreTrancao(state: GameState, blockerSeat: Seat): TrancaoResult {
  const rivalSeat = getNextSeat(blockerSeat, state.is2v2);
  const blockerPips = handPips(state.hands[blockerSeat] ?? []);
  const rivalPips = handPips(state.hands[rivalSeat] ?? []);
  const winnerSeat =
    blockerPips < rivalPips
      ? blockerSeat
      : rivalPips < blockerPips
      ? rivalSeat
      : state.starterThisRound;
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
 * with ends 5 and 5 any tile with a 5 counts, the double 5-5 included. A
 * double fits both ends only when both show its number, so the 2-2 on ends
 * 2 and 5 is a plain dominó (owner decision of 2026-09-28).
 */
export function isCapicua(
  endsBefore: { left: number; right: number },
  lastTile: Tile
): boolean {
  const [a, b] = lastTile;
  const fits = (end: number) => a === end || b === end;
  return fits(endsBefore.left) && fits(endsBefore.right);
}

export const CAPICUA_BONUS = 25;
export const VEINTICINCO_BONUS = 25;
// Pase de salida: the opener's side, when the seat after him passes on the
// opening tile and his partner then plays (2v2 only).
export const SALIDA_BONUS = 25;
