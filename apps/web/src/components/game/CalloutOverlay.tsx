"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

interface CalloutOverlayProps {
  callout: string;
  payload: Record<string, unknown> | null;
  onDismiss: () => void;
}

const CALLOUT_CONFIG: Record<
  string,
  {
    label: string;
    emoji: string;
    bg: string;
    textColor: string;
    subTextColor: string;
    borderColor: string;
  }
> = {
  domino: {
    label: "¡DOMINÓ!",
    emoji: "🎯",
    bg: "from-amber-500 via-yellow-400 to-amber-500",
    textColor: "text-amber-950",
    subTextColor: "text-amber-900/80",
    borderColor: "border-amber-300",
  },
  trancao: {
    label: "¡TRANCAO!",
    emoji: "🔒",
    bg: "from-red-700 via-red-600 to-red-700",
    textColor: "text-white",
    subTextColor: "text-red-100/80",
    borderColor: "border-red-400",
  },
  capicua: {
    label: "¡CAPICÚA!",
    emoji: "🔥",
    bg: "from-orange-600 via-amber-500 to-orange-600",
    textColor: "text-orange-950",
    subTextColor: "text-orange-900/80",
    borderColor: "border-orange-300",
  },
  veinticinco: {
    label: "¡VEINTICINCO!",
    emoji: "💥",
    bg: "from-purple-700 via-indigo-600 to-purple-700",
    textColor: "text-white",
    subTextColor: "text-purple-100/80",
    borderColor: "border-purple-400",
  },
};

export default function CalloutOverlay({
  callout,
  payload,
  onDismiss,
}: CalloutOverlayProps) {
  const { s } = useI18n();
  const [mounted, setMounted] = useState(false);
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Focus lands on the dismiss button so Enter and Space close the overlay.
  useEffect(() => {
    dismissRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const config = CALLOUT_CONFIG[callout];
  if (!config) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="callout-title"
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
      onClick={onDismiss}
    >
      <div
        className={`absolute inset-0 bg-black/75 transition-opacity duration-300 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`
          relative bg-gradient-to-b ${config.bg}
          rounded-3xl p-10 text-center max-w-sm w-full mx-6
          border-2 ${config.borderColor}
          shadow-2xl
          ${mounted ? "animate-callout-enter" : "opacity-0 scale-50"}
        `}
      >
        <p className="text-7xl mb-3 drop-shadow-lg">{config.emoji}</p>

        <h2
          id="callout-title"
          className={`text-5xl font-black tracking-tight ${config.textColor} drop-shadow-sm`}
        >
          {config.label}
        </h2>

        {payload && (
          <div
            className={`mt-5 space-y-1.5 text-base font-semibold ${config.subTextColor}`}
          >
            {typeof payload.pipsAwarded === "number" &&
              payload.pipsAwarded > 0 && (
                <p>+{payload.pipsAwarded} {s.points}</p>
              )}
            {typeof payload.capicuaBonus === "number" && (
              <p>+{payload.capicuaBonus} {s.capicuaBonus}</p>
            )}
            {typeof payload.veinticincoBonus === "number" && (
              <p>+{payload.veinticincoBonus} {s.bonus}</p>
            )}
            {typeof payload.pts === "number" && payload.pts > 0 && (
              <p>+{payload.pts} {s.points}</p>
            )}
          </div>
        )}

        {/* The backdrop click already dismisses; stop the bubble so a
            keyboard activation does not dismiss twice. */}
        <button
          ref={dismissRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className={`mt-6 min-h-[44px] px-5 text-sm rounded-xl ${config.subTextColor} animate-pulse focus:outline-none focus-visible:ring-2 focus-visible:ring-current`}
        >
          {s.tapToContinue}
        </button>
      </div>
    </div>
  );
}
