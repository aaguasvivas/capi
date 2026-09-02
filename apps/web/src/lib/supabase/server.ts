import { createClient } from "@supabase/supabase-js";

// Server-side client. Prefers the service role key (server-only env var) so
// the API is the only thing that can write game state once the public write
// policies are dropped (supabase/migrations/005_lock_direct_writes.sql).
// Falls back to the publishable key so a missing var degrades to today's
// behavior instead of taking the API down.
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see apps/web/.env.example)"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, options = {}) => fetch(input, { ...options, cache: "no-store" }),
    },
  });
}
