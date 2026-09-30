import test from "node:test";
import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import { buildICS } from "@/lib/ics";
import { buildXlsx } from "@/lib/xlsx";

test("calendar event: CRLF lines, UTC times, escaped text", () => {
  const ics = buildICS({
    uid: "abc",
    start: new Date("2026-10-14T09:00:00Z"),
    end: new Date("2026-10-14T09:40:00Z"),
    summary: "Κούρεμα – Zoubou",
    description: "Γραμμή 1\nΑλλαγή; ή, ακύρωση",
  });
  const lines = ics.split("\r\n");
  assert.equal(lines[0], "BEGIN:VCALENDAR");
  assert.equal(lines.at(-1), "END:VCALENDAR");
  assert.ok(lines.includes("DTSTART:20261014T090000Z"));
  assert.ok(lines.includes("DTEND:20261014T094000Z"));
  assert.ok(lines.includes("UID:abc@zoubou.gr"));
  assert.ok(lines.some((l) => l === "DESCRIPTION:Γραμμή 1\\nΑλλαγή\\; ή\\, ακύρωση"));
  assert.ok(!ics.includes("\n\n"));
});

// A tiny reader for the stored (uncompressed) ZIP that buildXlsx writes.
async function readZip(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const files = new Map<string, string>();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const expectedCrc = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const data = bytes.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
    assert.equal(crc32(data), expectedCrc, `CRC of ${name}`);
    files.set(name, new TextDecoder().decode(data));
    offset += 30 + nameLength + size;
  }
  // The central directory and the end record must follow.
  assert.equal(view.getUint32(offset, true), 0x02014b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 12, true), files.size);
  return files;
}

test("spreadsheet export is a valid workbook with every cell as text", async () => {
  const blob = buildXlsx("Ραντεβού", [
    ["Όνομα", "Τηλέφωνο"],
    ["Γιώργος <Υιοί> & Σία", "0069123"],
    ["Μαρία", ""],
  ]);
  assert.match(blob.type, /spreadsheetml\.sheet$/);
  const files = await readZip(blob);
  assert.deepEqual([...files.keys()].sort(), ["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/workbook.xml", "xl/worksheets/sheet1.xml"]);
  const sheet = files.get("xl/worksheets/sheet1.xml")!;
  assert.ok(sheet.includes("Γιώργος &lt;Υιοί&gt; &amp; Σία")); // escaped
  assert.ok(sheet.includes(">0069123<")); // leading zeros survive
  assert.ok(sheet.includes('r="B3"')); // addressing is right
  assert.ok(files.get("xl/workbook.xml")!.includes('name="Ραντεβού"'));
});
