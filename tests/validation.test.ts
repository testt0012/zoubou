import test from "node:test";
import assert from "node:assert/strict";
import { isValidDateString, isValidTimeString, normalizeGreekMobile, sanitizeName } from "@/lib/validation";

test("Greek mobile numbers are normalised to 69XXXXXXXX", () => {
  for (const input of ["6912345678", "69 1234 5678", "691-234-5678", "+306912345678", "0030 691 234 5678", "306912345678", " 6912345678 "]) {
    assert.equal(normalizeGreekMobile(input), "6912345678", input);
  }
});

test("anything that isn't a Greek mobile is refused", () => {
  for (const input of ["", "2101234567", "691234567", "69123456789", "7012345678", "abcdefghij", "+316912345678", "6912 34567x", "+30 210 123 4567"]) {
    assert.equal(normalizeGreekMobile(input), null, input);
  }
});

test("names: letters, spaces, hyphen and apostrophe are kept; junk is refused", () => {
  assert.equal(sanitizeName("  Γιάννης  "), "Γιάννης");
  assert.equal(sanitizeName("Μαρία   Ελένη"), "Μαρία Ελένη");
  assert.equal(sanitizeName("Jean-Luc"), "Jean-Luc");
  assert.equal(sanitizeName("O'Brien"), "O'Brien");
  assert.equal(sanitizeName("Ιωάννου"), "Ιωάννου");
  for (const bad of ["", "   ", "Γιάννης1", "<script>", "a@b.gr", "Γιάννης;DROP", "x".repeat(61)]) {
    assert.equal(sanitizeName(bad), null, JSON.stringify(bad));
  }
  assert.equal(sanitizeName("x".repeat(60)), "x".repeat(60));
});

test("date and time strings must have the exact shape", () => {
  assert.ok(isValidDateString("2026-10-06"));
  assert.ok(!isValidDateString("2026-1-6"));
  assert.ok(!isValidDateString("06/10/2026"));
  assert.ok(!isValidDateString(20261006));
  assert.ok(!isValidDateString(null));
  assert.ok(isValidTimeString("09:40"));
  assert.ok(!isValidTimeString("9:40"));
  assert.ok(!isValidTimeString("09:40:00"));
  assert.ok(!isValidTimeString(undefined));
});

test("dates must be real calendar days; times real clock times", () => {
  for (const bad of ["2026-02-30", "2026-02-29", "2026-13-01", "2026-00-10", "2026-10-00", "2026-10-32", "9999-99-99", "2026-04-31"]) {
    assert.ok(!isValidDateString(bad), bad);
  }
  for (const good of ["2026-02-28", "2028-02-29", "2026-12-31", "2026-01-01"]) assert.ok(isValidDateString(good), good);
  for (const bad of ["24:00", "99:99", "12:60", "7:30", "-1:00"]) assert.ok(!isValidTimeString(bad), bad);
  for (const good of ["00:00", "09:40", "23:59"]) assert.ok(isValidTimeString(good), good);
});
