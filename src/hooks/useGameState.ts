"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/engine/types";

interface PlayerSession {
  playerId: string;
  seat: string;
  gameId: string;
}

interface UseGameStateReturn {
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

export function useGameState(
  gameId: string,
  session: PlayerSession | null
): UseGameStateReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [stateVersion, setStateVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCallout, setLastCallout] = useState<string | null>(null);
  const [lastCalloutPayload, setLastCalloutPayload] = useState<Record<string, unknown> | null>(null);

  const versionRef = useRef(stateVersion);
  versionRef.current = stateVersion;

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Game not found");
        return;
      }
      const data = await res.json();
      if (data.game.state_version !== versionRef.current || loading) {
        setGameState(data.game.game_state);
        setStateVersion(data.game.state_version);
        setPlayers(data.players);
        setError(null);
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }, [gameId, loading]);

  // Initial fetch + 3-second polling for turn-based mode
  useEffect(() => {
    fetchGame();
    const interval = setInterval(fetchGame, 3000);
    return () => clearInterval(interval);
  }, [fetchGame]);

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
          // State is stale - refetch immediately
          await fetchGame();
          return;
        }

        if (!res.ok) {
          setError(data.error ?? "Move failed");
          return;
        }

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
