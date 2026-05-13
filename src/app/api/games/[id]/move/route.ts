import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { applyMove } from "@/lib/engine/reducer";
import type { GameState, Seat, MoveIntent } from "@/lib/engine/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { playerId, seat, intent, stateVersion } = body as {
      playerId: string;
      seat: Seat;
      intent: MoveIntent;
      stateVersion: number;
    };

    if (!playerId || !seat || !intent) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = createServerClient();

    // Load game with optimistic locking check
    const { data: game, error: gameError } = await db
      .from("games")
      .select("*")
      .eq("id", params.id)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status !== "playing") {
      return NextResponse.json({ error: "Game is not in play" }, { status: 409 });
    }

    // Verify the client's state_version matches; if not, they are stale
    if (game.state_version !== stateVersion) {
      return NextResponse.json(
        { error: "State is stale - refetch", stale: true },
        { status: 409 }
      );
    }

    // Verify the player exists and owns this seat
    const { data: player, error: playerError } = await db
      .from("players")
      .select("*")
      .eq("id", playerId)
      .eq("game_id", params.id)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 403 });
    }

    if (player.seat !== seat) {
      return NextResponse.json({ error: "Seat mismatch" }, { status: 403 });
    }

    const currentState = game.game_state as GameState;

    // Apply the move through the engine
    const result = applyMove(currentState, seat, intent);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    const newVersion = stateVersion + 1;

    // Write new state with optimistic locking
    const { data: updated, error: updateError } = await db
      .from("games")
      .update({
        game_state: result.newState,
        state_version: newVersion,
        status: result.newState.phase === "finished"
          ? "finished"
          : result.newState.phase === "round_over"
          ? "round_over"
          : "playing",
      })
      .eq("id", params.id)
      .eq("state_version", stateVersion)
      .select()
      .single();

    if (updateError || !updated) {
      // Another request beat us - the client should refetch
      return NextResponse.json(
        { error: "State conflict - refetch", stale: true },
        { status: 409 }
      );
    }

    // Record the move for audit
    await db.from("moves").insert({
      game_id: params.id,
      player_id: playerId,
      round_index: currentState.roundIndex,
      intent,
      result: {
        success: result.success,
        callout: result.callout ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      gameState: result.newState,
      stateVersion: newVersion,
      callout: result.callout ?? null,
      calloutPayload: result.calloutPayload ?? null,
    });
  } catch (err) {
    console.error("POST /api/games/[id]/move error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
