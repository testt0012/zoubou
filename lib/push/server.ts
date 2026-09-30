import "server-only";
import type webpushType from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

// web-push is sizeable, and most requests never send a notification: load it
// (and set the keys) the first time one is sent instead of at start-up, so
// routes that only occasionally notify start faster.
let webpush: typeof webpushType | null = null;
async function getWebPush(): Promise<typeof webpushType> {
  if (!webpush) {
    const lib = (await import("web-push")).default;
    lib.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    webpush = lib;
  }
  return webpush;
}

interface PushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// `gone` distinguishes "the push service says this subscription no longer
// exists" (permission revoked, browser data cleared, app uninstalled) from
// a transient failure — callers use it to prune dead subscriptions instead
// of retrying forever.
export async function sendPush(
  sub: PushKeys,
  payload: PushPayload
): Promise<{ ok: boolean; gone: boolean }> {
  try {
    await (await getWebPush()).sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return { ok: true, gone: false };
  } catch (err) {
    const statusCode = (err as { statusCode?: number } | null)?.statusCode;
    return { ok: false, gone: statusCode === 404 || statusCode === 410 };
  }
}

// Sends to every subscribed admin device, dropping subscriptions the push
// service reports as gone so the table doesn't accumulate dead entries.
export async function notifyAdmins(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  payload: PushPayload
): Promise<void> {
  const { data: subs } = await supabase
    .from("admin_push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (s: { id: number; endpoint: string; p256dh: string; auth: string }) => {
      const result = await sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        payload
      );
      if (result.gone) {
        await supabase.from("admin_push_subscriptions").delete().eq("id", s.id);
      }
    })
  );
}
