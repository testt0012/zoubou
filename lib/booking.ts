import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { timeToMinutes } from "@/lib/time";

// Firestore has no equivalent of a Postgres exclusion constraint, so exclusive
// time ranges are modeled as one lock document per fixed-size time bucket a
// booking occupies (independent of the admin's configurable display
// granularity, so changing that setting later can never misalign locks).
// A transaction reads every bucket the new appointment would occupy: if any
// lock document already exists, Firestore's optimistic-concurrency commit
// fails for whichever transaction loses the race, and it's turned into a
// clean "slot no longer available" response. This is what makes the guarantee
// hold even under truly simultaneous requests, not just the earlier
// availability check (which alone would be vulnerable to a race).
const LOCK_GRANULARITY_MINUTES = 5;

function lockIdsFor(date: string, startMinutes: number, endMinutes: number): string[] {
  const ids: string[] = [];
  for (let m = startMinutes; m < endMinutes; m += LOCK_GRANULARITY_MINUTES) {
    ids.push(`${date}_${m}`);
  }
  return ids;
}

export interface BookingInput {
  serviceId: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  firstName: string;
  lastName: string;
  mobile: string;
}

export type BookingResult =
  | { ok: true; appointmentId: string }
  | { ok: false; reason: "SLOT_UNAVAILABLE" };

export async function createBookingTransactional(
  input: BookingInput
): Promise<BookingResult> {
  const startMinutes = timeToMinutes(input.startTime);
  const endMinutes = timeToMinutes(input.endTime);
  const lockIds = lockIdsFor(input.date, startMinutes, endMinutes);
  const lockRefs = lockIds.map((id) => adminDb.collection("slotLocks").doc(id));
  const appointmentRef = adminDb.collection("appointments").doc();

  try {
    await adminDb.runTransaction(async (tx) => {
      const lockSnaps = await Promise.all(lockRefs.map((ref) => tx.get(ref)));
      if (lockSnaps.some((snap) => snap.exists)) {
        throw new SlotUnavailableError();
      }

      for (const ref of lockRefs) {
        tx.create(ref, { appointmentId: appointmentRef.id, date: input.date });
      }

      tx.create(appointmentRef, {
        service_id: input.serviceId,
        service_name: input.serviceName,
        date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        first_name: input.firstName,
        last_name: input.lastName,
        mobile: input.mobile,
        status: "confirmed",
        lock_ids: lockIds,
        created_at: FieldValue.serverTimestamp(),
      });
    });

    return { ok: true, appointmentId: appointmentRef.id };
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return { ok: false, reason: "SLOT_UNAVAILABLE" };
    }
    throw err;
  }
}

export async function releaseBookingLocks(lockIds: string[]): Promise<void> {
  if (lockIds.length === 0) return;
  const batch = adminDb.batch();
  for (const id of lockIds) {
    batch.delete(adminDb.collection("slotLocks").doc(id));
  }
  await batch.commit();
}

class SlotUnavailableError extends Error {}
