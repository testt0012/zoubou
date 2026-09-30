import { NextResponse, type NextRequest } from "next/server";
import type { SlotError } from "@/lib/slots";

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

// The response for a slot computation that couldn't be answered: an unknown
// service is a 404; a database that couldn't be read is a temporary 503 (the
// caller must not guess that times are free).
export function slotErrorResponse(error: SlotError) {
  if (error === "unavailable") {
    return NextResponse.json({ error: "Προσωρινό σφάλμα. Δοκιμάστε ξανά σε λίγο." }, { status: 503 });
  }
  return NextResponse.json({ error: "Η υπηρεσία δεν βρέθηκε." }, { status: 404 });
}
