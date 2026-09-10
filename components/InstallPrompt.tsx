"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "zoubou-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return;

    if (isIOS()) {
      Promise.resolve().then(() => {
        setPlatform("ios");
        setVisible(true);
      });
      return;
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-sm rounded-xl bg-white shadow-lg shadow-black/25 border border-neutral-200 px-4 py-3 flex items-center gap-3">
      <div className="flex-1 text-sm">
        {platform === "ios" ? (
          <p>
            Προσθέστε το Zoubou στην αρχική οθόνη: πατήστε{" "}
            <span className="font-medium">Κοινοποίηση</span>{" "}
            <span aria-hidden="true">⬆️</span> και μετά{" "}
            <span className="font-medium">«Προσθήκη στην Αρχική Οθόνη»</span>.
          </p>
        ) : (
          <p>Εγκαταστήστε το Zoubou στο κινητό σας για γρήγορη πρόσβαση.</p>
        )}
      </div>
      {platform === "android" && (
        <button
          onClick={handleInstallClick}
          className="shrink-0 bg-brand-purple text-white text-sm font-medium rounded-md px-3 py-2"
        >
          Εγκατάσταση
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Κλείσιμο"
        className="shrink-0 text-neutral-400 text-lg leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}
