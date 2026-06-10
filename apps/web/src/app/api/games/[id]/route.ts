import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

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

    if (error || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const { data: players } = await db
      .from("players")
      .select("*")
      .eq("game_id", params.id);

    return NextResponse.json({ game, players: players ?? [] });
  } catch (err) {
    console.error("GET /api/games/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
