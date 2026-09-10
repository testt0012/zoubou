import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for the anonymous public booking API routes only.
// Bypasses RLS entirely, so it must NEVER be imported into client
// components or exposed to the browser — the "server-only" import above
// makes any accidental client-side import a build-time error.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
