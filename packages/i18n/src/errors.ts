// Maps the fixed English messages the API and engine return into string
// keys, so every client shows failures in the player's language.

export type ErrorKey =
  | "gameNotFound"
  | "connectionError"
  | "errMoveFailed"
  | "errNotYourTurn"
  | "errMustPlay"
  | "errMustDraw"
  | "errTileMismatch"
  | "errStale"
  | "errNotAtTable"
  | "errGameFull"
  | "errGameStarted"
  | "errNotInPlay";

const EXACT: Record<string, ErrorKey> = {
  "Not your turn": "errNotYourTurn",
  "Must play if you have a legal move": "errMustPlay",
  "Must draw from the boneyard first": "errMustDraw",
  "Tile does not match left end": "errTileMismatch",
  "Tile does not match right end": "errTileMismatch",
  "Tile not in hand": "errTileMismatch",
  "Game is not in play": "errNotInPlay",
  "Game is not in round_over state": "errNotInPlay",
  "Game not found": "gameNotFound",
  "Player not found": "errNotAtTable",
  "Seat mismatch": "errNotAtTable",
  "Player not in this game": "errNotAtTable",
  "Game is full": "errGameFull",
  "Game already started": "errGameStarted",
  "State is stale - refetch": "errStale",
  "State conflict - refetch": "errStale",
  "Connection error": "connectionError",
};

export function errorKeyFor(message: unknown, fallback: ErrorKey = "errMoveFailed"): ErrorKey {
  if (typeof message !== "string") return fallback;
  return EXACT[message] ?? fallback;
}
