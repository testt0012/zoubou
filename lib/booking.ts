import { addDays } from "@/lib/time";

// Customers can only book this far ahead — three weeks. The admin's own
// screens (manual booking, moving an appointment) aren't limited by it.
export const MAX_ADVANCE_DAYS = 21;

export function lastBookableDate(today: string): string {
  return addDays(today, MAX_ADVANCE_DAYS);
}
