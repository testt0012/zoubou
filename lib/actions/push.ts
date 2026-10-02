"use server";

import { requireAdmin } from "@/lib/supabase/server";
import { logError } from "@/lib/errorLog";
import type { ActionResult } from "@/lib/actions/types";
import type { PushSubscriptionJSON } from "@/types/database";

export async function subscribeAdminPush(subscription: PushSubscriptionJSON): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("admin_push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    await logError("action/subscribeAdminPush", error);
    return { success: false, error: "Οι ειδοποιήσεις δεν ενεργοποιήθηκαν." };
  }
  return { success: true };
}

export async function unsubscribeAdminPush(endpoint: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("admin_push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    await logError("action/unsubscribeAdminPush", error);
    return { success: false, error: "Οι ειδοποιήσεις δεν απενεργοποιήθηκαν." };
  }
  return { success: true };
}
