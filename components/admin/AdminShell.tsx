"use client";

import { useRef } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/admin/BottomNav";
import PushNotificationPrompt from "@/components/admin/PushNotificationPrompt";
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

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const touchStartX = useRef<number | null>(null);
  const { loading } = useAdminData();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  function handleTouchStart(e: React.TouchEvent) {
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
            <button
              onClick={handleLogout}
              aria-label="Έξοδος"
              title="Έξοδος"
              className="flex items-center justify-center w-9 h-9 rounded-md text-neutral-400 hover:text-neutral-700"
            >
              <LogoutIcon />
            </button>
          </div>
          {loading ? (
            <div className="py-16 text-center text-neutral-400 text-sm">Φόρτωση δεδομένων…</div>
          ) : (
            <>
              <PushNotificationPrompt />
              {children}
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
