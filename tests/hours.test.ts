import test from "node:test";
import assert from "node:assert/strict";
import { isValidRange, mergeRanges, rangesOverlap } from "@/lib/hours";

test("a range needs its end after its start", () => {
  assert.ok(isValidRange({ start: "09:00", end: "17:00" }));
  assert.ok(!isValidRange({ start: "17:00", end: "09:00" }));
  assert.ok(!isValidRange({ start: "09:00", end: "09:00" }));
});

test("rangesOverlap: touching is fine, sharing time is not", () => {
  assert.ok(!rangesOverlap([{ start: "09:00", end: "13:00" }, { start: "13:00", end: "17:00" }]));
  assert.ok(!rangesOverlap([{ start: "09:00", end: "13:00" }, { start: "15:00", end: "17:00" }]));
  assert.ok(rangesOverlap([{ start: "09:00", end: "13:01" }, { start: "13:00", end: "17:00" }]));
  assert.ok(rangesOverlap([{ start: "09:00", end: "23:00" }, { start: "09:00", end: "17:00" }]));
  assert.ok(!rangesOverlap([]));
});

test("mergeRanges sorts, and fuses overlapping or touching ranges", () => {
  assert.deepEqual(mergeRanges([{ start: "09:00", end: "17:00" }, { start: "09:00", end: "23:00" }]), [{ start: "09:00", end: "23:00" }]);
  assert.deepEqual(mergeRanges([{ start: "15:00", end: "20:00" }, { start: "09:00", end: "13:00" }]), [
    { start: "09:00", end: "13:00" },
    { start: "15:00", end: "20:00" },
  ]);
  assert.deepEqual(mergeRanges([{ start: "09:00", end: "13:00" }, { start: "13:00", end: "17:00" }]), [{ start: "09:00", end: "17:00" }]);
  assert.deepEqual(mergeRanges([{ start: "09:00", end: "20:00" }, { start: "10:00", end: "12:00" }]), [{ start: "09:00", end: "20:00" }]);
  assert.deepEqual(mergeRanges([]), []);
});

test("mergeRanges does not modify its input", () => {
  const input = [{ start: "09:00", end: "13:00" }, { start: "12:00", end: "17:00" }];
  const copy = JSON.parse(JSON.stringify(input));
  mergeRanges(input);
  assert.deepEqual(input, copy);
});
