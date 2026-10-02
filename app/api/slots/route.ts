import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/slots";
import { isValidDateString } from "@/lib/validation";
import { todayAthens } from "@/lib/time";
import { getClientIp, slotErrorResponse } from "@/lib/http";
import { logError } from "@/lib/errorLog";
import { after } from "next/server";
import { lastBookableDate } from "@/lib/booking";

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_ATTEMPTS = 60;
const CACHE_SHORT = "public, s-maxage=5, stale-while-revalidate=25";

export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get("serviceId");
  const date = request.nextUrl.searchParams.get("date");

  if (!serviceId || !isValidDateString(date)) {
    return NextResponse.json(
      { error: "Μη έγκυρα στοιχεία αναζήτησης." },
      { status: 400 }
    );
  }

  const today = todayAthens();
  if (date < today || date > lastBookableDate(today)) {
    return NextResponse.json({ slots: [] });
  }

  const supabase = createAdminClient();

  // The rate-limit check and the work of finding the times don't depend on
  // each other, so they run side by side (one database round trip saved).
  const [{ data: allowed, error: rateLimitError }, result] = await Promise.all([
    supabase.rpc("record_slots_attempt", {
      p_ip: getClientIp(request),
      p_window_minutes: RATE_LIMIT_WINDOW_MINUTES,
      p_max_attempts: RATE_LIMIT_MAX_ATTEMPTS,
    }),
    computeAvailableSlots(supabase, serviceId, date),
  ]);

  if (rateLimitError) {
    after(() => logError("api/slots", rateLimitError));
    return NextResponse.json({ error: "Σφάλμα φόρτωσης διαθέσιμων ωρών." }, { status: 500 });
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά." },
      { status: 429 }
    );
  }

  if ("error" in result) return slotErrorResponse(result, "api/slots");

  // Short-lived shared copy: the same day's times are asked for again and
  // again (switching between days), and a slot taken in the meantime is
  // caught when the booking itself is checked.
  return NextResponse.json({ slots: result.slots }, { headers: { "Cache-Control": CACHE_SHORT } });
}
