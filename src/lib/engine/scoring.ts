import type { GameState, Seat, Tile } from "./types";
import { getTeam } from "./types";

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
    if (getTeam(seat) === team) {
      return sum + handPips(state.hands[seat] ?? []);
    }
    return sum;
  }, 0);
}

/**
 * DOMINÓ: winner gets opponent(s) remaining pips
 */
export function scoreDomino(state: GameState, winningTeam: 0 | 1): number {
  const oppTeam = winningTeam === 0 ? 1 : 0;
  return teamPips(state, oppTeam);
}

/**
 * TRANCAO: lower total wins; score = difference. Tie → starter wins (0 pts)
 */
export function scoreTrancao(state: GameState): { winnerTeam: 0 | 1; pts: number } {
  const team0 = teamPips(state, 0);
  const team1 = teamPips(state, 1);
  const starterTeam = getTeam(state.starterThisRound);
  if (team0 < team1) return { winnerTeam: 0, pts: team1 - team0 };
  if (team1 < team0) return { winnerTeam: 1, pts: team0 - team1 };
  return { winnerTeam: starterTeam, pts: 0 };
}

/**
 * CAPICÚA: +25 bonus. Only when DOMINÓ + both ends match + tile not double + no blank.
 */
export function isCapicua(
  board: Tile[],
  lastTile: Tile
): boolean {
  if (board.length === 0) return false;
  const leftEnd = board[0][0];
  const rightEnd = board[board.length - 1][1];
  if (leftEnd !== rightEnd) return false;
  if (lastTile[0] === lastTile[1]) return false; // double
  if (lastTile[0] === 0 || lastTile[1] === 0) return false; // blank
  return true;
}

export const CAPICUA_BONUS = 25;
export const VEINTICINCO_BONUS = 25;
