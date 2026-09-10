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
const TIME_RE = /^\d{2}:\d{2}$/;

export function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value);
}

export function isValidTimeString(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}
