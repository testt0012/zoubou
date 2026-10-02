import type { SupabaseClient } from "@supabase/supabase-js";
import { athensNow, minutesToTime, timeToMinutes, weekdayOf } from "@/lib/time";
import { subtractIntervals, workingMinutesForDate, type Interval } from "@/lib/occupancy";
import {
  fixedIntervalsFor,
  leavesRoomFor,
  placeReservations,
  toRecurringVisit,
  zoneReservationsFor,
  type RecurringVisit,
} from "@/lib/recurring";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type SlotError = "service_not_found" | "invalid_date" | "unavailable";
// A failed computation; `detail` is what the database said (for the error log).
export type SlotFailure = { error: SlotError; detail?: string };

export interface DayAvailability {
  open: boolean;
  count: number;
}

export interface DatesResult {
  // Days with at least one free time.
  dates: string[];
  // Every day in the range: whether the shop is open and how many times are free.
  days: Record<string, DayAvailability>;
  // The first day with free times and those times, so the booking screen can
  // show them without a second request.
  firstDay: { date: string; slots: string[] } | null;
}

export interface SlotsResult {
  slots: string[];
  serviceDurationMinutes: number;
}

const MISSING_TABLE_CODES = ["42P01", "PGRST205"];

// `now` is only for tests; it defaults to the real Athens clock.
export interface SlotOptions {
  excludeAppointmentId?: string;
  now?: { date: string; minutes: number };
}

interface WeeklyRule {
  weekday: number;
  start_time: string;
  end_time: string;
}

interface DatedSpan {
  date: string;
  start_time: string;
  end_time: string;
}

interface BookedSpan extends DatedSpan {
  id: string;
}

// Everything the slot maths needs, already fetched — for one date or for a
// whole range of them (the same data serves every date in it).
interface SlotInputs {
  duration: number;
  buffer: number;
  rules: WeeklyRule[];
  blocked: DatedSpan[];
  booked: BookedSpan[];
  visits: RecurringVisit[];
}

const toInterval = (s: { start_time: string; end_time: string }): Interval => ({
  start: timeToMinutes(s.start_time),
  end: timeToMinutes(s.end_time),
});

/**
 * The bookable start times (minutes since midnight) on one Athens date:
 * weekly availability windows, minus blocked slots, minus existing confirmed
 * appointments (padded by the configured buffer), minus what's held for
 * regular customers (see lib/recurring.ts: a fixed time is simply taken; a
 * time zone keeps one opening free, so the last free slot in it isn't
 * offered), and never in the past.
 *
 * Slots are stepped by the service's own duration, back to back, starting
 * from the beginning of each free stretch — a 40' service in a window
 * opening at 10:00 offers 10:00, 10:40, 11:20… and, after a booking that
 * ends at 12:15, carries on from 12:15, 12:55… — so changing a service's
 * duration in the admin reshapes its slots and no dead gaps are left
 * between appointments.
 */
function slotsForDate(
  inputs: SlotInputs,
  date: string,
  now: { date: string; minutes: number },
  excludeAppointmentId?: string
): number[] {
  const { duration, buffer, visits } = inputs;
  const weekday = weekdayOf(date);

  const windows = inputs.rules.filter((r) => r.weekday === weekday).map(toInterval);

  const busy: Interval[] = [
    ...fixedIntervalsFor(visits, date),
    ...inputs.blocked.filter((b) => b.date === date).map(toInterval),
    ...inputs.booked
      .filter((a) => a.date === date && a.id !== excludeAppointmentId)
      .map((a) => ({
        start: timeToMinutes(a.start_time) - buffer,
        end: timeToMinutes(a.end_time) + buffer,
      })),
  ];

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

  return Array.from(new Set(results)).sort((a, b) => a - b);
}

// A database error must never be read as "nothing booked, nothing blocked" —
// that would offer taken or closed times. Anything that can't be read makes
// the whole answer "unavailable" instead.
// Reads the duration out of the service lookup (which runs alongside the
// other queries, not before them — one database round trip saved per call).
function serviceDuration(result: {
  data: { duration_minutes: number } | null;
  error: { code?: string } | null;
}): number | SlotError {
  // 22P02: the id isn't even a valid UUID, so no such service.
  if (result.error) return result.error.code === "22P02" ? "service_not_found" : "unavailable";
  if (!result.data) return "service_not_found";
  return result.data.duration_minutes as number;
}

type ReadResult = { error: { code?: string; message?: string } | null };

// What went wrong in a batch of reads, as text for the error log; null if
// every read worked. (`visits` is null when the regulars couldn't be read.)
function readFailure(results: readonly [ReadResult, ReadResult, ReadResult, ReadResult, ReadResult, unknown]): string | null {
  const [service, settings, rules, blocked, booked, visits] = results;
  const names = ["services", "settings", "availability_rules", "blocked_slots", "appointments"];
  const failed = [service, settings, rules, blocked, booked].flatMap((r, i) =>
    r.error ? [`${names[i]}: ${r.error.code ?? ""} ${r.error.message ?? ""}`.trim()] : []
  );
  if (visits === null) failed.push("recurring_customers");
  return failed.length ? failed.join("; ") : null;
}

// A read that fails now and then (a dropped connection, a database busy for a
// moment) is tried once more after a short pause, so a customer doesn't see
// an error for a blip. An unknown service isn't a blip and isn't retried.
async function readWithOneRetry<T extends readonly [ReadResult, ReadResult, ReadResult, ReadResult, ReadResult, unknown]>(
  run: () => PromiseLike<T>
): Promise<T> {
  const attempt = async () => {
    try {
      return await run();
    } catch (error) {
      return error as Error;
    }
  };
  let result = await attempt();
  if (result instanceof Error || (readFailure(result) && result[0].error?.code !== "22P02")) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    result = await attempt();
  }
  if (result instanceof Error) throw result;
  return result;
}

