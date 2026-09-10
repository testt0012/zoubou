import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { computeAvailableSlots } from "@/lib/slots";
import { createBookingTransactional } from "@/lib/booking";
import {
  isValidDateString,
  isValidTimeString,
  normalizeGreekMobile,
  sanitizeName,
} from "@/lib/validation";
import { minutesToTime, timeToMinutes, todayAthens } from "@/lib/time";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο αίτημα." }, { status: 400 });
  }

  // Honeypot: real users never fill this hidden field. Bots that do get a
  // generic error rather than a signal that they were caught.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ error: "Μη έγκυρο αίτημα." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;

  const recentAttempts = await adminDb
    .collection("bookingRateLimits")
    .where("ip", "==", ip)
    .limit(20)
    .get();

  const attemptsInWindow = recentAttempts.docs.filter((doc) => {
    const createdAt = doc.data().created_at?.toMillis?.() ?? 0;
    return createdAt >= windowStart;
  });

  if (attemptsInWindow.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά." },
      { status: 429 }
    );
  }

  await adminDb
    .collection("bookingRateLimits")
    .add({ ip, created_at: FieldValue.serverTimestamp() });

  const serviceId = body.serviceId;
  const date = body.date;
  const startTime = body.startTime;

  if (
    typeof serviceId !== "string" ||
    !isValidDateString(date) ||
    !isValidTimeString(startTime)
  ) {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία ραντεβού." }, { status: 400 });
  }

  if (date < todayAthens()) {
    return NextResponse.json(
      { error: "Δεν μπορείτε να κλείσετε ραντεβού σε παρελθοντική ημερομηνία." },
      { status: 400 }
    );
  }

  const firstName = sanitizeName(String(body.firstName ?? ""));
  const lastName = sanitizeName(String(body.lastName ?? ""));
  const mobile = normalizeGreekMobile(String(body.mobile ?? ""));

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "Συμπληρώστε σωστά όνομα και επώνυμο." },
      { status: 400 }
    );
  }

  if (!mobile) {
    return NextResponse.json(
      { error: "Το κινητό τηλέφωνο πρέπει να ξεκινά από 69 και να έχει 10 ψηφία." },
      { status: 400 }
    );
  }

  const serviceSnap = await adminDb.collection("services").doc(serviceId).get();
  const service = serviceSnap.data();
  if (!serviceSnap.exists || !service) {
    return NextResponse.json({ error: "Η υπηρεσία δεν βρέθηκε." }, { status: 404 });
  }

  const result = await computeAvailableSlots(serviceId, date);
  if ("error" in result) {
    return NextResponse.json({ error: "Η υπηρεσία δεν βρέθηκε." }, { status: 404 });
  }

  if (!result.slots.includes(startTime)) {
    return NextResponse.json(
      {
        error: "Η ώρα αυτή δεν είναι πλέον διαθέσιμη. Επιλέξτε άλλη ώρα.",
        code: "SLOT_UNAVAILABLE",
      },
      { status: 409 }
    );
  }

  const endTime = minutesToTime(
    timeToMinutes(startTime) + result.serviceDurationMinutes
  );

  const booking = await createBookingTransactional({
    serviceId,
    serviceName: service.name,
    date,
    startTime,
    endTime,
    firstName,
    lastName,
    mobile,
  });

  if (!booking.ok) {
    return NextResponse.json(
      {
        error: "Η ώρα αυτή μόλις κλείστηκε από κάποιον άλλον. Επιλέξτε άλλη ώρα.",
        code: "SLOT_UNAVAILABLE",
      },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      appointment: {
        id: booking.appointmentId,
        date,
        start_time: startTime,
        end_time: endTime,
        services: { name: service.name },
      },
    },
    { status: 201 }
  );
}
