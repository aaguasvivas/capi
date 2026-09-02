"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  dictionaries,
  errorKeyFor,
  type ErrorKey,
  type Lang,
  type Strings,
} from "@capi/i18n";

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  s: Strings;
}

const DEFAULT_LANG: Lang = "es";
const STORAGE_KEY = "capi_lang";

const I18nContext = createContext<I18nCtx>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  s: dictionaries[DEFAULT_LANG],
});

// The chosen language is a browser-only store (localStorage) exposed to React
// through useSyncExternalStore. While hydrating, React renders the server
// snapshot (Spanish, matching the static HTML) and then switches to the stored
// language before the first client-only paint. English users get English from
// the first frame on the landing page, and server-rendered pages such as the
// game table never hit a hydration mismatch.
let current: Lang | null = null;
const listeners = new Set<() => void>();

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "es" ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

function getLang(): Lang {
  if (current === null) current = readStoredLang();
  return current;
}

function getServerLang(): Lang {
  return DEFAULT_LANG;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setLang(l: Lang) {
  current = l;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    // Storage can be blocked (private mode). The choice still holds for this visit.
  }
  listeners.forEach((notify) => notify());
}

// The API and engine answer with fixed English messages. Known ones map to a
// key in the player's language; anything else reads as the caller's generic
// failure instead of raw English.
const UNKNOWN: ErrorKey = "errMoveFailed";

export function apiErrorText(s: Strings, message: unknown, generic: string): string {
  const key = errorKeyFor(message, UNKNOWN);
  return key === UNKNOWN ? generic : s[key];
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getLang, getServerLang);

  // The root layout is static and ships lang="es". Keep the document in step
  // with the language actually shown.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, s: dictionaries[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
