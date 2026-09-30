import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOwnAppointment, publicView } from "@/lib/customerAppointment";

// The customer's private appointment page (/a/[id]) reads its details here.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/appointments/[id]">) {
  const { id } = await ctx.params;

  const appointment = await loadOwnAppointment(createAdminClient(), id);
  if (!appointment) {
    return NextResponse.json({ error: "Το ραντεβού δεν βρέθηκε." }, { status: 404 });
  }

  return NextResponse.json({ appointment: publicView(appointment) });
}
