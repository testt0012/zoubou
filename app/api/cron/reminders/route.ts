import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, todayAthens } from "@/lib/time";
import { sendPush } from "@/lib/push/server";

// Runs once a day (see vercel.json) and pushes a reminder to every
// tomorrow's confirmed appointment that has an attached push subscription.
// Marked reminder_sent right after each attempt (success or failure) —
// there's no same-day retry path, and by tomorrow the reminder would be
// for the wrong day anyway.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const tomorrow = addDays(todayAthens(), 1);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, start_time, push_endpoint, push_p256dh, push_auth, services(name)")
    .eq("date", tomorrow)
    .eq("status", "confirmed")
    .eq("reminder_sent", false)
    .not("push_endpoint", "is", null);

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
      }
    );
    sent++;
    await supabase.from("appointments").update({ reminder_sent: true }).eq("id", a.id);
  }

  return NextResponse.json({ sent });
}
