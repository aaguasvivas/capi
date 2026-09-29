// The home screen's last choices (name, color, table, mode, target score),
// kept across launches. Neither call throws: a failed read starts from the
// defaults, a failed write is dropped.
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@capi/home_prefs_v1";

export interface HomePrefs<Theme extends string = string> {
  nickname: string;
  avatarColor: string;
  theme: Theme;
  is2v2: boolean;
  targetScore: 100 | 200;
}

export interface HomePrefsRules<Theme extends string> {
  colors: readonly string[];
  themes: readonly Theme[];
  maxNickname: number;
}

// Keeps only the fields that pass their checks; the screen keeps its default
// for the rest. Theme ownership is the screen's call (entitlements load later).
export function parseHomePrefs<Theme extends string>(
  raw: string | null,
  rules: HomePrefsRules<Theme>
): Partial<HomePrefs<Theme>> {
  if (!raw) return {};
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const out: Partial<HomePrefs<Theme>> = {};
  if (typeof o.nickname === "string") {
    out.nickname = o.nickname.slice(0, rules.maxNickname);
  }
  if (typeof o.avatarColor === "string" && rules.colors.includes(o.avatarColor)) {
    out.avatarColor = o.avatarColor;
  }
  const theme = rules.themes.find((t) => t === o.theme);
  if (theme) out.theme = theme;
  if (typeof o.is2v2 === "boolean") out.is2v2 = o.is2v2;
  if (o.targetScore === 100 || o.targetScore === 200) {
    out.targetScore = o.targetScore;
  }
  return out;
}

export async function loadHomePrefs<Theme extends string>(
  rules: HomePrefsRules<Theme>
): Promise<Partial<HomePrefs<Theme>>> {
  try {
    return parseHomePrefs(await AsyncStorage.getItem(STORAGE_KEY), rules);
  } catch {
    return {};
  }
}

export function saveHomePrefs<Theme extends string>(prefs: HomePrefs<Theme>): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)).catch(() => {});
}

// What to do with a saved table once entitlements are known. A free table
// comes back at once; a premium one only when owned, and it is dropped once
// the launch restore settles without it, so a locked table never returns.
export function savedThemeAction(
  premium: string | undefined,
  owned: ReadonlySet<string>,
  reconciled: boolean
): "apply" | "wait" | "drop" {
  if (premium === undefined || owned.has(premium)) return "apply";
  return reconciled ? "drop" : "wait";
}
