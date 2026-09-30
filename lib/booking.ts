import { addDays, athensDateTimeToUTC } from "@/lib/time";

// Customers can only book this far ahead — three weeks. The admin's own
// screens (manual booking, moving an appointment) aren't limited by it.
export const MAX_ADVANCE_DAYS = 21;

export function lastBookableDate(today: string): string {
  return addDays(today, MAX_ADVANCE_DAYS);
}

// A customer can move or cancel their own appointment (from its private
// link) until this many hours before it starts; after that they have to
// get in touch with the shop.
export const CHANGE_DEADLINE_HOURS = 2;

export function canChangeAppointment(date: string, startTime: string, nowMs: number = Date.now()): boolean {
  const start = athensDateTimeToUTC(date, startTime.slice(0, 5)).getTime();
  return nowMs < start - CHANGE_DEADLINE_HOURS * 3600 * 1000;
}
