"use client";

import { useEffect, useState } from "react";
import type { Seat } from "@capi/engine";
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
}

// Status line right under the score bar: connection state, whose turn it is,
// and a warning once the seat on turn has been gone for a while. It reserves
// its height so the board never jumps when a state comes or goes, and mirrors
// the turn text into a polite live region for screen readers.
export default function TablePresence({
  connection,
  presence,
  currentTurn,
  playing,
  mySeat,
  players,
}: Props) {
  const { s } = useI18n();
  const [showLive, setShowLive] = useState(false);
  const [away, setAway] = useState(false);

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
  } else if (away) {
    body = (
      <div className="leading-tight py-0.5">
        <p className="font-bold text-amber-300">{s.waitingFor(turnName)}</p>
        <p className="text-[10px] font-medium opacity-60">{s.awayHint}</p>
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
