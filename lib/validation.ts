// Greek mobile numbers: 10 digits starting with 69. Accepts common ways
// people type them (+30, 0030, spaces, dashes) and normalizes to "69XXXXXXXX".
export function normalizeGreekMobile(raw: string): string | null {
  let digits = raw.replace(/[\s-]/g, "");

  if (digits.startsWith("+30")) digits = digits.slice(3);
  else if (digits.startsWith("0030")) digits = digits.slice(4);
  else if (digits.startsWith("30") && digits.length === 12) digits = digits.slice(2);

  if (!/^69\d{8}$/.test(digits)) return null;
  return digits;
}

export function sanitizeName(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length < 1 || trimmed.length > 60) return null;
  // Greek and Latin letters, spaces, and common name punctuation.
  if (!/^[A-Za-zΑ-Ωα-ωΆ-Ώά-ώ'\- ]+$/.test(trimmed)) return null;
  return trimmed;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// A real calendar day: "2026-02-30" and "2026-10-00" have the right shape
// but aren't dates (and would make the database reject the query).
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidTimeString(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}
