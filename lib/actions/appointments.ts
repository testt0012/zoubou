"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/server";
import { isValidDateString, isValidTimeString, normalizeGreekMobile, sanitizeName } from "@/lib/validation";
import { minutesToTime, timeToMinutes } from "@/lib/time";

export async function cancelAppointment(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
  revalidatePath("/admin/dashboard");
}

// Lets the admin add a walk-in / phone booking directly. The database's
// exclusion constraint (appointments_no_overlap) still protects against
// double-booking even here — the insert silently fails if the slot has
// meanwhile been taken, same as every other admin form in this file.
export async function createManualAppointment(formData: FormData) {
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
    return;
  }

  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .maybeSingle();

  if (!service) return;

  const endTime = minutesToTime(timeToMinutes(startTime) + service.duration_minutes);

  await supabase.from("appointments").insert({
    service_id: serviceId,
    date,
    start_time: startTime,
    end_time: endTime,
    first_name: firstName,
    last_name: lastName,
    mobile,
  });

  revalidatePath("/admin/dashboard");
}
