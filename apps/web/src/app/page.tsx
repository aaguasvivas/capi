"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CreateGameForm from "@/components/CreateGameForm";
import JoinGameForm from "@/components/JoinGameForm";
import { useI18n } from "@/lib/i18n/context";
import type { Lang, Strings } from "@capi/i18n";

const SESSION_PREFIX = "capi_session_";
const RESUME_MAX = 3;

// GET /api/games/<id> returns whole rows. The landing page keeps only these
// fields and drops everything else at the parse boundary.
interface Lobby {
  inviteCode: string;
  status: string;
  createdAt: string;
  hostName: string;
  full: boolean;
}

function pickLobby(data: unknown): Lobby | null {
  if (!data || typeof data !== "object") return null;
  const { game, players } = data as {
    game?: Record<string, unknown>;
    players?: unknown;
  };
  if (!game || typeof game.invite_code !== "string" || typeof game.status !== "string") {
    return null;
  }
  const settings = game.settings as { is2v2?: boolean } | null | undefined;
  const seated = Array.isArray(players)
    ? (players as Array<{ seat?: unknown; nickname?: unknown }>)
    : [];
  const host = seated.find((p) => p.seat === "n");
  return {
    inviteCode: game.invite_code,
    status: game.status,
    createdAt: typeof game.created_at === "string" ? game.created_at : "",
    hostName: typeof host?.nickname === "string" ? host.nickname : "",
    // Mirrors maxPlayersFor in lib/gameStart without pulling the engine into
    // the landing bundle.
    full: seated.length >= (settings?.is2v2 ? 4 : 2),
  };
}

type JoinLookup =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; code: string; hostName: string }
  | { kind: "notFound" }
  | { kind: "full" }
  | { kind: "started" }
  | { kind: "error" };

async function lookupJoin(gameId: string): Promise<JoinLookup> {
  try {
    const r = await fetch(`/api/games/${encodeURIComponent(gameId)}`);
    if (r.status === 404) return { kind: "notFound" };
    if (!r.ok) return { kind: "error" };
    const lobby = pickLobby(await r.json());
    if (!lobby) return { kind: "error" };
    if (lobby.status !== "waiting") return { kind: "started" };
    if (lobby.full) return { kind: "full" };
    return { kind: "ready", code: lobby.inviteCode, hostName: lobby.hostName };
  } catch {
    return { kind: "error" };
  }
}

function lookupText(lookup: JoinLookup, s: Strings): string {
  switch (lookup.kind) {
    case "loading":
      return s.joinLookupLoading;
    case "ready":
      return lookup.hostName ? s.joiningTableOf(lookup.hostName) : "";
    case "notFound":
      return s.joinLookupNotFound;
    case "full":
      return s.joinLookupFull;
    case "started":
      return s.joinLookupStarted;
    case "error":
      return s.networkError;
    default:
      return "";
  }
}

interface ResumeEntry {
  gameId: string;
  code: string;
  createdAt: string;
}

function readSessions(): Array<{ key: string; gameId: string }> {
  const sessions: Array<{ key: string; gameId: string }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SESSION_PREFIX)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? "") as { gameId?: unknown };
        if (typeof parsed.gameId === "string" && parsed.gameId) {
          sessions.push({ key, gameId: parsed.gameId });
        }
      } catch {
        // Not a session this page understands; leave it alone.
      }
    }
  } catch {
    // Storage unavailable: nothing to resume.
  }
  return sessions;
}

