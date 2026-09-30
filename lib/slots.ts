import type { SupabaseClient } from "@supabase/supabase-js";
import { athensNow, minutesToTime, timeToMinutes, weekdayOf } from "@/lib/time";
import { subtractIntervals, type Interval } from "@/lib/occupancy";
import {
  fixedIntervalsFor,
  leavesRoomFor,
  placeReservations,
  toRecurringVisit,
  zoneReservationsFor,
} from "@/lib/recurring";

export type SlotError = "service_not_found" | "invalid_date";

export interface SlotsResult {
  slots: string[];
  serviceDurationMinutes: number;
}

/**
 * Computes bookable start times ("HH:MM") for a given service on a given
 * Athens calendar date: weekly availability windows, minus blocked slots,
 * minus existing confirmed appointments (padded by the configured buffer),
 * minus what's held for regular customers (see lib/recurring.ts: a fixed
 * time is simply taken; a time zone keeps one opening free, so the last
 * free slot in it isn't offered), and never in the past.
 *
 * Slots are stepped by the service's own duration, back to back, starting
 * from the beginning of each free stretch — a 40' service in a window
 * opening at 10:00 offers 10:00, 10:40, 11:20… and, after a booking that
 * ends at 12:15, carries on from 12:15, 12:55… — so changing a service's
 * duration in the admin reshapes its slots and no dead gaps are left
 * between appointments.
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

  const [{ data: settings }, { data: rules }, { data: blocked }, { data: booked }, { data: regulars }] =
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
      // Errors (e.g. the table not existing before migration 0009) just
      // mean "no regulars".
      supabase
        .from("recurring_customers")
        .select("*, services(duration_minutes)")
        .lte("start_date", date),
    ]);

  const buffer = settings?.buffer_minutes ?? 0;

  const windows: Interval[] = (rules ?? []).map((r) => ({
    start: timeToMinutes(r.start_time),
    end: timeToMinutes(r.end_time),
  }));

  const visits = (regulars ?? []).map((r) => {
    const joined = r.services as { duration_minutes: number } | { duration_minutes: number }[] | null;
    const regularService = Array.isArray(joined) ? joined[0] : joined;
    return toRecurringVisit(r, regularService?.duration_minutes ?? 0);
  });

  const busy: Interval[] = [
    ...fixedIntervalsFor(visits, date),
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

  const freeSegments = subtractIntervals(windows, busy);

  // A zone regular can only still be seated in what's left of today. Only
  // the zones that can be seated at all are enforced — one that's already
  // out of room must not take every other slot of the day down with it.
  const reservable = isToday ? subtractIntervals(freeSegments, [{ start: 0, end: now.minutes }]) : freeSegments;
  const zones = placeReservations(reservable, zoneReservationsFor(visits, date));

  const results: number[] = [];

  for (const free of freeSegments) {
    for (let start = free.start; start + duration <= free.end; start += duration) {
      if (isToday && start <= now.minutes) continue;
      if (!leavesRoomFor(reservable, { start, end: start + duration }, zones)) continue;
      results.push(start);
    }
  }

  const slots = Array.from(new Set(results))
    .sort((a, b) => a - b)
    .map(minutesToTime);

  return { slots, serviceDurationMinutes: duration };
}
