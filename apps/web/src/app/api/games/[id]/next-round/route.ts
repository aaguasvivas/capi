import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { startNewRound } from "@capi/engine";
import type { GameState, Seat } from "@capi/engine";
import { reportError } from "@/lib/report";
import { gameLookupFailed, statusFor, unwrittenUpdate } from "@/lib/gameDb";
import { rebroadcastState } from "@/lib/resync";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { playerId, stateVersion } = body as {
      playerId: string;
      stateVersion: number;
    };

    if (!playerId) {
      return NextResponse.json(
        { error: "Missing playerId" },
        { status: 400 }
      );
    }

    const db = createServerClient();

    const { data: game, error: gameError } = await db
      .from("games")
      .select("*")
      .eq("id", params.id)
      .single();

    if (gameError || !game) return gameLookupFailed(gameError, "POST /api/games/[id]/next-round");

    // Only players in this game may advance the round
    const { data: player, error: playerError } = await db
      .from("players")
      .select("id")
      .eq("id", playerId)
      .eq("game_id", params.id)
      .single();

    if (playerError || !player) {
      return NextResponse.json(
        { error: "Player not in this game" },
        { status: 403 }
      );
    }

    // Version before status, as in the move route: a client that missed
    // another seat's deal is stale, and only the stale answer tells it so.
    if (game.state_version !== stateVersion) {
      return NextResponse.json(
        { error: "State is stale - refetch", stale: true },
        { status: 409 }
      );
    }

    const currentState = game.game_state as GameState;
    // The engine deals only from a round that ended; checking the phase too
    // means a row whose status and phase disagree is never "dealt" into a
    // playing status with an unchanged state.
    if (game.status !== "round_over" || currentState?.phase !== "round_over") {
      return NextResponse.json(
        { error: "Game is not in round_over state" },
        { status: 409 }
      );
    }
    const existingPlayers = currentState.players as Record<
      Seat,
      GameState["players"][Seat]
    >;
    const newState: GameState = {
      ...startNewRound(currentState, existingPlayers),
      // A fresh deal restarts the claim window for the opener.
      lastMoveAt: new Date().toISOString(),
    };
    const newVersion = stateVersion + 1;

    const { data: updated, error: updateError } = await db
      .from("games")
      .update({
        game_state: newState,
        state_version: newVersion,
        status: statusFor(newState.phase),
      })
      .eq("id", params.id)
      .eq("state_version", stateVersion)
      .select()
      .single();

    if (updateError || !updated) {
      return unwrittenUpdate(db, params.id, stateVersion, "POST /api/games/[id]/next-round", updateError);
    }

    // No client broadcasts a deal, so the other seats would learn of it only
    // from the database event; push it as well.
    await rebroadcastState(db, params.id);

    return NextResponse.json({
      success: true,
      gameState: newState,
      stateVersion: newVersion,
    });
  } catch (err) {
    reportError(err, "POST /api/games/[id]/next-round");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
