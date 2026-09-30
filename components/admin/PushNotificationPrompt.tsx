"use client";

import { useEffect, useState } from "react";
import { PUSH_DISMISSED_KEY, type AdminPushStatus } from "@/components/admin/useAdminPush";

interface Props {
  status: AdminPushStatus | null;
  busy: boolean;
  onEnable: () => void;
}

// Small opt-in banner for "new booking" alerts. Only ever shown when push
// is actually usable (unsupported entirely in a plain Safari tab on iOS —
// see lib/push/client.ts) and is currently off. Closing it only hides the
// banner: the bell in the header stays as the way to turn alerts on later.
export default function PushNotificationPrompt({ status, busy, onEnable }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    Promise.resolve().then(() => {
      setDismissed(!!localStorage.getItem(PUSH_DISMISSED_KEY));
    });
  }, [status]);

  function handleDismiss() {
    localStorage.setItem(PUSH_DISMISSED_KEY, "1");
    setDismissed(true);
  }

  if (status !== "off" || dismissed) return null;

  return (
    <div className="rounded-lg bg-brand-pink-light px-4 py-3 mb-4 flex items-center gap-3 text-sm">
      <span className="flex-1">Ενεργοποίησε ειδοποιήσεις για νέα ραντεβού.</span>
      <button
        type="button"
        onClick={onEnable}
        disabled={busy}
        className="shrink-0 bg-brand-purple text-white rounded-md px-3 py-1.5 font-medium disabled:opacity-60"
      >
        {busy ? "…" : "Ενεργοποίηση"}
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
