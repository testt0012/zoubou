import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableDates } from "@/lib/slots";
import { loadOwnAppointment } from "@/lib/customerAppointment";
import { checkRateLimit } from "@/lib/rateLimit";
import { slotErrorResponse } from "@/lib/http";
import { lastBookableDate } from "@/lib/booking";
import { todayAthens } from "@/lib/time";

// The days this appointment could be moved to: the same days a new booking
// for its service could use, with its own current slot counted as free.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/appointments/[id]/availability">) {
  const { id } = await ctx.params;
  const supabase = createAdminClient();

  const appointment = await loadOwnAppointment(supabase, id);
  if (!appointment) return NextResponse.json({ error: "Το ραντεβού δεν βρέθηκε." }, { status: 404 });
  if (!appointment.canChange) return NextResponse.json({ dates: [] });

  const limit = await checkRateLimit(supabase, request, "slots");
  if (limit === "error") return NextResponse.json({ error: "Σφάλμα φόρτωσης διαθέσιμων ημερών." }, { status: 500 });
  if (limit === "limited") {
    return NextResponse.json({ error: "Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά." }, { status: 429 });
  }

  const today = todayAthens();
  const result = await computeAvailableDates(supabase, appointment.serviceId, today, lastBookableDate(today), {
    excludeAppointmentId: appointment.id,
  });
  if ("error" in result) return slotErrorResponse(result.error);

  return NextResponse.json({ dates: result.dates });
}
