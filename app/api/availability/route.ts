import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableDates } from "@/lib/slots";
import { getClientIp, slotErrorResponse } from "@/lib/http";
import { logError } from "@/lib/errorLog";
import { after } from "next/server";
import { lastBookableDate } from "@/lib/booking";
import { todayAthens } from "@/lib/time";

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_ATTEMPTS = 60;
const CACHE_SHORT = "public, s-maxage=5, stale-while-revalidate=25";

// The days a customer can still book this service on (from today to three
// weeks ahead, and only those with at least one free time) — the calendar
// greys out everything else.
export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get("serviceId");
  if (!serviceId) {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία αναζήτησης." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const today = todayAthens();
  const [{ data: allowed, error: rateLimitError }, result] = await Promise.all([
    supabase.rpc("record_slots_attempt", {
      p_ip: getClientIp(request),
      p_window_minutes: RATE_LIMIT_WINDOW_MINUTES,
      p_max_attempts: RATE_LIMIT_MAX_ATTEMPTS,
    }),
    computeAvailableDates(supabase, serviceId, today, lastBookableDate(today)),
  ]);

  if (rateLimitError) {
    after(() => logError("api/availability", rateLimitError));
    return NextResponse.json({ error: "Σφάλμα φόρτωσης διαθέσιμων ημερών." }, { status: 500 });
  }

  if (!allowed) {
    return NextResponse.json({ error: "Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά." }, { status: 429 });
  }

  if ("error" in result) return slotErrorResponse(result.error, "api/availability");

  return NextResponse.json(
    { dates: result.dates, days: result.days, firstDay: result.firstDay },
    { headers: { "Cache-Control": CACHE_SHORT } }
  );
}
