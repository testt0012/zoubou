export const ATHENS_TZ = "Europe/Athens";

const GREEK_WEEKDAYS = [
  "Κυριακή",
  "Δευτέρα",
  "Τρίτη",
  "Τετάρτη",
  "Πέμπτη",
  "Παρασκευή",
  "Σάββατο",
];

// Time-of-day helpers work on plain "HH:MM" strings in minutes-since-midnight —
// there's no timezone math involved once we already have an Athens calendar date.
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// Calendar weekday (0 = Sunday ... 6 = Saturday) for a "YYYY-MM-DD" date
// string. Parsed at UTC noon so it can never shift to the adjacent day
// regardless of the server's local timezone.
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

export function formatDateLong(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const formatted = new Intl.DateTimeFormat("el-GR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ATHENS_TZ,
  }).format(d);
  return `${GREEK_WEEKDAYS[weekdayOf(dateStr)]}, ${formatted}`;
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat("el-GR", {
    day: "numeric",
    month: "short",
    timeZone: ATHENS_TZ,
  }).format(d);
}

export function weekdayLabel(weekday: number): string {
  return GREEK_WEEKDAYS[weekday];
}

// "Now" expressed as an Athens calendar date + minutes-since-midnight,
// independent of the server's own timezone.
export function athensNow(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATHENS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  return { date, minutes };
}

export function todayAthens(): string {
  return athensNow().date;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Monday of the week containing dateStr ("YYYY-MM-DD").
export function startOfWeek(dateStr: string): string {
  const weekday = weekdayOf(dateStr); // 0 = Sunday ... 6 = Saturday
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  return addDays(dateStr, -daysSinceMonday);
}

// Inclusive list of "YYYY-MM-DD" dates from `from` to `to`.
export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  let d = from;
  while (d <= to) {
    dates.push(d);
    d = addDays(d, 1);
  }
  return dates;
}

function athensOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return (asUTC - instant.getTime()) / 60000;
}

// Converts an Athens wall-clock date+time ("YYYY-MM-DD", "HH:MM") to the
// UTC instant it represents. Single-shot DST correction via Intl's
// round-trip offset lookup — accurate except inside the DST transition
// hour itself, which never falls within business hours.
export function athensDateTimeToUTC(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offsetMinutes = athensOffsetMinutes(new Date(guess));
  return new Date(guess - offsetMinutes * 60000);
}
