import type { Lang } from "./strings";

// Quick chat is predefined-only, end to end: clients send a phrase id, the
// server accepts only ids from this list, and every receiver renders the
// phrase in its own language. Raw display strings from older clients are
// still recognized (mapped back to their id) so mixed versions keep talking.

export type QuickChatKind = "quick_chat" | "emote";

export interface QuickPhrase {
  id: string;
  es: string;
  en: string;
}

export const QUICK_PHRASES: readonly QuickPhrase[] = [
  { id: "dale", es: "¡Dale!", en: "Let's go!" },
  { id: "tranquilo", es: "¡Tranquilo!", en: "Chill out!" },
  { id: "aguanta", es: "¡Aguanta!", en: "Hold up!" },
  { id: "eso_e", es: "¡Eso e'!", en: "That's crazy!" },
  { id: "vamo_alla", es: "¡Vamo' allá!", en: "We outside!" },
  { id: "que_lo_que", es: "¡Qué lo qué!", en: "Say less!" },
];

export const EMOTES: readonly string[] = ["🔥", "😂", "😤", "💀", "👑"];

// Returns the canonical payload (phrase id or emote) for anything a client
// might send, or null when it is not one of ours.
export function normalizeChatPayload(type: QuickChatKind, payload: unknown): string | null {
  if (typeof payload !== "string" || payload.length === 0 || payload.length > 40) return null;
  if (type === "emote") return EMOTES.includes(payload) ? payload : null;
  const byId = QUICK_PHRASES.find((p) => p.id === payload);
  if (byId) return byId.id;
  const byText = QUICK_PHRASES.find((p) => p.es === payload || p.en === payload);
  return byText ? byText.id : null;
}

export function chatText(type: QuickChatKind, payload: string, lang: Lang): string {
  if (type === "emote") return payload;
  const phrase = QUICK_PHRASES.find((p) => p.id === payload);
  return phrase ? phrase[lang] : payload;
}
