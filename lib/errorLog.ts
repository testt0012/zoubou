import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlert } from "@/lib/alerts";
import { logErrorWith } from "@/lib/errorLogCore";

// Record an unexpected server-side failure (see lib/errorLogCore.ts). Use it
// where the app would otherwise just return "something went wrong" — and
// never pass customer names or phone numbers in the error.
export function logError(source: string, error: unknown): Promise<void> {
  return logErrorWith({ db: createAdminClient(), send: sendAlert }, source, error);
}
