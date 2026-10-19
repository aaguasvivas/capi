// The waiting room's Refresh link reports what the fetch found. Pure module
// so it unit-tests without React Native.

// The link reads "Checking" at least this long, so a fast answer still shows.
export const REFRESH_MIN_MS = 700;
// How long the outcome stays in place of the link text.
export const REFRESH_NOTE_MS = 3000;

interface SeatHolder {
  id: string;
  seat: string;
}

function seatsKey(players: readonly SeatHolder[]): string {
  return players
    .map((p) => `${p.seat}:${p.id}`)
    .sort()
    .join(",");
}

// A failed fetch says so. A fetch that changed a seat needs no note: the new
// player is on screen. Otherwise the player learns nobody has joined yet.
export function refreshOutcome(
  ok: boolean,
  before: readonly SeatHolder[],
  after: readonly SeatHolder[]
): "networkError" | "refreshNoChange" | null {
  if (!ok) return "networkError";
  return seatsKey(before) === seatsKey(after) ? "refreshNoChange" : null;
}
