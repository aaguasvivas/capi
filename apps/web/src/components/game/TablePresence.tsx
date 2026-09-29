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
  /** Seats seen in presence at least once since this page joined. */
  presenceSeen: Partial<Record<Seat, boolean>>;
  currentTurn: Seat;
  /** True while tiles are in play; turn and away states only matter then. */
  playing: boolean;
  /** Null for a spectator. */
  mySeat: Seat | null;
  players: Array<{ seat: string; nickname: string }>;
  /** Server clock of the last move; drives the stall notice and the claim. */
  lastMoveAt?: string;
  /** Turn-based games (iMessage) have no claim window: no stall notice,
   *  away line, warning, or claim. */
  turnBased: boolean;
  /** True when my side may claim once the window closes (seated, other side on turn). */
  canClaim: boolean;
  claiming: boolean;
  onClaim: () => void;
}

// Status line right under the score bar: connection state, whose turn it is,
// a warning once the seat on turn has been gone for a while, a warning to me
// when my own turn runs long, and the claim once the seat on turn has been
// silent past the window. It reserves its height so the board never jumps
// when a state comes or goes, and mirrors the turn text into a polite live
// region for screen readers.
export default function TablePresence({
  connection,
  presence,
  presenceSeen,
  currentTurn,
  playing,
  mySeat,
  players,
  lastMoveAt,
  turnBased,
  canClaim,
  claiming,
  onClaim,
}: Props) {
  const { s } = useI18n();
  const [showLive, setShowLive] = useState(false);
  const [away, setAway] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Claim is two taps: the first asks, the second claims. An in-page step,
  // because window.confirm returns false in the iMessage webview.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (connection !== "live") {
      setShowLive(false);
      return;
    }
    setShowLive(true);
    const t = setTimeout(() => setShowLive(false), LIVE_PILL_MS);
    return () => clearTimeout(t);
  }, [connection]);

  const myTurn = playing && currentTurn === mySeat;

  // Restart the clock whenever the turn moves or the seat shows up again.
  // Only a seat seen in presence during this visit can be away: the 1.0 app
  // never joins presence, so a seat never seen is unknown, not gone.
  const turnAbsent =
    playing &&
    !turnBased &&
    !myTurn &&
    presenceSeen[currentTurn] === true &&
    presence[currentTurn] !== true;
  useEffect(() => {
    setAway(false);
    if (!turnAbsent) return;
    const t = setTimeout(() => setAway(true), AWAY_AFTER_MS);
    return () => clearTimeout(t);
  }, [turnAbsent, currentTurn]);
  // The flag resets in an effect; this keeps a stale one off the render in
  // between (the turn just moved, or the seat just came back).
  const awayNow = away && turnAbsent;

  // One tick per second during a live game, so the stall notice, my own
  // warning, and the claim all appear on their own.
  const clockOn = playing && !turnBased && !!lastMoveAt;
  useEffect(() => {
    if (!clockOn) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [clockOn, lastMoveAt]);

  const lastMove = lastMoveAt ? Date.parse(lastMoveAt) : NaN;
  const stalled = clockOn && !Number.isNaN(lastMove) ? Math.max(0, now - lastMove) : 0;
  const stallNotice = !myTurn && stalled >= STALL_NOTICE_MS;
  // The seat on turn hears about the claim before the other side can use it.
  const warnMe = myTurn && stalled >= STALL_NOTICE_MS;
  const claimReady = canClaim && stalled >= CLAIM_AFTER_MS;

  // A half-finished confirm never outlives the claim window it was for.
  useEffect(() => {
    if (!claimReady) setConfirming(false);
  }, [claimReady]);

  const turnName =
    players.find((p) => p.seat === currentTurn)?.nickname ?? s.opponent;
  const turnText = !playing
    ? ""
    : myTurn
      ? s.yourTurn
      : s.turnOf(turnName);

  let body: React.ReactNode = null;
  if (connection === "offline") {
    body = <Pill tone="red">{s.connectionOffline}</Pill>;
  } else if (connection === "reconnecting") {
    body = <Pill tone="amber">{s.connectionReconnecting}</Pill>;
  } else if (awayNow || stallNotice) {
    body = (
      <div className="leading-tight py-1 space-y-1">
        <p className="font-bold text-amber-300">
          {stallNotice
            ? s.stalledFor(turnName, formatStall(stalled))
            : s.waitingFor(turnName)}
        </p>
        {claimReady ? (
          confirming ? (
            <div className="space-y-1">
              <p className="text-[11px] font-medium">{s.claimWinConfirm}</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={claiming}
                  className="min-h-[44px] px-4 rounded-full bg-white/10 text-xs font-bold hover:bg-white/20 active:scale-95 transition-all disabled:opacity-60"
                >
                  {s.cancel}
                </button>
                <button
                  type="button"
                  onClick={onClaim}
                  disabled={claiming}
                  className="min-h-[44px] px-4 rounded-full bg-amber-400 text-gray-900 text-xs font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-60"
                >
                  {s.claimWin}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="min-h-[44px] px-4 rounded-full bg-amber-400 text-gray-900 text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
            >
              {s.claimWin}
            </button>
          )
        ) : (
          <p className="text-[10px] font-medium opacity-60">
            {awayNow ? s.awayHint : canClaim ? s.claimHint : null}
          </p>
        )}
      </div>
    );
  } else if (warnMe) {
    body = (
      <p className="font-bold text-amber-300 leading-tight py-1">
        {s.claimWarnMe}
      </p>
    );
  } else if (showLive) {
    body = <Pill tone="green">{s.connectionLive}</Pill>;
  } else if (turnText) {
    body = (
      <span
        className={
          myTurn
            ? "font-bold text-[var(--score-accent,var(--accent-light))]"
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
        {warnMe ? s.claimWarnMe : turnText}
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
