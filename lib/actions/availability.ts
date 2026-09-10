"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/firebase/server";

const PATH = "/admin/availability";

export async function addAvailabilityRule(formData: FormData) {
  await requireAdmin();
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

  await adminDb.collection("availabilityRules").add({
    weekday,
    start_time,
    end_time,
    created_at: FieldValue.serverTimestamp(),
  });
  revalidatePath(PATH);
}

export async function deleteAvailabilityRule(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await adminDb.collection("availabilityRules").doc(id).delete();
  revalidatePath(PATH);
}

export async function addBlockedSlot(formData: FormData) {
  await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const start_time = String(formData.get("start_time") ?? "");
  const end_time = String(formData.get("end_time") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!date || !start_time || !end_time || start_time >= end_time) return;

  await adminDb.collection("blockedSlots").add({
    date,
    start_time,
    end_time,
    reason,
    created_at: FieldValue.serverTimestamp(),
  });
  revalidatePath(PATH);
}

export async function deleteBlockedSlot(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await adminDb.collection("blockedSlots").doc(id).delete();
  revalidatePath(PATH);
}

export async function updateSettings(formData: FormData) {
  await requireAdmin();
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

  await adminDb
    .collection("settings")
    .doc("config")
    .set({ slot_granularity_minutes, buffer_minutes }, { merge: true });

  revalidatePath(PATH);
}
