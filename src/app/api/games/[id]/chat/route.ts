import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { playerId, type, payload } = body as {
      playerId: string;
      type: string;
      payload: string;
    };

    if (!playerId || !type || !payload) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (type !== "quick_chat" && type !== "emote") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const db = createServerClient();

    // Verify player belongs to this game
    const { data: player, error: playerError } = await db
      .from("players")
      .select("id")
      .eq("id", playerId)
      .eq("game_id", params.id)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not in game" }, { status: 403 });
    }

    // Persist for audit
    const { error: insertError } = await db.from("chat_emotes").insert({
      game_id: params.id,
      player_id: playerId,
      type,
      payload,
    });

    if (insertError) {
      console.error("chat insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save chat" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/games/[id]/chat error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
