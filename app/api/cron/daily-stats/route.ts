import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { snapshotMissingDays } from "@/lib/stats";
import { todayAthens } from "@/lib/time";

// Runs once a night (see vercel.json), after closing: freezes each finished
// day's opening hours and booked hours into daily_stats, so the reports
// don't change retroactively when the weekly hours or the regular customers
// do. Also fills in any day a previous run missed.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await snapshotMissingDays(createAdminClient(), todayAthens());
    return NextResponse.json(result);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    return NextResponse.json({ error: "snapshot failed", code }, { status: 500 });
  }
}
