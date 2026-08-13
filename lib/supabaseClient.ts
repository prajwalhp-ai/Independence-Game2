"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side client. Uses the public anon key.
// Used by the play page, game board, and live leaderboard.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
