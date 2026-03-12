"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const AVATAR_COLORS = [
  "#ec4899", "#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#ef4444",
];

interface Props {
  prefillCode?: string;
}

export default function JoinGameForm({ prefillCode = "" }: Props) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");

  // Sync when prefillCode arrives asynchronously (from ?join= URL lookup)
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
      // Look up game by invite code
      const lookupRes = await fetch(`/api/games/by-code/${inviteCode.trim().toUpperCase()}`);
      if (!lookupRes.ok) {
        setError("Game not found — check the invite code");
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
        setError(data.error ?? "Failed to join game");
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
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleJoin} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Invite code
        </label>
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="XXXXXX"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your nickname
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          placeholder="e.g. ElTiburon"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your color
        </label>
        <div className="flex gap-2">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAvatarColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                avatarColor === c ? "border-gray-900 scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !nickname.trim() || inviteCode.length !== 6}
        className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-gray-700 transition-colors"
      >
        {loading ? "Joining…" : "Join game"}
      </button>
    </form>
  );
}
