import test from "node:test";
import assert from "node:assert/strict";
import { bookedMinutesForDate, occupancyPercent, subtractIntervals, workingMinutesForDate } from "@/lib/occupancy";

test("subtractIntervals: a cut in the middle splits, at the edge trims, outside leaves alone", () => {
  assert.deepEqual(subtractIntervals([{ start: 600, end: 1200 }], [{ start: 800, end: 900 }]), [
    { start: 600, end: 800 },
    { start: 900, end: 1200 },
  ]);
  assert.deepEqual(subtractIntervals([{ start: 600, end: 1200 }], [{ start: 500, end: 700 }]), [{ start: 700, end: 1200 }]);
  assert.deepEqual(subtractIntervals([{ start: 600, end: 1200 }], [{ start: 1100, end: 1300 }]), [{ start: 600, end: 1100 }]);
  assert.deepEqual(subtractIntervals([{ start: 600, end: 1200 }], [{ start: 0, end: 500 }]), [{ start: 600, end: 1200 }]);
  assert.deepEqual(subtractIntervals([{ start: 600, end: 1200 }], [{ start: 0, end: 1440 }]), []);
  assert.deepEqual(subtractIntervals([{ start: 600, end: 1200 }], []), [{ start: 600, end: 1200 }]);
});

test("subtractIntervals: several cuts, unsorted and overlapping", () => {
  const free = subtractIntervals(
    [{ start: 600, end: 1200 }],
    [{ start: 900, end: 950 }, { start: 700, end: 760 }, { start: 740, end: 800 }]
  );
  assert.deepEqual(free, [
    { start: 600, end: 700 },
    { start: 800, end: 900 },
    { start: 950, end: 1200 },
  ]);
});

const rules = [
  { weekday: 2, start_time: "10:00:00", end_time: "20:00:00" },
  { weekday: 6, start_time: "09:00:00", end_time: "13:00:00" },
  { weekday: 6, start_time: "17:00:00", end_time: "21:00:00" },
];

test("working minutes: weekly hours minus that day's blocked time", () => {
  assert.equal(workingMinutesForDate(rules, [], "2026-10-06"), 600); // Tuesday
  assert.equal(workingMinutesForDate(rules, [], "2026-10-10"), 480); // Saturday, split shift 4h + 4h
  assert.equal(workingMinutesForDate(rules, [], "2026-10-05"), 0); // Monday closed
  const blocked = [{ date: "2026-10-06", start_time: "12:00:00", end_time: "14:00:00" }];
  assert.equal(workingMinutesForDate(rules, blocked, "2026-10-06"), 480);
  assert.equal(workingMinutesForDate(rules, blocked, "2026-10-13"), 600); // blocked slot is for one date only
  const allDay = [{ date: "2026-10-06", start_time: "00:00:00", end_time: "23:59:00" }];
  assert.equal(workingMinutesForDate(rules, allDay, "2026-10-06"), 0);
});

test("booked minutes add up the appointments of that date only", () => {
  const spans = [
    { date: "2026-10-06", start_time: "10:00:00", end_time: "10:40:00" },
    { date: "2026-10-06", start_time: "11:00:00", end_time: "12:00:00" },
    { date: "2026-10-07", start_time: "10:00:00", end_time: "10:40:00" },
  ];
  assert.equal(bookedMinutesForDate(spans, "2026-10-06"), 100);
  assert.equal(bookedMinutesForDate(spans, "2026-10-08"), 0);
});

test("occupancy percent: rounds, caps at 100, and is 0 when closed", () => {
  assert.equal(occupancyPercent(60, 600), 10);
  assert.equal(occupancyPercent(100, 600), 17); // 16.67 -> 17
  assert.equal(occupancyPercent(600, 600), 100);
  assert.equal(occupancyPercent(700, 600), 100);
  assert.equal(occupancyPercent(0, 600), 0);
  assert.equal(occupancyPercent(60, 0), 0);
});
