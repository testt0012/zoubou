import { timeToMinutes } from "@/lib/time";

// One stretch of opening hours within a day, as "HH:MM" strings.
export interface TimeRange {
  start: string;
  end: string;
}

export const MAX_RANGES_PER_DAY = 3;

// blocked_slots holds both planned time off ("Διακοπές") and one-off
// closures; the latter are told apart by carrying this as their reason.
export const EMERGENCY_CLOSURE_REASON = "Έκτακτο κλείσιμο";
export const FULL_DAY_START = "00:00";
export const FULL_DAY_END = "23:59";

export function isValidRange(range: TimeRange): boolean {
  return timeToMinutes(range.start) < timeToMinutes(range.end);
}

export function rangesOverlap(ranges: TimeRange[]): boolean {
  return ranges.some((a, i) =>
    ranges.some(
      (b, j) =>
        i < j &&
        timeToMinutes(a.start) < timeToMinutes(b.end) &&
        timeToMinutes(b.start) < timeToMinutes(a.end)
    )
  );
}

// Sorted, with overlapping or touching ranges fused into one — the shape a
// day's hours are always stored in, so the same hour can never be open twice.
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = [...ranges].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const merged: TimeRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && timeToMinutes(range.start) <= timeToMinutes(last.end)) {
      if (timeToMinutes(range.end) > timeToMinutes(last.end)) last.end = range.end;
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}
