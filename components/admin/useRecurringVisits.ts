"use client";

import { useAdminData } from "@/components/admin/AdminDataProvider";
import { bookedMinutesForDate } from "@/lib/occupancy";
import { recurringEntriesForDate, recurringMinutesForDate, toRecurringVisit } from "@/lib/recurring";

// Regular customers aren't appointments in the database — their standing
// visits are worked out per day from the cached admin data. This gathers
// the lookups every screen that shows or counts them needs.
export function useRecurringVisits() {
  const { services, availabilityRules, blockedSlots, appointments, recurringCustomers } = useAdminData();

  const serviceById = new Map(services.map((s) => [s.id, s]));
  const serviceNames = new Map(services.map((s) => [s.id, s.name]));
  const customerById = new Map(recurringCustomers.map((c) => [c.id, c]));
  const visits = recurringCustomers.map((c) =>
    toRecurringVisit(c, serviceById.get(c.service_id)?.duration_minutes ?? 0)
  );

  return {
    visits,
    customerById,
    serviceNames,
    entriesFor: (date: string) =>
      recurringEntriesForDate(visits, availabilityRules, blockedSlots, appointments, date),
    // Booked appointments plus regulars' visits: the numerator of occupancy.
    takenMinutesFor: (date: string) =>
      bookedMinutesForDate(appointments, date) +
      recurringMinutesForDate(visits, availabilityRules, blockedSlots, appointments, date),
  };
}
