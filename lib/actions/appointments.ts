"use server";

import { requireAdmin } from "@/lib/supabase/server";
import { isValidDateString, isValidTimeString, normalizeGreekMobile, sanitizeName } from "@/lib/validation";
import { minutesToTime, timeToMinutes, todayAthens } from "@/lib/time";
import { computeAvailableSlots, type SlotError } from "@/lib/slots";
import { logError } from "@/lib/errorLog";

function slotErrorMessage(error: SlotError): string {
  return error === "unavailable" ? "Προσωρινό σφάλμα. Δοκιμάστε ξανά σε λίγο." : "Η υπηρεσία δεν βρέθηκε.";
}

// Called directly from client code (not a <form action>) so the UI can
// show an inline "Ακυρώθηκε — Αναίρεση" undo affordance instead of a
// blocking confirm() dialog.
export async function cancelAppointment(id: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
}

export async function uncancelAppointment(id: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("appointments").update({ status: "confirmed" }).eq("id", id);
}

// The admin's own view of a day's free times (manual booking, moving an
// appointment). Unlike the customers' /api/slots it isn't capped at three
// weeks ahead and isn't rate-limited. `excludeAppointmentId` treats that one
// appointment as not there, so it can move to a time overlapping its own.
export async function getAdminSlots(
  serviceId: string,
  date: string,
  excludeAppointmentId?: string
): Promise<{ slots: string[] } | { error: string }> {
  const { supabase } = await requireAdmin();
  if (!serviceId || !isValidDateString(date)) return { error: "Μη έγκυρα στοιχεία." };

  const result = await computeAvailableSlots(supabase, serviceId, date, { excludeAppointmentId });
  if ("error" in result) return { error: slotErrorMessage(result.error) };

  return { slots: date < todayAthens() ? [] : result.slots };
}

export interface CreateManualAppointmentResult {
  success: boolean;
  error?: string;
}

// Lets the admin add a walk-in / phone booking directly. The slot dropdown
// in the UI already only offers times computeAvailableSlots approves (open
// hours, not blocked, not already booked), but a server action is directly
// callable regardless of what the client sent — so it's re-checked here too,
// the same way POST /api/book re-checks before inserting. The database's
// exclusion constraint (appointments_no_overlap) is the last-resort guard
// for the remaining race (another booking landing between this check and
// the insert) — reported back to the caller instead of failing silently, so
// the form can tell the admin the slot was just taken.
export async function createManualAppointment(
  formData: FormData
): Promise<CreateManualAppointmentResult> {
  const { supabase } = await requireAdmin();

  const serviceId = String(formData.get("service_id") ?? "");
  const date = formData.get("date");
  const startTime = formData.get("start_time");
  const firstName = sanitizeName(String(formData.get("first_name") ?? ""));
  const lastName = sanitizeName(String(formData.get("last_name") ?? ""));

  // Mobile is optional for manual entries (unlike the public booking flow):
  // an admin adding a walk-in may not have one on hand. If they did type
  // something, though, it still has to be a valid Greek mobile.
  const mobileRaw = String(formData.get("mobile") ?? "").trim();
  const mobile = mobileRaw ? normalizeGreekMobile(mobileRaw) : null;

  if (
    !serviceId ||
    !isValidDateString(date) ||
    !isValidTimeString(startTime) ||
    !firstName ||
    !lastName ||
    (mobileRaw && !mobile)
  ) {
    return { success: false, error: "Συμπληρώστε σωστά όλα τα στοιχεία." };
  }

  const result = await computeAvailableSlots(supabase, serviceId, date);
  if ("error" in result) return { success: false, error: slotErrorMessage(result.error) };

  if (!result.slots.includes(startTime)) {
    return { success: false, error: "Η ώρα αυτή δεν είναι διαθέσιμη. Επιλέξτε άλλη ώρα." };
  }

  const endTime = minutesToTime(timeToMinutes(startTime) + result.serviceDurationMinutes);

  const { error } = await supabase.from("appointments").insert({
    service_id: serviceId,
    date,
    start_time: startTime,
    end_time: endTime,
    first_name: firstName,
    last_name: lastName,
    mobile,
  });

  if (error) {
    if (error.code === "23P01") {
      return { success: false, error: "Η ώρα αυτή μόλις κλείστηκε. Επιλέξτε άλλη ώρα." };
    }
    await logError("action/createManualAppointment", error);
    return { success: false, error: "Σφάλμα κατά τη δημιουργία του ραντεβού." };
  }

  return { success: true };
}

// Moves a confirmed appointment to another date/time. The new time is
// re-validated the same way a new booking is (open hours, not blocked, not
// held for a regular customer, not overlapping another appointment — its
// own current slot excluded), with the database's exclusion constraint as
// the last-resort guard. The reminder is re-armed for the new day.
export async function moveAppointment(
  id: string,
  date: string,
  startTime: string
): Promise<CreateManualAppointmentResult> {
  const { supabase } = await requireAdmin();

  if (!id || !isValidDateString(date) || !isValidTimeString(startTime)) {
    return { success: false, error: "Μη έγκυρα στοιχεία." };
  }
  if (date < todayAthens()) {
    return { success: false, error: "Δεν μπορείτε να μετακινήσετε ραντεβού σε παρελθοντική ημερομηνία." };
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, service_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!appointment || appointment.status !== "confirmed") {
    return { success: false, error: "Το ραντεβού δεν βρέθηκε." };
  }

  const result = await computeAvailableSlots(supabase, appointment.service_id, date, {
    excludeAppointmentId: id,
  });
  if ("error" in result) return { success: false, error: slotErrorMessage(result.error) };

  if (!result.slots.includes(startTime)) {
    return { success: false, error: "Η ώρα αυτή δεν είναι διαθέσιμη. Επιλέξτε άλλη ώρα." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      date,
      start_time: startTime,
      end_time: minutesToTime(timeToMinutes(startTime) + result.serviceDurationMinutes),
      reminder_sent: false,
    })
    .eq("id", id)
    .eq("status", "confirmed");

  if (error) {
    if (error.code === "23P01") {
      return { success: false, error: "Η ώρα αυτή μόλις κλείστηκε. Επιλέξτε άλλη ώρα." };
    }
    await logError("action/moveAppointment", error);
    return { success: false, error: "Σφάλμα κατά τη μετακίνηση του ραντεβού." };
  }

  return { success: true };
}