// Resolves to a card entry for a live game, or null. Prunes sessions whose
// game is gone or finished; a network or server failure keeps the session
// for next time.
async function lookupResume(key: string, gameId: string): Promise<ResumeEntry | null> {
  try {
    const r = await fetch(`/api/games/${encodeURIComponent(gameId)}`);
    if (r.status === 404) {
      localStorage.removeItem(key);
      return null;
    }
    if (!r.ok) return null;
    const lobby = pickLobby(await r.json());
    if (!lobby) return null;
    if (lobby.status === "finished") {
      localStorage.removeItem(key);
      return null;
    }
    return { gameId, code: lobby.inviteCode, createdAt: lobby.createdAt };
  } catch {
    return null;
  }
}

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

  const [lookup, setLookup] = useState<JoinLookup>(
    joinId ? { kind: "loading" } : { kind: "idle" }
  );

  useEffect(() => {
    if (!joinId) return;
    let cancelled = false;
    lookupJoin(joinId).then((result) => {
      if (!cancelled) setLookup(result);
    });
    return () => {
      cancelled = true;
    };
  }, [joinId]);

  const [resume, setResume] = useState<ResumeEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    for (const { key, gameId } of readSessions()) {
      lookupResume(key, gameId).then((entry) => {
        if (cancelled || !entry) return;
        setResume((prev) =>
          [...prev.filter((e) => e.gameId !== entry.gameId), entry]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, RESUME_MAX)
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const noteText = lookupText(lookup, s);
  const noteTone =
    lookup.kind === "loading"
      ? "border-gray-200 bg-gray-50 text-gray-500"
      : lookup.kind === "ready"
        ? "border-gray-200 bg-gray-50 text-gray-800"
        : "border-red-200 bg-red-50 text-red-700";

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
          {/* Unicode domino glyphs render as tofu on platforms without a
              symbols font (Windows/Android), so these minis are inline SVG. */}
          <div
            aria-hidden
            className="flex justify-center gap-1.5 opacity-40 select-none pt-1.5"
          >
            {[
              [1, 3],
              [2, 5],
              [4, 6],
              [6, 6],
            ].map(([a, b], i) => (
              <MiniTile key={i} top={a} bottom={b} />
            ))}
          </div>
        </div>

        {/* Resume: games this browser is seated at and that are still going */}
        {resume.length > 0 && (
          <section className="space-y-1.5">
            <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {s.resumeGame}
            </p>
            {resume.map((g) => (
              <Link
                key={g.gameId}
                href={`/game/${g.gameId}`}
                className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white/80 px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
              >
                <span>{s.resumeGameHint(g.code)}</span>
                <span aria-hidden className="text-gray-400">
                  →
                </span>
              </Link>
            ))}
          </section>
        )}

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
              <>
                {noteText && (
                  <p
                    role="status"
                    className={`mb-4 rounded-xl border px-3.5 py-2.5 text-sm font-medium ${noteTone}`}
                  >
                    {noteText}
                  </p>
                )}
                <JoinGameForm
                  prefillCode={lookup.kind === "ready" ? lookup.code : ""}
                />
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 font-medium">
          {s.noAccount}
        </p>

        {/* Footer */}
        <footer className="flex items-center justify-center gap-3 pt-1 text-[11px] font-medium text-gray-400">
          <Link
            href="/privacy"
            className="hover:text-gray-600 transition-colors"
          >
            {s.footerPrivacy}
          </Link>
          <span aria-hidden className="text-gray-300">
            ·
          </span>
          <Link
            href="/support"
            className="hover:text-gray-600 transition-colors"
          >
            {s.footerSupport}
          </Link>
        </footer>
      </div>
    </main>
  );
}

const MINI_PIPS: Record<number, Array<[number, number]>> = {
  1: [[6, 6]],
  2: [
    [3, 3],
    [9, 9],
  ],
  3: [
    [3, 3],
    [6, 6],
    [9, 9],
  ],
  4: [
    [3, 3],
    [9, 3],
    [3, 9],
    [9, 9],
  ],
  5: [
    [3, 3],
    [9, 3],
    [6, 6],
    [3, 9],
    [9, 9],
  ],
  6: [
    [3, 3],
    [3, 6],
    [3, 9],
    [9, 3],
    [9, 6],
    [9, 9],
  ],
};

function MiniTile({ top, bottom }: { top: number; bottom: number }) {
  return (
    <svg width="13" height="25" viewBox="0 0 13 25">
      <rect
        x="0.5"
        y="0.5"
        width="12"
        height="24"
        rx="2.5"
        fill="#fafaf7"
        stroke="#0a0a0a"
      />
      <line x1="2" y1="12.5" x2="11" y2="12.5" stroke="#0a0a0a" />
      {MINI_PIPS[top].map(([cx, cy], i) => (
        <circle key={`t${i}`} cx={(cx * 9) / 12 + 2} cy={(cy * 9) / 12 + 2} r="1.1" fill="#0a0a0a" />
      ))}
      {MINI_PIPS[bottom].map(([cx, cy], i) => (
        <circle key={`b${i}`} cx={(cx * 9) / 12 + 2} cy={(cy * 9) / 12 + 13.5} r="1.1" fill="#0a0a0a" />
      ))}
    </svg>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
