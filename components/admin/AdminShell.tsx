"use client";

import { useRef } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/admin/BottomNav";
import RealtimeRefresh from "@/components/admin/RealtimeRefresh";
import { ADMIN_NAV } from "@/components/admin/adminNav";

const SWIPE_THRESHOLD_PX = 60;

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const touchStartX = useRef<number | null>(null);

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
      <RealtimeRefresh />
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
              className="h-9 w-auto"
            />
            <button
              onClick={handleLogout}
              className="text-sm text-neutral-400 hover:text-neutral-700 whitespace-nowrap"
            >
              Έξοδος
            </button>
          </div>
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
