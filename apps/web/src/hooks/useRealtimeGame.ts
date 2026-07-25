"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { GameState, Tile, Seat } from "@capi/engine";
import { getNextSeat } from "@capi/engine";

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

function tileEqual(a: Tile, b: Tile): boolean {
  return (
    (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])
  );
}

function placeTileOnBoard(
  board: Tile[],
  tile: Tile,
  end: "left" | "right"
): Tile[] {
  const [a, b] = tile;
  if (board.length === 0) return [[a, b]];
  if (end === "left") {
    const leftEnd = board[0][0];
    const match = a === leftEnd ? b : a;
    return [[match, leftEnd] as Tile, ...board];
  } else {
    const rightEnd = board[board.length - 1][1];
    const match = a === rightEnd ? b : a;
    return [...board, [rightEnd, match] as Tile];
  }
}

function removeTileFromHand(hand: Tile[], tile: Tile): Tile[] {
  const idx = hand.findIndex((t) => tileEqual(t, tile));
  if (idx < 0) return hand;
  return [...hand.slice(0, idx), ...hand.slice(idx + 1)];
}

export function useRealtimeGame(
  gameId: string,
  session: PlayerSession | null
) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [stateVersion, setStateVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const preOptimisticRef = useRef<GameState | null>(null);

  // A move POST currently awaiting its response. Blocks duplicate
  // submissions (double-clicks / button mashing) — the server's optimistic
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

  const showTransientError = useCallback((message: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError(message);
    errorTimerRef.current = setTimeout(() => {
      setError(null);
      errorTimerRef.current = null;
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Game not found");
        return;
      }
      const data = await res.json();
      const gs = data.game.game_state as GameState | null;
      setGameState(gs);
      setStateVersion(data.game.state_version);
      setPlayers(data.players);
      if (data.game.settings) {
        setGameSettings(data.game.settings);
      }
      if (data.game.invite_code) {
        setInviteCode(data.game.invite_code as string);
      }
      setError(null);
      surfaceCallout(
        gs?.lastCallout,
        gs?.lastCalloutPayload,
        data.game.state_version
      );
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }, [gameId, surfaceCallout]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Postgres Changes - game state
  useEffect(() => {
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
          if (sv > versionRef.current) {
            preOptimisticRef.current = null;
            setGameState(gs);
            setStateVersion(sv);
            surfaceCallout(gs?.lastCallout, gs?.lastCalloutPayload, sv);
          }
          if (updated.status === "playing" && !gs) {
            fetchGame();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, fetchGame, surfaceCallout]);

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

  // Broadcast channel - ephemeral chat delivery + state fast-path.
  // postgres_changes delivers the authoritative update but its fanout adds
  // hundreds of ms; the mover already holds the server-confirmed state when
  // the move POST returns, so it broadcasts it here and the other players
  // apply it immediately. The version guard makes the later postgres event
  // a no-op, and remains the fallback if a broadcast is missed.
  useEffect(() => {
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
          if (sv > versionRef.current) {
            preOptimisticRef.current = null;
            setGameState(payload.gameState as GameState);
            setStateVersion(sv);
            surfaceCallout(
              payload.callout as string | null,
              (payload.calloutPayload as Record<string, unknown> | null) ??
                undefined,
              sv
            );
          }
        }
      )
      .on(
        "broadcast",
        { event: "chat" },
        ({ payload }: { payload: ChatBroadcastPayload }) => {
          if (!payload?.playerId) return;

          const msg: ChatMessage = {
            id: `${Date.now()}-${Math.random()}`,
            playerId: payload.playerId,
            seat: payload.seat,
            type: payload.type,
            payload: payload.payload,
            isMe: payload.playerId === session?.playerId,
          };

          setChatMessages((prev) => {
            // Keep at most 3 newest messages
            const next = [...prev, msg];
            return next.slice(-3);
          });
        }
      )
      .subscribe();

    chatChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      chatChannelRef.current = null;
    };
  }, [gameId, session?.playerId, surfaceCallout]);

  const submitMove = useCallback(
    async (intent: MoveIntentPayload) => {
      if (!session) return;
      if (moveInFlightRef.current) return;
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

        if (res.status === 409 && data.stale) {
          preOptimisticRef.current = null;
          await fetchGame();
          return;
        }

        if (!res.ok) {
          // Revert optimistic update
          if (preOptimisticRef.current) {
            setGameState(preOptimisticRef.current);
            preOptimisticRef.current = null;
          }
          showTransientError(data.error ?? "Move failed");
          return;
        }

        preOptimisticRef.current = null;
        setGameState(data.gameState);
        setStateVersion(data.stateVersion);
        setError(null);

        if (data.callout) {
          surfaceCallout(
            data.callout,
            data.calloutPayload ?? null,
            data.stateVersion
          );
        }

        // State fast-path: hand the confirmed state to the other players
        // directly — they'd otherwise wait on the postgres_changes fanout.
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
      } catch {
        if (preOptimisticRef.current) {
          setGameState(preOptimisticRef.current);
          preOptimisticRef.current = null;
        }
        showTransientError("Connection error");
      } finally {
        moveInFlightRef.current = false;
      }
    },
    [gameId, session, fetchGame, gameState, surfaceCallout, showTransientError]
  );

  const sendChat = useCallback(
    async (type: "quick_chat" | "emote", payload: string) => {
      if (!session) return;

      const broadcastPayload: ChatBroadcastPayload = {
        playerId: session.playerId,
        seat: session.seat,
        type,
        payload,
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
          payload,
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
    error,
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
