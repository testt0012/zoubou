import test from "node:test";
import assert from "node:assert/strict";
import { snapshotMissingDays } from "@/lib/stats";
import { appointment, blocked, makeDb, regular, rule } from "./helpers";

const rules = [rule(2, "10:00", "20:00"), rule(3, "10:00", "20:00")]; // Tue + Wed, 10 h each

function db(over: Record<string, unknown[]> = {}) {
  return makeDb({ availability_rules: rules, blocked_slots: [], appointments: [], recurring_customers: [], daily_stats: [], ...over });
}

test("first run starts at the earliest appointment and freezes every finished day up to yesterday", async () => {
  const fake = db({
    appointments: [
      appointment("2026-09-15", "10:00", "10:40"), // Tue
      appointment("2026-09-15", "11:00", "12:00"),
      appointment("2026-09-16", "10:00", "10:40", { status: "cancelled" }), // Wed, cancelled: doesn't count
    ],
  });
  const result = await snapshotMissingDays(fake, "2026-09-18");
  assert.deepEqual(result, { saved: 3, from: "2026-09-15", to: "2026-09-17" }); // today (18th) is not finished
  assert.deepEqual(
    fake.saved.map((r: { date: string; working_minutes: number; booked_minutes: number }) => [r.date, r.working_minutes, r.booked_minutes]),
    [
      ["2026-09-15", 600, 100],
      ["2026-09-16", 600, 0],
      ["2026-09-17", 0, 0], // Thursday: closed
    ]
  );
});

test("regular customers' visits are frozen as booked time too", async () => {
  const fake = db({
    appointments: [appointment("2026-09-15", "10:00", "10:40")],
    recurring_customers: [regular({ start_date: "2026-09-15", start_time: "15:00:00", services: { duration_minutes: 40 } })],
  });
  await snapshotMissingDays(fake, "2026-09-17");
  const tuesday = fake.saved.find((r: { date: string }) => r.date === "2026-09-15");
  assert.equal(tuesday.booked_minutes, 80); // 40 booked + 40 regular
});

test("blocked time shortens the open hours that are frozen", async () => {
  const fake = db({ appointments: [appointment("2026-09-15", "10:00", "10:40")], blocked_slots: [blocked("2026-09-15", "14:00", "18:00")] });
  await snapshotMissingDays(fake, "2026-09-17");
  assert.equal(fake.saved.find((r: { date: string }) => r.date === "2026-09-15").working_minutes, 360);
});

test("a day can't be 'open' for less time than was booked on it", async () => {
  // Monday is closed in the hours on file, yet an appointment exists (hours were different then).
  const fake = db({ appointments: [appointment("2026-09-14", "10:00", "11:00")] });
  await snapshotMissingDays(fake, "2026-09-16");
  const monday = fake.saved.find((r: { date: string }) => r.date === "2026-09-14");
  assert.deepEqual([monday.working_minutes, monday.booked_minutes], [60, 60]);
});

test("later runs only add the days after the last saved one", async () => {
  const fake = db({ appointments: [appointment("2026-09-15", "10:00", "10:40")], daily_stats: [{ date: "2026-09-16" }] });
  const result = await snapshotMissingDays(fake, "2026-09-19");
  assert.deepEqual(result, { saved: 2, from: "2026-09-17", to: "2026-09-18" });
});

test("nothing to do when already up to date, or when there has never been an appointment", async () => {
  assert.deepEqual(await snapshotMissingDays(db({ daily_stats: [{ date: "2026-09-17" }] }), "2026-09-18"), { saved: 0, from: null, to: null });
  assert.deepEqual(await snapshotMissingDays(db(), "2026-09-18"), { saved: 0, from: null, to: null });
});

test("a long gap is worked off in chunks of 120 days", async () => {
  const fake = db({ appointments: [appointment("2026-01-05", "10:00", "10:40")] });
  const result = await snapshotMissingDays(fake, "2026-12-31");
  assert.equal(result.saved, 120);
  assert.equal(result.from, "2026-01-05");
  assert.equal(result.to, "2026-05-04");
});

test("unreadable data stops the run instead of saving guesses", async () => {
  const fake = makeDb({ availability_rules: rules, blocked_slots: [], appointments: [appointment("2026-09-15", "10:00", "10:40")], recurring_customers: [], daily_stats: [] }, { errors: { recurring_customers: "XX000" } });
  await assert.rejects(() => snapshotMissingDays(fake, "2026-09-18"));
  assert.equal(fake.saved.length, 0);
});

test("if the opening hours can't be read, nothing is saved (a frozen day is never recomputed)", async () => {
  const fake = makeDb(
    { availability_rules: rules, blocked_slots: [], appointments: [appointment("2026-09-15", "10:00", "10:40")], recurring_customers: [], daily_stats: [] },
    { errors: { availability_rules: "XX000" } }
  );
  await assert.rejects(() => snapshotMissingDays(fake, "2026-09-18"));
  assert.equal(fake.saved.length, 0);
});
