"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiErrorText, useI18n } from "@/lib/i18n/context";

const AVATAR_COLORS = [
  "#ec4899", "#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#ef4444",
];

const CODE_LENGTH = 6;

// Invite codes are uppercase letters and digits. Typed or pasted input keeps
// only those, so "abc-123 " becomes "ABC123". No maxLength on the input: the
// browser would truncate a pasted "ABC-123" before the dash is dropped.
function sanitizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

interface Props {
  prefillCode?: string;
}

export default function JoinGameForm({ prefillCode = "" }: Props) {
  const router = useRouter();
  const { s } = useI18n();
  const [inviteCode, setInviteCode] = useState("");
  const [codeHint, setCodeHint] = useState(false);

  // A link prefill never replaces a code the player already typed.
  useEffect(() => {
    if (!prefillCode) return;
    setInviteCode((typed) => typed || sanitizeCode(prefillCode));
  }, [prefillCode]);

  const [nickname, setNickname] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const showCodeHint = codeHint && inviteCode.length !== CODE_LENGTH;

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    if (inviteCode.length !== CODE_LENGTH) {
      setCodeHint(true);
      return;
    }
    setLoading(true);
    setError("");

    try {
      const lookupRes = await fetch(`/api/games/by-code/${inviteCode}`);
      const lookup = await lookupRes.json();
      if (!lookupRes.ok) {
        setError(apiErrorText(s, lookup.error, s.failedJoin));
        return;
      }
      const { gameId } = lookup;

      const joinRes = await fetch(`/api/games/${gameId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), avatarColor }),
      });

      const data = await joinRes.json();

      if (!joinRes.ok) {
        setError(apiErrorText(s, data.error, s.failedJoin));
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
        <label
          htmlFor="join-code"
          className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5"
        >
          {s.inviteCode}
        </label>
        <input
          id="join-code"
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(sanitizeCode(e.target.value))}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          placeholder="XXXXXX"
          aria-describedby={showCodeHint ? "join-code-hint" : undefined}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition-all bg-gray-50/50 tracking-[0.3em] text-center"
        />
        {showCodeHint && (
          <p id="join-code-hint" className="mt-1.5 text-xs font-medium text-amber-700">
            {s.codeIs6}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="join-name"
          className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5"
        >
          {s.yourName}
        </label>
        <input
          id="join-name"
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
        disabled={loading || !nickname.trim()}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-40 hover:bg-gray-800 transition-all active:scale-[0.98] shadow-sm"
      >
        {loading ? s.joining : s.joinAction}
      </button>
    </form>
  );
}
