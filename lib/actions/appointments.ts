"use server";

import { requireAdmin } from "@/lib/supabase/server";
import { isValidDateString, isValidTimeString, normalizeGreekMobile, sanitizeName } from "@/lib/validation";
import { minutesToTime, timeToMinutes } from "@/lib/time";
import { computeAvailableSlots } from "@/lib/slots";

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
  if ("error" in result) return { success: false, error: "Η υπηρεσία δεν βρέθηκε." };

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
    return { success: false, error: "Σφάλμα κατά τη δημιουργία του ραντεβού." };
  }

  return { success: true };
}
