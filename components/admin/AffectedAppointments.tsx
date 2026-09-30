"use client";

import { buildXlsx } from "@/lib/xlsx";
import type { RecurringDayEntry } from "@/lib/recurring";
import { ATHENS_TZ, formatDateLong, minutesToTime } from "@/lib/time";
import type { AppointmentWithService, RecurringCustomer } from "@/types/database";

// One customer who has to be told about a closure — a booked appointment,
// or a regular customer's standing visit.
export interface AffectedPerson {
  key: string;
  firstName: string;
  lastName: string;
  mobile: string | null;
  date: string; // "YYYY-MM-DD"
  time: string; // "14:00–14:40", or "ζώνη 15:00–19:40" for a zone regular
  serviceName: string;
  // How they came to be in the book: "Έκλεισε στις …" / "Μόνιμος πελάτης".
  note: string;
}

// When the customer made the booking (created_at), in Athens time.
function formatBookedAt(createdAt: string): string {
  return new Intl.DateTimeFormat("el-GR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ATHENS_TZ,
  }).format(new Date(createdAt));
}

export function appointmentToAffected(a: AppointmentWithService): AffectedPerson {
  return {
    key: a.id,
    firstName: a.first_name ?? "",
    lastName: a.last_name ?? "",
    mobile: a.mobile,
    date: a.date,
    time: `${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`,
    serviceName: a.services?.name ?? "",
    note: `Έκλεισε στις ${formatBookedAt(a.created_at)}`,
  };
}

export function regularToAffected(
  customer: RecurringCustomer,
  entry: RecurringDayEntry,
  date: string,
  serviceName: string
): AffectedPerson {
  const range = `${minutesToTime(entry.start)}–${minutesToTime(entry.end)}`;
  return {
    key: `${customer.id}-${date}`,
    firstName: customer.first_name,
    lastName: customer.last_name,
    mobile: customer.mobile,
    date,
    time: entry.isZone ? `ζώνη ${range}` : range,
    serviceName,
    note: "Μόνιμος πελάτης",
  };
}

export function sortAffected(people: AffectedPerson[]): AffectedPerson[] {
  return [...people].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function toRows(people: AffectedPerson[]): string[][] {
  return [
    ["Ημερομηνία", "Ώρα", "Όνομα", "Επώνυμο", "Τηλέφωνο", "Υπηρεσία", "Κράτηση"],
    ...people.map((p) => [
      formatDateLong(p.date),
      p.time,
      p.firstName,
      p.lastName,
      p.mobile ?? "",
      p.serviceName,
      p.note,
    ]),
  ];
}

// On a phone the share sheet ("Save to Files", open in Excel/Numbers, send
// to someone) is more dependable than a bare download, which an installed
// home-screen app may just swallow; anywhere else it's a normal download.
async function saveFile(blob: Blob, fileName: string) {
  const file = new File([blob], fileName, { type: blob.type });
  if (window.matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return; // closed the sheet
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Props {
  people: AffectedPerson[];
  // false: asking before the closure is added. true: it has been added and
  // this is the list of customers left to call.
  confirmed: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  // Label of the "go ahead regardless" button.
  confirmLabel?: string;
}

// Customers who are in the book for a time that's being closed (time off,
// a one-off closure) or claimed (a new regular's standing time): who they
// are, when they were due, how they got there, a tap-to-call number, and
// the same list as an Excel file.
export default function AffectedAppointments({
  people,
  confirmed,
  onConfirm,
  onDismiss,
  confirmLabel = "Κλείσιμο παρόλα αυτά",
}: Props) {
  const count = people.length;

  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-3 flex flex-col gap-3">
      <div className="font-medium text-red-700">
        {confirmed
          ? `Έκλεισες. Πρέπει να ενημερώσεις ${count === 1 ? "1 πελάτη" : `${count} πελάτες`}:`
          : `Υπάρχ${count === 1 ? "ει ήδη 1" : `ουν ήδη ${count}`} ραντεβού σε αυτό το διάστημα:`}
      </div>

      <div className="flex flex-col gap-2">
        {people.map((p) => (
          <div key={p.key} className="rounded-lg bg-white border border-red-100 px-3 py-3 flex flex-col gap-2">
            <div className="min-w-0 text-sm">
              <div className="font-medium text-base">
                {p.firstName} {p.lastName}
              </div>
              <div className="text-neutral-700">
                {formatDateLong(p.date)} · {p.time}
              </div>
              <div className="text-neutral-500">
                {p.serviceName ? `${p.serviceName} · ` : ""}
                {p.note}
              </div>
              {!p.mobile && <div className="text-neutral-400">Χωρίς τηλέφωνο</div>}
            </div>
            {p.mobile && (
              <a
                href={`tel:${p.mobile}`}
                className="h-12 rounded-lg border border-neutral-300 flex items-center justify-center font-medium text-brand-purple"
              >
                Κλήση {p.mobile}
              </a>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => saveFile(buildXlsx("Ραντεβού", toRows(people)), "rantevou-pros-enimerosi.xlsx")}
        className="h-12 rounded-lg border border-neutral-300 bg-white font-medium text-neutral-700"
      >
        Λήψη λίστας (Excel)
      </button>

      {confirmed ? (
        <button type="button" onClick={onDismiss} className="h-12 rounded-lg bg-brand-purple text-white font-medium">
          Εντάξει
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="h-12 rounded-lg border border-red-300 bg-white text-red-700 font-medium"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="h-12 rounded-lg border border-neutral-300 bg-white font-medium text-neutral-700"
          >
            Άκυρο
          </button>
        </div>
      )}
    </div>
  );
}
