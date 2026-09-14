"use client";

import { useEffect, useState } from "react";
import { isPushSupported, subscribeToPush } from "@/lib/push/client";
import { subscribeAdminPush } from "@/lib/actions/push";

const DISMISSED_KEY = "zoubou-admin-push-dismissed";

// Small opt-in banner for "new booking" alerts. Only ever shown when push
// is actually usable (unsupported entirely in a plain Safari tab on iOS —
// see lib/push/client.ts) and permission hasn't already been decided.
export default function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (!isPushSupported()) return;
      if (localStorage.getItem(DISMISSED_KEY)) return;
      if (Notification.permission !== "default") return;
      setVisible(true);
    });
  }, []);

  async function handleEnable() {
    setSubscribing(true);
    const subscription = await subscribeToPush();
    if (subscription) {
      await subscribeAdminPush(subscription);
    }
    setVisible(false);
    setSubscribing(false);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="rounded-lg bg-brand-pink-light px-4 py-3 mb-4 flex items-center gap-3 text-sm">
      <span className="flex-1">Ενεργοποίησε ειδοποιήσεις για νέα ραντεβού.</span>
      <button
        type="button"
        onClick={handleEnable}
        disabled={subscribing}
        className="shrink-0 bg-brand-purple text-white rounded-md px-3 py-1.5 font-medium disabled:opacity-60"
      >
        {subscribing ? "…" : "Ενεργοποίηση"}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Κλείσιμο"
        className="shrink-0 text-neutral-400 text-lg leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}
