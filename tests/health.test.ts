import test from "node:test";
import assert from "node:assert/strict";
import { checkHealth } from "@/lib/health";
import { makeDb } from "./helpers";

const TODAY = "2026-10-10";
const appt = (date: string, over: Record<string, unknown> = {}) => ({
  id: `${date}-${JSON.stringify(over)}`,
  date,
  start_time: "10:00:00",
  end_time: "10:40:00",
  status: "confirmed",
  first_name: null,
  ...over,
});

test("a quiet, healthy system reports nothing", async () => {
  assert.deepEqual(await checkHealth(makeDb({ appointments: [], daily_stats: [] }), TODAY), []);
});

test("old appointments that still carry a name mean the wipe job has stopped", async () => {
  const issues = await checkHealth(
    makeDb({ appointments: [appt("2026-10-05", { first_name: "Γιάννης" })], daily_stats: [{ date: "2026-10-09" }] }),
    TODAY
  );
  assert.equal(issues.length, 1);
  assert.match(issues[0], /wipe of personal details/);
});

test("recent appointments with names are normal (the wipe runs twice a day)", async () => {
  for (const date of ["2026-10-10", "2026-10-09", "2026-10-08"]) {
    const issues = await checkHealth(makeDb({ appointments: [appt(date, { first_name: "Γιάννης" })], daily_stats: [{ date: "2026-10-09" }] }), TODAY);
    assert.deepEqual(issues, [], date);
  }
});

test("old appointments that were wiped are healthy", async () => {
  assert.deepEqual(await checkHealth(makeDb({ appointments: [appt("2026-09-20")], daily_stats: [{ date: "2026-10-09" }] }), TODAY), []);
});

test("the nightly snapshot must have covered yesterday", async () => {
  const finished = [appt("2026-10-01")];
  assert.deepEqual(await checkHealth(makeDb({ appointments: finished, daily_stats: [{ date: "2026-10-09" }] }), TODAY), []);
  const stale = await checkHealth(makeDb({ appointments: finished, daily_stats: [{ date: "2026-10-07" }] }), TODAY);
  assert.equal(stale.length, 1);
  assert.match(stale[0], /nightly report snapshot/);
  const never = await checkHealth(makeDb({ appointments: finished, daily_stats: [] }), TODAY);
  assert.match(never[0], /nightly report snapshot/);
});

test("no snapshot is expected while there is nothing finished to freeze", async () => {
  assert.deepEqual(await checkHealth(makeDb({ appointments: [appt("2026-10-20")], daily_stats: [] }), TODAY), []);
});

test("a check that can't read the tables doesn't raise a false alarm", async () => {
  const fake = makeDb({ appointments: [appt("2026-10-01", { first_name: "x" })], daily_stats: [] }, { errors: { appointments: "XX000", daily_stats: "XX000" } });
  assert.deepEqual(await checkHealth(fake, TODAY), []);
});
