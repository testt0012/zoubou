import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/time";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

// Checks that the scheduled jobs are actually doing their work. A job that
// stops (an extension switched off, a cron removed, an error every night)
// doesn't complain by itself, so the daily reminders run looks for the
// traces they should have left. Returns a description of each problem found
// — empty when all is well.
export async function checkHealth(supabase: Db, today: string): Promise<string[]> {
  const issues: string[] = [];
  const yesterday = addDays(today, -1);

  // The database job that wipes customers' details an hour after their
  // appointment ends runs at midday and at night: nothing older than two
  // days should still carry a name.
  const unwiped = await supabase
    .from("appointments")
    .select("id")
    .lt("date", addDays(today, -2))
    .not("first_name", "is", null)
    .limit(1);
  if (!unwiped.error && (unwiped.data?.length ?? 0) > 0) {
    issues.push("the wipe of personal details is not running (old appointments still have names)");
  }

  // The nightly job that freezes each day's figures for the reports should
  // have covered yesterday, if there is anything to freeze.
  const anyFinished = await supabase.from("appointments").select("id").lte("date", yesterday).limit(1);
  if (!anyFinished.error && (anyFinished.data?.length ?? 0) > 0) {
    const last = await supabase
      .from("daily_stats")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last.error && (!last.data || (last.data.date as string) < yesterday)) {
      issues.push("the nightly report snapshot is not running (yesterday is missing)");
    }
  }

  return issues;
}
