"use server";

import { requireAdmin } from "@/lib/supabase/server";

export async function createService(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const duration = Number(formData.get("duration_minutes"));

  if (!name || !Number.isFinite(duration) || duration <= 0) return;

  const { data: existing } = await supabase
    .from("services")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("services").insert({
    name,
    duration_minutes: duration,
    sort_order: (existing?.sort_order ?? 0) + 1,
  });
}

export async function updateService(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const duration = Number(formData.get("duration_minutes"));

  if (!id || !name || !Number.isFinite(duration) || duration <= 0) return;

  await supabase
    .from("services")
    .update({ name, duration_minutes: duration })
    .eq("id", id);
}

export async function deleteService(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) {
    // Existing appointments reference this service (FK constraint) — keep
    // the row so their history stays intact, just hide it going forward.
    await supabase.from("services").update({ active: false }).eq("id", id);
  }
}
