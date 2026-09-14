import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayAthens } from "@/lib/time";

// Customers have no account, so their push subscription (opt-in, right
// after a successful booking) is attached directly to that one appointment
// row instead of a separate customer table — this is what the daily
// reminder cron reads from.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο αίτημα." }, { status: 400 });
  }

  const appointmentId = body.appointmentId;
  const subscription = body.subscription as
    | { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
    | undefined;

  if (
    typeof appointmentId !== "string" ||
    !subscription ||
    typeof subscription.endpoint !== "string" ||
    typeof subscription.keys?.p256dh !== "string" ||
    typeof subscription.keys?.auth !== "string"
  ) {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, date, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment || appointment.status !== "confirmed" || appointment.date < todayAthens()) {
    return NextResponse.json({ error: "Το ραντεβού δεν βρέθηκε." }, { status: 404 });
  }

  await supabase
    .from("appointments")
    .update({
      push_endpoint: subscription.endpoint,
      push_p256dh: subscription.keys.p256dh,
      push_auth: subscription.keys.auth,
    })
    .eq("id", appointmentId);

  return NextResponse.json({ ok: true });
}
