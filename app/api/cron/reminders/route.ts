import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, todayAthens } from "@/lib/time";
import { sendPush } from "@/lib/push/server";
import { checkHealth } from "@/lib/health";
import { logError } from "@/lib/errorLog";

// Runs once a day (see vercel.json) and pushes a reminder to every
// tomorrow's confirmed appointment that has an attached push subscription.
// Marked reminder_sent right after each attempt (success or failure) —
// there's no same-day retry path, and by tomorrow the reminder would be
// for the wrong day anyway.
//
// It also checks that the other scheduled jobs are doing their work (see
// lib/health.ts) and reports any that have silently stopped.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const tomorrow = addDays(todayAthens(), 1);

  try {
    for (const issue of await checkHealth(supabase, todayAthens())) await logError("health", issue);
  } catch (error) {
    await logError("cron/reminders (health check)", error);
  }

  const { data: appointments, error: queryError } = await supabase
    .from("appointments")
    .select("id, start_time, push_endpoint, push_p256dh, push_auth, services(name)")
    .eq("date", tomorrow)
    .eq("status", "confirmed")
    .eq("reminder_sent", false)
    .not("push_endpoint", "is", null);

  if (queryError) await logError("cron/reminders", queryError);

  let sent = 0;
  for (const a of appointments ?? []) {
    if (!a.push_endpoint || !a.push_p256dh || !a.push_auth) continue;

    const service = a.services as unknown as { name: string } | null;
    await sendPush(
      { endpoint: a.push_endpoint, p256dh: a.push_p256dh, auth: a.push_auth },
      {
        title: "Υπενθύμιση ραντεβού",
        body: `Έχετε ραντεβού αύριο στις ${a.start_time.slice(0, 5)}${
          service ? ` για ${service.name}` : ""
        } στο Zoubou.`,
        // Tapping it opens the appointment's page, where it can be changed.
        url: `/a/${a.id}`,
      }
    );
    sent++;
    await supabase.from("appointments").update({ reminder_sent: true }).eq("id", a.id);
  }

  return NextResponse.json({ sent });
}
