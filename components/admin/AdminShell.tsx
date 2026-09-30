"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AccountSheet from "@/components/admin/AccountSheet";
import BottomNav from "@/components/admin/BottomNav";
import PushNotificationPrompt from "@/components/admin/PushNotificationPrompt";
import { useAdminPush, type AdminPushStatus } from "@/components/admin/useAdminPush";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { ADMIN_NAV } from "@/components/admin/adminNav";

const SWIPE_THRESHOLD_PX = 60;

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function BellIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

// The browser only ever shows its permission prompt once. After a refusal
// the app can't ask again, so the best the bell can do is say where to
// switch it back on.
const PUSH_MESSAGES: Record<AdminPushStatus, string> = {
  on: "Οι ειδοποιήσεις για νέα ραντεβού ενεργοποιήθηκαν.",
  off: "Οι ειδοποιήσεις για νέα ραντεβού απενεργοποιήθηκαν.",
  denied:
    "Οι ειδοποιήσεις είναι μπλοκαρισμένες από το κινητό. Άνοιξε Ρυθμίσεις → Ειδοποιήσεις → Zoubou, επίτρεψέ τες και πάτησε ξανά το καμπανάκι.",
  unsupported: "",
};

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const touchStartX = useRef<number | null>(null);
  const { loading } = useAdminData();
  const push = useAdminPush();
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  async function handlePushEnable() {
    setPushMessage(PUSH_MESSAGES[await push.enable()]);
  }

  async function handleBellClick() {
    if (push.status === "on") setPushMessage(PUSH_MESSAGES[await push.disable()]);
    else await handlePushEnable();
  }

  const pushUsable = push.status !== null && push.status !== "unsupported";
  const pushLabel = push.status === "on" ? "Απενεργοποίηση ειδοποιήσεων" : "Ενεργοποίηση ειδοποιήσεων";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  function handleTouchStart(e: React.TouchEvent) {
    // A drag that starts inside a pop-up or a swipeable control (the week
    // strip, the calendar, the time wheels) belongs to that control and
    // must not also flip the tab underneath.
    if ((e.target as Element).closest("[data-no-swipe]")) {
      touchStartX.current = null;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
  }

  // Swipe left/right between tabs, Instagram-tabs style — same directional
  // slide as tapping the bottom nav, just triggered by a horizontal drag
  // instead of a tap. Only reacts to the net start->end distance, so it
  // never fights vertical scrolling or normal taps on buttons/links inside.
  function handleTouchEnd(e: React.TouchEvent) {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null) return;

    const deltaX = e.changedTouches[0].clientX - startX;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;

    const currentIndex = ADMIN_NAV.findIndex((item) => item.href === pathname);
    if (currentIndex === -1) return;

    const target = ADMIN_NAV[deltaX < 0 ? currentIndex + 1 : currentIndex - 1];
    if (!target) return;

    router.push(target.href);
  }

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-6 pb-28">
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="bg-white rounded-2xl shadow-lg shadow-black/20 px-4 py-6 sm:px-6"
        >
          <div className="flex items-center justify-between mb-6">
            <Image
              src="/logo.png"
              alt="Zoubou"
              width={900}
              height={300}
              className="h-12 w-auto"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAccountOpen(true)}
                aria-label="Λογαριασμός"
                title="Λογαριασμός"
                className="flex items-center justify-center w-9 h-9 rounded-md text-neutral-400 hover:text-neutral-700"
              >
                <UserIcon />
              </button>
              {pushUsable && (
                <button
                  onClick={handleBellClick}
                  disabled={push.busy}
                  aria-label={pushLabel}
                  aria-pressed={push.status === "on"}
                  title={pushLabel}
                  className={`flex items-center justify-center w-9 h-9 rounded-md disabled:opacity-60 ${
                    push.status === "on" ? "text-brand-purple" : "text-neutral-400 hover:text-neutral-700"
                  }`}
                >
                  <BellIcon off={push.status !== "on"} />
                </button>
              )}
              <button
                onClick={handleLogout}
                aria-label="Έξοδος"
                title="Έξοδος"
                className="flex items-center justify-center w-9 h-9 rounded-md text-neutral-400 hover:text-neutral-700"
              >
                <LogoutIcon />
              </button>
            </div>
          </div>
          {pushMessage && (
            <div className="rounded-lg bg-neutral-100 px-4 py-3 mb-4 flex items-start gap-3 text-sm text-neutral-700">
              <span className="flex-1">{pushMessage}</span>
              <button
                type="button"
                onClick={() => setPushMessage(null)}
                aria-label="Κλείσιμο"
                className="shrink-0 text-neutral-400 text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
          )}
          {loading ? (
            <div className="py-16 text-center text-neutral-400 text-sm">Φόρτωση δεδομένων…</div>
          ) : (
            <>
              <PushNotificationPrompt status={push.status} busy={push.busy} onEnable={handlePushEnable} />
              {children}
            </>
          )}
        </div>
      </main>
      {accountOpen && <AccountSheet onClose={() => setAccountOpen(false)} />}
      <BottomNav />
    </div>
  );
}
