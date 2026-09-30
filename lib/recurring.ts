import { subtractIntervals, type Interval } from "@/lib/occupancy";
import { timeToMinutes, weekdayLabel, weekdayOf } from "@/lib/time";

// A regular ("μόνιμος") customer's standing visit, reduced to what the
// scheduling maths needs. Either a fixed time (zoneEnd null: the visit is
// start..start+duration) or a time zone (the visit can land anywhere in
// start..zoneEnd, and one place for it is always kept free there).
export interface RecurringVisit {
  id: string;
  startDate: string; // first visit, "YYYY-MM-DD" — also fixes the weekday
  intervalWeeks: number;
  skippedDates: string[]; // due dates the customer isn't coming on
  start: number; // minutes since midnight
  zoneEnd: number | null;
  duration: number; // of the customer's service, in minutes
}

export interface ZoneReservation {
  start: number;
  end: number;
  duration: number;
}

const DAY_MS = 86400000;

export function toRecurringVisit(
  row: {
    id: string;
    start_date: string;
    interval_weeks: number;
    start_time: string;
    zone_end_time: string | null;
    skipped_dates?: string[] | null;
  },
  duration: number
): RecurringVisit {
  return {
    id: row.id,
    startDate: row.start_date,
    intervalWeeks: row.interval_weeks,
    skippedDates: row.skipped_dates ?? [],
    start: timeToMinutes(row.start_time),
    zoneEnd: row.zone_end_time === null ? null : timeToMinutes(row.zone_end_time),
    duration,
  };
}

// "Κάθε Τρίτη · 13:00" / "Κάθε 2 εβδομάδες, Τρίτη · ζώνη 13:00–16:00"
export function describeSchedule(row: {
  start_date: string;
  interval_weeks: number;
  start_time: string;
  zone_end_time: string | null;
}): string {
  const day = weekdayLabel(weekdayOf(row.start_date));
  const every = row.interval_weeks === 1 ? `Κάθε ${day}` : `Κάθε ${row.interval_weeks} εβδομάδες, ${day}`;
  const time =
    row.zone_end_time === null
      ? row.start_time.slice(0, 5)
      : `ζώνη ${row.start_time.slice(0, 5)}–${row.zone_end_time.slice(0, 5)}`;
  return `${every} · ${time}`;
}

// Whether `date` is one of the customer's due dates by the calendar alone:
// same weekday as their first visit, not before it, and a whole number of
// their intervals after it.
export function isDueDate(visit: Pick<RecurringVisit, "startDate" | "intervalWeeks">, date: string): boolean {
  if (date < visit.startDate || weekdayOf(date) !== weekdayOf(visit.startDate)) return false;
  const days = Math.round(
    (new Date(`${date}T12:00:00Z`).getTime() - new Date(`${visit.startDate}T12:00:00Z`).getTime()) / DAY_MS
  );
  return (days / 7) % visit.intervalWeeks === 0;
}

// Whether the customer is actually coming on `date`: a due date they
// haven't been marked as skipping.
export function occursOn(
  visit: Pick<RecurringVisit, "startDate" | "intervalWeeks"> & { skippedDates?: string[] },
  date: string
): boolean {
  return isDueDate(visit, date) && !visit.skippedDates?.includes(date);
}

// Time taken outright by the fixed-time regulars due on `date`.
export function fixedIntervalsFor(visits: RecurringVisit[], date: string): Interval[] {
  return visits
    .filter((v) => v.zoneEnd === null && occursOn(v, date))
    .map((v) => ({ start: v.start, end: v.start + v.duration }));
}

export function zoneReservationsFor(visits: RecurringVisit[], date: string): ZoneReservation[] {
  return visits
    .filter((v) => v.zoneEnd !== null && occursOn(v, date))
    .map((v) => ({ start: v.start, end: v.zoneEnd as number, duration: v.duration }));
}

// Seats each zone reservation in `free` time, earliest-ending zone first and
// each at the earliest spot inside its zone. Returns the ones that fitted
// (the rest simply have no room left that day).
export function placeReservations(free: Interval[], zones: ZoneReservation[]): ZoneReservation[] {
  let remaining = [...free].sort((a, b) => a.start - b.start);
  const placed: ZoneReservation[] = [];

  for (const zone of [...zones].sort((a, b) => a.end - b.end)) {
    for (const segment of remaining) {
      const start = Math.max(segment.start, zone.start);
      const end = Math.min(segment.end, zone.end);
      if (end - start >= zone.duration) {
        remaining = subtractIntervals(remaining, [{ start, end: start + zone.duration }]);
        placed.push(zone);
        break;
      }
    }
  }
  return placed;
}

