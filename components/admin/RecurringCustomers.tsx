"use client";

import { useState, useTransition } from "react";
import { deleteRecurringCustomer, setRecurringVisitSkipped } from "@/lib/actions/recurring";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import BottomSheet from "@/components/admin/BottomSheet";
import { describeSchedule, type RecurringDayEntry } from "@/lib/recurring";
import { formatDateLong, formatDateShort, minutesToTime, todayAthens } from "@/lib/time";
import type { RecurringCustomer } from "@/types/database";

const SECONDARY_BUTTON_CLASS =
  "h-12 rounded-lg border border-neutral-300 px-4 font-medium text-neutral-700 disabled:opacity-60";

function RecurringCustomerSheet({
  customer,
  serviceName,
  date,
  onClose,
}: {
  customer: RecurringCustomer;
  serviceName: string;
  // The day the sheet was opened from, when it was opened from a day: that
  // one visit can then be skipped without touching the rest.
  date?: string;
  onClose: () => void;
}) {
  const { refreshRecurringCustomers } = useAdminData();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startTransition] = useTransition();

  const today = todayAthens();
  const upcomingSkips = (customer.skipped_dates ?? []).filter((d) => d >= today);

  function setSkipped(skipDate: string, skipped: boolean, closeAfter: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setRecurringVisitSkipped(customer.id, skipDate, skipped);
      await refreshRecurringCustomers();
      if (!result.success) setError(result.error ?? "Κάτι πήγε στραβά.");
      else if (closeAfter) onClose();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteRecurringCustomer(customer.id);
      await refreshRecurringCustomers();
      onClose();
    });
  }

  return (
    <BottomSheet title={`${customer.first_name} ${customer.last_name}`} onClose={onClose}>
      <div className="flex flex-col gap-3 pt-1">
        <div>
          <div className="font-medium">{describeSchedule(customer)}</div>
          <div className="text-sm text-neutral-500">Μόνιμος πελάτης · {serviceName}</div>
        </div>

        {customer.mobile && (
          <a
            href={`tel:${customer.mobile}`}
            className="h-12 rounded-lg border border-neutral-300 flex items-center justify-center font-medium text-brand-purple"
          >
            Κλήση {customer.mobile}
          </a>
        )}

        {date && (
          <button
            type="button"
            onClick={() => setSkipped(date, true, true)}
            disabled={isDeleting}
            className={SECONDARY_BUTTON_CLASS}
          >
            Δεν θα έρθει {formatDateShort(date)}
          </button>
        )}

        {upcomingSkips.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-sm text-neutral-500">Δεν θα έρθει:</div>
            {upcomingSkips.map((d) => (
              <div key={d} className="flex items-center justify-between gap-3 rounded-lg bg-neutral-100 pl-3">
                <span className="text-sm">{formatDateLong(d)}</span>
                <button
                  type="button"
                  onClick={() => setSkipped(d, false, false)}
                  disabled={isDeleting}
                  className="shrink-0 h-12 px-3 font-medium text-brand-purple disabled:opacity-60"
                >
                  Επαναφορά
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {confirmDelete ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 h-12 rounded-lg bg-red-600 text-white font-medium disabled:opacity-60"
            >
              Ναι, διαγραφή
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={isDeleting}
              className={SECONDARY_BUTTON_CLASS}
            >
              Όχι
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="h-12 rounded-lg border border-red-200 font-medium text-red-600"
          >
            Διαγραφή μόνιμου πελάτη
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

// One cell in the day's 3-column grid, next to the booked appointments —
// dashed, to set a standing visit apart from an actual booking.
export function RecurringCell({
  entry,
  customer,
  serviceName,
  date,
}: {
  entry: RecurringDayEntry;
  customer: RecurringCustomer;
  serviceName: string;
  date: string;
}) {
  const [open, setOpen] = useState(false);

  // A zone shows as a range until bookings leave exactly one opening in it;
  // from then on that opening is the customer's time.
  const time = !entry.isZone
    ? minutesToTime(entry.start)
    : entry.exactStart !== null
      ? minutesToTime(entry.exactStart)
      : `${minutesToTime(entry.start)}–${minutesToTime(entry.end)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-lg px-1 py-2 flex flex-col items-center gap-0.5 border border-dashed active:opacity-70 ${
          entry.fits ? "border-brand-purple/60" : "border-red-300"
        }`}
      >
        <span className={`text-sm font-semibold ${entry.fits ? "text-brand-purple" : "text-red-600"}`}>{time}</span>
        <span className="text-[11px] text-neutral-500 leading-tight text-center line-clamp-2 max-w-full break-words">
          {customer.first_name} {customer.last_name}
        </span>
        <span className="text-[10px] text-neutral-400 leading-tight">{entry.fits ? "μόνιμος" : "δεν χωράει"}</span>
      </button>

      {open && (
        <RecurringCustomerSheet
          customer={customer}
          serviceName={serviceName}
          date={date}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// Every regular customer, whatever day they come on — the place to look one
// up or remove one. Closed by default: it's rarely needed.
export function RecurringCustomerList({
  customers,
  serviceNames,
}: {
  customers: RecurringCustomer[];
  serviceNames: Map<string, string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Looked up fresh each render so the open sheet reflects a restore at once.
  const selected = customers.find((c) => c.id === selectedId) ?? null;

  if (customers.length === 0) return null;

  return (
    <details className="group border border-neutral-200 rounded-xl mt-6">
      <summary className="min-h-14 px-4 cursor-pointer select-none list-none flex items-center justify-between gap-3 font-semibold">
        Μόνιμοι πελάτες ({customers.length})
        <span className="shrink-0 text-2xl font-normal text-neutral-400 transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="border-t border-neutral-200 divide-y divide-neutral-100">
        {customers.map((c) => (
          <button
            type="button"
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className="w-full min-h-14 px-4 py-2 flex items-center justify-between gap-3 text-left"
          >
            <span className="min-w-0">
              <span className="block font-medium">
                {c.first_name} {c.last_name}
              </span>
              <span className="block text-sm text-neutral-500">{describeSchedule(c)}</span>
            </span>
            <span className="shrink-0 text-xl text-neutral-400">›</span>
          </button>
        ))}
      </div>

      {selected && (
        <RecurringCustomerSheet
          customer={selected}
          serviceName={serviceNames.get(selected.service_id) ?? "—"}
          onClose={() => setSelectedId(null)}
        />
      )}
    </details>
  );
}
