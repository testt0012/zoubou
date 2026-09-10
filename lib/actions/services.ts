"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/firebase/server";

export async function createService(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const duration = Number(formData.get("duration_minutes"));

  if (!name || !Number.isFinite(duration) || duration <= 0) return;

  const lastSnap = await adminDb
    .collection("services")
    .orderBy("sort_order", "desc")
    .limit(1)
    .get();
  const nextSortOrder = (lastSnap.docs[0]?.data().sort_order ?? 0) + 1;

  await adminDb.collection("services").add({
    name,
    duration_minutes: duration,
    active: true,
    sort_order: nextSortOrder,
    created_at: FieldValue.serverTimestamp(),
  });

  revalidatePath("/admin/services");
}

export async function updateService(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const duration = Number(formData.get("duration_minutes"));

  if (!id || !name || !Number.isFinite(duration) || duration <= 0) return;

  await adminDb
    .collection("services")
    .doc(id)
    .update({ name, duration_minutes: duration });

  revalidatePath("/admin/services");
}

export async function toggleServiceActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  await adminDb.collection("services").doc(id).update({ active: !active });
  revalidatePath("/admin/services");
}
