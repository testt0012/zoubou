import { adminDb } from "@/lib/firebase/admin";
import { athensNow, minutesToTime, timeToMinutes, weekdayOf } from "@/lib/time";

interface Interval {
  start: number;
  end: number;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export type SlotError = "service_not_found";

export interface SlotsResult {
  slots: string[];
  serviceDurationMinutes: number;
}

const DEFAULT_GRANULARITY_MINUTES = 30;
const DEFAULT_BUFFER_MINUTES = 0;

/**
 * Computes bookable start times ("HH:MM") for a given service on a given
 * Athens calendar date: weekly availability windows, minus blocked slots,
 * minus existing confirmed appointments (padded by the configured buffer),
 * stepped at the admin-configured slot granularity, and never in the past.
 *
 * Used both by GET /api/slots (to show clients options) and by POST /api/book
 * (to re-validate the chosen slot server-side before the transactional
 * insert) — the per-time-bucket lock documents created in that transaction
 * are the final, authoritative race-condition guard; this function is what
 * makes the UI/validation actually usable.
 */
export async function computeAvailableSlots(
  serviceId: string,
  date: string
): Promise<SlotsResult | { error: SlotError }> {
  const serviceSnap = await adminDb.collection("services").doc(serviceId).get();
  const service = serviceSnap.data();

  if (!serviceSnap.exists || !service || service.active !== true) {
    return { error: "service_not_found" };
  }

  const duration = service.duration_minutes as number;

  const [settingsSnap, rulesSnap, blockedSnap, bookedSnap] = await Promise.all([
    adminDb.collection("settings").doc("config").get(),
    adminDb.collection("availabilityRules").where("weekday", "==", weekdayOf(date)).get(),
    adminDb.collection("blockedSlots").where("date", "==", date).get(),
    adminDb
      .collection("appointments")
      .where("date", "==", date)
      .where("status", "==", "confirmed")
      .get(),
  ]);

  const settings = settingsSnap.data();
  const granularity = settings?.slot_granularity_minutes ?? DEFAULT_GRANULARITY_MINUTES;
  const buffer = settings?.buffer_minutes ?? DEFAULT_BUFFER_MINUTES;

  const windows: Interval[] = rulesSnap.docs.map((doc) => ({
    start: timeToMinutes(doc.data().start_time),
    end: timeToMinutes(doc.data().end_time),
  }));

  const busy: Interval[] = [
    ...blockedSnap.docs.map((doc) => ({
      start: timeToMinutes(doc.data().start_time),
      end: timeToMinutes(doc.data().end_time),
    })),
    ...bookedSnap.docs.map((doc) => ({
      start: timeToMinutes(doc.data().start_time) - buffer,
      end: timeToMinutes(doc.data().end_time) + buffer,
    })),
  ];

  const now = athensNow();
  const isToday = now.date === date;

  const results: number[] = [];

  for (const window of windows) {
    for (
      let start = window.start;
      start + duration <= window.end;
      start += granularity
    ) {
      if (isToday && start <= now.minutes) continue;

      const candidate: Interval = { start, end: start + duration };
      const blockedByBusy = busy.some((b) => overlaps(candidate, b));
      if (!blockedByBusy) results.push(start);
    }
  }

  const slots = Array.from(new Set(results))
    .sort((a, b) => a - b)
    .map(minutesToTime);

  return { slots, serviceDurationMinutes: duration };
}
