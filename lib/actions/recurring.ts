"use server";

import { requireAdmin } from "@/lib/supabase/server";
import { isValidDateString, isValidTimeString, normalizeGreekMobile, sanitizeName } from "@/lib/validation";
import { timeToMinutes } from "@/lib/time";

export interface RecurringCustomerInput {
  firstName: string;
  lastName: string;
  mobile: string;
  serviceId: string;
  startDate: string;
  intervalWeeks: number;
  startTime: string;
  // null = fixed time; otherwise the end of the time zone.
  zoneEndTime: string | null;
}

export interface RecurringCustomerResult {
  success: boolean;
  error?: string;
}

// Postgres / PostgREST codes for "that table doesn't exist" — i.e. migration
// 0009 hasn't been run on this database yet.
const MISSING_TABLE_CODES = ["42P01", "PGRST205"];

export async function addRecurringCustomer(input: RecurringCustomerInput): Promise<RecurringCustomerResult> {
  const { supabase } = await requireAdmin();

  const firstName = sanitizeName(String(input?.firstName ?? ""));
  const lastName = sanitizeName(String(input?.lastName ?? ""));
  const mobileRaw = String(input?.mobile ?? "").trim();
  const mobile = mobileRaw ? normalizeGreekMobile(mobileRaw) : null;
  const { serviceId, startDate, intervalWeeks, startTime, zoneEndTime } = input ?? {};

  if (
    !firstName ||
    !lastName ||
    (mobileRaw && !mobile) ||
    typeof serviceId !== "string" ||
    !serviceId ||
    !isValidDateString(startDate) ||
    ![1, 2, 3].includes(intervalWeeks) ||
    !isValidTimeString(startTime) ||
    (zoneEndTime !== null && !isValidTimeString(zoneEndTime))
  ) {
    return { success: false, error: "Συμπληρώστε σωστά όλα τα στοιχεία." };
  }

  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) return { success: false, error: "Η υπηρεσία δεν βρέθηκε." };

  const start = timeToMinutes(startTime);
  const duration = service.duration_minutes as number;
  if (zoneEndTime === null) {
    if (start + duration > 24 * 60) return { success: false, error: "Η ώρα είναι πολύ αργά για αυτή την υπηρεσία." };
  } else if (timeToMinutes(zoneEndTime) - start < duration) {
    return { success: false, error: `Η ζώνη ώρας πρέπει να χωράει την υπηρεσία (${duration}′).` };
  }

  const { error } = await supabase.from("recurring_customers").insert({
    first_name: firstName,
    last_name: lastName,
    mobile,
    service_id: serviceId,
    start_date: startDate,
    interval_weeks: intervalWeeks,
    start_time: startTime,
    zone_end_time: zoneEndTime,
  });

  if (error) {
    if (MISSING_TABLE_CODES.includes(error.code)) {
      return { success: false, error: "Η βάση δεν έχει ενημερωθεί ακόμα για μόνιμους πελάτες (migration 0009)." };
    }
    return { success: false, error: "Σφάλμα κατά την αποθήκευση." };
  }

  return { success: true };
}

export async function deleteRecurringCustomer(id: string) {
  const { supabase } = await requireAdmin();
  if (!id) return;
  await supabase.from("recurring_customers").delete().eq("id", id);
}

// Postgres / PostgREST codes for "that column doesn't exist" — i.e.
// migration 0010 hasn't been run on this database yet.
const MISSING_COLUMN_CODES = ["42703", "PGRST204"];

// Marks (or un-marks) one due date as "not coming": just that week's place
// is released, the standing visit itself stays.
export async function setRecurringVisitSkipped(
  id: string,
  date: string,
  skipped: boolean
): Promise<RecurringCustomerResult> {
  const { supabase } = await requireAdmin();
  if (!id || !isValidDateString(date)) return { success: false, error: "Μη έγκυρα στοιχεία." };

  const { data: row, error: readError } = await supabase
    .from("recurring_customers")
    .select("skipped_dates")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    if (MISSING_COLUMN_CODES.includes(readError.code)) {
      return { success: false, error: "Η βάση δεν έχει ενημερωθεί ακόμα για παραλείψεις (migration 0010)." };
    }
    return { success: false, error: "Σφάλμα κατά την αποθήκευση." };
  }
  if (!row) return { success: false, error: "Ο πελάτης δεν βρέθηκε." };

  const current = (row.skipped_dates ?? []) as string[];
  const next = skipped
    ? Array.from(new Set([...current, date])).sort()
    : current.filter((d) => d !== date);

  const { error } = await supabase.from("recurring_customers").update({ skipped_dates: next }).eq("id", id);
  if (error) return { success: false, error: "Σφάλμα κατά την αποθήκευση." };

  return { success: true };
}
