import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  athensDateTimeToUTC,
  eachDate,
  formatDateLong,
  minutesToTime,
  startOfWeek,
  timeToMinutes,
  weekdayOf,
} from "@/lib/time";

test("time <-> minutes round trip", () => {
  assert.equal(timeToMinutes("00:00"), 0);
  assert.equal(timeToMinutes("09:40"), 580);
  assert.equal(timeToMinutes("23:59"), 1439);
  assert.equal(minutesToTime(0), "00:00");
  assert.equal(minutesToTime(580), "09:40");
  assert.equal(minutesToTime(1439), "23:59");
  for (const t of ["00:00", "07:05", "12:30", "23:59"]) assert.equal(minutesToTime(timeToMinutes(t)), t);
});

test("weekdayOf: 0 = Sunday … 6 = Saturday", () => {
  assert.equal(weekdayOf("2026-10-04"), 0); // Sunday
  assert.equal(weekdayOf("2026-10-05"), 1); // Monday
  assert.equal(weekdayOf("2026-10-06"), 2); // Tuesday
  assert.equal(weekdayOf("2026-10-10"), 6); // Saturday
  assert.equal(weekdayOf("2028-02-29"), 2); // leap day
});

test("addDays crosses month, year and leap-year boundaries", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2027-02-28", 1), "2027-03-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2026-10-06", 0), "2026-10-06");
  assert.equal(addDays("2026-10-06", -7), "2026-09-29");
});

test("addDays is not thrown off by the daylight-saving change (25 Oct 2026)", () => {
  assert.equal(addDays("2026-10-24", 1), "2026-10-25");
  assert.equal(addDays("2026-10-25", 1), "2026-10-26");
  assert.equal(addDays("2026-03-28", 1), "2026-03-29");
  assert.equal(addDays("2026-03-29", 1), "2026-03-30");
});

test("startOfWeek returns the Monday of that week", () => {
  assert.equal(startOfWeek("2026-10-05"), "2026-10-05"); // Monday stays
  assert.equal(startOfWeek("2026-10-07"), "2026-10-05");
  assert.equal(startOfWeek("2026-10-11"), "2026-10-05"); // Sunday belongs to the week that started before it
  assert.equal(startOfWeek("2026-10-12"), "2026-10-12");
  assert.equal(startOfWeek("2027-01-01"), "2026-12-28"); // across a year
});

test("eachDate is inclusive at both ends", () => {
  assert.deepEqual(eachDate("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.deepEqual(eachDate("2026-10-06", "2026-10-06"), ["2026-10-06"]);
  assert.deepEqual(eachDate("2026-10-07", "2026-10-06"), []);
  assert.equal(eachDate("2026-01-01", "2026-12-31").length, 365);
});

test("athensDateTimeToUTC: summer is UTC+3, winter UTC+2", () => {
  assert.equal(athensDateTimeToUTC("2026-07-01", "12:00").toISOString(), "2026-07-01T09:00:00.000Z");
  assert.equal(athensDateTimeToUTC("2026-01-15", "12:00").toISOString(), "2026-01-15T10:00:00.000Z");
  // The clocks go back on Sunday 25 Oct 2026 (04:00 -> 03:00): afternoon is already winter time.
  assert.equal(athensDateTimeToUTC("2026-10-24", "18:00").toISOString(), "2026-10-24T15:00:00.000Z");
  assert.equal(athensDateTimeToUTC("2026-10-25", "18:00").toISOString(), "2026-10-25T16:00:00.000Z");
  // And forward on 29 March 2026.
  assert.equal(athensDateTimeToUTC("2026-03-28", "18:00").toISOString(), "2026-03-28T16:00:00.000Z");
  assert.equal(athensDateTimeToUTC("2026-03-29", "18:00").toISOString(), "2026-03-29T15:00:00.000Z");
});

test("formatDateLong names the Greek weekday and month", () => {
  const text = formatDateLong("2026-10-06");
  assert.match(text, /^Τρίτη, 6 Οκτωβρίου 2026$/);
  assert.match(formatDateLong("2026-10-04"), /^Κυριακή, 4 Οκτωβρίου 2026$/);
});
