import { after, NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/slots";
import { loadOwnAppointment, publicView } from "@/lib/customerAppointment";
import { checkRateLimit } from "@/lib/rateLimit";
import { slotErrorResponse } from "@/lib/http";
import { notifyAdmins } from "@/lib/push/server";
import { CHANGE_DEADLINE_HOURS, lastBookableDate } from "@/lib/booking";
import { isValidDateString, isValidTimeString } from "@/lib/validation";
import { formatDateLong, minutesToTime, timeToMinutes, todayAthens } from "@/lib/time";

// The customer moves their own appointment to another free time, under the
// same rules as a new booking (open hours, nothing already taken, up to
// three weeks ahead) plus the change deadline on the appointment itself.
// Its own current slot counts as free, and the database's exclusion
// constraint is still the last-resort guard against two people taking the
// same time at once.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/appointments/[id]/move">) {
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο αίτημα." }, { status: 400 });
  }

  const date = body.date;
  const startTime = body.startTime;
  if (!isValidDateString(date) || !isValidTimeString(startTime)) {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία ραντεβού." }, { status: 400 });
  }

  const today = todayAthens();
  if (date < today) {
    return NextResponse.json(
      { error: "Δεν μπορείτε να κλείσετε ραντεβού σε παρελθοντική ημερομηνία." },
      { status: 400 }
    );
  }
  if (date > lastBookableDate(today)) {
    return NextResponse.json({ error: "Μπορείτε να κλείσετε ραντεβού μέχρι 3 εβδομάδες μπροστά." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const appointment = await loadOwnAppointment(supabase, id);
  if (!appointment) return NextResponse.json({ error: "Το ραντεβού δεν βρέθηκε." }, { status: 404 });
  if (!appointment.canChange) {
    return NextResponse.json(
      {
        error: `Η αλλαγή γίνεται μέχρι ${CHANGE_DEADLINE_HOURS} ώρες πριν το ραντεβού. Επικοινωνήστε μαζί μας.`,
      },
      { status: 409 }
    );
  }

  const limit = await checkRateLimit(supabase, request, "booking");
  if (limit === "error") return NextResponse.json({ error: "Σφάλμα κατά τη μετακίνηση του ραντεβού." }, { status: 500 });
  if (limit === "limited") {
    return NextResponse.json({ error: "Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά." }, { status: 429 });
  }

  const result = await computeAvailableSlots(supabase, appointment.serviceId, date, {
    excludeAppointmentId: appointment.id,
  });
  if ("error" in result) return slotErrorResponse(result.error);

  if (!result.slots.includes(startTime)) {
    return NextResponse.json(
      { error: "Η ώρα αυτή δεν είναι πλέον διαθέσιμη. Επιλέξτε άλλη ώρα.", code: "SLOT_UNAVAILABLE" },
      { status: 409 }
    );
  }

  const endTime = minutesToTime(timeToMinutes(startTime) + result.serviceDurationMinutes);
  const { error } = await supabase
    .from("appointments")
    .update({ date, start_time: startTime, end_time: endTime, reminder_sent: false })
    .eq("id", appointment.id)
    .eq("status", "confirmed");

  if (error) {
    if (error.code === "23P01") {
      return NextResponse.json(
        { error: "Η ώρα αυτή μόλις κλείστηκε από κάποιον άλλον. Επιλέξτε άλλη ώρα.", code: "SLOT_UNAVAILABLE" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Σφάλμα κατά τη μετακίνηση του ραντεβού." }, { status: 500 });
  }

  after(() => {
    notifyAdmins(supabase, {
      title: "Μετακίνηση ραντεβού",
      body: `${appointment.firstName} ${appointment.lastName} · από ${formatDateLong(appointment.date)} ${appointment.start} σε ${formatDateLong(date)} ${startTime}`,
      url: "/admin/dashboard",
    }).catch(() => {});
  });

  const moved = await loadOwnAppointment(supabase, appointment.id);
  return NextResponse.json({ appointment: moved ? publicView(moved) : null });
}