const serviceQuery = (supabase: Db, serviceId: string) =>
  supabase
    .from("services")
    .select("id, duration_minutes, active")
    .eq("id", serviceId)
    .eq("active", true)
    .maybeSingle();

// The table not existing (before migration 0009) just means "no regulars";
// any other error is passed on as null.
export async function loadRegulars(supabase: Db, upTo: string): Promise<RecurringVisit[] | null> {
  const { data, error } = await supabase
    .from("recurring_customers")
    .select("*, services(duration_minutes)")
    .lte("start_date", upTo);
  if (error) return MISSING_TABLE_CODES.includes(error.code ?? "") ? [] : null;

  return (data ?? []).map((r) => {
    const joined = r.services as { duration_minutes: number } | { duration_minutes: number }[] | null;
    const regularService = Array.isArray(joined) ? joined[0] : joined;
    return toRecurringVisit(r, regularService?.duration_minutes ?? 0);
  });
}

/**
 * Bookable start times ("HH:MM") for a service on one date.
 *
 * Used both by GET /api/slots (to show clients options) and by POST /api/book
 * (to re-validate the chosen slot server-side before insert) — the exclusion
 * constraint in the database is the final, authoritative race-condition guard,
 * this function is what makes the UI/validation actually usable.
 *
 * `excludeAppointmentId` ignores one existing appointment, so it can be
 * moved to a time that overlaps its own current one.
 */
export async function computeAvailableSlots(
  supabase: Db,
  serviceId: string,
  date: string,
  options: SlotOptions = {}
): Promise<SlotsResult | SlotFailure> {
  const loaded = await readWithOneRetry(() =>
    Promise.all([
      serviceQuery(supabase, serviceId),
      supabase.from("settings").select("*").eq("id", true).maybeSingle(),
      supabase.from("availability_rules").select("weekday, start_time, end_time").eq("weekday", weekdayOf(date)),
      supabase.from("blocked_slots").select("date, start_time, end_time").eq("date", date),
      supabase
        .from("appointments")
        .select("id, date, start_time, end_time")
        .eq("date", date)
        .eq("status", "confirmed"),
      loadRegulars(supabase, date),
    ])
  );
  const [serviceRes, settingsRes, rulesRes, blockedRes, bookedRes, visits] = loaded;

  const duration = serviceDuration(serviceRes);
  if (typeof duration !== "number") {
    return duration === "unavailable" ? { error: duration, detail: readFailure(loaded) ?? undefined } : { error: duration };
  }

  const failure = readFailure(loaded);
  if (failure || visits === null) return { error: "unavailable", detail: failure ?? undefined };

  const slots = slotsForDate(
    {
      duration,
      buffer: settingsRes.data?.buffer_minutes ?? 0,
      rules: rulesRes.data ?? [],
      blocked: blockedRes.data ?? [],
      booked: bookedRes.data ?? [],
      visits,
    },
    date,
    options.now ?? athensNow(),
    options.excludeAppointmentId
  ).map(minutesToTime);

  return { slots, serviceDurationMinutes: duration };
}

/**
 * Every date in [from, to] with at least one bookable time for the service —
 * what the customer's calendar uses to grey out closed and fully-booked
 * days. Loads everything once for the whole range instead of once per date.
 */
export async function computeAvailableDates(
  supabase: Db,
  serviceId: string,
  from: string,
  to: string,
  options: SlotOptions = {}
): Promise<DatesResult | SlotFailure> {
  const loaded = await readWithOneRetry(() =>
    Promise.all([
      serviceQuery(supabase, serviceId),
      supabase.from("settings").select("*").eq("id", true).maybeSingle(),
      supabase.from("availability_rules").select("weekday, start_time, end_time"),
      supabase.from("blocked_slots").select("date, start_time, end_time").gte("date", from).lte("date", to),
      supabase
        .from("appointments")
        .select("id, date, start_time, end_time")
        .gte("date", from)
        .lte("date", to)
        .eq("status", "confirmed"),
      loadRegulars(supabase, to),
    ])
  );
  const [serviceRes, settingsRes, rulesRes, blockedRes, bookedRes, visits] = loaded;

  const duration = serviceDuration(serviceRes);
  if (typeof duration !== "number") {
    return duration === "unavailable" ? { error: duration, detail: readFailure(loaded) ?? undefined } : { error: duration };
  }

  const failure = readFailure(loaded);
  if (failure || visits === null) return { error: "unavailable", detail: failure ?? undefined };

  const inputs: SlotInputs = {
    duration,
    buffer: settingsRes.data?.buffer_minutes ?? 0,
    rules: rulesRes.data ?? [],
    blocked: blockedRes.data ?? [],
    booked: bookedRes.data ?? [],
    visits,
  };

  const now = options.now ?? athensNow();
  const dates: string[] = [];
  const days: Record<string, DayAvailability> = {};
  let firstDay: DatesResult["firstDay"] = null;
  for (let date = from; date <= to; date = nextDate(date)) {
    const times = slotsForDate(inputs, date, now, options.excludeAppointmentId);
    const count = times.length;
    if (count > 0 && !firstDay) firstDay = { date, slots: times.map(minutesToTime) };
    // "Open" is about the shop's hours, not about what's left: a full day is
    // open with 0 free times, a day with no hours (or closed by a vacation
    // or an all-day closure) is not open at all.
    days[date] = { open: workingMinutesForDate(inputs.rules, inputs.blocked, date) > 0, count };
    if (count > 0) dates.push(date);
  }

  return { dates, days, firstDay };
}

function nextDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
