"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { CalloutPayload, GameState, Seat, Tile } from "@capi/engine";
import {
  getNextSeat,
  placeTileOnBoard,
  removeTileFromHand,
} from "@capi/engine";
import {
  chatWireText,
  errorKeyFor,
  normalizeChatPayload,
  type ErrorKey,
  type Lang,
} from "@capi/i18n";
import { clearPendingMove, markPendingMove, settleHandoff } from "@/lib/imessageBridge";
import { isImessageEmbed } from "@/lib/embed";

export type ConnectionState = "live" | "reconnecting" | "offline";

// A seat that passed, as seen in the confirmed state. The key changes on
// every pass so the page can react to the same seat passing twice.
export interface LastPass {
  seat: Seat;
  key: number;
}

interface PlayerSession {
  playerId: string;
  seat: string;
  gameId: string;
}

interface PlayerRecord {
  id: string;
  seat: string;
  nickname: string;
  avatar_color: string;
  game_id: string;
}

interface MoveIntentPayload {
  type: "play" | "pass" | "draw";
  tile?: [number, number];
  end?: "left" | "right";
}

export interface ChatMessage {
  id: string;
  playerId: string;
  seat: string;
  type: "quick_chat" | "emote";
  payload: string;
  isMe: boolean;
}

interface ChatBroadcastPayload {
  playerId: string;
  seat: string;
  type: "quick_chat" | "emote";
  payload: string;
}

// Poll cadence while realtime cannot be trusted: a degraded socket, or a
// lobby that has no game state yet.
const POLL_MS = 10_000;
// A table that has heard of no newer state for this long asks the server
// again and relays the answer (see the idle resync effect).
const IDLE_RESYNC_MS = 10_000;
const IDLE_CHECK_MS = 2_000;
const IDLE_RESYNC_STOP_MS = 30 * 60_000;
// A move request that has not answered by now is treated as lost.
const MOVE_TIMEOUT_MS = 15_000;

// The highest callout version this device dismissed for a table. Kept in
// storage because the iMessage drawer reloads the page on every open, and
// the row keeps lastCallout until the next move: without it, the winner saw
// the same DOMINÓ again on each reopen.
function readDismissedCallout(gameId: string): number {
  try {
    const raw = Number(localStorage.getItem(`capi_callout_seen_${gameId}`));
    return Number.isFinite(raw) ? raw : 0;
  } catch {
    return 0;
  }
}

function writeDismissedCallout(gameId: string, version: number) {
  try {
    localStorage.setItem(`capi_callout_seen_${gameId}`, String(version));
  } catch {
    /* storage blocked: the callout shows again after a reload */
  }
}

// A degraded socket while the browser itself reports no network is
// "offline"; otherwise a rejoin is in progress.
function degradedConnection(): ConnectionState {
  return navigator.onLine === false ? "offline" : "reconnecting";
}

// The seat that passed between two confirmed states, or null. A pass keeps
// the round, the board and the passer's hand as they were, moves the turn
// on, and adds to the pass count.
function passedSeat(prev: GameState | null, next: GameState | null): Seat | null {
  if (!prev || !next) return null;
  const seat = prev.currentTurn;
  if (
    next.roundIndex === prev.roundIndex &&
    next.board?.length === prev.board?.length &&
    next.hands?.[seat]?.length === prev.hands?.[seat]?.length &&
    next.currentTurn !== seat &&
    next.consecutivePasses > prev.consecutivePasses
  ) {
    return seat;
  }
  return null;
}

