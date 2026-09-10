import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/slots";
import {
  isValidDateString,
  isValidTimeString,
  normalizeGreekMobile,
  sanitizeName,
} from "@/lib/validation";
import { minutesToTime, timeToMinutes, todayAthens } from "@/lib/time";

const RATE_LIMIT_WINDOW_MINUTES = 10;
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

  const supabase = createAdminClient();
  const ip = getClientIp(request);

  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
  ).toISOString();

  const { count } = await supabase
    .from("booking_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά." },
      { status: 429 }
    );
  }

  await supabase.from("booking_rate_limits").insert({ ip });

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

  const result = await computeAvailableSlots(supabase, serviceId, date);
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

  const { data: appointment, error: insertError } = await supabase
    .from("appointments")
    .insert({
      service_id: serviceId,
      date,
      start_time: startTime,
      end_time: endTime,
      first_name: firstName,
      last_name: lastName,
      mobile,
    })
    .select("id, date, start_time, end_time, services(name)")
    .single();

  if (insertError) {
    // 23P01 = exclusion_violation: another booking grabbed this exact/
    // overlapping slot in the moment between our availability check and
    // the insert. This is the authoritative race-condition guard.
    if (insertError.code === "23P01") {
      return NextResponse.json(
        {
          error: "Η ώρα αυτή μόλις κλείστηκε από κάποιον άλλον. Επιλέξτε άλλη ώρα.",
          code: "SLOT_UNAVAILABLE",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Σφάλμα κατά τη δημιουργία του ραντεβού." },
      { status: 500 }
    );
  }

  return NextResponse.json({ appointment }, { status: 201 });
}
