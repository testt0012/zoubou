import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canChangeAppointment } from "@/lib/booking";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OwnAppointment {
  id: string;
  serviceId: string;
  serviceName: string;
  status: "confirmed" | "cancelled";
  date: string;
  start: string; // "HH:MM"
  end: string;
  firstName: string;
  lastName: string;
  canChange: boolean;
}

// Customers have no account: the appointment's id (an unguessable UUID, only
// ever handed to the person who booked it) is the key to its private page.
// An appointment whose details have already been wiped (an hour after it
// ended) no longer exists as far as that page is concerned.
export async function loadOwnAppointment(supabase: Db, id: string): Promise<OwnAppointment | null> {
  if (!UUID_RE.test(id)) return null;

  const { data } = await supabase
    .from("appointments")
    .select("id, service_id, date, start_time, end_time, status, first_name, last_name, services(name)")
    .eq("id", id)
    .maybeSingle();

  if (!data || data.first_name === null) return null;

  const service = data.services as unknown as { name: string } | null;
  const start = (data.start_time as string).slice(0, 5);
  return {
    id: data.id,
    serviceId: data.service_id,
    serviceName: service?.name ?? "Ραντεβού",
    status: data.status,
    date: data.date,
    start,
    end: (data.end_time as string).slice(0, 5),
    firstName: data.first_name,
    lastName: data.last_name ?? "",
    canChange: data.status === "confirmed" && canChangeAppointment(data.date, start),
  };
}

// What the customer sees: no name, no phone — just the appointment itself.
export function publicView(a: OwnAppointment) {
  return {
    id: a.id,
    serviceName: a.serviceName,
    status: a.status,
    date: a.date,
    start: a.start,
    end: a.end,
    canChange: a.canChange,
  };
}
