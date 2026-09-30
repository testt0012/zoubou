import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { snapshotMissingDays } from "@/lib/stats";
import { logError } from "@/lib/errorLog";
import { todayAthens } from "@/lib/time";

const ERROR_LOG_KEEP_DAYS = 30;

// Runs once a night (see vercel.json), after closing: freezes each finished
// day's opening hours and booked hours into daily_stats, so the reports
// don't change retroactively when the weekly hours or the regular customers
// do. Also fills in any day a previous run missed, and tidies the error log.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  try {
    const result = await snapshotMissingDays(supabase, todayAthens());

    // Best effort: the log table may not exist yet.
    const cutoff = new Date(Date.now() - ERROR_LOG_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("error_log").delete().lt("last_seen_at", cutoff);

    return NextResponse.json(result);
  } catch (error) {
    await logError("cron/daily-stats", error);
    const code = (error as { code?: string } | null)?.code;
    return NextResponse.json({ error: "snapshot failed", code }, { status: 500 });
  }
}
