"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { GameState, Tile, Seat } from "@capi/engine";
import {
  getNextSeat,
  getTeam,
  getOpponentTeam,
  placeTileOnBoard,
  removeTileFromHand,
} from "@capi/engine";
import { errorKeyFor, normalizeChatPayload, type ErrorKey } from "@capi/i18n";
import { postToExtension } from "@/lib/imessageBridge";

export type ConnectionState = "live" | "reconnecting" | "offline";

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

// A degraded socket while the browser itself reports no network is
// "offline"; otherwise a rejoin is in progress.
function degradedConnection(): ConnectionState {
  return navigator.onLine === false ? "offline" : "reconnecting";
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
  const [gameSettings, setGameSettings] = useState<{ is2v2: boolean; targetScore: number } | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [lastCallout, setLastCallout] = useState<string | null>(null);
  const [lastCalloutPayload, setLastCalloutPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Highest state version applied so far. Written at every apply site (not
  // on render) so realtime callbacks that fire before React re-renders still
  // compare against what was actually applied.
  const versionRef = useRef(0);
  // Whether an authoritative game state has been applied for this game. It
  // decides if a fetch failure is a sticky banner or a transient flash.
  const hasStateRef = useRef(false);
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
      payload: Record<string, unknown> | null | undefined,
      version: number
    ) => {
      if (!callout) {
        setLastCallout(null);
        setLastCalloutPayload(null);
        return;
      }
      if (version <= dismissedCalloutVersionRef.current) return;
      calloutVersionRef.current = version;
      setLastCallout(callout);
      setLastCalloutPayload(payload ?? null);
    },
    []
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
    hasStateRef.current = false;
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
      calloutPayload: Record<string, unknown> | null | undefined
    ) => {
      preOptimisticRef.current = null;
      versionRef.current = sv;
      hasStateRef.current = gs !== null;
      setGameState(gs);
      setStateVersion(sv);
      surfaceCallout(callout, calloutPayload, sv);
    },
    [surfaceCallout]
  );

  const fetchGame = useCallback(async () => {
    // Background refetches (polls, resync) must not pin a permanent banner
    // over a table that is already rendered: flash instead.
    const fail = (key: ErrorKey) => {
      if (hasStateRef.current) showTransientError(key);
      else setErrorKey(key);
    };
    try {
      const res = await fetch(`/api/games/${gameId}`, { cache: "no-store" });
      if (activeGameIdRef.current !== gameId) return;
      if (!res.ok) {
        fail(res.status === 404 ? "gameNotFound" : "connectionError");
        return;
      }
      const data = await res.json();
      if (activeGameIdRef.current !== gameId) return;
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
      // realtime update (or a later fetch) only refreshes the data above.
      if (sv >= versionRef.current) {
        const gs = data.game.game_state as GameState | null;
        applyServerState(gs, sv, gs?.lastCallout, gs?.lastCalloutPayload);
      }
    } catch {
      if (activeGameIdRef.current !== gameId) return;
      fail("connectionError");
    } finally {
      if (activeGameIdRef.current === gameId) setLoading(false);
    }
  }, [gameId, applyServerState, showTransientError]);

  useEffect(() => {
    void fetchGame();
  }, [fetchGame]);

  // Postgres Changes - game state (authoritative)
  useEffect(() => {
    let active = true;
    let subscribedBefore = false;
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
        // Every join after the first is a recovered socket: whatever moved
        // while it was down never reached this client, so catch up.
        if (subscribedBefore) void fetchGame();
        subscribedBefore = true;
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
            (payload.calloutPayload as Record<string, unknown> | null) ??
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

  // Realtime is the fast path, never the only path. While the socket is
  // degraded, or while the table has no state yet (lobby), poll the row.
  const hasGameState = gameState !== null;
  useEffect(() => {
    if (connection === "live" && hasGameState) return;
    const timer = setInterval(() => {
      void fetchGame();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [connection, hasGameState, fetchGame]);

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

        // Emit on server-confirmed turn changes only (plays and passes);
        // terminal phases are covered by the roundOver/gameOver effects, and
        // rejected moves must not post a bubble.
        if (
          (intent.type === "play" || intent.type === "pass") &&
          data.gameState.phase === "playing"
        ) {
          const myTeam = getTeam(session.seat as Seat, data.gameState.is2v2);
          const oppTeam = getOpponentTeam(myTeam);
          postToExtension({
            type: "moved",
            myScore: data.gameState.scores[myTeam],
            oppScore: data.gameState.scores[oppTeam],
          });
        }
        return true;
      } catch {
        if (activeGameIdRef.current !== gameId) return false;
        if (preOptimisticRef.current) {
          setGameState(preOptimisticRef.current);
          preOptimisticRef.current = null;
        }
        showTransientError("connectionError");
        return false;
      } finally {
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
    async (type: "quick_chat" | "emote", payload: string) => {
      if (!session) return;
      const canonical = normalizeChatPayload(type, payload);
      if (!canonical) return;

      const broadcastPayload: ChatBroadcastPayload = {
        playerId: session.playerId,
        seat: session.seat,
        type,
        payload: canonical,
      };

      // Add to local state immediately (sender sees their own message)
      const msg: ChatMessage = {
        id: `${Date.now()}-${Math.random()}`,
        ...broadcastPayload,
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
    setLastCallout(null);
    setLastCalloutPayload(null);
  }, []);

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
    lastCallout,
    lastCalloutPayload,
    chatMessages,
    submitMove,
    sendChat,
    clearCallout,
    refetch: fetchGame,
  };
}
