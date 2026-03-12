import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from("games")
      .select("id")
      .eq("invite_code", params.code.toUpperCase())
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json({ gameId: data.id });
  } catch (err) {
    console.error("GET /api/games/by-code/[code] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
