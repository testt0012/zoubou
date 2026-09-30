import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

const DEDUPE_MINUTES = 10;
const ALERT_INTERVAL_MS = 30 * 60 * 1000;
const MAX_MESSAGE = 500;

// One alert per source per half hour, per server instance — enough to keep a
// broken database from turning every failed request into a notification.
const lastAlert = new Map<string, number>();

export interface ErrorLogDeps {
  db: Db;
  send: (title: string, message: string) => Promise<void>;
  now?: () => number;
}

// Only ever what is safe to store and send on: the message and the error
// code — never the row details a database error can carry — with anything
// that looks like a phone number or an email address blanked out.
export function describeError(error: unknown): { message: string; code?: string } {
  let message = "unknown error";
  let code: string | undefined;

  if (error instanceof Error) message = error.message;
  else if (typeof error === "string") message = error;
  else if (error && typeof error === "object") {
    const e = error as { message?: unknown; code?: unknown };
    if (typeof e.message === "string") message = e.message;
    if (typeof e.code === "string") code = e.code;
  }

  message = message
    .replace(/Failing row contains[\s\S]*/, "Failing row contains [removed]")
    .replace(/(?<!\d)(?:\+?30[\s-]?)?69\d{8}(?!\d)/g, "[phone]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .slice(0, MAX_MESSAGE);

  return { message, code };
}

// Records an unexpected failure and, the first time it happens in a while,
// alerts the developer. Never throws: a problem with the logging itself must
// not turn into a problem for the request that hit the original error.
export async function logErrorWith(deps: ErrorLogDeps, source: string, error: unknown): Promise<void> {
  const { message, code } = describeError(error);
  console.error(`[${source}] ${message}${code ? ` (${code})` : ""}`);

  try {
    const now = deps.now?.() ?? Date.now();
    let isNew = true;

    // If the database itself is what failed, the log can't be written — the
    // alert still goes out, and counts as new.
    try {
      const since = new Date(now - DEDUPE_MINUTES * 60 * 1000).toISOString();
      const { data: existing, error: readError } = await deps.db
        .from("error_log")
        .select("id, count")
        .eq("source", source)
        .eq("message", message)
        .gte("last_seen_at", since)
        .order("last_seen_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (readError) throw readError;

      if (existing) {
        isNew = false;
        await deps.db
          .from("error_log")
          .update({ count: (existing.count as number) + 1, last_seen_at: new Date(now).toISOString() })
          .eq("id", existing.id);
      } else {
        const { error: insertError } = await deps.db
          .from("error_log")
          .insert({
            source,
            message,
            detail: code ? { code } : null,
            count: 1,
            created_at: new Date(now).toISOString(),
            last_seen_at: new Date(now).toISOString(),
          });
        if (insertError) throw insertError;
      }
    } catch {
      // fall through to the alert
    }

    if (!isNew) return;
    if (now - (lastAlert.get(source) ?? 0) < ALERT_INTERVAL_MS) return;
    lastAlert.set(source, now);
    await deps.send(`Zoubou error: ${source}`, message);
  } catch {
    // logging must never throw
  }
}

// For tests: forget which sources were recently alerted.
export function resetAlertThrottle() {
  lastAlert.clear();
}
