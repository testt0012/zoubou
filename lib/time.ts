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
