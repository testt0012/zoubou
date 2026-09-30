import test from "node:test";
import assert from "node:assert/strict";
import {
  fixedIntervalsFor,
  isDueDate,
  leavesRoomFor,
  occursOn,
  placeReservations,
  recurringEntriesForDate,
  recurringMinutesForDate,
  regularsAffectedByClosure,
  toRecurringVisit,
  zoneReservationsFor,
} from "@/lib/recurring";

// First visit Tuesday 6 Oct 2026.
const weekly = { startDate: "2026-10-06", intervalWeeks: 1 };
const biweekly = { startDate: "2026-10-06", intervalWeeks: 2 };
const threeWeekly = { startDate: "2026-10-06", intervalWeeks: 3 };

test("every week: the same weekday from the first visit on", () => {
  assert.ok(occursOn(weekly, "2026-10-06"));
  assert.ok(occursOn(weekly, "2026-10-13"));
  assert.ok(occursOn(weekly, "2027-01-05"));
  assert.ok(!occursOn(weekly, "2026-09-29")); // before the first visit
  assert.ok(!occursOn(weekly, "2026-10-07")); // wrong weekday
});

test("every 2 and every 3 weeks keep their rhythm (also across a year and a clock change)", () => {
  assert.deepEqual(["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27", "2026-11-03"].map((d) => occursOn(biweekly, d)), [true, false, true, false, true]);
  assert.deepEqual(["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27", "2026-11-03"].map((d) => occursOn(threeWeekly, d)), [true, false, false, true, false]);
  assert.ok(occursOn(biweekly, "2026-10-20")); // the week of the clock change (25 Oct) is not a special case
  assert.ok(occursOn(biweekly, "2026-12-29")); // 12 weeks later
  assert.ok(occursOn(biweekly, "2027-01-12"));
  assert.ok(!occursOn(biweekly, "2027-01-05"));
});

test("a skipped date is not an occurrence, but stays a due date and the rest are unaffected", () => {
  const visit = { ...biweekly, skippedDates: ["2026-10-20"] };
  assert.ok(!occursOn(visit, "2026-10-20"));
  assert.ok(isDueDate(visit, "2026-10-20"));
  assert.ok(occursOn(visit, "2026-11-03"));
  assert.ok(occursOn(visit, "2026-10-06"));
});

const fixed = (over = {}) => ({ id: "f", startDate: "2026-10-06", intervalWeeks: 1, skippedDates: [], start: 780, zoneEnd: null, duration: 40, ...over });
const zone = (over = {}) => ({ id: "z", startDate: "2026-10-06", intervalWeeks: 1, skippedDates: [], start: 780, zoneEnd: 960, duration: 60, ...over });

test("a fixed regular takes exactly its time on its days", () => {
  assert.deepEqual(fixedIntervalsFor([fixed()], "2026-10-13"), [{ start: 780, end: 820 }]);
  assert.deepEqual(fixedIntervalsFor([fixed()], "2026-10-14"), []);
  assert.deepEqual(fixedIntervalsFor([fixed({ skippedDates: ["2026-10-13"] })], "2026-10-13"), []);
  assert.deepEqual(fixedIntervalsFor([zone()], "2026-10-13"), []); // zones are not fixed
});

test("zone reservations are listed only on the days the customer comes", () => {
  assert.deepEqual(zoneReservationsFor([zone()], "2026-10-13"), [{ start: 780, end: 960, duration: 60 }]);
  assert.deepEqual(zoneReservationsFor([zone({ intervalWeeks: 2 })], "2026-10-13"), []);
});

test("placeReservations seats each zone in free time, and leaves out one that has no room", () => {
  const free = [{ start: 780, end: 960 }];
  assert.equal(placeReservations(free, [{ start: 780, end: 960, duration: 60 }]).length, 1);
  assert.equal(placeReservations(free, [{ start: 780, end: 960, duration: 60 }, { start: 780, end: 960, duration: 60 }]).length, 2);
  assert.equal(placeReservations(free, [{ start: 780, end: 960, duration: 200 }]).length, 0); // longer than the zone
  assert.equal(placeReservations([{ start: 780, end: 800 }], [{ start: 780, end: 960, duration: 60 }]).length, 0);
  assert.equal(placeReservations(free, [{ start: 0, end: 700, duration: 60 }]).length, 0); // zone outside free time
});

