import { randomInt } from "crypto";
import type { createServerClient } from "@/lib/supabase/server";

// No 0/O/1/I so codes survive being read aloud or typed from a photo.
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CHARS[randomInt(CHARS.length)];
  return code;
}

// Retries until a code is verified unused (every candidate is checked,
// including the last one).
export async function uniqueInviteCode(db: ReturnType<typeof createServerClient>): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateInviteCode();
    const { data } = await db.from("games").select("id").eq("invite_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not allocate an invite code");
}
