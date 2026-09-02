"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

interface Props {
  gameId?: string;
  playerId?: string;
  gameState?: unknown;
  stateVersion?: number;
}

type Status = "idle" | "sending" | "sent" | "error";

export default function BugReportButton({
  gameId,
  playerId,
  gameState,
  stateVersion,
}: Props) {
  const { s, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      // small delay so the modal mounts before we focus
      const id = setTimeout(() => taRef.current?.focus(), 50);
      return () => clearTimeout(id);
    } else {
      // reset when closed
      setMessage("");
      setStatus("idle");
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          playerId,
          message: trimmed,
          userAgent: navigator.userAgent,
          url: window.location.href,
          viewportW: window.innerWidth,
          viewportH: window.innerHeight,
          language: lang,
          gameState,
          stateVersion,
        }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("sent");
      setTimeout(() => setOpen(false), 1300);
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      {/* 44px hit area around the 32px bubble; the negative margin keeps the
          layout footprint the bubble's own size. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-11 h-11 -m-1.5 flex items-center justify-center group"
        title={s.reportBug}
        aria-label={s.reportBug}
      >
        <span className="w-8 h-8 flex items-center justify-center rounded-full bg-black/30 group-hover:bg-black/50 transition-colors text-white/70 group-hover:text-white text-sm">
          🐞
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && status !== "sending")
              setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bug-report-title"
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4"
          >
            <div className="flex items-start justify-between">
              <h2
                id="bug-report-title"
                className="font-black text-lg text-gray-900"
              >
                🐞 {s.reportBugTitle}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={status === "sending"}
                className="w-11 h-11 -m-2.5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 text-lg leading-none disabled:opacity-50"
                aria-label={s.reportBugCancel}
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-500 leading-snug">
              {s.reportBugPrompt}
            </p>

            <textarea
              ref={taRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              disabled={status === "sending" || status === "sent"}
              placeholder={s.reportBugPlaceholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 disabled:bg-gray-50"
            />

            {status === "error" && (
              <p className="text-xs text-red-600 font-medium">
                {s.reportBugFailed}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={status === "sending"}
                className="min-h-[44px] px-3 text-sm text-gray-500 font-medium hover:text-gray-700 disabled:opacity-50"
              >
                {s.reportBugCancel}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  !message.trim() ||
                  status === "sending" ||
                  status === "sent"
                }
                className="min-h-[44px] px-4 text-sm bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "sending"
                  ? s.reportBugSending
                  : status === "sent"
                    ? `✓ ${s.reportBugSent}`
                    : s.reportBugSend}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
