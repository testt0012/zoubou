"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import AppointmentRow from "@/components/admin/AppointmentRow";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { RecurringCell } from "@/components/admin/RecurringCustomers";
import { useRecurringVisits } from "@/components/admin/useRecurringVisits";
import { uncancelAppointment } from "@/lib/actions/appointments";
import { timeToMinutes } from "@/lib/time";
import type { AppointmentWithService } from "@/types/database";

// How long the "Ακυρώθηκε — Αναίρεση" bar stays after a cancellation: there
// is no history to recover a mis-tapped cancel from, so it gets a short undo
// window instead of a blocking confirm() dialog.
const UNDO_WINDOW_MS = 5000;

// Everything happening on one day, in time order: the booked appointments
// and, among them, the regular customers due that day.
export default function DayAppointmentGrid({ date }: { date: string }) {
  const { appointments, refreshAppointments } = useAdminData();
  const { entriesFor, customerById, serviceNames } = useRecurringVisits();

  // Appointments cancelled a moment ago, kept here (not in the list the live
  // refresh rewrites) so the undo bar survives until its window runs out.
  const [undoable, setUndoable] = useState<Map<string, AppointmentWithService>>(new Map());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [, startTransition] = useTransition();

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  function dismiss(id: string) {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setUndoable((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function handleCancelled(appointment: AppointmentWithService) {
    setUndoable((prev) => new Map(prev).set(appointment.id, appointment));
    timers.current.set(
      appointment.id,
      setTimeout(() => dismiss(appointment.id), UNDO_WINDOW_MS)
    );
  }

  function handleUndo(appointment: AppointmentWithService) {
    dismiss(appointment.id);
    startTransition(async () => {
      await uncancelAppointment(appointment.id);
      await refreshAppointments();
    });
  }

  const onDay = appointments.filter((a) => a.date === date);
  const inList = new Set(onDay.map((a) => a.id));
  const items = [
    ...onDay.map((a) => ({
      minutes: timeToMinutes(a.start_time),
      appointment: a,
      undo: undoable.has(a.id),
      entry: null,
    })),
    // Already dropped from the list by the live refresh, still undoable.
    ...[...undoable.values()]
      .filter((a) => a.date === date && !inList.has(a.id))
      .map((a) => ({ minutes: timeToMinutes(a.start_time), appointment: a, undo: true, entry: null })),
    ...entriesFor(date).map((e) => ({ minutes: e.exactStart ?? e.start, appointment: null, undo: false, entry: e })),
  ].sort((a, b) => a.minutes - b.minutes);

  if (items.length === 0) {
    return <p className="text-neutral-500 text-sm">Δεν υπάρχουν ραντεβού αυτή την ημέρα.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map((item, i) => {
        if (item.appointment && item.undo) {
          const a = item.appointment;
          return (
            <div
              key={`undo-${a.id}`}
              className="col-span-full flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-500"
            >
              <span className="truncate">
                Ακυρώθηκε — {a.first_name} {a.last_name}
              </span>
              <button type="button" onClick={() => handleUndo(a)} className="text-brand-purple font-medium shrink-0 h-10 px-2">
                Αναίρεση
              </button>
            </div>
          );
        }
        if (item.appointment) {
          return (
            <AppointmentRow key={item.appointment.id} appointment={item.appointment} index={i} onCancelled={handleCancelled} />
          );
        }
        const customer = customerById.get(item.entry.id)!;
        return (
          <RecurringCell
            key={customer.id}
            entry={item.entry}
            customer={customer}
            serviceName={serviceNames.get(customer.service_id) ?? "—"}
            date={date}
          />
        );
      })}
    </div>
  );
}
