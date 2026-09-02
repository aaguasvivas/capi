// Dominican Dominoes Game Engine Types

export type Pip = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Tile = [Pip, Pip];

export type Seat = "n" | "e" | "s" | "w";
export type GameMode = "live" | "turn_based";
export type Theme =
  | "barberia"
  | "colmado"
  | "patio"
  | "quisqueya"
  | "larimar"
  | "noche";

export type CalloutType = "domino" | "trancao" | "capicua" | "veinticinco";

export interface PlayerInfo {
  seat: Seat;
  nickname: string;
  avatarColor: string;
  team: 0 | 1;
}

export interface GameState {
  phase: "waiting" | "playing" | "round_over" | "finished";
  mode: GameMode;
  theme: Theme;
  is2v2: boolean;
  targetScore: number;
  scores: [number, number];
  roundIndex: number;
  hands: Record<Seat, Tile[]>;
  board: Tile[];
  boneyard: Tile[];
  currentTurn: Seat;
  consecutivePasses: number;
  passesSinceLastPlay: number;
  starterThisRound: Seat;
  lastCallout: CalloutType | null;
  lastCalloutPayload: Record<string, unknown> | null;
  players: Record<Seat, PlayerInfo | null>;
  winnerTeam: number | null;
  lastPlayedBy: Seat | null;
  // Set on a finished game once any player asks for a rematch: the id of the
  // new table every seat can arrive at (same seats, same names).
  rematchGameId?: string;
}

export interface MoveIntent {
  type: "play" | "pass" | "draw";
  tile?: Tile;
  end?: "left" | "right";
}

export interface MoveResult {
  success: boolean;
  newState: GameState;
  error?: string;
  callout?: CalloutType;
  calloutPayload?: Record<string, unknown>;
}

const SEAT_ORDER: Seat[] = ["n", "e", "s", "w"];

export function getNextSeat(seat: Seat, is2v2: boolean): Seat {
  const order: Seat[] = is2v2 ? SEAT_ORDER : ["n", "s"];
  const idx = order.indexOf(seat);
  const nextIdx = (idx + 1) % order.length;
  return order[nextIdx];
}

export function getSeatsForGame(is2v2: boolean): Seat[] {
  return is2v2 ? ["n", "e", "s", "w"] : ["n", "s"];
}

export function getTeam(seat: Seat, is2v2: boolean): 0 | 1 {
  if (is2v2) return seat === "n" || seat === "s" ? 0 : 1;
  return seat === "n" ? 0 : 1;
}

export function getOpponentTeam(team: 0 | 1): 0 | 1 {
  return team === 0 ? 1 : 0;
}

// Open pips at each end of the chain; -1 when the table is empty.
export function boardEnds(board: Tile[]): { left: number; right: number } {
  if (board.length === 0) return { left: -1, right: -1 };
  return { left: board[0][0], right: board[board.length - 1][1] };
}

// Seats around the table relative to mine: partner across, opponents on the
// sides, so every player sees themselves at the bottom.
export function getRelativeSeats(mySeat: Seat): { top: Seat; left: Seat; right: Seat } {
  switch (mySeat) {
    case "n":
      return { top: "s", left: "w", right: "e" };
    case "e":
      return { top: "w", left: "n", right: "s" };
    case "s":
      return { top: "n", left: "e", right: "w" };
    case "w":
      return { top: "e", left: "s", right: "n" };
  }
}
