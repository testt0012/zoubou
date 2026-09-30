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

  const { data: allowed, error: rateLimitError } = await supabase.rpc("record_slots_attempt", {
    p_ip: getClientIp(request),
    p_window_minutes: RATE_LIMIT_WINDOW_MINUTES,
    p_max_attempts: RATE_LIMIT_MAX_ATTEMPTS,
  });

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

  const result = await computeAvailableSlots(supabase, serviceId, date);

  if ("error" in result) return slotErrorResponse(result.error, "api/slots");

  return NextResponse.json({ slots: result.slots });
}
