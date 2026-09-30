"use client";

import { useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// A crash inside the admin area: friendly message, and — using the admin's
// own signed-in session — a record in error_log so the developer can see it
// (see supabase/migrations/0017_error_log.sql). Best effort: if it can't be
// written (table missing, session gone) nothing else happens.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const message = (error.message || "admin screen crashed").slice(0, 500);
    createClient()
      .from("error_log")
      .insert({ source: "admin-ui", message, detail: error.digest ? { digest: error.digest } : null })
      .then(() => {});
  }, [error]);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 my-6 bg-white rounded-2xl shadow-lg shadow-black/20 text-center">
      <h1 className="text-lg font-semibold mb-2">Κάτι πήγε στραβά</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Παρουσιάστηκε ένα απρόσμενο πρόβλημα στην οθόνη. Δοκιμάστε ξανά ή γυρίστε στα ραντεβού.
      </p>
      <div className="flex flex-col gap-3">
        <button type="button" onClick={reset} className="w-full h-12 rounded-md bg-brand-purple text-white font-medium">
          Δοκιμάστε ξανά
        </button>
        <Link
          href="/admin/dashboard"
          className="w-full h-12 rounded-md border border-brand-purple text-brand-purple font-medium flex items-center justify-center"
        >
          Πίσω στα ραντεβού
        </Link>
      </div>
    </div>
  );
}
