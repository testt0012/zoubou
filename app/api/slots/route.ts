import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/slots";
import { isValidDateString } from "@/lib/validation";
import { todayAthens } from "@/lib/time";

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
  const result = await computeAvailableSlots(supabase, serviceId, date);

  if ("error" in result) {
    return NextResponse.json(
      { error: "Η υπηρεσία δεν βρέθηκε." },
      { status: 404 }
    );
  }

  return NextResponse.json({ slots: result.slots });
}
