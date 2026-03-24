"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { GameState, Tile, Seat } from "@/lib/engine/types";
import { getNextSeat } from "@/lib/engine/types";

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
  const [lastCallout, setLastCallout] = useState<string | null>(null);
  const [lastCalloutPayload, setLastCalloutPayload] = useState<Record<
    string,
    unknown
  > | null>(null);

  const versionRef = useRef(stateVersion);
  versionRef.current = stateVersion;

  const preOptimisticRef = useRef<GameState | null>(null);

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
      setError(null);
      if (gs?.lastCallout) {
        setLastCallout(gs.lastCallout);
        setLastCalloutPayload(gs.lastCalloutPayload ?? null);
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

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
            if (gs?.lastCallout) {
              setLastCallout(gs.lastCallout);
              setLastCalloutPayload(gs.lastCalloutPayload ?? null);
            }
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
  }, [gameId, fetchGame]);

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

  const submitMove = useCallback(
    async (intent: MoveIntentPayload) => {
      if (!session) return;

      // Optimistic update for play moves — instant visual feedback
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
          setError(data.error ?? "Move failed");
          return;
        }

        preOptimisticRef.current = null;
        setGameState(data.gameState);
        setStateVersion(data.stateVersion);
        setError(null);

        if (data.callout) {
          setLastCallout(data.callout);
          setLastCalloutPayload(data.calloutPayload ?? null);
        }
      } catch {
        if (preOptimisticRef.current) {
          setGameState(preOptimisticRef.current);
          preOptimisticRef.current = null;
        }
        setError("Connection error");
      }
    },
    [gameId, session, fetchGame, gameState]
  );

  const clearCallout = useCallback(() => {
    setLastCallout(null);
    setLastCalloutPayload(null);
  }, []);

  return {
    gameState,
    players,
    stateVersion,
    loading,
    error,
    lastCallout,
    lastCalloutPayload,
    submitMove,
    clearCallout,
  };
}
