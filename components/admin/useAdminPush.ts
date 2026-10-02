"use client";

import { useCallback, useEffect, useState } from "react";
import { isPushSupported, subscribeToPush } from "@/lib/push/client";
import { subscribeAdminPush, unsubscribeAdminPush } from "@/lib/actions/push";

export const PUSH_DISMISSED_KEY = "zoubou-admin-push-dismissed";

// "denied" is the one state the app can't get out of on its own: once the
// admin has refused at the OS/browser prompt, Notification.requestPermission()
// resolves "denied" straight away without showing anything, so the only way
// back is the device's own settings.
export type AdminPushStatus = "unsupported" | "off" | "on" | "denied";

async function readStatus(): Promise<AdminPushStatus> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

// Single source of truth for this device's "new booking" alert state, shared
// by the header bell and the opt-in banner so they never disagree.
export function useAdminPush() {
  const [status, setStatus] = useState<AdminPushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      readStatus().then((next) => {
        if (!cancelled) setStatus(next);
      });
    };
    refresh();

    // Re-check when the admin comes back to the app — that's when a change
    // made in the device's notification settings becomes visible.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Must be called straight from a tap: the permission prompt only appears
  // in response to a user gesture.
  const enable = useCallback(async (): Promise<AdminPushStatus> => {
    setBusy(true);
    try {
      const subscription = await subscribeToPush();
      if (subscription) {
        const saved = await subscribeAdminPush(subscription);
        // Not stored on the server: leave the browser unsubscribed too, so the
        // bell doesn't say "on" for a device that will never be notified.
        if (!saved.success) {
          const registration = await navigator.serviceWorker.ready;
          await (await registration.pushManager.getSubscription())?.unsubscribe();
        }
      }
    } catch {
      // Fall through — the status re-read below reports what actually stuck.
    }
    const next = await readStatus();
    setStatus(next);
    setBusy(false);
    return next;
  }, []);

  const disable = useCallback(async (): Promise<AdminPushStatus> => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeAdminPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      // Turned off on purpose — don't nag with the opt-in banner afterwards.
      localStorage.setItem(PUSH_DISMISSED_KEY, "1");
    } catch {
      // Same as above.
    }
    const next = await readStatus();
    setStatus(next);
    setBusy(false);
    return next;
  }, []);

  return { status, busy, enable, disable };
}
