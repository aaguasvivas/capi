"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { GameState } from "@/lib/engine/types";

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

export interface UseRealtimeGameReturn {
  gameState: GameState | null;
  players: PlayerRecord[];
  stateVersion: number;
  loading: boolean;
  error: string | null;
  lastCallout: string | null;
  lastCalloutPayload: Record<string, unknown> | null;
  submitMove: (intent: MoveIntentPayload) => Promise<void>;
  clearCallout: () => void;
}

export function useRealtimeGame(
  gameId: string,
  session: PlayerSession | null
): UseRealtimeGameReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [stateVersion, setStateVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCallout, setLastCallout] = useState<string | null>(null);
  const [lastCalloutPayload, setLastCalloutPayload] = useState<Record<string, unknown> | null>(null);

  const versionRef = useRef(stateVersion);
  versionRef.current = stateVersion;

  // Full fetch — used for initial load and as a fallback
  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Game not found");
        return;
      }
      const data = await res.json();
      setGameState(data.game.game_state);
      setStateVersion(data.game.state_version);
      setPlayers(data.players);
      setError(null);
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Initial fetch on mount
  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Realtime subscription — listens for any change to this game row
  useEffect(() => {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        async (payload) => {
          const newRecord = payload.new as Record<string, unknown>;
          if (!newRecord) return;

          const newVersion = newRecord.state_version as number;
          const newGameState = newRecord.game_state as GameState | null;
          const prevVersion = versionRef.current;

          // Only process if this is a genuinely newer version.
          // If prevVersion === newVersion, submitMove already applied this update.
          if (newVersion <= prevVersion) return;

          if (newGameState) {
            setGameState(newGameState);
            setStateVersion(newVersion);

            // Show callout from opponent's move (our own move callouts come from submitMove)
            if (newGameState.lastCallout) {
              setLastCallout(newGameState.lastCallout);
              setLastCalloutPayload(newGameState.lastCalloutPayload);
            }
          }

          // When game transitions from waiting → playing (0 → 1), fetch the full
          // player list so the waiting screen can transition to the board.
          if (prevVersion === 0 && newVersion === 1) {
            const res = await fetch(`/api/games/${gameId}`, { cache: "no-store" });
            if (res.ok) {
              const data = await res.json();
              setPlayers(data.players);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Submit a move — POST to API, update state optimistically from response.
  // If the server returns 409/stale, fall back to a full refetch.
  const submitMove = useCallback(
    async (intent: MoveIntentPayload) => {
      if (!session) return;

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
          await fetchGame();
          return;
        }

        if (!res.ok) {
          setError(data.error ?? "Move failed");
          return;
        }

        // Apply the server's authoritative result immediately so the player
        // sees their own move without waiting for the Realtime echo.
        setGameState(data.gameState);
        setStateVersion(data.stateVersion);
        setError(null);

        if (data.callout) {
          setLastCallout(data.callout);
          setLastCalloutPayload(data.calloutPayload ?? null);
        }
      } catch {
        setError("Connection error");
      }
    },
    [gameId, session, fetchGame]
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
