"use client";

import { useEffect, useState } from "react";
import type { Seat } from "@capi/engine";
import { CLAIM_AFTER_MS, STALL_NOTICE_MS, formatStall } from "@capi/engine";
import type { ConnectionState } from "@/hooks/useRealtimeGame";
import { useI18n } from "@/lib/i18n/context";

// How long the seat on turn can be missing from the presence channel before
// the table says so. Presence flaps on every reconnect, so this is generous.
const AWAY_AFTER_MS = 45_000;
// A fresh "Live" confirmation shows briefly, then the line goes back to the
// turn indicator.
const LIVE_PILL_MS = 2_000;

interface Props {
  connection: ConnectionState;
  presence: Partial<Record<Seat, boolean>>;
  currentTurn: Seat;
  /** True while tiles are in play; turn and away states only matter then. */
  playing: boolean;
  /** Null for a spectator. */
  mySeat: Seat | null;
  players: Array<{ seat: string; nickname: string }>;
  /** Server clock of the last move; drives the stall notice and the claim. */
  lastMoveAt?: string;
  /** True when my side may claim once the window closes (seated, other side on turn). */
  canClaim: boolean;
  claiming: boolean;
  onClaim: () => void;
}

// Status line right under the score bar: connection state, whose turn it is,
// a warning once the seat on turn has been gone for a while, and the claim
// once that seat has been silent past the window. It reserves its height so
// the board never jumps when a state comes or goes, and mirrors the turn text
// into a polite live region for screen readers.
export default function TablePresence({
  connection,
  presence,
  currentTurn,
  playing,
  mySeat,
  players,
  lastMoveAt,
  canClaim,
  claiming,
  onClaim,
}: Props) {
  const { s } = useI18n();
  const [showLive, setShowLive] = useState(false);
  const [away, setAway] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (connection !== "live") {
      setShowLive(false);
      return;
    }
    setShowLive(true);
    const t = setTimeout(() => setShowLive(false), LIVE_PILL_MS);
    return () => clearTimeout(t);
  }, [connection]);

  // Restart the clock whenever the turn moves or the seat shows up again.
  const turnAbsent =
    playing && currentTurn !== mySeat && presence[currentTurn] !== true;
  useEffect(() => {
    setAway(false);
    if (!turnAbsent) return;
    const t = setTimeout(() => setAway(true), AWAY_AFTER_MS);
    return () => clearTimeout(t);
  }, [turnAbsent, currentTurn]);

  // One tick per second while the other side is on turn, so the stall notice
  // and the claim unlock on their own.
  const watching = playing && currentTurn !== mySeat && !!lastMoveAt;
  useEffect(() => {
    if (!watching) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [watching, lastMoveAt]);

  const lastMove = lastMoveAt ? Date.parse(lastMoveAt) : NaN;
  const stalled = watching && !Number.isNaN(lastMove) ? Math.max(0, now - lastMove) : 0;
  const stallNotice = stalled >= STALL_NOTICE_MS;
  const claimReady = canClaim && stalled >= CLAIM_AFTER_MS;

  const turnName =
    players.find((p) => p.seat === currentTurn)?.nickname ?? s.opponent;
  const turnText = !playing
    ? ""
    : currentTurn === mySeat
      ? s.yourTurn
      : s.turnOf(turnName);

  let body: React.ReactNode = null;
  if (connection === "offline") {
    body = <Pill tone="red">{s.connectionOffline}</Pill>;
  } else if (connection === "reconnecting") {
    body = <Pill tone="amber">{s.connectionReconnecting}</Pill>;
  } else if (away || stallNotice) {
    body = (
      <div className="leading-tight py-1 space-y-1">
        <p className="font-bold text-amber-300">
          {stallNotice
            ? s.stalledFor(turnName, formatStall(stalled))
            : s.waitingFor(turnName)}
        </p>
        {claimReady ? (
          <button
            type="button"
            onClick={onClaim}
            disabled={claiming}
            className="px-3 py-1 rounded-full bg-amber-400 text-gray-900 text-[11px] font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-60"
          >
            {s.claimWin}
          </button>
        ) : (
          <p className="text-[10px] font-medium opacity-60">
            {away ? s.awayHint : canClaim ? s.claimHint : null}
          </p>
        )}
      </div>
    );
  } else if (showLive) {
    body = <Pill tone="green">{s.connectionLive}</Pill>;
  } else if (turnText) {
    body = (
      <span
        className={
          currentTurn === mySeat
            ? "font-bold text-[var(--accent-light)]"
            : "opacity-70"
        }
      >
        {turnText}
      </span>
    );
  }

  return (
    <>
      <div className="min-h-[1.5rem] px-3 py-0.5 flex items-center justify-center bg-theme-score text-theme-score-text border-t border-white/10 text-[11px] font-semibold text-center">
        {body}
      </div>
      <div aria-live="polite" className="sr-only">
        {turnText}
      </div>
    </>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red";
  children: React.ReactNode;
}) {
  const dot =
    tone === "green"
      ? "bg-green-400"
      : tone === "amber"
        ? "bg-amber-400 animate-pulse"
        : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-px rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-wider">
      <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}
