"use client";

import { useAdminData } from "@/components/admin/AdminDataProvider";
import {
  appointmentToAffected,
  regularToAffected,
  sortAffected,
  type AffectedPerson,
} from "@/components/admin/AffectedAppointments";
import { useRecurringVisits } from "@/components/admin/useRecurringVisits";
import { regularsAffectedByClosure } from "@/lib/recurring";
import { timeToMinutes } from "@/lib/time";

// Returns a lookup for "who is in the book if the shop closes on these
// dates between these times": booked appointments that overlap the closure,
// plus regular customers who'd lose their place because of it.
export function useClosureConflicts() {
  const { availabilityRules, blockedSlots, appointments } = useAdminData();
  const { visits, customerById, serviceNames } = useRecurringVisits();

  return (dates: string[], startTime: string, endTime: string): AffectedPerson[] => {
    const dateSet = new Set(dates);
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);

    const booked = appointments
      .filter((a) => dateSet.has(a.date) && timeToMinutes(a.start_time) < end && start < timeToMinutes(a.end_time))
      .map(appointmentToAffected);

    const regulars = regularsAffectedByClosure(
      visits,
      availabilityRules,
      blockedSlots,
      appointments,
      dates,
      startTime,
      endTime
    ).map(({ date, entry }) => {
      const customer = customerById.get(entry.id)!;
      return regularToAffected(customer, entry, date, serviceNames.get(customer.service_id) ?? "");
    });

    return sortAffected([...booked, ...regulars]);
  };
}
