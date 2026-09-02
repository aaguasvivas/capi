import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "../lib/supabase";
import { API_BASE } from "../theme";
import type { GameState, Tile, Seat } from "@capi/engine";
import { getNextSeat, placeTileOnBoard, removeTileFromHand } from "@capi/engine";
import { errorKeyFor, normalizeChatPayload, type ErrorKey } from "@capi/i18n";
import type { PlayerSession } from "../lib/session";

export type ConnectionState = "live" | "reconnecting" | "offline";

// Fallback cadence while realtime is down or the table is still forming.
const POLL_INTERVAL_MS = 10_000;

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

export function useRealtimeGame(
  gameId: string,
  session: PlayerSession | null
) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [stateVersion, setStateVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  // Errors travel as string keys so the screen renders them in the player's
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

  const versionRef = useRef(stateVersion);
  versionRef.current = stateVersion;

  // Lets fetchGame tell a first load apart from a background refetch without
  // depending on gameState (which would re-run every effect built on it).
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // The game this render belongs to. Async work compares against it so a
  // response for a game the screen already left never lands in the next one.
  const activeGameRef = useRef(gameId);
  activeGameRef.current = gameId;

  const preOptimisticRef = useRef<GameState | null>(null);

  // A move POST currently awaiting its response. Blocks duplicate
  // submissions (double-taps / button mashing). The server's optimistic
  // lock would reject them anyway, but this avoids the churn and the
  // confusing error flash.
  const moveInFlightRef = useRef(false);

  // Callouts are keyed by the state_version that produced them so a callout
  // the user already dismissed never resurrects on refetch. The DB keeps
  // `lastCallout` inside game_state until the next move clears it, so
  // without this guard any fetchGame() re-shows a dismissed overlay.
  const calloutVersionRef = useRef(0);
  const dismissedCalloutVersionRef = useRef(0);

  // Auto-clear timer for transient move-rejection errors
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref to the broadcast channel so sendChat can access it without recreating
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null
  );

  // Everything above is per game. Expo Router can swap the id in place, so
  // when it changes drop the previous game before any effect for the new one
  // runs. Resetting during render is React's documented way to reset state on
  // a prop change; the refs are cleared alongside.
  const [renderedGameId, setRenderedGameId] = useState(gameId);
  if (renderedGameId !== gameId) {
    setRenderedGameId(gameId);
    setGameState(null);
    setPlayers([]);
    setStateVersion(0);
    setLoading(true);
    setErrorKey(null);
    setConnection("live");
    setPresence({});
    setGameSettings(null);
    setInviteCode(null);
    setLastCallout(null);
    setLastCalloutPayload(null);
    setChatMessages([]);
    preOptimisticRef.current = null;
    moveInFlightRef.current = false;
    calloutVersionRef.current = 0;
    dismissedCalloutVersionRef.current = 0;
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }

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

  // Adopts a server-confirmed state. versionRef is bumped right away so the
  // version guards and the next move POST see it before React re-renders.
  const adoptState = useCallback((gs: GameState | null, sv: number) => {
    preOptimisticRef.current = null;
    versionRef.current = sv;
    setGameState(gs);
    setStateVersion(sv);
  }, []);

  const fetchGame = useCallback(async () => {
    const stale = () => activeGameRef.current !== gameId;
    const fail = (sticky: ErrorKey) => {
      // With a board on screen a failed refetch is a blip, not a dead end.
      if (gameStateRef.current) showTransientError("connectionError");
      else setErrorKey(sticky);
    };
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}`, { cache: "no-store" });
      if (stale()) return;
      if (!res.ok) {
        fail("gameNotFound");
        return;
      }
      const data = await res.json();
      if (stale()) return;
      setPlayers(data.players);
      if (data.game.settings) {
        setGameSettings(data.game.settings);
      }
      if (data.game.invite_code) {
        setInviteCode(data.game.invite_code as string);
      }
      setErrorKey(null);
      // Versions only move forward. Equal is applied too: the fetch is the
      // truth, and replaces an optimistic preview at the same version.
      const sv = data.game.state_version as number;
      if (sv >= versionRef.current) {
        const gs = data.game.game_state as GameState | null;
        adoptState(gs, sv);
        surfaceCallout(gs?.lastCallout, gs?.lastCalloutPayload, sv);
      }
    } catch {
      if (!stale()) fail("connectionError");
    } finally {
      if (!stale()) setLoading(false);
    }
  }, [gameId, adoptState, surfaceCallout, showTransientError]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Re-sync when the app returns to the foreground (a backgrounded phone may
  // have missed realtime updates while suspended).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        fetchGame();
      }
    });
    return () => {
      sub.remove();
    };
  }, [fetchGame]);

  // Realtime is the fast path, not the only one. While the socket is down, or
  // while the table is still forming and no state has arrived, poll so a
  // missed event can only delay an update, never lose it.
  const polling = connection !== "live" || gameState === null;
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(fetchGame, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [polling, fetchGame]);

  // Postgres Changes - game state. Also the connection signal: this is the
  // authoritative stream, so its subscription status is what "live" means.
  useEffect(() => {
    let active = true;
    let subscribedOnce = false;
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
          if (gs && sv >= versionRef.current) {
            adoptState(gs, sv);
            surfaceCallout(gs.lastCallout, gs.lastCalloutPayload, sv);
          } else if (!gs && (updated.status === "playing" || gameStateRef.current)) {
            // The row changed but the event carries no state (the table just
            // started, or the payload was trimmed): the fetch is the truth.
            fetchGame();
          }
        }
      )
      .subscribe((status) => {
        if (!active) return;
        setConnection(status === "SUBSCRIBED" ? "live" : "reconnecting");
        // A rejoin after a drop may have missed events: resync from the server.
        if (status === "SUBSCRIBED") {
          if (subscribedOnce) fetchGame();
          subscribedOnce = true;
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [gameId, fetchGame, adoptState, surfaceCallout]);

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
          fetchGame();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, fetchGame]);

  // Broadcast channel - ephemeral chat delivery, presence, and state fast-path.
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
          const gs = payload.gameState as GameState | undefined;
          // A relayed state is only trusted as the exact next step. A gap
          // means something was missed, so the server is asked instead.
          if (gs && sv === versionRef.current + 1) {
            adoptState(gs, sv);
            surfaceCallout(
              payload.callout as string | null,
              (payload.calloutPayload as Record<string, unknown> | null) ??
                undefined,
              sv
            );
          } else if (sv > versionRef.current) {
            fetchGame();
          }
        }
      )
      .on(
        "broadcast",
        { event: "chat" },
        ({ payload }: { payload: ChatBroadcastPayload }) => {
          if (!payload?.playerId) return;
          if (payload.type !== "quick_chat" && payload.type !== "emote") return;
          // Predefined phrases only: anything else on the channel is dropped.
          const canonical = normalizeChatPayload(payload.type, payload.payload);
          if (!canonical) return;

          const msg: ChatMessage = {
            id: `${Date.now()}-${Math.random()}`,
            playerId: payload.playerId,
            seat: payload.seat,
            type: payload.type,
            payload: canonical,
            isMe: payload.playerId === session?.playerId,
          };

          setChatMessages((prev) => {
            // Keep at most 3 newest messages
            const next = [...prev, msg];
            return next.slice(-3);
          });
        }
      )
      .on("presence", { event: "sync" }, () => {
        if (!active) return;
        const next: Partial<Record<Seat, boolean>> = {};
        for (const entries of Object.values(
          channel.presenceState<{ seat?: string }>()
        )) {
          for (const entry of entries) {
            if (entry.seat) next[entry.seat as Seat] = true;
          }
        }
        setPresence(next);
      })
      .subscribe((status) => {
        if (!active) return;
        // Presence lives per join, so the seat is announced after every rejoin.
        if (status === "SUBSCRIBED" && session?.seat) {
          channel.track({ seat: session.seat });
        }
      });

    chatChannelRef.current = channel;

    return () => {
      active = false;
      supabase.removeChannel(channel);
      chatChannelRef.current = null;
    };
  }, [gameId, session?.playerId, session?.seat, fetchGame, adoptState, surfaceCallout]);

  // Resolves true only when the server accepted the move.
  const submitMove = useCallback(
    async (intent: MoveIntentPayload): Promise<boolean> => {
      if (!session) return false;
      if (moveInFlightRef.current) return false;
      moveInFlightRef.current = true;
      const stale = () => activeGameRef.current !== gameId;
      const revertOptimistic = () => {
        if (preOptimisticRef.current) {
          setGameState(preOptimisticRef.current);
          preOptimisticRef.current = null;
        }
      };

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
        const res = await fetch(`${API_BASE}/api/games/${gameId}/move`, {
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
        if (stale()) return false;

        if (res.status === 409 && data.stale) {
          // The board was behind the server: drop the preview and catch up.
          revertOptimistic();
          await fetchGame();
          return false;
        }

        if (!res.ok) {
          revertOptimistic();
          showTransientError(errorKeyFor(data.error));
          return false;
        }

        adoptState(data.gameState, data.stateVersion);
        setErrorKey(null);

        if (data.callout) {
          surfaceCallout(
            data.callout,
            data.calloutPayload ?? null,
            data.stateVersion
          );
        }

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
        if (stale()) return false;
        revertOptimistic();
        showTransientError("connectionError");
        return false;
      } finally {
        if (!stale()) moveInFlightRef.current = false;
      }
    },
    [gameId, session, fetchGame, gameState, adoptState, surfaceCallout, showTransientError]
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

      // Broadcast to the other players instantly (ephemeral)
      chatChannelRef.current?.send({
        type: "broadcast",
        event: "chat",
        payload: broadcastPayload,
      });

      // Persist for audit - fire and forget
      fetch(`${API_BASE}/api/games/${gameId}/chat`, {
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

  const dismissChat = useCallback((id: string) => {
    setChatMessages((prev) => prev.filter((m) => m.id !== id));
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
    dismissChat,
    refetch: fetchGame,
  };
}
