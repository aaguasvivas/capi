"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import CreateGameForm from "@/components/CreateGameForm";
import JoinGameForm from "@/components/JoinGameForm";
import { useI18n } from "@/lib/i18n/context";
import type { Lang } from "@/lib/i18n/strings";

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center bg-white/80 backdrop-blur rounded-full p-0.5 border border-gray-200 shadow-sm">
      {(["es", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
            lang === l
              ? "bg-gray-900 text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {l === "es" ? "ES" : "EN"}
        </button>
      ))}
    </div>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const joinId = searchParams.get("join");
  const [tab, setTab] = useState<"create" | "join">(joinId ? "join" : "create");
  const { s } = useI18n();

  const [prefillCode, setPrefillCode] = useState("");

  useEffect(() => {
    if (!joinId) return;
    fetch(`/api/games/${joinId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.game?.invite_code) {
          setPrefillCode(data.game.invite_code);
          setTab("join");
        }
      })
      .catch(() => {});
  }, [joinId]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f5f0e8] via-[#f0ebe3] to-[#e8d5c0] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <LangToggle />
          </div>
          <h1 className="text-5xl font-black tracking-tight text-gray-900 drop-shadow-sm">
            Capi
          </h1>
          <div
            aria-hidden
            className="mx-auto h-[3px] w-12 rounded-full"
            style={{ background: "#b8860b" }}
          />
          <p className="text-[11px] font-bold tracking-[0.22em] text-gray-500 uppercase pt-1">
            {s.tagline}
          </p>
          <p className="text-base italic text-gray-700 font-medium pt-1">
            Como en el patio.
          </p>
          <div className="flex justify-center gap-1 text-xl opacity-40 select-none pt-1">
            🁣 🁫 🁳 🂃
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setTab("create")}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
                tab === "create"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {s.createGame}
            </button>
            <button
              onClick={() => setTab("join")}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
                tab === "join"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {s.joinGame}
            </button>
          </div>

          {/* Form */}
          <div className="p-6">
            {tab === "create" ? (
              <CreateGameForm />
            ) : (
              <JoinGameForm prefillCode={prefillCode} />
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 font-medium">
          {s.noAccount}
        </p>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
