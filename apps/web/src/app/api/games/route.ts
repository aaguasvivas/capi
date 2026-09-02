import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { uniqueInviteCode } from "@/lib/inviteCode";
import { cleanAvatarColor, cleanNickname, isMode, isTheme } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const nickname = cleanNickname(body.nickname);
    if (!nickname) {
      return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
    }
    const targetScore = body.targetScore ?? 100;
    if (targetScore !== 100 && targetScore !== 200) {
      return NextResponse.json({ error: "targetScore must be 100 or 200" }, { status: 400 });
    }
    const mode = isMode(body.mode) ? body.mode : "turn_based";
    const theme = isTheme(body.theme) ? body.theme : "barberia";
    const avatarColor = cleanAvatarColor(body.avatarColor, "#6366f1");

    const db = createServerClient();

    // Create the game row (no game_state yet - starts when 2nd player joins)
    const { data: game, error: gameError } = await db
      .from("games")
      .insert({
        invite_code: await uniqueInviteCode(db),
        mode,
        theme,
        status: "waiting",
        state_version: 0,
        settings: { targetScore, is2v2: !!body.is2v2 },
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
        nickname,
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
