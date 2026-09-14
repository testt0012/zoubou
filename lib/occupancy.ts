import { timeToMinutes, weekdayOf } from "@/lib/time";

interface Interval {
  start: number;
  end: number;
}

// Subtracts each interval in `cuts` from the intervals in `base`, splitting
// a base interval in two when a cut falls in the middle of it.
function subtractIntervals(base: Interval[], cuts: Interval[]): Interval[] {
  let result = base;
  for (const cut of cuts) {
    const next: Interval[] = [];
    for (const seg of result) {
      if (cut.end <= seg.start || cut.start >= seg.end) {
        next.push(seg);
        continue;
      }
      if (cut.start > seg.start) next.push({ start: seg.start, end: Math.min(cut.start, seg.end) });
      if (cut.end < seg.end) next.push({ start: Math.max(cut.end, seg.start), end: seg.end });
    }
    result = next;
  }
  return result;
}

function sumMinutes(intervals: Interval[]): number {
  return intervals.reduce((sum, i) => sum + (i.end - i.start), 0);
}

interface AvailabilityRuleLike {
  weekday: number;
  start_time: string;
  end_time: string;
}

interface BlockedSlotLike {
  date: string;
  start_time: string;
  end_time: string;
}

interface AppointmentSpanLike {
  date: string;
  start_time: string;
  end_time: string;
}

// Minutes actually open for business on a specific date: the weekly
// availability windows for that weekday, minus whatever one-off
// blocked_slots fall inside them that day.
export function workingMinutesForDate(
  rules: AvailabilityRuleLike[],
  blocked: BlockedSlotLike[],
  date: string
): number {
  const weekday = weekdayOf(date);
  const windows: Interval[] = rules
    .filter((r) => r.weekday === weekday)
    .map((r) => ({ start: timeToMinutes(r.start_time), end: timeToMinutes(r.end_time) }));
  const cuts: Interval[] = blocked
    .filter((b) => b.date === date)
    .map((b) => ({ start: timeToMinutes(b.start_time), end: timeToMinutes(b.end_time) }));
  return sumMinutes(subtractIntervals(windows, cuts));
}

export function bookedMinutesForDate(appointments: AppointmentSpanLike[], date: string): number {
  return appointments
    .filter((a) => a.date === date)
    .reduce((sum, a) => sum + (timeToMinutes(a.end_time) - timeToMinutes(a.start_time)), 0);
}

export function occupancyPercent(bookedMinutes: number, workingMinutes: number): number {
  if (workingMinutes <= 0) return 0;
  return Math.min(100, Math.round((bookedMinutes / workingMinutes) * 100));
}
