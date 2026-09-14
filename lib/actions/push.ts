"use server";

import { requireAdmin } from "@/lib/supabase/server";
import type { PushSubscriptionJSON } from "@/types/database";

export async function subscribeAdminPush(subscription: PushSubscriptionJSON) {
  const { supabase } = await requireAdmin();
  await supabase.from("admin_push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );
}

export async function unsubscribeAdminPush(endpoint: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("admin_push_subscriptions").delete().eq("endpoint", endpoint);
}
