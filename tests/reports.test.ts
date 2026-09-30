import test from "node:test";
import assert from "node:assert/strict";
import { addMonths, classifyDays, dayTotals, previousMonthRange, previousWeekRange } from "@/lib/reports";

test("previous week is Monday to Sunday of the week before, whatever today is", () => {
  // Wed 30 Sep 2026: this week began Mon 28 Sep, the previous one was 21–27 Sep.
  assert.deepEqual(previousWeekRange("2026-09-30"), { from: "2026-09-21", to: "2026-09-27" });
  assert.deepEqual(previousWeekRange("2026-09-28"), { from: "2026-09-21", to: "2026-09-27" }); // Monday
  assert.deepEqual(previousWeekRange("2026-10-04"), { from: "2026-09-21", to: "2026-09-27" }); // Sunday
  assert.deepEqual(previousWeekRange("2026-10-05"), { from: "2026-09-28", to: "2026-10-04" }); // next Monday moves on
  assert.deepEqual(previousWeekRange("2027-01-03"), { from: "2026-12-21", to: "2026-12-27" }); // across a year
});

test("previous month is the whole calendar month, 1st to last day", () => {
  assert.deepEqual(previousMonthRange("2026-09-30"), { from: "2026-08-01", to: "2026-08-31" });
  assert.deepEqual(previousMonthRange("2026-10-01"), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(previousMonthRange("2026-10-31"), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(previousMonthRange("2027-01-15"), { from: "2026-12-01", to: "2026-12-31" }); // year rollover
  assert.deepEqual(previousMonthRange("2027-03-10"), { from: "2027-02-01", to: "2027-02-28" });
  assert.deepEqual(previousMonthRange("2028-03-10"), { from: "2028-02-01", to: "2028-02-29" }); // leap year
});

test("addMonths keeps the day, or the last day of a shorter month", () => {
  assert.equal(addMonths("2026-09-30", -6), "2026-03-30");
  assert.equal(addMonths("2026-08-31", -6), "2026-02-28");
  assert.equal(addMonths("2028-08-31", -6), "2028-02-29");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-03-15", -3), "2025-12-15");
  assert.equal(addMonths("2026-10-01", 0), "2026-10-01");
});

test("a day's open time is never less than what was booked on it", () => {
  assert.deepEqual(dayTotals(600, 120), { working: 600, booked: 120 });
  assert.deepEqual(dayTotals(0, 60), { working: 60, booked: 60 }); // booked on a day now marked closed
  assert.deepEqual(dayTotals(0, 0), { working: 0, booked: 0 });
});

test("classifyDays: frozen, skipped (older than any record) and live", () => {
  const frozen = new Map([
    ["2026-09-14", { working: 600, booked: 60 }],
    ["2026-09-15", { working: 600, booked: 120 }],
  ]);
  const dates = ["2026-09-10", "2026-09-14", "2026-09-15", "2026-09-16", "2026-10-01", "2026-10-02"];
  const result = classifyDays(dates, "2026-10-01", frozen, "2026-09-14");
  assert.deepEqual(result.skipped, ["2026-09-10"]); // before the first record: no data
  assert.deepEqual(result.frozen.map((f) => f.date), ["2026-09-14", "2026-09-15"]);
  assert.deepEqual(result.live, ["2026-09-16", "2026-10-01", "2026-10-02"]); // unsaved past day + today + future
});

test("classifyDays: with nothing frozen yet, every day is computed live", () => {
  const dates = ["2026-09-10", "2026-09-30", "2026-10-02"];
  assert.deepEqual(classifyDays(dates, "2026-10-01", new Map(), null).live, dates);
  assert.deepEqual(classifyDays(dates, "2026-10-01", null, null).live, dates); // table unreadable
});

test("classifyDays never reads today or later from the frozen totals", () => {
  const frozen = new Map([["2026-10-01", { working: 1, booked: 1 }]]);
  const result = classifyDays(["2026-10-01"], "2026-10-01", frozen, "2026-09-01");
  assert.deepEqual(result.frozen, []);
  assert.deepEqual(result.live, ["2026-10-01"]);
});
