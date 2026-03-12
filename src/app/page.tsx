"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import CreateGameForm from "@/components/CreateGameForm";
import JoinGameForm from "@/components/JoinGameForm";

function HomeContent() {
  const searchParams = useSearchParams();
  const joinId = searchParams.get("join");
  const [tab, setTab] = useState<"create" | "join">(joinId ? "join" : "create");

  // If there's a ?join= param, look up the invite code
  const [prefillCode, setPrefillCode] = useState("");

  useEffect(() => {
    if (!joinId) return;
    // joinId might be a gameId — look up its invite code
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
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Capi</h1>
          <p className="text-sm text-gray-500">Dominican Dominoes</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setTab("create")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === "create"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Create game
            </button>
            <button
              onClick={() => setTab("join")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === "join"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Join game
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

        <p className="text-center text-xs text-gray-400">
          No account needed. Just pick a name and play.
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
