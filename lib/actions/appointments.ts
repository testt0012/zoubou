"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/server";

export async function cancelAppointment(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
  revalidatePath("/admin/dashboard");
}
