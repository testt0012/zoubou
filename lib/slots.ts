import type { SupabaseClient } from "@supabase/supabase-js";
import { athensNow, minutesToTime, timeToMinutes, weekdayOf } from "@/lib/time";

interface Interval {
  start: number;
  end: number;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export type SlotError = "service_not_found" | "invalid_date";

export interface SlotsResult {
  slots: string[];
  serviceDurationMinutes: number;
}

/**
 * Computes bookable start times ("HH:MM") for a given service on a given
 * Athens calendar date: weekly availability windows, minus blocked slots,
 * minus existing confirmed appointments (padded by the configured buffer),
 * stepped at the admin-configured slot granularity, and never in the past.
 *
 * Used both by GET /api/slots (to show clients options) and by POST /api/book
 * (to re-validate the chosen slot server-side before insert) — the exclusion
 * constraint in the database is the final, authoritative race-condition guard,
 * this function is what makes the UI/validation actually usable.
 */
export async function computeAvailableSlots(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  serviceId: string,
  date: string
): Promise<SlotsResult | { error: SlotError }> {
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, duration_minutes, active")
    .eq("id", serviceId)
    .eq("active", true)
    .maybeSingle();

  if (serviceError || !service) {
    return { error: "service_not_found" };
  }

  const duration = service.duration_minutes as number;

  const [{ data: settings }, { data: rules }, { data: blocked }, { data: booked }] =
    await Promise.all([
      supabase.from("settings").select("*").eq("id", true).maybeSingle(),
      supabase
        .from("availability_rules")
        .select("start_time, end_time")
        .eq("weekday", weekdayOf(date)),
      supabase.from("blocked_slots").select("start_time, end_time").eq("date", date),
      supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("date", date)
        .eq("status", "confirmed"),
    ]);

  const granularity = settings?.slot_granularity_minutes ?? 30;
  const buffer = settings?.buffer_minutes ?? 0;

  const windows: Interval[] = (rules ?? []).map((r) => ({
    start: timeToMinutes(r.start_time),
    end: timeToMinutes(r.end_time),
  }));

  const busy: Interval[] = [
    ...(blocked ?? []).map((b) => ({
      start: timeToMinutes(b.start_time),
      end: timeToMinutes(b.end_time),
    })),
    ...(booked ?? []).map((a) => ({
      start: timeToMinutes(a.start_time) - buffer,
      end: timeToMinutes(a.end_time) + buffer,
    })),
  ];

  const now = athensNow();
  const isToday = now.date === date;

  const results: number[] = [];

  for (const window of windows) {
    for (
      let start = window.start;
      start + duration <= window.end;
      start += granularity
    ) {
      if (isToday && start <= now.minutes) continue;

      const candidate: Interval = { start, end: start + duration };
      const blockedByBusy = busy.some((b) => overlaps(candidate, b));
      if (!blockedByBusy) results.push(start);
    }
  }

  const slots = Array.from(new Set(results))
    .sort((a, b) => a - b)
    .map(minutesToTime);

  return { slots, serviceDurationMinutes: duration };
}
