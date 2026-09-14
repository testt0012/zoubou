import type { PushSubscriptionJSON } from "@/types/database";

// Web Push's applicationServerKey wants the VAPID public key as raw bytes,
// not the base64url string it's distributed as.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Push (like Notification) is unsupported in a plain Safari tab on iOS —
// it only exists there once the site has been added to the Home Screen
// (iOS 16.4+). Callers should hide any "enable notifications" UI entirely
// when this is false rather than show a button that can't work.
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Prompts for permission (must be called from a user gesture) and returns
// the browser's push subscription, or null if unsupported/denied.
export async function subscribeToPush(): Promise<PushSubscriptionJSON | null> {
  if (!isPushSupported()) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
  }
  return subscription.toJSON() as PushSubscriptionJSON;
}
