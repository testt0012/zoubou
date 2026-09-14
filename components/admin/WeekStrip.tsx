"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { addDays } from "@/lib/time";

const SWIPE_THRESHOLD_PX = 40;

// Swipe left/right directly on the 7-day strip to page between weeks —
// separate from AdminShell's swipe (which switches admin tabs). Stops the
// touch events from bubbling up to that outer handler so a single swipe
// gesture here doesn't also trigger a tab change.
export default function WeekStrip({
  weekStart,
  canGoPrevWeek,
  children,
}: {
  weekStart: string;
  canGoPrevWeek: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const touchStartX = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    e.stopPropagation();
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    e.stopPropagation();
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null) return;

    const deltaX = e.changedTouches[0].clientX - startX;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;

    if (deltaX < 0) {
      router.push(`/admin/dashboard?weekStart=${addDays(weekStart, 7)}`);
    } else if (canGoPrevWeek) {
      router.push(`/admin/dashboard?weekStart=${addDays(weekStart, -7)}`);
    }
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {children}
    </div>
  );
}
