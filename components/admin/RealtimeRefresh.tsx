"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Mounted once in the persistent admin shell. Refreshes the current
// route's server data whenever an appointment changes anywhere — a client
// booking online, another tab cancelling one, etc. — so the dashboard and
// reports stay live without a manual reload. See migration 0005.
export default function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-appointments")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
