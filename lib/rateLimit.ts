import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientIp } from "@/lib/http";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

const WINDOW_MINUTES = 10;

// Per-IP limits backed by the atomic database functions (migrations 0003
// and 0007): "slots" is the generous one for browsing times and days,
// "booking" the strict one for anything that changes an appointment.
const LIMITS = {
  slots: { fn: "record_slots_attempt", max: 60 },
  booking: { fn: "record_booking_attempt", max: 5 },
} as const;

export async function checkRateLimit(
  supabase: Db,
  request: NextRequest,
  kind: keyof typeof LIMITS
): Promise<"ok" | "limited" | "error"> {
  const { data: allowed, error } = await supabase.rpc(LIMITS[kind].fn, {
    p_ip: getClientIp(request),
    p_window_minutes: WINDOW_MINUTES,
    p_max_attempts: LIMITS[kind].max,
  });
  if (error) return "error";
  return allowed ? "ok" : "limited";
}
