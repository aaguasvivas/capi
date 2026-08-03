// The iMessage extension seats a player natively (create/join over REST) and
// hands the session to this webview via URL fragment: #s=<playerId>.<seat>
// A fragment never reaches server logs. The page stores it under the same
// localStorage key the create/join forms use, then strips the hash.
const SEATS = new Set(["n", "e", "s", "w"]);

export interface EmbedSession {
  playerId: string;
  seat: string;
  gameId: string;
}

export function parseSessionFragment(hash: string, gameId: string): EmbedSession | null {
  const m = /^#s=([^.]+)\.([nesw])$/.exec(hash ?? "");
  if (!m || !SEATS.has(m[2])) return null;
  return { playerId: m[1], seat: m[2], gameId };
}
