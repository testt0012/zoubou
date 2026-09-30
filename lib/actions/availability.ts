"use server";

import { requireAdmin } from "@/lib/supabase/server";
import { eachDate } from "@/lib/time";
import { isValidDateString, isValidTimeString } from "@/lib/validation";
import { isValidRange, mergeRanges, MAX_RANGES_PER_DAY, type TimeRange } from "@/lib/hours";

const MAX_BLOCKED_RANGE_DAYS = 366;

export interface SetWeekdayHoursResult {
  success: boolean;
  error?: string;
}

// The only way weekly hours are written: replaces everything stored for the
// given weekdays with `ranges` (an empty list = closed that day). Replacing
// the day wholesale, with the ranges merged first, is what guarantees a day
// can never end up with two overlapping rules (e.g. 09:00–17:00 alongside
// 09:00–23:00) the way adding rules one by one used to allow.
export async function setWeekdayHours(
  weekdays: number[],
  ranges: TimeRange[]
): Promise<SetWeekdayHoursResult> {
  const { supabase } = await requireAdmin();

  const days = Array.from(new Set(weekdays));
  const validDays =
    days.length > 0 && days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const validRanges =
    Array.isArray(ranges) &&
    ranges.length <= MAX_RANGES_PER_DAY &&
    ranges.every((r) => isValidTimeString(r?.start) && isValidTimeString(r?.end) && isValidRange(r));

  if (!validDays || !validRanges) {
    return { success: false, error: "Μη έγκυρο ωράριο." };
  }

  const merged = mergeRanges(ranges);

  const { data: previous, error: readError } = await supabase
    .from("availability_rules")
    .select("weekday, start_time, end_time")
    .in("weekday", days);
  if (readError) return { success: false, error: "Σφάλμα αποθήκευσης ωραρίου." };

  const { error: deleteError } = await supabase.from("availability_rules").delete().in("weekday", days);
  if (deleteError) return { success: false, error: "Σφάλμα αποθήκευσης ωραρίου." };

  if (merged.length === 0) return { success: true };

  const rows = days.flatMap((weekday) =>
    merged.map((r) => ({ weekday, start_time: r.start, end_time: r.end }))
  );
  const { error: insertError } = await supabase.from("availability_rules").insert(rows);
  if (insertError) {
    // Put the old hours back rather than leave those days closed.
    if (previous && previous.length > 0) await supabase.from("availability_rules").insert(previous);
    return { success: false, error: "Σφάλμα αποθήκευσης ωραρίου." };
  }

  return { success: true };
}

// Accepts a date range ("Από" / "Έως") rather than a single day, so a
// multi-day closure (e.g. holidays) is one submission instead of adding
// each day by hand — the blocked_slots table stays one row per day
// underneath, so every existing read path (computeAvailableSlots, the
// occupancy report) needs no changes.
export async function addBlockedSlot(formData: FormData) {
  const { supabase } = await requireAdmin();
  const dateFrom = formData.get("dateFrom");
  const dateTo = formData.get("dateTo");
  const start_time = String(formData.get("start_time") ?? "");
  const end_time = String(formData.get("end_time") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (
    !isValidDateString(dateFrom) ||
    !isValidDateString(dateTo) ||
    dateFrom > dateTo ||
    !start_time ||
    !end_time ||
    start_time >= end_time
  ) {
    return;
  }

  const dates = eachDate(dateFrom, dateTo);
  if (dates.length > MAX_BLOCKED_RANGE_DAYS) return;

  await supabase
    .from("blocked_slots")
    .insert(dates.map((date) => ({ date, start_time, end_time, reason })));
}

export async function deleteBlockedSlot(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("blocked_slots").delete().eq("id", id);
}
