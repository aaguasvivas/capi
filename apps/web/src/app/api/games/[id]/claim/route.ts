import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/report";
import { claimCheck } from "@capi/engine";
import type { GameState, Seat } from "@capi/engine";

// A seated player asks to end a game whose seat on turn stopped playing. The
// decision is made from the server clock stored in the state, so a client
// with a wrong clock can only be told "too early", never win early.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json().catch(() => ({}))) as { playerId?: unknown };
    const playerId = typeof body.playerId === "string" ? body.playerId : "";
    if (!playerId) {
      return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
    }

    const db = createServerClient();
    const { data: game, error: gameError } = await db
      .from("games")
      .select("id, status, state_version, game_state")
      .eq("id", params.id)
      .single();
    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const { data: player } = await db
      .from("players")
      .select("seat")
      .eq("id", playerId)
      .eq("game_id", params.id)
      .maybeSingle();
    if (!player) {
      return NextResponse.json({ error: "Player not in this game" }, { status: 403 });
    }

    if (game.status !== "playing") {
      return NextResponse.json({ error: "Game is not in play" }, { status: 409 });
    }

    const check = claimCheck(game.game_state as GameState, player.seat as Seat, Date.now());
    if (!check.ok) {
      return NextResponse.json(
        { error: check.error, retryInMs: check.retryInMs },
        { status: check.status }
      );
    }

    const newVersion = game.state_version + 1;
    const { data: updated } = await db
      .from("games")
      .update({ game_state: check.newState, state_version: newVersion, status: "finished" })
      .eq("id", params.id)
      .eq("state_version", game.state_version)
      .select("id")
      .maybeSingle();
    if (!updated) {
      // A move landed in between: the seat is back, nothing to claim now.
      return NextResponse.json({ error: "State conflict - refetch", stale: true }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      gameState: check.newState,
      stateVersion: newVersion,
    });
  } catch (err) {
    reportError(err, "POST /api/games/[id]/claim");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
