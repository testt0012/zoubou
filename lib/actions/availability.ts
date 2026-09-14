"use server";

import { requireAdmin } from "@/lib/supabase/server";
import { eachDate } from "@/lib/time";
import { isValidDateString } from "@/lib/validation";

const MAX_BLOCKED_RANGE_DAYS = 366;

export async function addAvailabilityRule(formData: FormData) {
  const { supabase } = await requireAdmin();
  const weekday = Number(formData.get("weekday"));
  const start_time = String(formData.get("start_time") ?? "");
  const end_time = String(formData.get("end_time") ?? "");

  if (
    !Number.isInteger(weekday) ||
    weekday < 0 ||
    weekday > 6 ||
    !start_time ||
    !end_time ||
    start_time >= end_time
  ) {
    return;
  }

  await supabase.from("availability_rules").insert({ weekday, start_time, end_time });
}

// Same time range, every day of the week at once — for the common "open
// the same hours every day" case instead of filling in the form 7 times.
export async function addAvailabilityRuleAllDays(formData: FormData) {
  const { supabase } = await requireAdmin();
  const start_time = String(formData.get("start_time") ?? "");
  const end_time = String(formData.get("end_time") ?? "");

  if (!start_time || !end_time || start_time >= end_time) return;

  const rows = Array.from({ length: 7 }, (_, weekday) => ({ weekday, start_time, end_time }));
  await supabase.from("availability_rules").insert(rows);
}

export async function updateAvailabilityRule(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const start_time = String(formData.get("start_time") ?? "");
  const end_time = String(formData.get("end_time") ?? "");

  if (!id || !start_time || !end_time || start_time >= end_time) return;

  await supabase.from("availability_rules").update({ start_time, end_time }).eq("id", id);
}

export async function deleteAvailabilityRule(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("availability_rules").delete().eq("id", id);
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
