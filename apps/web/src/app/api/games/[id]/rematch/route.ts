import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { playerId } = body as { playerId: string };

    if (!playerId) {
      return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
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

    const { data: players } = await db
      .from("players")
      .select("*")
      .eq("game_id", params.id);

    if (!players?.length) {
      return NextResponse.json({ error: "No players found" }, { status: 400 });
    }

    const requestingPlayer = players.find((p) => p.id === playerId);
    if (!requestingPlayer) {
      return NextResponse.json({ error: "Player not in this game" }, { status: 403 });
    }

    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data } = await db.from("games").select("id").eq("invite_code", inviteCode).single();
      if (!data) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    const is2v2 = game.settings?.is2v2 ?? false;

    const { data: newGame, error: newGameError } = await db
      .from("games")
      .insert({
        invite_code: inviteCode,
        mode: game.mode,
        theme: game.theme,
        status: "waiting",
        state_version: 0,
        settings: { targetScore: game.settings?.targetScore ?? 100, is2v2 },
      })
      .select()
      .single();

    if (newGameError || !newGame) {
      console.error("Failed to create rematch game:", newGameError);
      return NextResponse.json({ error: "Failed to create rematch" }, { status: 500 });
    }

    const { data: newPlayer, error: newPlayerError } = await db
      .from("players")
      .insert({
        game_id: newGame.id,
        seat: "n",
        nickname: requestingPlayer.nickname,
        avatar_color: requestingPlayer.avatar_color,
      })
      .select()
      .single();

    if (newPlayerError || !newPlayer) {
      console.error("Failed to create rematch player:", newPlayerError);
      return NextResponse.json({ error: "Failed to create rematch" }, { status: 500 });
    }

    return NextResponse.json({
      gameId: newGame.id,
      inviteCode: newGame.invite_code,
      playerId: newPlayer.id,
      seat: "n",
    });
  } catch (err) {
    console.error("POST /api/games/[id]/rematch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
