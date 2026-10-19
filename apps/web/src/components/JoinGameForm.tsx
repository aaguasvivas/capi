"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { checkFields, normalizeCode, type FieldErrors, type FormField } from "@/lib/gameForms";
import { apiErrorText, useI18n } from "@/lib/i18n/context";
import { readProfile, saveProfile } from "@/lib/profile";

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
  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);


  const [nickname, setNickname] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [loading, setLoading] = useState(false);
  // A field's own problem, shown under it; `error` is the server's answer,
  // shown under the button.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");

  // Start from the name and color this browser used last time.
  useEffect(() => {
    const { nickname: name, avatarColor: color } = readProfile(AVATAR_COLORS);
    if (name) setNickname((typed) => typed || name);
    if (color) setAvatarColor(color);
  }, []);

  // Editing a field clears only that field's message.
  function edited(field: FormField) {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  // A link prefill never replaces a code the player already typed. When it
  // fills an empty field, a code message from an early tap no longer applies.
  useEffect(() => {
    if (!prefillCode || inviteCode) return;
    setInviteCode(normalizeCode(prefillCode));
    edited("code");
    // Only a new prefill matters here, not each typed character.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCode]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    const { errors, first } = checkFields([
      ["code", inviteCode],
      ["name", nickname],
    ]);
    setFieldErrors(errors);
    if (first) {
      const input = (first === "code" ? codeRef : nameRef).current;
      input?.scrollIntoView({ block: "center" });
      input?.focus({ preventScroll: true });
      return;
    }
    setLoading(true);

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
      saveProfile({ nickname: nickname.trim(), avatarColor });

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
          ref={codeRef}
          id="join-code"
          type="text"
          value={inviteCode}
          onChange={(e) => {
            setInviteCode(normalizeCode(e.target.value));
            edited("code");
          }}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          placeholder="XXXXXX"
          aria-invalid={fieldErrors.code ? true : undefined}
          aria-describedby={fieldErrors.code ? "join-code-error" : undefined}
          className={`w-full border rounded-xl px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 transition-all bg-gray-50/50 tracking-[0.3em] text-center ${
            fieldErrors.code
              ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
              : "border-gray-200 focus:ring-gray-900/20 focus:border-gray-400"
          }`}
        />
        {fieldErrors.code && (
          <p id="join-code-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600">
            {s[fieldErrors.code]}
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
          ref={nameRef}
          id="join-name"
          type="text"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            edited("name");
          }}
          maxLength={20}
          placeholder={s.joinNamePlaceholder}
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? "join-name-error" : undefined}
          className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all bg-gray-50/50 ${
            fieldErrors.name
              ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
              : "border-gray-200 focus:ring-gray-900/20 focus:border-gray-400"
          }`}
        />
        {fieldErrors.name && (
          <p id="join-name-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600">
            {s[fieldErrors.name]}
          </p>
        )}
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

      {/* Only a running request disables the button: a tap with a field
          missing names the field instead of doing nothing. */}
      <div className="space-y-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-40 hover:bg-gray-800 transition-all active:scale-[0.98] shadow-sm"
        >
          {loading ? s.joining : s.joinAction}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-600 font-medium">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
