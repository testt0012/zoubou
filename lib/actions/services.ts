"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/server";
import { logError } from "@/lib/errorLog";
import type { ActionResult } from "@/lib/actions/types";

const MAX_NAME_LENGTH = 60;
const MAX_DURATION_MINUTES = 480;

// A service needs a name and a whole number of minutes (the same limits the
// form's own fields have, checked again here since an action can be called
// directly).
function readService(formData: FormData): { name: string; duration: number } | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const duration = Number(formData.get("duration_minutes"));

  if (!name) return { error: "Γράψτε όνομα για την υπηρεσία." };
  if (name.length > MAX_NAME_LENGTH) return { error: `Το όνομα μπορεί να έχει το πολύ ${MAX_NAME_LENGTH} χαρακτήρες.` };
  if (!Number.isInteger(duration) || duration < 1 || duration > MAX_DURATION_MINUTES) {
    return { error: `Η διάρκεια πρέπει να είναι ακέραιος αριθμός λεπτών από 1 έως ${MAX_DURATION_MINUTES}.` };
  }
  return { name, duration };
}

export async function createService(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const service = readService(formData);
  if ("error" in service) return { success: false, error: service.error };

  const { data: existing } = await supabase
    .from("services")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("services").insert({
    name: service.name,
    duration_minutes: service.duration,
    sort_order: (existing?.sort_order ?? 0) + 1,
  });
  if (error) {
    await logError("action/createService", error);
    return { success: false, error: "Η υπηρεσία δεν αποθηκεύτηκε. Δοκιμάστε ξανά." };
  }

  // The home page serves a ready-made copy of the services list.
  revalidatePath("/");
  return { success: true };
}

export async function updateService(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { success: false, error: "Η υπηρεσία δεν βρέθηκε." };

  const service = readService(formData);
  if ("error" in service) return { success: false, error: service.error };

  const { error } = await supabase
    .from("services")
    .update({ name: service.name, duration_minutes: service.duration })
    .eq("id", id);
  if (error) {
    await logError("action/updateService", error);
    return { success: false, error: "Οι αλλαγές δεν αποθηκεύτηκαν. Δοκιμάστε ξανά." };
  }

  // The home page serves a ready-made copy of the services list.
  revalidatePath("/");
  return { success: true };
}

export async function deleteService(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!id) return { success: false, error: "Η υπηρεσία δεν βρέθηκε." };

  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) {
    // Existing appointments reference this service (FK constraint) — keep
    // the row so their history stays intact, just hide it going forward.
    const { error: hideError } = await supabase.from("services").update({ active: false }).eq("id", id);
    if (hideError) {
      await logError("action/deleteService", hideError);
      return { success: false, error: "Η υπηρεσία δεν διαγράφηκε. Δοκιμάστε ξανά." };
    }
  }

  // The home page serves a ready-made copy of the services list.
  revalidatePath("/");
  return { success: true };
}
