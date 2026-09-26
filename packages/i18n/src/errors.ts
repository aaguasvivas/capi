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
  | "errNotInPlay"
  | "errClaimTooEarly"
  | "errClaimOwnSide"
  | "errClaimTurnBased"
  | "errRematchNotFinished"
  | "errNicknameRequired"
  | "errServer"
  | "failedRematch"
  | "failedCreate"
  | "failedJoin";

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
  "Too early to claim": "errClaimTooEarly",
  "No move on record yet": "errClaimTooEarly",
  "Your side is on turn": "errClaimOwnSide",
  "Claim is not available in turn-based games": "errClaimTurnBased",
  "Game is not finished": "errRematchNotFinished",
  "Failed to create rematch": "failedRematch",
  "Nickname is required": "errNicknameRequired",
  "Player not in game": "errNotAtTable",
  "Failed to join game": "failedJoin",
  "Failed to create game": "failedCreate",
  "Failed to create player": "failedCreate",
  "Game has no host": "gameNotFound",
  "Internal server error": "errServer",
  "Connection error": "connectionError",
};

export function errorKeyFor(message: unknown, fallback: ErrorKey = "errMoveFailed"): ErrorKey {
  if (typeof message !== "string") return fallback;
  return EXACT[message] ?? fallback;
}
