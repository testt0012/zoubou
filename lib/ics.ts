function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toICSDateUTC(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeICSText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

interface ICSEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
}

export function buildICS(event: ICSEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zoubou//Booking//EL",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.uid}@zoubou.gr`,
    `DTSTAMP:${toICSDateUTC(new Date())}`,
    `DTSTART:${toICSDateUTC(event.start)}`,
    `DTEND:${toICSDateUTC(event.end)}`,
    `SUMMARY:${escapeICSText(event.summary)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}
