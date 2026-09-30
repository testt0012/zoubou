"use client";

import AppointmentRow from "@/components/admin/AppointmentRow";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { RecurringCell } from "@/components/admin/RecurringCustomers";
import { useRecurringVisits } from "@/components/admin/useRecurringVisits";
import { timeToMinutes } from "@/lib/time";

// Everything happening on one day, in time order: the booked appointments
// and, among them, the regular customers due that day.
export default function DayAppointmentGrid({ date }: { date: string }) {
  const { appointments } = useAdminData();
  const { entriesFor, customerById, serviceNames } = useRecurringVisits();

  const items = [
    ...appointments
      .filter((a) => a.date === date)
      .map((a) => ({ minutes: timeToMinutes(a.start_time), appointment: a, entry: null })),
    ...entriesFor(date).map((e) => ({ minutes: e.exactStart ?? e.start, appointment: null, entry: e })),
  ].sort((a, b) => a.minutes - b.minutes);

  if (items.length === 0) {
    return <p className="text-neutral-500 text-sm">Δεν υπάρχουν ραντεβού αυτή την ημέρα.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map((item, i) => {
        if (item.appointment) {
          return <AppointmentRow key={item.appointment.id} appointment={item.appointment} index={i} />;
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
