import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { describeError, logErrorWith, resetAlertThrottle } from "@/lib/errorLogCore";
import { makeDb } from "./helpers";

beforeEach(() => resetAlertThrottle());

const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);
const minutes = (n: number) => n * 60 * 1000;

function setup(options = {}, seed: Record<string, unknown[]> = {}) {
  const db = makeDb({ error_log: [], ...seed }, options);
  const alerts: { title: string; message: string }[] = [];
  const send = async (title: string, message: string) => {
    alerts.push({ title, message });
  };
  return { db, alerts, deps: (at = T0) => ({ db, send, now: () => at }) };
}

test("what gets stored never includes phone numbers, emails or database row contents", () => {
  assert.equal(describeError(new Error("boom")).message, "boom");
  assert.deepEqual(describeError({ message: "insert failed", code: "23502" }), { message: "insert failed", code: "23502" });
  assert.equal(describeError("plain text").message, "plain text");
  assert.equal(describeError(null).message, "unknown error");
  assert.equal(describeError(new Error("call 6912345678 or +306912345678")).message, "call [phone] or [phone]");
  assert.equal(describeError(new Error("mail a.b@example.com failed")).message, "mail [email] failed");
  assert.equal(
    describeError({ message: 'null value violates not-null. Failing row contains (1, Γιάννης, Παπαδόπουλος, 6912345678)' }).message,
    "null value violates not-null. Failing row contains [removed]"
  );
  assert.equal(describeError(new Error("x".repeat(900))).message.length, 500);
});

test("a first failure is written to the log and alerts once", async () => {
  const { db, alerts, deps } = setup();
  await logErrorWith(deps(), "api/book", { message: "insert failed", code: "XX000" });
  assert.equal(db.tables.error_log.length, 1);
  assert.deepEqual(
    { source: db.tables.error_log[0].source, message: db.tables.error_log[0].message, detail: db.tables.error_log[0].detail },
    { source: "api/book", message: "insert failed", detail: { code: "XX000" } }
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].title, "Zoubou error: api/book");
  assert.equal(alerts[0].message, "insert failed");
});

test("the same failure repeating within 10 minutes is counted, not re-logged or re-alerted", async () => {
  const { db, alerts, deps } = setup();
  await logErrorWith(deps(T0), "api/book", "same problem");
  await logErrorWith(deps(T0 + minutes(3)), "api/book", "same problem");
  await logErrorWith(deps(T0 + minutes(9)), "api/book", "same problem");
  assert.equal(db.tables.error_log.length, 1);
  assert.equal(db.tables.error_log[0].count, 3);
  assert.equal(alerts.length, 1);
});

test("after 10 minutes the same failure is a new entry; alerts are still at most one per half hour per source", async () => {
  const { db, alerts, deps } = setup();
  await logErrorWith(deps(T0), "api/book", "same problem");
  await logErrorWith(deps(T0 + minutes(11)), "api/book", "same problem");
  assert.equal(db.tables.error_log.length, 2);
  assert.equal(alerts.length, 1); // 11 minutes later: still inside the alert quiet period
  await logErrorWith(deps(T0 + minutes(31)), "api/book", "same problem");
  assert.equal(alerts.length, 2); // a new half hour
});

test("a different source alerts independently", async () => {
  const { alerts, deps } = setup();
  await logErrorWith(deps(), "api/book", "a");
  await logErrorWith(deps(), "cron/daily-stats", "b");
  assert.deepEqual(alerts.map((a) => a.title), ["Zoubou error: api/book", "Zoubou error: cron/daily-stats"]);
});

test("if the database is the thing that broke, the alert still goes out (once)", async () => {
  const { alerts, deps } = setup({ errors: { error_log: "XX000" } });
  await logErrorWith(deps(T0), "api/slots", "database down");
  await logErrorWith(deps(T0 + minutes(1)), "api/slots", "database down");
  assert.equal(alerts.length, 1);
});

test("a failed log write still alerts", async () => {
  const { alerts, deps } = setup({ insertErrors: { error_log: "42P01" } });
  await logErrorWith(deps(), "api/book", "x");
  assert.equal(alerts.length, 1);
});

test("logging never throws, even if the alert itself fails", async () => {
  const db = makeDb({ error_log: [] });
  await assert.doesNotReject(() =>
    logErrorWith({ db, send: async () => { throw new Error("network down"); }, now: () => T0 }, "api/book", "x")
  );
});