export function useRealtimeGame(
  gameId: string,
  session: PlayerSession | null
) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [stateVersion, setStateVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  // Errors travel as string keys so the page renders them in the player's
  // language (see errors.ts in @capi/i18n).
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("live");
  // Seats currently connected to the table, from channel presence.
  const [presence, setPresence] = useState<Partial<Record<Seat, boolean>>>({});
  // Seats that have shown up in presence at least once for this game. The
  // 1.0 app never joins presence, so a seat never seen is unknown, not away.
  const [presenceSeen, setPresenceSeen] = useState<Partial<Record<Seat, boolean>>>({});
  const [lastPass, setLastPass] = useState<LastPass | null>(null);
  const [gameSettings, setGameSettings] = useState<{ is2v2: boolean; targetScore: number } | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [lastCallout, setLastCallout] = useState<string | null>(null);
  const [lastCalloutPayload, setLastCalloutPayload] = useState<CalloutPayload | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Highest state version applied so far. Written at every apply site (not
  // on render) so realtime callbacks that fire before React re-renders still
  // compare against what was actually applied.
  const versionRef = useRef(0);
  // When versionRef last moved forward, from any source. The idle resync
  // measures from here.
  const lastChangeAtRef = useRef(Date.now());
  const lastResyncAtRef = useRef(0);
  // Whether a fetch for this game has succeeded. Before that a failure is
  // the error screen; after it, a failure is a connection blip.
  const loadedRef = useRef(false);
  // The last confirmed state applied, to spot passes between two of them.
  const serverStateRef = useRef<GameState | null>(null);
  const passKeyRef = useRef(0);
  // The game this hook instance is currently serving. Responses that belong
  // to a previous table (rematch navigation) are dropped on arrival.
  const activeGameIdRef = useRef(gameId);

  const preOptimisticRef = useRef<GameState | null>(null);

  // A move POST currently awaiting its response. Blocks duplicate
  // submissions (double-clicks / button mashing). The server's optimistic
  // lock would reject them anyway, but this avoids the churn and the
  // confusing error flash.
  const moveInFlightRef = useRef(false);

  // Callouts are keyed by the state_version that produced them so a callout
  // the user already dismissed never resurrects on refetch. The DB keeps
  // `lastCallout` inside game_state until the next move clears it, so
  // without this guard any fetchGame() re-shows a dismissed overlay.
  const calloutVersionRef = useRef(0);
  const dismissedCalloutVersionRef = useRef(0);

  // Auto-clear timer for transient errors
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref to the broadcast channel so sendChat can access it without recreating
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null
  );
  // Last status the game channel reported: true after SUBSCRIBED, false after
  // anything else. The online handler reads it to pick a banner state.
  const gameChannelLiveRef = useRef(false);
  // The chat channel is joined, so presence can be tracked on it right now.
  const chatChannelJoinedRef = useRef(false);

  // Session fields the channel handlers read. Refs keep the chat channel
  // from tearing down and rejoining when the session loads.
  const playerIdRef = useRef<string | null>(null);
  playerIdRef.current = session?.playerId ?? null;
  const seatRef = useRef<string | null>(null);
  seatRef.current = session?.seat ?? null;

  const surfaceCallout = useCallback(
    (
      callout: string | null | undefined,
      payload: CalloutPayload | null | undefined,
      version: number
    ) => {
      if (!callout) {
        setLastCallout(null);
        setLastCalloutPayload(null);
        return;
      }
      if (version <= Math.max(dismissedCalloutVersionRef.current, readDismissedCallout(gameId))) {
        return;
      }
      calloutVersionRef.current = version;
      setLastCallout(callout);
      setLastCalloutPayload(payload ?? null);
    },
    [gameId]
  );

  const showTransientError = useCallback((key: ErrorKey) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setErrorKey(key);
    errorTimerRef.current = setTimeout(() => {
      setErrorKey(null);
      errorTimerRef.current = null;
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  // Per-game reset. Navigating from a finished game straight to its rematch
  // reuses this hook instance, and nothing from the old table may carry
  // over: callout suppression, in-flight flags, stale state or chat.
  useEffect(() => {
    if (activeGameIdRef.current === gameId) return;
    activeGameIdRef.current = gameId;
    versionRef.current = 0;
    lastChangeAtRef.current = Date.now();
    lastResyncAtRef.current = 0;
    loadedRef.current = false;
    serverStateRef.current = null;
    preOptimisticRef.current = null;
    moveInFlightRef.current = false;
    calloutVersionRef.current = 0;
    dismissedCalloutVersionRef.current = 0;
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setGameState(null);
    setPlayers([]);
    setStateVersion(0);
    setLoading(true);
    setErrorKey(null);
    setChatMessages([]);
    setGameSettings(null);
    setInviteCode(null);
    setLastCallout(null);
    setLastCalloutPayload(null);
    setPresence({});
    setPresenceSeen({});
    setLastPass(null);
  }, [gameId]);

  // Single writer for authoritative state. Callers guard on version; this
  // records the version right away so later guards see it before React
  // re-renders, and drops any optimistic snapshot (a newer truth is in, so a
  // failed move must never revert to an older one).
  const applyServerState = useCallback(
    (
      gs: GameState | null,
      sv: number,
      callout: string | null | undefined,
      calloutPayload: CalloutPayload | null | undefined
    ) => {
      preOptimisticRef.current = null;
      if (sv > versionRef.current) lastChangeAtRef.current = Date.now();
      versionRef.current = sv;
      const passer = passedSeat(serverStateRef.current, gs);
      serverStateRef.current = gs;
      setGameState(gs);
      setStateVersion(sv);
      surfaceCallout(callout, calloutPayload, sv);
      if (passer) {
        passKeyRef.current += 1;
        setLastPass({ seat: passer, key: passKeyRef.current });
      }
      // The drawer's bubble for this device's own move, whichever path
      // brought the state that move produced.
      settleHandoff(gameId, gs, sv, (seatRef.current as Seat | null) ?? null);
    },
    [gameId, surfaceCallout]
  );

  // Resolves to the row's state when the fetch succeeded and was applied
  // (null otherwise), so the idle resync can relay exactly what it adopted.
  const fetchGame = useCallback(async (): Promise<{
    gs: GameState | null;
    sv: number;
  } | null> => {
    // Once the game has loaded, a failed refetch (poll, resync, tab shown)
    // is a blip: the lobby or table stays, and the connection status says
    // so. Only a failed first load shows the error screen.
    const fail = (key: ErrorKey) => {
      if (loadedRef.current) setConnection(degradedConnection());
      else setErrorKey(key);
    };
    try {
      const res = await fetch(`/api/games/${gameId}`, { cache: "no-store" });
      if (activeGameIdRef.current !== gameId) return null;
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (activeGameIdRef.current !== gameId) return null;
        fail(
          errorKeyFor(
            body?.error,
            res.status === 404 ? "gameNotFound" : "connectionError"
          )
        );
        return null;
      }
      const data = await res.json();
      if (activeGameIdRef.current !== gameId) return null;
      loadedRef.current = true;
      // The server answered: with the socket joined, the table is live again
      // even if an earlier refetch marked it degraded.
      if (gameChannelLiveRef.current) setConnection("live");
      const sv = data.game.state_version as number;
      setPlayers(data.players);
      if (data.game.settings) {
        setGameSettings(data.game.settings);
      }
      if (data.game.invite_code) {
        setInviteCode(data.game.invite_code as string);
      }
      setErrorKey(null);
      // Never roll the table backwards: a slow response that lands after a
      // realtime update (or a later fetch) only refreshes the data above. An
      // equal version is the truth too, except while this player's move is
      // in flight: it would put the tile being played back in the hand.
      if (sv > versionRef.current || (sv === versionRef.current && !moveInFlightRef.current)) {
        const gs = data.game.game_state as GameState | null;
        applyServerState(gs, sv, gs?.lastCallout, gs?.lastCalloutPayload);
        return { gs, sv };
      }
      return null;
    } catch {
      if (activeGameIdRef.current !== gameId) return null;
      fail("connectionError");
      return null;
    } finally {
      if (activeGameIdRef.current === gameId) setLoading(false);
    }
  }, [gameId, applyServerState]);

  useEffect(() => {
    void fetchGame();
  }, [fetchGame]);

  // Postgres Changes - game state (authoritative)
  useEffect(() => {
    let active = true;
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          const sv = updated.state_version as number;
          const gs = updated.game_state as GameState | null;
          if (typeof sv !== "number" || sv < versionRef.current) return;
          if (sv === versionRef.current && moveInFlightRef.current) return;
          // A row without a state body (lobby updates, or the moment the
          // status flips to playing): the fetch has the full picture.
          if (!gs) {
            void fetchGame();
            return;
          }
          // Row data wins at the current version too, so a broadcast of the
          // same version never outranks the database.
          applyServerState(gs, sv, gs.lastCallout, gs.lastCalloutPayload);
        }
      )
      .subscribe((status) => {
        if (!active) return;
        if (status !== "SUBSCRIBED") {
          gameChannelLiveRef.current = false;
          setConnection(degradedConnection());
          return;
        }
        gameChannelLiveRef.current = true;
        setConnection("live");
        // Catch up on every join. A rejoin follows a socket that was down,
        // and the first join can follow a move made after the first fetch.
        void fetchGame();
      });

    return () => {
      active = false;
      gameChannelLiveRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [gameId, fetchGame, applyServerState]);

  // Postgres Changes - players joining
  useEffect(() => {
    const channel = supabase
      .channel(`players-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "players",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          void fetchGame();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, fetchGame]);

  // Broadcast channel - ephemeral chat delivery + state fast-path.
  // postgres_changes delivers the authoritative update but its fanout adds
  // hundreds of ms; the mover already holds the server-confirmed state when
  // the move POST returns, so it broadcasts it here and the other players
  // apply it immediately. The version guard makes the later postgres event
  // a no-op, and remains the fallback if a broadcast is missed.
  useEffect(() => {
    let active = true;
    const channel = supabase
      .channel(`chat-${gameId}`, {
        config: { broadcast: { self: false } },
      })
      .on(
        "broadcast",
        { event: "state" },
        ({ payload }: { payload: Record<string, unknown> }) => {
          if (!payload || typeof payload.stateVersion !== "number") return;
          const sv = payload.stateVersion as number;
          const gs = payload.gameState;
          if (sv <= versionRef.current) return;
          // Only the very next version is trusted from a peer. Anything
          // further ahead means an update was missed, and a payload with no
          // state body is not worth applying: the row is the source of truth.
          if (sv !== versionRef.current + 1 || !gs || typeof gs !== "object") {
            void fetchGame();
            return;
          }
          applyServerState(
            gs as GameState,
            sv,
            payload.callout as string | null,
            (payload.calloutPayload as CalloutPayload | null) ??
              undefined
          );
        }
      )
      .on(
        "broadcast",
        { event: "chat" },
        ({ payload }: { payload: ChatBroadcastPayload }) => {
          if (!payload?.playerId) return;
          // Predefined phrases only: anything else on the channel is dropped.
          const canonical = normalizeChatPayload(payload.type, payload.payload);
          if (!canonical) return;

          const msg: ChatMessage = {
            id: `${Date.now()}-${Math.random()}`,
            playerId: payload.playerId,
            seat: payload.seat,
            type: payload.type,
            payload: canonical,
            isMe: payload.playerId === playerIdRef.current,
          };

          setChatMessages((prev) => {
            // Keep at most 3 newest messages
            const next = [...prev, msg];
            return next.slice(-3);
          });
        }
      )
      .on("presence", { event: "sync" }, () => {
        const next: Partial<Record<Seat, boolean>> = {};
        for (const entries of Object.values(channel.presenceState())) {
          for (const entry of entries as Array<{ seat?: string }>) {
            if (entry.seat) next[entry.seat as Seat] = true;
          }
        }
        setPresence(next);
        setPresenceSeen((prev) =>
          (Object.keys(next) as Seat[]).every((seat) => prev[seat])
            ? prev
            : { ...prev, ...next }
        );
      })
      .subscribe((status) => {
        if (!active) return;
        chatChannelJoinedRef.current = status === "SUBSCRIBED";
        // Presence lives on the join: every rejoin needs a fresh track, with
        // whatever seat is current at that moment.
        if (status === "SUBSCRIBED" && seatRef.current) {
          void channel.track({ seat: seatRef.current });
        }
      });

    chatChannelRef.current = channel;

    return () => {
      active = false;
      chatChannelJoinedRef.current = false;
      chatChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [gameId, fetchGame, applyServerState]);

  // The session usually loads after the chat channel joined: track as soon
  // as a seat is known, and again if it changes. Before the join, the
  // subscribe callback above tracks it.
  useEffect(() => {
    const seat = session?.seat;
    if (!seat || !chatChannelJoinedRef.current) return;
    void chatChannelRef.current?.track({ seat });
  }, [session?.seat]);

  // Asks the server for the row and relays it as the next "state" message.
  // A screen that missed an update catches up from it: newer clients take
  // the next version or refetch, and the 1.0 app, which never polls and never
  // refetches after a rejoin, applies any newer version. Screens that are
  // current drop it.
  const resync = useCallback(async () => {
    const row = await fetchGame();
    // Spectators only catch up; the seated players relay.
    if (!row?.gs || !playerIdRef.current) return;
    chatChannelRef.current?.send({
      type: "broadcast",
      event: "state",
      payload: {
        gameState: row.gs,
        stateVersion: row.sv,
        callout: row.gs.lastCallout ?? null,
        calloutPayload: row.gs.lastCalloutPayload ?? null,
      },
    });
  }, [fetchGame]);

  // Realtime is the fast path, never the only path. While the socket is
  // degraded, or while the table has no state yet (lobby), poll the row. A
  // table in play relays each poll too: a send without a joined socket goes
  // out over REST, so a degraded screen still unsticks a 1.0 opponent.
  const hasGameState = gameState !== null;
  useEffect(() => {
    if (connection === "live" && hasGameState) return;
    const timer = setInterval(() => {
      void (hasGameState ? resync() : fetchGame());
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [connection, hasGameState, fetchGame, resync]);

  // A live socket can still have dropped an event, and then every screen
  // waits on another one. So a table that has heard of no newer state for
  // IDLE_RESYNC_MS resyncs, and again every IDLE_RESYNC_MS while it stays
  // quiet. The check runs often; the request only goes out when quiet.
  // A hidden tab keeps it up while a round is on, because its relay is what
  // unsticks a 1.0 opponent; a finished table only while it is on screen.
  // A table quiet for IDLE_RESYNC_STOP_MS is abandoned and stops asking.
  useEffect(() => {
    if (connection !== "live" || !hasGameState) return;
    const timer = setInterval(() => {
      if (moveInFlightRef.current) return;
      const gs = serverStateRef.current;
      const finished = gs?.phase === "finished";
      // A finished table has nothing left to relay once its rematch exists.
      if (finished && (gs?.rematchGameId || document.visibilityState === "hidden")) return;
      if (Date.now() - lastChangeAtRef.current > IDLE_RESYNC_STOP_MS) return;
      const quietSince = Math.max(lastChangeAtRef.current, lastResyncAtRef.current);
      if (Date.now() - quietSince < IDLE_RESYNC_MS) return;
      lastResyncAtRef.current = Date.now();
      void resync();
    }, IDLE_CHECK_MS);
    return () => clearInterval(timer);
  }, [connection, hasGameState, resync]);

  // Catch up whenever the page comes back (tab shown, network back), and
  // mirror the browser's own network signal in the banner.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void fetchGame();
    };
    const onOnline = () => {
      // The socket may have survived a short blip: trust the last status the
      // channel reported, and let a rejoin (if one follows) correct it.
      setConnection(gameChannelLiveRef.current ? "live" : "reconnecting");
      void fetchGame();
    };
    const onOffline = () => setConnection("offline");
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [fetchGame]);

  // Resolves true only when the server accepted the move.
  const submitMove = useCallback(
    async (intent: MoveIntentPayload): Promise<boolean> => {
      if (!session) return false;
      if (moveInFlightRef.current) return false;
      moveInFlightRef.current = true;

      // Optimistic update for play moves - instant visual feedback
      if (
        intent.type === "play" &&
        intent.tile &&
        intent.end &&
        gameState
      ) {
        const seat = session.seat as Seat;
        const tile = intent.tile as Tile;
        const newHand = removeTileFromHand(
          gameState.hands[seat] ?? [],
          tile
        );
        const newBoard = placeTileOnBoard(gameState.board, tile, intent.end);
        const nextTurn = getNextSeat(seat, gameState.is2v2);

        preOptimisticRef.current = gameState;
        setGameState({
          ...gameState,
          hands: { ...gameState.hands, [seat]: newHand },
          board: newBoard,
          currentTurn: nextTurn,
        });
      }

      // In the drawer, the move's bubble goes out when this device sees the
      // state the move produced (settleHandoff), even if this answer is lost.
      if (isImessageEmbed(new URLSearchParams(window.location.search))) {
        markPendingMove(gameId, versionRef.current);
      }

      // A request stuck on a half-open connection would keep every later tap
      // blocked; give up and ask the server what landed. A plain timer, since
      // AbortSignal.timeout is missing before iOS 16 (the drawer's WebKit).
      const abort = new AbortController();
      const abortTimer = setTimeout(() => abort.abort(), MOVE_TIMEOUT_MS);
      try {
        const res = await fetch(`/api/games/${gameId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: session.playerId,
            seat: session.seat,
            intent,
            stateVersion: versionRef.current,
          }),
          signal: abort.signal,
        });

        const data = await res.json();
        // The table changed underneath this request (rematch navigation).
        if (activeGameIdRef.current !== gameId) return false;

        if (res.status === 409 && data.stale) {
          // Put the confirmed state back before catching up, so a failed
          // refetch never leaves the optimistic board on screen.
          if (preOptimisticRef.current) {
            setGameState(preOptimisticRef.current);
            preOptimisticRef.current = null;
          }
          await fetchGame();
          return false;
        }

        if (!res.ok) {
          // Refused: no state follows from this move, so no bubble either.
          clearPendingMove(gameId);
          // Revert optimistic update
          if (preOptimisticRef.current) {
            setGameState(preOptimisticRef.current);
            preOptimisticRef.current = null;
          }
          showTransientError(errorKeyFor(data.error));
          return false;
        }

        // Accepted. Apply unless a newer version already landed through
        // realtime while this response was in flight.
        if (data.stateVersion >= versionRef.current) {
          applyServerState(
            data.gameState,
            data.stateVersion,
            data.callout ?? null,
            data.calloutPayload ?? null
          );
        }
        setErrorKey(null);

        // State fast-path: hand the confirmed state to the other players
        // directly, since they'd otherwise wait on the postgres_changes fanout.
        chatChannelRef.current?.send({
          type: "broadcast",
          event: "state",
          payload: {
            gameState: data.gameState,
            stateVersion: data.stateVersion,
            callout: data.callout ?? null,
            calloutPayload: data.calloutPayload ?? null,
          },
        });
        return true;
      } catch {
        if (activeGameIdRef.current !== gameId) return false;
        if (preOptimisticRef.current) {
          setGameState(preOptimisticRef.current);
          preOptimisticRef.current = null;
        }
        showTransientError("connectionError");
        // The move may have landed with its answer lost: ask the server.
        moveInFlightRef.current = false;
        void fetchGame();
        return false;
      } finally {
        clearTimeout(abortTimer);
        moveInFlightRef.current = false;
      }
    },
    [
      gameId,
      session,
      fetchGame,
      gameState,
      applyServerState,
      showTransientError,
    ]
  );

  const sendChat = useCallback(
    async (type: "quick_chat" | "emote", payload: string, lang: Lang) => {
      if (!session) return;
      const canonical = normalizeChatPayload(type, payload);
      if (!canonical) return;

      // The wire carries the phrase text in the sender's language, because
      // the 1.0 app prints the payload as is. Newer receivers map the text
      // back to the id.
      const broadcastPayload: ChatBroadcastPayload = {
        playerId: session.playerId,
        seat: session.seat,
        type,
        payload: chatWireText(type, canonical, lang),
      };

      // Add to local state immediately (sender sees their own message)
      const msg: ChatMessage = {
        id: `${Date.now()}-${Math.random()}`,
        playerId: session.playerId,
        seat: session.seat,
        type,
        payload: canonical,
        isMe: true,
      };
      setChatMessages((prev) => [...prev, msg].slice(-3));

      // Broadcast to the other player instantly (ephemeral)
      chatChannelRef.current?.send({
        type: "broadcast",
        event: "chat",
        payload: broadcastPayload,
      });

      // Persist for audit - fire and forget
      fetch(`/api/games/${gameId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: session.playerId,
          type,
          payload: canonical,
        }),
      }).catch(() => {});
    },
    [gameId, session]
  );

  const clearCallout = useCallback(() => {
    // Record the dismissal so a refetch of the same state version doesn't
    // resurrect the overlay (the DB keeps lastCallout until the next move).
    dismissedCalloutVersionRef.current = Math.max(
      dismissedCalloutVersionRef.current,
      calloutVersionRef.current
    );
    writeDismissedCallout(gameId, dismissedCalloutVersionRef.current);
    setLastCallout(null);
    setLastCalloutPayload(null);
  }, [gameId]);

  return {
    gameState,
    gameSettings,
    inviteCode,
    players,
    stateVersion,
    loading,
    errorKey,
    connection,
    presence,
    presenceSeen,
    lastPass,
    lastCallout,
    lastCalloutPayload,
    chatMessages,
    submitMove,
    sendChat,
    clearCallout,
    refetch: fetchGame,
  };
}
