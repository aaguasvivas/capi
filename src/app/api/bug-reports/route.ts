import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const REPORT_EMAIL = "adelson@coachable.dev";
const RESEND_FROM = "Capi Bug Reports <onboarding@resend.dev>"; // works without domain verification

const MAX_MESSAGE_LEN = 4000;

interface BugReportBody {
  gameId?: string | null;
  playerId?: string | null;
  message: string;
  userAgent?: string | null;
  url?: string | null;
  viewportW?: number | null;
  viewportH?: number | null;
  language?: string | null;
  gameState?: unknown;
  stateVersion?: number | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BugReportBody;

    if (
      !body.message ||
      typeof body.message !== "string" ||
      body.message.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (body.message.length > MAX_MESSAGE_LEN) {
      return NextResponse.json(
        { error: `Message too long (max ${MAX_MESSAGE_LEN} chars)` },
        { status: 400 }
      );
    }

    const trimmed = body.message.trim();

    const db = createServerClient();
    const { data: report, error: insertError } = await db
      .from("bug_reports")
      .insert({
        game_id: body.gameId ?? null,
        player_id: body.playerId ?? null,
        message: trimmed,
        user_agent: body.userAgent ?? null,
        url: body.url ?? null,
        viewport_w: body.viewportW ?? null,
        viewport_h: body.viewportH ?? null,
        language: body.language ?? null,
        game_state: body.gameState ?? null,
        state_version: body.stateVersion ?? null,
      })
      .select()
      .single();

    if (insertError || !report) {
      console.error("Failed to insert bug report:", insertError);
      return NextResponse.json(
        { error: "Failed to save report" },
        { status: 500 }
      );
    }

    // Fire-and-mostly-forget email via Resend. If email fails we still
    // return success because the report is safely saved in the DB.
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: RESEND_FROM,
          to: REPORT_EMAIL,
          subject: emailSubject(trimmed, body.gameId ?? null),
          text: formatEmailBody(report),
        });
      } catch (e) {
        console.error("Resend email failed:", e);
      }
    } else {
      console.warn("RESEND_API_KEY missing - bug report saved but no email sent");
    }

    return NextResponse.json({ success: true, reportId: report.id });
  } catch (err) {
    console.error("POST /api/bug-reports error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function emailSubject(message: string, gameId: string | null): string {
  const snippet = message.slice(0, 60).replace(/\s+/g, " ");
  const tag = gameId ? `game ${gameId.slice(0, 8)}` : "no game";
  return `Capi bug (${tag}): ${snippet}${message.length > 60 ? "..." : ""}`;
}

function formatEmailBody(report: Record<string, unknown>): string {
  const stateJson = report.game_state
    ? JSON.stringify(report.game_state, null, 2)
    : "(no game state attached)";

  return [
    "New bug report from playcapi.com",
    "=".repeat(40),
    "",
    `When:        ${report.created_at}`,
    `Report ID:   ${report.id}`,
    `Game ID:     ${report.game_id ?? "(not in game)"}`,
    `Player ID:   ${report.player_id ?? "(no player)"}`,
    `URL:         ${report.url ?? "(unknown)"}`,
    `User Agent:  ${report.user_agent ?? "(unknown)"}`,
    `Viewport:    ${report.viewport_w ?? "?"}x${report.viewport_h ?? "?"}`,
    `Language:    ${report.language ?? "(unknown)"}`,
    `State ver:   ${report.state_version ?? "(unknown)"}`,
    "",
    "Message:",
    "-".repeat(40),
    String(report.message ?? ""),
    "",
    "Game state:",
    "-".repeat(40),
    stateJson,
  ].join("\n");
}
