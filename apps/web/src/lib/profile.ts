// The player's last name and color, kept in this browser so the create and
// join forms start filled in. Storage can be missing or blocked (private
// mode, some web views), so every access is guarded and a miss is harmless.

const KEY = "capi_profile";

export interface Profile {
  nickname: string;
  avatarColor: string;
}

// Only what the form can show: a name that fits its field and a color from
// its own palette.
export function readProfile(palette: readonly string[]): Partial<Profile> {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Record<keyof Profile, unknown>>) : {};
    const out: Partial<Profile> = {};
    if (typeof saved.nickname === "string" && saved.nickname.trim() && saved.nickname.length <= 20) {
      out.nickname = saved.nickname;
    }
    if (typeof saved.avatarColor === "string" && palette.includes(saved.avatarColor)) {
      out.avatarColor = saved.avatarColor;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveProfile(profile: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* storage blocked: the form just starts empty next time */
  }
}