// Whether taking `candidate` out of `free` still leaves every zone
// reservation a place. This is what closes the last opening in a zone: with
// one spot left, any booking that would use it fails this check.
export function leavesRoomFor(free: Interval[], candidate: Interval, zones: ZoneReservation[]): boolean {
  if (zones.length === 0) return true;
  return placeReservations(subtractIntervals(free, [candidate]), zones).length === zones.length;
}

// ---------------------------------------------------------------------------
// Day view (admin): where each regular due on a date shows up.
// ---------------------------------------------------------------------------

interface RuleLike {
  weekday: number;
  start_time: string;
  end_time: string;
}

interface SpanLike {
  date: string;
  start_time: string;
  end_time: string;
}

export interface RecurringDayEntry {
  id: string;
  isZone: boolean;
  // Fixed: the visit itself. Zone: the zone.
  start: number;
  end: number;
  duration: number;
  // Zone only: the one opening left in the zone, once bookings have narrowed
  // it down to exactly one — otherwise null.
  exactStart: number | null;
  // False when the day no longer has room for the visit (shop closed then,
  // or the zone is completely booked).
  fits: boolean;
}

export function recurringEntriesForDate(
  visits: RecurringVisit[],
  rules: RuleLike[],
  blocked: SpanLike[],
  appointments: SpanLike[],
  date: string
): RecurringDayEntry[] {
  const due = visits.filter((v) => occursOn(v, date));
  if (due.length === 0) return [];

  const weekday = weekdayOf(date);
  const toInterval = (s: { start_time: string; end_time: string }): Interval => ({
    start: timeToMinutes(s.start_time),
    end: timeToMinutes(s.end_time),
  });
  const open = subtractIntervals(
    rules.filter((r) => r.weekday === weekday).map(toInterval),
    blocked.filter((b) => b.date === date).map(toInterval)
  );
  const free = subtractIntervals(open, [
    ...appointments.filter((a) => a.date === date).map(toInterval),
    ...fixedIntervalsFor(visits, date),
  ]);

  return due
    .map((v): RecurringDayEntry => {
      if (v.zoneEnd === null) {
        const end = v.start + v.duration;
        const fits = open.some((o) => o.start <= v.start && end <= o.end);
        return { id: v.id, isZone: false, start: v.start, end, duration: v.duration, exactStart: null, fits };
      }
      const openings = subtractIntervals(free, [
        { start: 0, end: v.start },
        { start: v.zoneEnd, end: 24 * 60 },
      ]).filter((segment) => segment.end - segment.start >= v.duration);
      const capacity = openings.reduce((sum, s) => sum + Math.floor((s.end - s.start) / v.duration), 0);
      return {
        id: v.id,
        isZone: true,
        start: v.start,
        end: v.zoneEnd,
        duration: v.duration,
        exactStart: capacity === 1 ? openings[0].start : null,
        fits: capacity >= 1,
      };
    })
    .sort((a, b) => (a.exactStart ?? a.start) - (b.exactStart ?? b.start));
}

// Minutes of the day taken by regulars' visits — what they add to occupancy
// on top of the booked appointments.
export function recurringMinutesForDate(
  visits: RecurringVisit[],
  rules: RuleLike[],
  blocked: SpanLike[],
  appointments: SpanLike[],
  date: string
): number {
  return recurringEntriesForDate(visits, rules, blocked, appointments, date).reduce(
    (sum, entry) => sum + (entry.fits ? entry.duration : 0),
    0
  );
}

// Regulars who have a place on one of `dates` now and would lose it if the
// shop closed from `startTime` to `endTime` on those dates.
export function regularsAffectedByClosure(
  visits: RecurringVisit[],
  rules: RuleLike[],
  blocked: SpanLike[],
  appointments: SpanLike[],
  dates: string[],
  startTime: string,
  endTime: string
): { date: string; entry: RecurringDayEntry }[] {
  const affected: { date: string; entry: RecurringDayEntry }[] = [];
  for (const date of dates) {
    const before = recurringEntriesForDate(visits, rules, blocked, appointments, date);
    if (before.length === 0) continue;
    const after = recurringEntriesForDate(
      visits,
      rules,
      [...blocked, { date, start_time: startTime, end_time: endTime }],
      appointments,
      date
    );
    for (const entry of before) {
      if (entry.fits && !after.find((e) => e.id === entry.id)?.fits) affected.push({ date, entry });
    }
  }
  return affected;
}
