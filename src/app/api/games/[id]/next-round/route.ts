import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { startNewRound } from "@/lib/engine/reducer";
import type { GameState, Seat } from "@/lib/engine/types";

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

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status !== "round_over") {
      return NextResponse.json(
        { error: "Game is not in round_over state" },
        { status: 409 }
      );
    }

    if (game.state_version !== stateVersion) {
      return NextResponse.json(
        { error: "State is stale — refetch", stale: true },
        { status: 409 }
      );
    }

    const currentState = game.game_state as GameState;
    const existingPlayers = currentState.players as Record<
      Seat,
      GameState["players"][Seat]
    >;
    const newState = startNewRound(currentState, existingPlayers);
    const newVersion = stateVersion + 1;

    const { data: updated, error: updateError } = await db
      .from("games")
      .update({
        game_state: newState,
        state_version: newVersion,
        status: "playing",
      })
      .eq("id", params.id)
      .eq("state_version", stateVersion)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "State conflict — refetch", stale: true },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      gameState: newState,
      stateVersion: newVersion,
    });
  } catch (err) {
    console.error("POST /api/games/[id]/next-round error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
