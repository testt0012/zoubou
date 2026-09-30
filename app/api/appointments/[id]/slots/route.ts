import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/slots";
import { loadOwnAppointment } from "@/lib/customerAppointment";
import { checkRateLimit } from "@/lib/rateLimit";
import { slotErrorResponse } from "@/lib/http";
import { logError } from "@/lib/errorLog";
import { after } from "next/server";
import { lastBookableDate } from "@/lib/booking";
import { isValidDateString } from "@/lib/validation";
import { todayAthens } from "@/lib/time";

// The free times on one day this appointment could be moved to.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/appointments/[id]/slots">) {
  const { id } = await ctx.params;
  const date = request.nextUrl.searchParams.get("date");
  if (!isValidDateString(date)) {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία αναζήτησης." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const appointment = await loadOwnAppointment(supabase, id);
  if (!appointment) return NextResponse.json({ error: "Το ραντεβού δεν βρέθηκε." }, { status: 404 });

  const today = todayAthens();
  if (!appointment.canChange || date < today || date > lastBookableDate(today)) {
    return NextResponse.json({ slots: [] });
  }

  const limit = await checkRateLimit(supabase, request, "slots");
  if (limit === "error") {
    after(() => logError("api/appointments/slots", "rate limit check failed"));
    return NextResponse.json({ error: "Σφάλμα φόρτωσης διαθέσιμων ωρών." }, { status: 500 });
  }
  if (limit === "limited") {
    return NextResponse.json({ error: "Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά." }, { status: 429 });
  }

  const result = await computeAvailableSlots(supabase, appointment.serviceId, date, {
    excludeAppointmentId: appointment.id,
  });
  if ("error" in result) return slotErrorResponse(result.error, "api/appointments/slots");

  return NextResponse.json({ slots: result.slots });
}
