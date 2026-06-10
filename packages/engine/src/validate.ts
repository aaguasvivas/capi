import type { GameState, Seat, Tile, MoveIntent } from "./types";

function tileEqual(a: Tile, b: Tile): boolean {
  return (
    (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])
  );
}

function tileInHand(hand: Tile[], tile: Tile): boolean {
  return hand.some((t) => tileEqual(t, tile));
}

function tileMatchesEnd(tile: Tile, endPip: number): boolean {
  return tile[0] === endPip || tile[1] === endPip;
}

function getLeftEnd(board: Tile[]): number {
  if (board.length === 0) return -1;
  return board[0][0];
}

function getRightEnd(board: Tile[]): number {
  if (board.length === 0) return -1;
  return board[board.length - 1][1];
}

export function hasLegalPlay(hand: Tile[], board: Tile[]): boolean {
  if (board.length === 0) return hand.length > 0;
  const left = getLeftEnd(board);
  const right = getRightEnd(board);
  return hand.some(
    (t) => tileMatchesEnd(t, left) || tileMatchesEnd(t, right)
  );
}

export function validateMove(
  state: GameState,
  seat: Seat,
  intent: MoveIntent
): string | null {
  if (state.phase !== "playing") {
    return "Game is not in play";
  }
  if (state.currentTurn !== seat) {
    return "Not your turn";
  }

  const hand = state.hands[seat] ?? [];

  if (intent.type === "play") {
    if (!intent.tile || intent.end === undefined) {
      return "Play requires tile and end";
    }
    if (!tileInHand(hand, intent.tile)) {
      return "Tile not in hand";
    }
    if (state.board.length === 0) {
      return null;
    }
    const left = getLeftEnd(state.board);
    const right = getRightEnd(state.board);
    const matchesLeft = tileMatchesEnd(intent.tile, left);
    const matchesRight = tileMatchesEnd(intent.tile, right);
    if (intent.end === "left" && !matchesLeft) return "Tile does not match left end";
    if (intent.end === "right" && !matchesRight) return "Tile does not match right end";
    return null;
  }

  if (intent.type === "draw") {
    if (state.is2v2) {
      return "Draw is not allowed in 2v2 (no boneyard)";
    }
    if (state.boneyard.length === 0) {
      return "Boneyard is empty";
    }
    if (hasLegalPlay(hand, state.board)) {
      return "Must play if you have a legal move";
    }
    return null;
  }

  if (intent.type === "pass") {
    if (hasLegalPlay(hand, state.board)) {
      return "Must play if you have a legal move";
    }
    if (!state.is2v2 && state.boneyard.length > 0) {
      return "Must draw from the boneyard first";
    }
    return null;
  }

  return "Invalid move type";
}
