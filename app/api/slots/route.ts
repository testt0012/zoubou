import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/slots";
import { isValidDateString } from "@/lib/validation";
import { todayAthens } from "@/lib/time";

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_ATTEMPTS = 60;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get("serviceId");
  const date = request.nextUrl.searchParams.get("date");

  if (!serviceId || !isValidDateString(date)) {
    return NextResponse.json(
      { error: "Μη έγκυρα στοιχεία αναζήτησης." },
      { status: 400 }
    );
  }

  if (date < todayAthens()) {
    return NextResponse.json({ slots: [] });
  }

  const supabase = createAdminClient();

  const { data: allowed, error: rateLimitError } = await supabase.rpc("record_slots_attempt", {
    p_ip: getClientIp(request),
    p_window_minutes: RATE_LIMIT_WINDOW_MINUTES,
    p_max_attempts: RATE_LIMIT_MAX_ATTEMPTS,
  });

  if (rateLimitError) {
    return NextResponse.json({ error: "Σφάλμα φόρτωσης διαθέσιμων ωρών." }, { status: 500 });
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά." },
      { status: 429 }
    );
  }

  const result = await computeAvailableSlots(supabase, serviceId, date);

  if ("error" in result) {
    return NextResponse.json(
      { error: "Η υπηρεσία δεν βρέθηκε." },
      { status: 404 }
    );
  }

  return NextResponse.json({ slots: result.slots });
}
