import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createInitialState } from "@capi/engine";
import type { GameState } from "@capi/engine";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nickname, avatarColor = "#6366f1", mode = "turn_based", theme = "barberia", is2v2 = false, targetScore = 100 } = body;

    if (!nickname || typeof nickname !== "string" || nickname.trim().length === 0) {
      return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
    }

    if (targetScore !== 100 && targetScore !== 200) {
      return NextResponse.json({ error: "targetScore must be 100 or 200" }, { status: 400 });
    }

    const db = createServerClient();

    // Generate a unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data } = await db.from("games").select("id").eq("invite_code", inviteCode).single();
      if (!data) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    // Create the game row (no game_state yet - starts when 2nd player joins)
    const { data: game, error: gameError } = await db
      .from("games")
      .insert({
        invite_code: inviteCode,
        mode,
        theme,
        status: "waiting",
        state_version: 0,
        settings: { targetScore, is2v2: !!is2v2 },
      })
      .select()
      .single();

    if (gameError || !game) {
      console.error("Failed to create game:", gameError);
      return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
    }

    // Create the creator as seat "n"
    const { data: player, error: playerError } = await db
      .from("players")
      .insert({
        game_id: game.id,
        seat: "n",
        nickname: nickname.trim(),
        avatar_color: avatarColor,
      })
      .select()
      .single();

    if (playerError || !player) {
      console.error("Failed to create player:", playerError);
      return NextResponse.json({ error: "Failed to create player" }, { status: 500 });
    }

    return NextResponse.json({
      gameId: game.id,
      inviteCode: game.invite_code,
      playerId: player.id,
      seat: "n",
    });
  } catch (err) {
    console.error("POST /api/games error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
