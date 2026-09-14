import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { athensDateTimeToUTC } from "@/lib/time";
import { buildICS } from "@/lib/ics";

// Served as a real, fetchable .ics file rather than a blob: URL — iOS
// Safari (and most other browsers) only recognizes the "Content-Type:
// text/calendar" response of an actual navigation and offers its native
// "Add Event" sheet for that; a blob: URL with a `download` attribute just
// gets treated as a generic file download instead, which is what the
// customer was seeing (a save prompt that never actually adds the event).
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/ics/[appointmentId]">
) {
  const { appointmentId } = await ctx.params;

  const supabase = createAdminClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, date, start_time, end_time, first_name, last_name, services(name)")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return NextResponse.json({ error: "Το ραντεβού δεν βρέθηκε." }, { status: 404 });
  }

  const service = appointment.services as unknown as { name: string } | null;
  const serviceName = service?.name ?? "Ραντεβού";

  const ics = buildICS({
    uid: appointment.id,
    start: athensDateTimeToUTC(appointment.date, appointment.start_time.slice(0, 5)),
    end: athensDateTimeToUTC(appointment.date, appointment.end_time.slice(0, 5)),
    summary: `${serviceName} – Zoubou`,
    description: `Ραντεβού για ${serviceName} στο κουρείο Zoubou.`,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="zoubou-rantevou.ics"',
    },
  });
}
