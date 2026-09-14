"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { addDays, todayAthens } from "@/lib/time";
import type { AppointmentWithService, AvailabilityRule, BlockedSlot, Service } from "@/types/database";

// How far forward appointments are cached on login. Reports/dashboard week
// navigation past this window calls ensureAppointmentsRange to extend it
// on demand — see that function below.
const INITIAL_APPOINTMENT_WINDOW_DAYS = 120;

interface AdminDataValue {
  loading: boolean;
  services: Service[];
  availabilityRules: AvailabilityRule[];
  blockedSlots: BlockedSlot[];
  appointments: AppointmentWithService[];
  ensureAppointmentsRange: (from: string, to: string) => Promise<void>;
}

const AdminDataContext = createContext<AdminDataValue | null>(null);

export function useAdminData(): AdminDataValue {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error("useAdminData must be used inside AdminDataProvider");
  return ctx;
}

// Loads every admin table once (right after confirming a session exists)
// and keeps it in memory for the rest of the admin visit, so switching
// between Ραντεβού/Αναφορές/Διαθεσιμότητα/Υπηρεσίες is a pure client-side
// re-render — no server round trip, no re-running the auth check, no
// re-querying Supabase — instead of the fresh server-rendered fetch each
// page used to do on every navigation.
//
// Correctness is kept by a single Realtime subscription covering every
// table here (migrations 0005 + 0006): any change, from this admin,
// another tab, or the public booking flow, re-pulls just that table.
export default function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => todayAthens(), []);

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [appointments, setAppointments] = useState<AppointmentWithService[]>([]);

  const rangeRef = useRef({ from: today, to: addDays(today, INITIAL_APPOINTMENT_WINDOW_DAYS) });
  const channelRef = useRef<RealtimeChannel | null>(null);

  const refetchServices = useCallback(async () => {
    const { data } = await supabase.from("services").select("*").order("sort_order", { ascending: true });
    setServices((data ?? []) as Service[]);
  }, [supabase]);

  const refetchAvailabilityRules = useCallback(async () => {
    const { data } = await supabase
      .from("availability_rules")
      .select("*")
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true });
    setAvailabilityRules((data ?? []) as AvailabilityRule[]);
  }, [supabase]);

  const refetchBlockedSlots = useCallback(async () => {
    const { data } = await supabase.from("blocked_slots").select("*").order("date", { ascending: true });
    setBlockedSlots((data ?? []) as BlockedSlot[]);
  }, [supabase]);

  const fetchAppointments = useCallback(
    async (from: string, to: string) => {
      const { data } = await supabase
        .from("appointments")
        .select("*, services(id, name, duration_minutes)")
        .eq("status", "confirmed")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      setAppointments((data ?? []) as AppointmentWithService[]);
    },
    [supabase]
  );

  const ensureAppointmentsRange = useCallback(
    async (from: string, to: string) => {
      const current = rangeRef.current;
      if (from >= current.from && to <= current.to) return;
      const needFrom = from < current.from ? from : current.from;
      const needTo = to > current.to ? to : current.to;
      rangeRef.current = { from: needFrom, to: needTo };
      await fetchAppointments(needFrom, needTo);
    },
    [fetchAppointments]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/admin/login");
        return;
      }
      if (cancelled) return;

      // Realtime's postgres_changes is RLS-aware: without explicitly
      // handing it this session's JWT, the socket authorizes as anon
      // (no policies on these tables), so every change is silently
      // filtered out server-side — the channel still reports SUBSCRIBED,
      // it just never receives anything. This was the actual cause of
      // realtime updates never arriving, confirmed by testing.
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      await Promise.all([
        refetchServices(),
        refetchAvailabilityRules(),
        refetchBlockedSlots(),
        fetchAppointments(rangeRef.current.from, rangeRef.current.to),
      ]);
      if (cancelled) return;

      // Don't reveal the UI (and let the admin start mutating things) until
      // the channel has actually confirmed SUBSCRIBED — postgres_changes
      // never replays events from before a channel subscribes, so a
      // mutation squeezed into that gap would silently never sync. Capped
      // with a timeout so a blocked WebSocket (e.g. a restrictive network)
      // degrades to "usable but not live" instead of hanging forever.
      await new Promise<void>((resolve) => {
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const timeout = setTimeout(settle, 5000);

        channelRef.current = supabase
          .channel("admin-data")
          .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
            fetchAppointments(rangeRef.current.from, rangeRef.current.to);
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "availability_rules" }, () => {
            refetchAvailabilityRules();
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "blocked_slots" }, () => {
            refetchBlockedSlots();
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => {
            refetchServices();
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              clearTimeout(timeout);
              settle();
            }
          });
      });
      if (cancelled) return;

      setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, router, refetchServices, refetchAvailabilityRules, refetchBlockedSlots, fetchAppointments]);

  const value: AdminDataValue = {
    loading,
    services,
    availabilityRules,
    blockedSlots,
    appointments,
    ensureAppointmentsRange,
  };

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}
