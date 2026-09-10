import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Σφάλμα φόρτωσης υπηρεσιών." },
      { status: 500 }
    );
  }

  return NextResponse.json({ services: data });
}