test("leavesRoomFor: the last opening in a zone can't be taken, earlier ones can", () => {
  const zones = [{ start: 780, end: 960, duration: 60 }]; // 13:00–16:00
  assert.ok(leavesRoomFor([{ start: 780, end: 960 }], { start: 780, end: 840 }, zones)); // 3 openings -> 2 left
  assert.ok(leavesRoomFor([{ start: 840, end: 960 }], { start: 840, end: 900 }, zones)); // 2 openings -> 1 left
  assert.ok(!leavesRoomFor([{ start: 900, end: 960 }], { start: 900, end: 960 }, zones)); // the last one
  assert.ok(leavesRoomFor([{ start: 900, end: 960 }], { start: 900, end: 960 }, [])); // no zone, no rule
});

const rules = [{ weekday: 2, start_time: "10:00:00", end_time: "20:00:00" }];

test("day view: a fixed regular shows at its time; a zone shows as a range until one opening is left", () => {
  const visits = [fixed({ start: 600 }), zone()];
  const morning = recurringEntriesForDate(visits, rules, [], [], "2026-10-13");
  assert.equal(morning.length, 2);
  assert.deepEqual(morning.map((e) => ({ id: e.id, exactStart: e.exactStart, fits: e.fits })), [
    { id: "f", exactStart: null, fits: true },
    { id: "z", exactStart: null, fits: true },
  ]);

  // Book 13:00 and 14:00 -> only 15:00 is left in the zone.
  const booked = [
    { date: "2026-10-13", start_time: "13:00:00", end_time: "14:00:00" },
    { date: "2026-10-13", start_time: "14:00:00", end_time: "15:00:00" },
  ];
  const narrowed = recurringEntriesForDate([zone()], rules, [], booked, "2026-10-13");
  assert.equal(narrowed[0].exactStart, 900);
  assert.ok(narrowed[0].fits);

  // Book the whole zone -> it no longer fits.
  const full = [...booked, { date: "2026-10-13", start_time: "15:00:00", end_time: "16:00:00" }];
  assert.ok(!recurringEntriesForDate([zone()], rules, [], full, "2026-10-13")[0].fits);
});

test("a fixed regular outside the open hours, or over a blocked day, does not fit", () => {
  assert.ok(!recurringEntriesForDate([fixed({ start: 1260 })], rules, [], [], "2026-10-13")[0].fits); // 21:00, closed
  const closed = [{ date: "2026-10-13", start_time: "00:00:00", end_time: "23:59:00" }];
  assert.ok(!recurringEntriesForDate([fixed()], rules, closed, [], "2026-10-13")[0].fits);
});

test("occupancy: regulars count with their service length, and only when they fit", () => {
  assert.equal(recurringMinutesForDate([fixed(), zone()], rules, [], [], "2026-10-13"), 40 + 60);
  assert.equal(recurringMinutesForDate([fixed()], rules, [], [], "2026-10-14"), 0); // not their day
  const closed = [{ date: "2026-10-13", start_time: "00:00:00", end_time: "23:59:00" }];
  assert.equal(recurringMinutesForDate([fixed()], rules, closed, [], "2026-10-13"), 0);
});

test("a closure affects a regular only if it takes away their place", () => {
  const visits = [fixed({ start: 780 })]; // 13:00–13:40
  const hit = regularsAffectedByClosure(visits, rules, [], [], ["2026-10-13"], "12:00", "14:00");
  assert.equal(hit.length, 1);
  assert.equal(hit[0].date, "2026-10-13");
  assert.equal(regularsAffectedByClosure(visits, rules, [], [], ["2026-10-13"], "15:00", "23:59").length, 0); // closes after them
  assert.equal(regularsAffectedByClosure(visits, rules, [], [], ["2026-10-14"], "00:00", "23:59").length, 0); // not their day
  // A zone with room left before the closure isn't affected; with none left it is.
  const z = [zone()];
  assert.equal(regularsAffectedByClosure(z, rules, [], [], ["2026-10-13"], "15:00", "23:59").length, 0);
  assert.equal(regularsAffectedByClosure(z, rules, [], [], ["2026-10-13"], "00:00", "23:59").length, 1);
});

test("toRecurringVisit converts a database row", () => {
  const visit = toRecurringVisit(
    { id: "r", start_date: "2026-10-06", interval_weeks: 2, start_time: "13:00:00", zone_end_time: "16:00:00", skipped_dates: ["2026-10-20"] },
    40
  );
  assert.deepEqual(visit, { id: "r", startDate: "2026-10-06", intervalWeeks: 2, skippedDates: ["2026-10-20"], start: 780, zoneEnd: 960, duration: 40 });
  assert.equal(toRecurringVisit({ id: "r", start_date: "2026-10-06", interval_weeks: 1, start_time: "13:00:00", zone_end_time: null }, 40).skippedDates.length, 0);
});
