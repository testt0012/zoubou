"use server";

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/firebase/server";
import { releaseBookingLocks } from "@/lib/booking";

export async function cancelAppointment(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const ref = adminDb.collection("appointments").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;

  await ref.update({ status: "cancelled" });
  await releaseBookingLocks(snap.data()?.lock_ids ?? []);

  revalidatePath("/admin/dashboard");
}
