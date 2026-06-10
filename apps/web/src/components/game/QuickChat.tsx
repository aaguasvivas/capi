"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

interface QuickChatProps {
  onSend: (type: "quick_chat" | "emote", payload: string) => void;
  disabled?: boolean;
}

const PHRASES_ES = [
  "¡Dale!", "¡Tranquilo!", "¡Aguanta!",
  "¡Eso e'!", "¡Vamo' allá!", "¡Qué lo qué!",
];

const PHRASES_EN = [
  "Let's go!", "Chill out!", "Hold up!",
  "That's crazy!", "We outside!", "Say less!",
];

const EMOTES = ["🔥", "😂", "😤", "💀", "👑"];

export default function QuickChat({ onSend, disabled }: QuickChatProps) {
  const { lang, s } = useI18n();
  const [open, setOpen] = useState(false);
  const [tapped, setTapped] = useState<string | null>(null);
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const phrases = lang === "en" ? PHRASES_EN : PHRASES_ES;

  const resetInactivity = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => setOpen(false), 3000);
  }, []);

  useEffect(() => {
    if (open) resetInactivity();
    return () => {
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
    };
  }, [open, resetInactivity]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleSend(type: "quick_chat" | "emote", value: string) {
    if (disabled) return;
    setTapped(value);
    setTimeout(() => setTapped(null), 300);
    onSend(type, value);
    resetInactivity();
  }

  return (
    <div ref={containerRef} className="relative">
      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-[220px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-chat-tray-in">
          <div className="bg-[#1a1208]/95 backdrop-blur-sm p-3 space-y-3">
            <div className="flex items-center justify-between">
              {EMOTES.map((e) => (
                <button
                  key={e}
                  onClick={() => handleSend("emote", e)}
                  className={`text-xl leading-none w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 select-none
                    ${tapped === e
                      ? "scale-75 bg-white/20"
                      : "scale-100 hover:bg-white/10 active:scale-75"
                    }
                  `}
                  aria-label={`Emote ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>

            <div className="h-px bg-white/10" />

            <div className="flex flex-col gap-1.5">
              {phrases.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSend("quick_chat", p)}
                  className={`text-left text-sm font-bold px-3 py-1.5 rounded-xl transition-all duration-150 select-none
                    text-amber-200
                    ${tapped === p
                      ? "scale-95 bg-amber-500/30"
                      : "scale-100 hover:bg-white/10 active:scale-95"
                    }
                  `}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all duration-150
          shadow-lg select-none
          ${open
            ? "bg-amber-500 text-white scale-110 shadow-amber-500/40"
            : "bg-black/40 text-white/70 hover:bg-black/60 hover:text-white active:scale-90"
          }
          ${disabled ? "opacity-40 cursor-not-allowed" : ""}
        `}
        title={open ? s.closeTray : s.quickChat}
        aria-label={s.quickChat}
      >
        💬
      </button>
    </div>
  );
}
