import test from "node:test";
import assert from "node:assert/strict";
import { computeAvailableDates, computeAvailableSlots } from "@/lib/slots";
import { appointment, blocked, makeDb, regular, rule, service } from "./helpers";

// All dates are in the future of the fake clock below unless a test says otherwise.
const NOW = { date: "2026-10-01", minutes: 600 }; // Thu 1 Oct 2026, 10:00
const TUE = "2026-10-06";
const NEXT_TUE = "2026-10-13";
const MON = "2026-10-05";

const base = {
  services: [service()],
  settings: [{ id: true, buffer_minutes: 0 }],
  availability_rules: [rule(2, "10:00", "14:00")], // Tuesdays 10–14
  blocked_slots: [],
  appointments: [],
  recurring_customers: [],
};

async function slots(over: Record<string, unknown[]> = {}, date = TUE, options = {}) {
  const result = await computeAvailableSlots(makeDb({ ...base, ...over }), "svc", date, { now: NOW, ...options });
  assert.ok("slots" in result, JSON.stringify(result));
  return result.slots;
}

test("slots step by the service's duration from the start of the opening window", async () => {
  assert.deepEqual(await slots(), ["10:00", "10:40", "11:20", "12:00", "12:40", "13:20"]);
  assert.deepEqual(await slots({ services: [service({ duration_minutes: 30 })] }), ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30"]);
  assert.deepEqual(await slots({ services: [service({ duration_minutes: 60 })] }), ["10:00", "11:00", "12:00", "13:00"]);
});

test("the last slot must finish by closing time", async () => {
  const result = await slots({ services: [service({ duration_minutes: 90 })] });
  assert.deepEqual(result, ["10:00", "11:30"]); // 13:00 would end at 14:30, after closing
  assert.deepEqual(await slots({ services: [service({ duration_minutes: 300 })] }), []); // longer than the day
});

test("a booking removes its time and the rest carries on from where it ends", async () => {
  const result = await slots({ appointments: [appointment(TUE, "11:00", "11:40")] });
  assert.deepEqual(result, ["10:00", "11:40", "12:20", "13:00"]);
});

test("a booking for a different length service still packs the day correctly", async () => {
  const result = await slots({ appointments: [appointment(TUE, "10:00", "10:30")] });
  assert.deepEqual(result, ["10:30", "11:10", "11:50", "12:30", "13:10"]);
});

test("cancelled appointments don't hold a time; other days' appointments don't matter", async () => {
  assert.equal((await slots({ appointments: [appointment(TUE, "10:00", "10:40", { status: "cancelled" })] }))[0], "10:00");
  assert.equal((await slots({ appointments: [appointment(NEXT_TUE, "10:00", "10:40")] }))[0], "10:00");
});

test("the buffer between bookings is kept on both sides", async () => {
  const result = await slots({ settings: [{ id: true, buffer_minutes: 10 }], appointments: [appointment(TUE, "11:00", "11:40")] });
  // Busy 10:50–11:50: 10:00–10:40 fits; next free stretch starts at 11:50.
  assert.deepEqual(result, ["10:00", "11:50", "12:30", "13:10"]);
});

test("blocked time (vacation, emergency closure) removes slots; an all-day block removes them all", async () => {
  assert.deepEqual(await slots({ blocked_slots: [blocked(TUE, "12:00", "23:59")] }), ["10:00", "10:40", "11:20"]);
  assert.deepEqual(await slots({ blocked_slots: [blocked(TUE)] }), []);
  assert.equal((await slots({ blocked_slots: [blocked(NEXT_TUE)] })).length, 6); // another date
});

test("a closed weekday has no slots; a split shift offers both parts", async () => {
  assert.deepEqual(await slots({}, MON), []);
  const split = await slots({ availability_rules: [rule(2, "10:00", "12:00"), rule(2, "17:00", "19:00")] });
  assert.deepEqual(split, ["10:00", "10:40", "11:20", "17:00", "17:40", "18:20"]);
});

test("today: nothing at or before the current time", async () => {
  const result = await computeAvailableSlots(makeDb({ ...base, availability_rules: [rule(4, "10:00", "14:00")] }), "svc", NOW.date, {
    now: { date: NOW.date, minutes: 11 * 60 }, // 11:00
  });
  assert.ok("slots" in result);
  assert.deepEqual(result.slots, ["11:20", "12:00", "12:40", "13:20"]);
  const late = await computeAvailableSlots(makeDb({ ...base, availability_rules: [rule(4, "10:00", "14:00")] }), "svc", NOW.date, {
    now: { date: NOW.date, minutes: 15 * 60 },
  });
  assert.ok("slots" in late && late.slots.length === 0);
});

test("moving an appointment: its own slot counts as free, everyone else's doesn't", async () => {
  const mine = appointment(TUE, "11:00", "11:40", { id: "mine" });
  const other = appointment(TUE, "13:00", "13:40", { id: "other" });
  const without = await slots({ appointments: [mine, other] });
  assert.ok(!without.includes("11:00"));
  const excluded = await slots({ appointments: [mine, other] }, TUE, { excludeAppointmentId: "mine" });
  // Free 10:00–13:00 (its own 11:00 is released), then the other booking at 13:00.
  assert.deepEqual(excluded, ["10:00", "10:40", "11:20", "12:00"]);
  assert.ok(excluded.includes("11:20")); // overlaps its own old time, allowed
  assert.ok(!excluded.includes("13:00")); // the other booking still blocks
});

test("unknown or inactive service -> service_not_found", async () => {
  assert.deepEqual(await computeAvailableSlots(makeDb(base), "nope", TUE, { now: NOW }), { error: "service_not_found" });
  assert.deepEqual(await computeAvailableSlots(makeDb({ ...base, services: [service({ active: false })] }), "svc", TUE, { now: NOW }), {
    error: "service_not_found",
  });
});

test("a database error is never read as 'nothing booked' — the answer is 'unavailable'", async () => {
  for (const table of ["appointments", "blocked_slots", "availability_rules", "settings", "services"]) {
    const result = await computeAvailableSlots(makeDb(base, { errors: { [table]: "XX000" } }), "svc", TUE, { now: NOW });
    assert.deepEqual(result, { error: "unavailable" }, table);
  }
  // …except a regular-customers table that doesn't exist yet, which just means no regulars.
  const missing = await computeAvailableSlots(makeDb(base, { errors: { recurring_customers: "42P01" } }), "svc", TUE, { now: NOW });
  assert.ok("slots" in missing && missing.slots.length === 6);
  const broken = await computeAvailableSlots(makeDb(base, { errors: { recurring_customers: "XX000" } }), "svc", TUE, { now: NOW });
  assert.deepEqual(broken, { error: "unavailable" });
});

test("a fixed regular's time is never offered on their days, and only on those days", async () => {
  const fixed = regular({ start_time: "12:00:00" });
  // 12:00–12:40 taken; the rest of that stretch carries on from 12:40.
  assert.deepEqual(await slots({ recurring_customers: [fixed] }), ["10:00", "10:40", "11:20", "12:40", "13:20"]);
  assert.equal((await slots({ recurring_customers: [regular({ start_date: "2026-10-13", start_time: "12:00:00" })] }, TUE)).length, 6); // starts next week
  assert.deepEqual(await slots({ recurring_customers: [{ ...fixed, skipped_dates: [TUE] }] }), ["10:00", "10:40", "11:20", "12:00", "12:40", "13:20"]);
  const every2 = regular({ start_time: "12:00:00", interval_weeks: 2 });
  assert.equal((await slots({ recurring_customers: [every2] }, NEXT_TUE)).length, 6); // the off week
});

test("a zone regular: one opening in the zone is always kept free", async () => {
  const zoneRegular = regular({ start_time: "12:00:00", zone_end_time: "14:00:00", services: { duration_minutes: 40 } });
  // Zone 12:00–14:00 holds 3 slots of 40' (12:00, 12:40, 13:20). Nothing booked: all offered.
  assert.deepEqual(await slots({ recurring_customers: [zoneRegular] }), ["10:00", "10:40", "11:20", "12:00", "12:40", "13:20"]);
  // Two of the three taken -> the last one is held back.
  const two = await slots({ recurring_customers: [zoneRegular], appointments: [appointment(TUE, "12:00", "12:40"), appointment(TUE, "12:40", "13:20")] });
  assert.ok(!two.includes("13:20"));
  assert.ok(two.includes("10:00") && two.includes("11:20")); // outside the zone is unaffected
  // All three taken (e.g. by the admin earlier): the rule gives way instead of closing the whole day.
  const allThree = await slots({ recurring_customers: [zoneRegular], appointments: [appointment(TUE, "12:00", "12:40"), appointment(TUE, "12:40", "13:20"), appointment(TUE, "13:20", "14:00")] });
  assert.deepEqual(allThree, ["10:00", "10:40", "11:20"]);
});

test("two zone regulars keep two openings", async () => {
  const a = regular({ id: "a", start_time: "12:00:00", zone_end_time: "14:00:00" });
  const b = regular({ id: "b", start_time: "12:00:00", zone_end_time: "14:00:00" });
  const one = await slots({ recurring_customers: [a, b], appointments: [appointment(TUE, "12:00", "12:40")] });
  assert.ok(!one.includes("12:40") && !one.includes("13:20")); // 2 left, both held
});

test("available dates: closed, blocked, fully booked and out-of-hours days are left out", async () => {
  const db = makeDb({
    ...base,
    availability_rules: [rule(2, "10:00", "12:00"), rule(3, "10:00", "12:00")], // Tue + Wed
    blocked_slots: [blocked("2026-10-07")], // Wed 7th blocked
    appointments: [appointment("2026-10-06", "10:00", "10:40"), appointment("2026-10-06", "10:40", "11:20"), appointment("2026-10-06", "11:20", "12:00")], // Tue 6th full
  });
  const result = await computeAvailableDates(db, "svc", "2026-10-05", "2026-10-14", { now: NOW });
  assert.ok("dates" in result);
  assert.deepEqual(result.dates, ["2026-10-13", "2026-10-14"]); // only the following Tue + Wed are free
});

test("available dates agree with the slot list for every day in a range", async () => {
  const db = makeDb({
    ...base,
    availability_rules: [rule(2, "10:00", "14:00"), rule(4, "12:00", "16:00"), rule(6, "09:00", "13:00")],
    appointments: [appointment("2026-10-06", "10:00", "10:40"), appointment("2026-10-08", "12:00", "12:40")],
    recurring_customers: [regular({ start_time: "10:40:00" })],
  });
  const dates = await computeAvailableDates(db, "svc", "2026-10-01", "2026-10-31", { now: NOW });
  assert.ok("dates" in dates);
  for (let d = new Date("2026-10-01T12:00:00Z"); d <= new Date("2026-10-31T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    const list = await computeAvailableSlots(db, "svc", date, { now: NOW });
    assert.ok("slots" in list);
    assert.equal(dates.dates.includes(date), list.slots.length > 0, date);
  }
});

test("available dates: a database error is 'unavailable', not an empty calendar", async () => {
  const result = await computeAvailableDates(makeDb(base, { errors: { appointments: "XX000" } }), "svc", "2026-10-01", "2026-10-21", { now: NOW });
  assert.deepEqual(result, { error: "unavailable" });
});

test("a service id that isn't even a valid id is 'not found', not a server fault", async () => {
  const result = await computeAvailableSlots(makeDb(base, { errors: { services: "22P02" } }), "abc", TUE, { now: NOW });
  assert.deepEqual(result, { error: "service_not_found" });
});
