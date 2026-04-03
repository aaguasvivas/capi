"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

const AVATAR_COLORS = [
  "#ec4899", "#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#ef4444",
];

interface Props {
  prefillCode?: string;
}

export default function JoinGameForm({ prefillCode = "" }: Props) {
  const router = useRouter();
  const { s } = useI18n();
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    if (prefillCode) setInviteCode(prefillCode.toUpperCase());
  }, [prefillCode]);

  const [nickname, setNickname] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim() || !inviteCode.trim()) return;
    setLoading(true);
    setError("");

    try {
      const lookupRes = await fetch(`/api/games/by-code/${inviteCode.trim().toUpperCase()}`);
      if (!lookupRes.ok) {
        setError(s.gameNotFound);
        return;
      }
      const { gameId } = await lookupRes.json();

      const joinRes = await fetch(`/api/games/${gameId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), avatarColor }),
      });

      const data = await joinRes.json();

      if (!joinRes.ok) {
        setError(data.error ?? s.failedJoin);
        return;
      }

      localStorage.setItem(
        `capi_session_${gameId}`,
        JSON.stringify({
          playerId: data.playerId,
          seat: data.seat,
          gameId,
        })
      );

      router.push(`/game/${gameId}`);
    } catch {
      setError(s.networkError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleJoin} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          {s.inviteCode}
        </label>
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="XXXXXX"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition-all bg-gray-50/50 tracking-[0.3em] text-center"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          {s.yourName}
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          placeholder={s.joinNamePlaceholder}
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
                avatarColor === c ? "border-gray-900 scale-110 shadow-md" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={loading || !nickname.trim() || inviteCode.length !== 6}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-40 hover:bg-gray-800 transition-all active:scale-[0.98] shadow-sm"
      >
        {loading ? s.joining : s.joinAction}
      </button>
    </form>
  );
}
