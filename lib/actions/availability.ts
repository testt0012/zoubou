"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/server";

const PATH = "/admin/availability";

export async function addAvailabilityRule(formData: FormData) {
  const { supabase } = await requireAdmin();
  const weekday = Number(formData.get("weekday"));
  const start_time = String(formData.get("start_time") ?? "");
  const end_time = String(formData.get("end_time") ?? "");

  if (
    !Number.isInteger(weekday) ||
    weekday < 0 ||
    weekday > 6 ||
    !start_time ||
    !end_time ||
    start_time >= end_time
  ) {
    return;
  }

  await supabase.from("availability_rules").insert({ weekday, start_time, end_time });
  revalidatePath(PATH);
}

export async function deleteAvailabilityRule(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("availability_rules").delete().eq("id", id);
  revalidatePath(PATH);
}

export async function addBlockedSlot(formData: FormData) {
  const { supabase } = await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const start_time = String(formData.get("start_time") ?? "");
  const end_time = String(formData.get("end_time") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!date || !start_time || !end_time || start_time >= end_time) return;

  await supabase.from("blocked_slots").insert({ date, start_time, end_time, reason });
  revalidatePath(PATH);
}

export async function deleteBlockedSlot(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("blocked_slots").delete().eq("id", id);
  revalidatePath(PATH);
}

export async function updateSettings(formData: FormData) {
  const { supabase } = await requireAdmin();
  const slot_granularity_minutes = Number(formData.get("slot_granularity_minutes"));
  const buffer_minutes = Number(formData.get("buffer_minutes"));

  if (
    !Number.isFinite(slot_granularity_minutes) ||
    slot_granularity_minutes <= 0 ||
    !Number.isFinite(buffer_minutes) ||
    buffer_minutes < 0
  ) {
    return;
  }

  await supabase
    .from("settings")
    .update({ slot_granularity_minutes, buffer_minutes })
    .eq("id", true);

  revalidatePath(PATH);
}
