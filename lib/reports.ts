import { addDays, startOfWeek } from "@/lib/time";

// One day's occupancy figures, in minutes: how long the shop was open and
// how much of that was booked.
export interface DayTotals {
  working: number;
  booked: number;
}

// A day can't have been open for less time than was booked on it: bookings
// that outlive a later change (hours reduced, the day closed over them) or
// that predate the hours now on file would otherwise add booked time with
// no open time behind it and push a period's percentage past what it can
// be. The open time is raised to cover them.
export function dayTotals(workingMinutes: number, bookedMinutes: number): DayTotals {
  return { working: Math.max(workingMinutes, bookedMinutes), booked: bookedMinutes };
}

// "YYYY-MM-DD" moved by whole months, keeping the day where the target
// month has it (31 March - 1 month = 28/29 February).
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}

// Monday to Sunday of the week before the one `today` is in.
export function previousWeekRange(today: string): { from: string; to: string } {
  const from = addDays(startOfWeek(today), -7);
  return { from, to: addDays(from, 6) };
}

// The whole previous calendar month, 1st to last day.
export function previousMonthRange(today: string): { from: string; to: string } {
  const firstOfThisMonth = `${today.slice(0, 8)}01`;
  return { from: addMonths(firstOfThisMonth, -1), to: addDays(firstOfThisMonth, -1) };
}

// Sorts a period's days into where their figures come from:
//  - frozen:  a past day already saved in daily_stats;
//  - skipped: a past day older than anything ever recorded (no data exists);
//  - live:    today and later, or a past day not yet saved — computed from
//             the current hours and bookings.
// With no frozen data at all (`firstFrozen` null) every day is live.
export function classifyDays(
  dates: string[],
  today: string,
  frozen: ReadonlyMap<string, DayTotals> | null,
  firstFrozen: string | null
): { frozen: { date: string; totals: DayTotals }[]; live: string[]; skipped: string[] } {
  const result = { frozen: [] as { date: string; totals: DayTotals }[], live: [] as string[], skipped: [] as string[] };

  for (const date of dates) {
    const saved = date < today ? frozen?.get(date) : undefined;
    if (saved) result.frozen.push({ date, totals: saved });
    else if (date < today && firstFrozen && date < firstFrozen) result.skipped.push(date);
    else result.live.push(date);
  }

  return result;
}
