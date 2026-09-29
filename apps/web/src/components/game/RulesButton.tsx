"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RULES } from "@capi/i18n";
import { useI18n } from "@/lib/i18n/context";
import RulesArticle from "@/components/RulesArticle";

// "How to play" from the table. The rules open in a sheet on this page and
// never navigate: the Messages drawer's web view loads only /game/ pages.
// The sheet is portaled to <body>, out of the table's stacking contexts, so
// nothing on the table paints over it.
export default function RulesButton() {
  const { lang, s } = useI18n();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-11 h-11 -m-1.5 flex items-center justify-center group"
        title={s.howToPlay}
        aria-label={s.howToPlay}
        aria-haspopup="dialog"
      >
        {/* 44px hit area around a 32px mark, like the bug report button, so
            the cluster covers little of the board. */}
        <span
          aria-hidden
          className="w-8 h-8 flex items-center justify-center rounded-full bg-black/30 group-hover:bg-black/50 transition-colors text-white/70 group-hover:text-white text-sm font-black"
        >
          ?
        </span>
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={s.howToPlay}
            className="fixed inset-0 z-50 bg-black/60 overflow-y-auto overscroll-contain px-4 py-4 animate-fade-in"
            onClick={() => setOpen(false)}
          >
            <div
              className="relative mx-auto w-full max-w-md rounded-2xl bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-2 right-2 z-10 w-11 h-11 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-black/5 transition-colors"
                aria-label={s.closeTray}
              >
                <span aria-hidden>✕</span>
              </button>
              <RulesArticle lang={lang} rules={RULES[lang]} tagged={false} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
