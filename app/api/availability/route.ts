import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableDates } from "@/lib/slots";
import { getClientIp, slotErrorResponse } from "@/lib/http";
import { lastBookableDate } from "@/lib/booking";
import { todayAthens } from "@/lib/time";

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_ATTEMPTS = 60;

// The days a customer can still book this service on (from today to three
// weeks ahead, and only those with at least one free time) — the calendar
// greys out everything else.
export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get("serviceId");
  if (!serviceId) {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία αναζήτησης." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: allowed, error: rateLimitError } = await supabase.rpc("record_slots_attempt", {
    p_ip: getClientIp(request),
    p_window_minutes: RATE_LIMIT_WINDOW_MINUTES,
    p_max_attempts: RATE_LIMIT_MAX_ATTEMPTS,
  });

  if (rateLimitError) {
    return NextResponse.json({ error: "Σφάλμα φόρτωσης διαθέσιμων ημερών." }, { status: 500 });
  }

  if (!allowed) {
    return NextResponse.json({ error: "Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά." }, { status: 429 });
  }

  const today = todayAthens();
  const result = await computeAvailableDates(supabase, serviceId, today, lastBookableDate(today));

  if ("error" in result) return slotErrorResponse(result.error);

  return NextResponse.json({ dates: result.dates });
}
