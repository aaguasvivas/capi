import type { Lang } from "./strings";

// Quick chat is predefined-only, end to end. On the wire (the chat-<gameId>
// broadcast) a phrase travels as its display text in the sender's language
// (chatWireText), because the 1.0 app prints the payload as is. Every newer
// receiver maps the text back to its id with normalizeChatPayload and renders
// it in its own language; the server stores the id.

export type QuickChatKind = "quick_chat" | "emote";

export interface QuickPhrase {
  id: string;
  es: string;
  en: string;
  // The English text shipped clients know this phrase by, when `en` has
  // changed since. It still maps to the id, and it stays the English wire
  // text: the 1.0 app prints it, and 1.1 clients drop text they do not know.
  legacyEn?: string;
}

export const QUICK_PHRASES: readonly QuickPhrase[] = [
  { id: "dale", es: "¡Dale!", en: "Let's go!" },
  { id: "te_toca", es: "¡Te toca!", en: "Your turn!" },
  { id: "ta_ahi", es: "¿Tú ta' ahí?", en: "You there?" },
  { id: "apurate", es: "¡Apúrate!", en: "Hurry up!" },
  { id: "tranquilo", es: "¡Tranquilo!", en: "Chill out!" },
  { id: "aguanta", es: "¡Aguanta!", en: "Hold up!" },
  { id: "eso_e", es: "¡Eso e'!", en: "That's it!", legacyEn: "That's crazy!" },
  { id: "vamo_alla", es: "¡Vamo' allá!", en: "We outside!" },
  { id: "que_lo_que", es: "¡Qué lo qué!", en: "What's up!", legacyEn: "Say less!" },
  { id: "buena_mano", es: "¡Buena mano!", en: "Nice hand!" },
];

export const EMOTES: readonly string[] = ["🔥", "😂", "😤", "💀", "👑"];

// Returns the canonical payload (phrase id or emote) for anything a client
// might send, or null when it is not one of ours.
export function normalizeChatPayload(type: QuickChatKind, payload: unknown): string | null {
  if (typeof payload !== "string" || payload.length === 0 || payload.length > 40) return null;
  if (type === "emote") return EMOTES.includes(payload) ? payload : null;
  const byId = QUICK_PHRASES.find((p) => p.id === payload);
  if (byId) return byId.id;
  const byText = QUICK_PHRASES.find((p) => p.es === payload || p.en === payload || p.legacyEn === payload);
  return byText ? byText.id : null;
}

export function chatText(type: QuickChatKind, payload: string, lang: Lang): string {
  if (type === "emote") return payload;
  const phrase = QUICK_PHRASES.find((p) => p.id === payload);
  return phrase ? phrase[lang] : payload;
}

// The broadcast text for a canonical payload: chatText, except that a
// renamed English phrase goes out under its legacy text (see legacyEn).
export function chatWireText(type: QuickChatKind, payload: string, lang: Lang): string {
  const phrase = type === "quick_chat" ? QUICK_PHRASES.find((p) => p.id === payload) : undefined;
  if (lang === "en" && phrase?.legacyEn) return phrase.legacyEn;
  return chatText(type, payload, lang);
}
