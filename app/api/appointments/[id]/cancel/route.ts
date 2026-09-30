import { after, NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOwnAppointment } from "@/lib/customerAppointment";
import { checkRateLimit } from "@/lib/rateLimit";
import { notifyAdmins } from "@/lib/push/server";
import { logError } from "@/lib/errorLog";
import { CHANGE_DEADLINE_HOURS } from "@/lib/booking";
import { formatDateLong } from "@/lib/time";

// The customer cancels their own appointment, up to CHANGE_DEADLINE_HOURS
// before it starts. The slot frees up by itself (only confirmed
// appointments hold a time) and the admin is told.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/appointments/[id]/cancel">) {
  const { id } = await ctx.params;
  const supabase = createAdminClient();

  const appointment = await loadOwnAppointment(supabase, id);
  if (!appointment) return NextResponse.json({ error: "Το ραντεβού δεν βρέθηκε." }, { status: 404 });
  if (appointment.status === "cancelled") return NextResponse.json({ ok: true });

  if (!appointment.canChange) {
    return NextResponse.json(
      { error: `Η ακύρωση γίνεται μέχρι ${CHANGE_DEADLINE_HOURS} ώρες πριν το ραντεβού. Επικοινωνήστε μαζί μας.` },
      { status: 409 }
    );
  }

  const limit = await checkRateLimit(supabase, request, "booking");
  if (limit === "error") {
    after(() => logError("api/appointments/cancel", "rate limit check failed"));
    return NextResponse.json({ error: "Σφάλμα κατά την ακύρωση." }, { status: 500 });
  }
  if (limit === "limited") {
    return NextResponse.json({ error: "Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά." }, { status: 429 });
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointment.id)
    .eq("status", "confirmed");
  if (error) {
    after(() => logError("api/appointments/cancel", error));
    return NextResponse.json({ error: "Σφάλμα κατά την ακύρωση." }, { status: 500 });
  }

  after(() => {
    notifyAdmins(supabase, {
      title: "Ακύρωση ραντεβού",
      body: `${appointment.firstName} ${appointment.lastName} · ${formatDateLong(appointment.date)} στις ${appointment.start}`,
      url: "/admin/dashboard",
    }).catch(() => {});
  });

  return NextResponse.json({ ok: true });
}
