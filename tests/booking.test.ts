import test from "node:test";
import assert from "node:assert/strict";
import { canChangeAppointment, CHANGE_DEADLINE_HOURS, lastBookableDate, MAX_ADVANCE_DAYS } from "@/lib/booking";
import { athensDateTimeToUTC } from "@/lib/time";

test("customers can book at most three weeks ahead", () => {
  assert.equal(MAX_ADVANCE_DAYS, 21);
  assert.equal(lastBookableDate("2026-09-30"), "2026-10-21");
  assert.equal(lastBookableDate("2026-12-20"), "2027-01-10");
});

test("changes are allowed up to 2 hours before the start, to the minute", () => {
  const start = athensDateTimeToUTC("2026-10-14", "12:00").getTime();
  const hour = 3600 * 1000;
  assert.equal(CHANGE_DEADLINE_HOURS, 2);
  assert.ok(canChangeAppointment("2026-10-14", "12:00", start - 3 * hour));
  assert.ok(canChangeAppointment("2026-10-14", "12:00", start - 2 * hour - 1000)); // 1 second before the deadline
  assert.ok(!canChangeAppointment("2026-10-14", "12:00", start - 2 * hour)); // exactly at the deadline
  assert.ok(!canChangeAppointment("2026-10-14", "12:00", start - hour));
  assert.ok(!canChangeAppointment("2026-10-14", "12:00", start + hour)); // already started
});

test("the deadline follows Athens clock time across the autumn clock change", () => {
  // 26 Oct 10:00 is winter time (UTC+2) = 08:00 UTC; the deadline is 06:00 UTC.
  const before = Date.UTC(2026, 9, 26, 5, 59);
  const after = Date.UTC(2026, 9, 26, 6, 1);
  assert.ok(canChangeAppointment("2026-10-26", "10:00", before));
  assert.ok(!canChangeAppointment("2026-10-26", "10:00", after));
});
