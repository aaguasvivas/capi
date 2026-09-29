// Request shaping for the game API. Clients already enforce these on their
// forms; the server is where they become true.

export const NICKNAME_MAX = 20;
export const THEMES = ["barberia", "colmado", "patio", "quisqueya", "larimar", "noche"] as const;
export const MODES = ["live", "turn_based"] as const;

// The cut counts UTF-16 units, like every client's maxLength, but never
// splits an emoji or another character outside the BMP in two: a lone
// surrogate cannot be stored as text.
export function cleanNickname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return null;
  const cut = trimmed.slice(0, NICKNAME_MAX);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

export function cleanAvatarColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

export function isTheme(value: unknown): value is (typeof THEMES)[number] {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function isMode(value: unknown): value is (typeof MODES)[number] {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}
