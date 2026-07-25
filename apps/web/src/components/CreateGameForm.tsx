"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

const AVATAR_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
];

type ThemeId = "barberia" | "colmado" | "patio";

function ModeGlyph({ mode }: { mode: "1v1" | "2v2" }) {
  // Player avatars facing off: 1v1 is one bust vs one bust; 2v2 is an
  // overlapped pair vs an overlapped pair (con tu frente), the same avatar
  // stack language as the in-game team score bar.
  const teamA = ["#6366f1", "#3b82f6"];
  const teamB = ["#e74c3c", "#f39c12"];
  const person = (cx: number, cy: number, r: number, color: string, key: string) => (
    <g key={key}>
      <circle cx={cx} cy={cy} r={r} fill={color} stroke="#ffffff" strokeWidth="1.6" />
      <circle cx={cx} cy={cy - r * 0.22} r={r * 0.32} fill="#ffffff" />
      <ellipse cx={cx} cy={cy + r * 0.5} rx={r * 0.5} ry={r * 0.3} fill="#ffffff" />
    </g>
  );
  return (
    <svg viewBox="0 0 64 44" className="h-10 mx-auto block" aria-hidden>
      {mode === "1v1" ? (
        <>
          {person(17, 22, 9.5, teamA[0], "a")}
          {person(47, 22, 9.5, teamB[0], "b")}
        </>
      ) : (
        <>
          {person(10, 22, 7.2, teamA[1], "a2")}
          {person(19.5, 22, 7.2, teamA[0], "a1")}
          {person(54, 22, 7.2, teamB[1], "b2")}
          {person(44.5, 22, 7.2, teamB[0], "b1")}
        </>
      )}
      <text
        x="32"
        y="24.5"
        textAnchor="middle"
        fontSize={mode === "1v1" ? 8.5 : 7}
        fontWeight="bold"
        fontStyle="italic"
        fill="#9ca3af"
      >
        vs
      </text>
    </svg>
  );
}

export default function CreateGameForm() {
  const router = useRouter();
  const { s } = useI18n();
  const [nickname, setNickname] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [theme, setTheme] = useState<ThemeId>("barberia");
  const [is2v2, setIs2v2] = useState(false);
  const [targetScore, setTargetScore] = useState<100 | 200>(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const themes: { id: ThemeId; label: string; color: string; accent: string; desc: string }[] = [
    { id: "barberia", label: "Barbería", color: "#145228", accent: "#c0392b", desc: s.themeClassic },
    { id: "colmado", label: "Colmado", color: "#3a2a1a", accent: "#d4a017", desc: s.themeBarrio },
    { id: "patio", label: "Patio", color: "#7a7268", accent: "#c4693d", desc: s.themeOutdoors },
  ];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), avatarColor, theme, is2v2, targetScore }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? s.failedCreate);
        return;
      }

      localStorage.setItem(
        `capi_session_${data.gameId}`,
        JSON.stringify({
          playerId: data.playerId,
          seat: data.seat,
          gameId: data.gameId,
        })
      );

      router.push(`/game/${data.gameId}`);
    } catch {
      setError(s.networkError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="space-y-5">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          {s.yourName}
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          placeholder={s.namePlaceholder}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition-all bg-gray-50/50"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          {s.yourColor}
        </label>
        <div className="flex gap-2.5">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAvatarColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                avatarColor === c
                  ? "border-gray-900 scale-110 shadow-md"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          {s.table}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`py-3 px-2 rounded-xl border-2 transition-all text-center ${
                theme === t.id
                  ? "border-gray-900 shadow-md bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div
                className="w-full h-8 rounded-lg mb-1.5"
                style={{
                  background: `linear-gradient(135deg, ${t.color}, ${t.accent})`,
                }}
              />
              <span className="text-xs font-semibold text-gray-800 block">
                {t.label}
              </span>
              <span className="text-[10px] text-gray-400">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          {s.mode}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIs2v2(false)}
            className={`flex-1 py-3 px-3 rounded-xl border-2 transition-all text-center ${
              !is2v2
                ? "border-gray-900 shadow-md bg-gray-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <ModeGlyph mode="1v1" />
            <span className="text-xs font-semibold text-gray-800 block mt-1.5">1v1</span>
          </button>
          <button
            type="button"
            onClick={() => setIs2v2(true)}
            className={`flex-1 py-3 px-3 rounded-xl border-2 transition-all text-center ${
              is2v2
                ? "border-gray-900 shadow-md bg-gray-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <ModeGlyph mode="2v2" />
            <span className="text-xs font-semibold text-gray-800 block mt-1.5">2v2</span>
            <span className="text-[10px] text-gray-400">{s.conTuFrente}</span>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          {s.firstTo}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTargetScore(100)}
            className={`flex-1 py-3 px-3 rounded-xl border-2 transition-all text-center ${
              targetScore === 100
                ? "border-gray-900 shadow-md bg-gray-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="text-xs font-semibold text-gray-800 block">{s.score100}</span>
          </button>
          <button
            type="button"
            onClick={() => setTargetScore(200)}
            className={`flex-1 py-3 px-3 rounded-xl border-2 transition-all text-center ${
              targetScore === 200
                ? "border-gray-900 shadow-md bg-gray-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="text-xs font-semibold text-gray-800 block">{s.score200}</span>
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={loading || !nickname.trim()}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-40 hover:bg-gray-800 transition-all active:scale-[0.98] shadow-sm"
      >
        {loading ? s.creating : s.createAction}
      </button>
    </form>
  );
}
