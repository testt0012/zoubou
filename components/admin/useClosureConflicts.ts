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
import { athensNow, timeToMinutes } from "@/lib/time";

// Returns a lookup for "who is in the book if the shop closes on these
// dates between these times": booked appointments that overlap the closure,
// plus regular customers who'd lose their place because of it.
export function useClosureConflicts() {
  const { availabilityRules, blockedSlots, appointments } = useAdminData();
  const { visits, customerById, serviceNames } = useRecurringVisits();

  return (dates: string[], startTime: string, endTime: string): AffectedPerson[] => {
    const dateSet = new Set(dates);
    // Someone whose time has already passed today isn't affected by a closure.
    const now = athensNow();
    const stillToCome = (date: string, endMinutes: number) => date > now.date || endMinutes > now.minutes;
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);

    const booked = appointments
      .filter(
        (a) =>
          a.first_name !== null &&
          dateSet.has(a.date) &&
          timeToMinutes(a.start_time) < end &&
          start < timeToMinutes(a.end_time) &&
          stillToCome(a.date, timeToMinutes(a.end_time))
      )
      .map(appointmentToAffected);

    const regulars = regularsAffectedByClosure(
      visits,
      availabilityRules,
      blockedSlots,
      appointments,
      dates,
      startTime,
      endTime
    )
      .filter(({ date, entry }) => stillToCome(date, entry.end))
      .map(({ date, entry }) => {
      const customer = customerById.get(entry.id)!;
      return regularToAffected(customer, entry, date, serviceNames.get(customer.service_id) ?? "");
    });

    return sortAffected([...booked, ...regulars]);
  };
}
