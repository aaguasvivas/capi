"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const AVATAR_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444",
];

export default function CreateGameForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), avatarColor }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create game");
        return;
      }

      // Store session in localStorage
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
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your nickname
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          placeholder="e.g. ElCapo"
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
        disabled={loading || !nickname.trim()}
        className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-gray-700 transition-colors"
      >
        {loading ? "Creating…" : "Create game"}
      </button>
    </form>
  );
}
