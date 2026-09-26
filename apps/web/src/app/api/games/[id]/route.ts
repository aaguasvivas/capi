import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/report";
import { gameLookupFailed } from "@/lib/gameDb";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = createServerClient();
    const { data: game, error } = await db
      .from("games")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !game) return gameLookupFailed(error, "GET /api/games/[id]");

    const { data: players, error: playersError } = await db
      .from("players")
      .select("*")
      .eq("game_id", params.id);
    // An empty seat list would read as "nobody is seated here" and clients
    // would offer the join form instead of the player's own table.
    if (playersError) {
      reportError(playersError, "GET /api/games/[id] players");
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ game, players: players ?? [] });
  } catch (err) {
    reportError(err, "GET /api/games/[id]");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
