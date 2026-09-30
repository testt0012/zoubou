"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_NAV } from "@/components/admin/adminNav";

// Press and hold on the bar, then slide the finger sideways: the highlight
// follows the finger from tab to tab and the tab under it opens when it is
// let go — the way Instagram's bottom bar works. A plain tap still just opens
// the tab.
const HOLD_MS = 100;
// A finger that has moved this far before the hold is up is doing something
// else (a scroll, a swipe that started on the bar) — no slide starts.
const MOVE_TOLERANCE_PX = 10;
// The bar's own padding (Tailwind p-1.5) around the tabs.
const BAR_PADDING_PX = 6;

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    ADMIN_NAV.findIndex((item) => item.href === pathname)
  );

  const bar = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const scrubbing = useRef(false);
  // A slide ends with the finger lifted over a tab, which the browser can
  // still report as a click on it; that click is swallowed.
  const swallowClick = useRef(false);
  // The tab the finger is over while sliding (null when not sliding).
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const shownIndex = scrubIndex ?? activeIndex;

  function indexAt(clientX: number): number {
    const rect = bar.current!.getBoundingClientRect();
    const slot = (rect.width - BAR_PADDING_PX * 2) / ADMIN_NAV.length;
    const index = Math.floor((clientX - rect.left - BAR_PADDING_PX) / slot);
    return Math.min(ADMIN_NAV.length - 1, Math.max(0, index));
  }

  function clearHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    clearHold();
    holdTimer.current = setTimeout(() => {
      const origin = start.current;
      if (!origin || !bar.current) return;
      scrubbing.current = true;
      // Keep receiving the finger's moves even when it leaves the bar.
      bar.current.setPointerCapture(origin.pointerId);
      setScrubIndex(indexAt(origin.x));
      navigator.vibrate?.(8);
    }, HOLD_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const origin = start.current;
    if (!origin) return;

    if (!scrubbing.current) {
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > MOVE_TOLERANCE_PX) {
        clearHold();
        start.current = null;
      }
      return;
    }

    const index = indexAt(e.clientX);
    if (index !== scrubIndex) {
      setScrubIndex(index);
      navigator.vibrate?.(6);
    }
  }

  function finish(e: React.PointerEvent, commit: boolean) {
    clearHold();
    const wasScrubbing = scrubbing.current;
    scrubbing.current = false;
    start.current = null;
    if (!wasScrubbing) return;

    if (bar.current?.hasPointerCapture(e.pointerId)) bar.current.releasePointerCapture(e.pointerId);
    swallowClick.current = true;
    setTimeout(() => {
      swallowClick.current = false;
    }, 400);

    const target = commit ? indexAt(e.clientX) : activeIndex;
    setScrubIndex(null);
    if (target !== activeIndex) router.push(ADMIN_NAV[target].href);
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
      <div className="max-w-3xl mx-auto px-4 flex justify-center">
        {/* The name of the tab the finger is over, while sliding. */}
        {scrubIndex !== null && (
          <div
            aria-hidden="true"
            className="absolute -top-9 rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white"
          >
            {ADMIN_NAV[scrubIndex].label}
          </div>
        )}
        <div
          ref={bar}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => finish(e, true)}
          onPointerCancel={(e) => finish(e, false)}
          onContextMenu={(e) => e.preventDefault()}
          onClickCapture={(e) => {
            if (swallowClick.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          className={`relative flex w-full max-w-[320px] bg-brand-purple/55 backdrop-blur rounded-full p-1.5 shadow-lg shadow-black/25 select-none touch-none [-webkit-touch-callout:none] transition-transform duration-200 ${
            scrubIndex !== null ? "scale-[1.04]" : "scale-100"
          }`}
        >
          <div
            aria-hidden="true"
            className={`absolute inset-y-1.5 left-1.5 rounded-full bg-brand-pink transition-transform ease-out ${
              scrubIndex !== null ? "duration-150" : "duration-300"
            }`}
            style={{
              // Widths/left here must match the flex items' *content* box
              // (padding-box minus the container's own padding), not the
              // container's full padding-box — using a plain "100%" for
              // width made the indicator ~3px too wide per slot, drifting
              // further off the actual icon with every tab to the right.
              width: `calc((100% - 0.75rem) / ${ADMIN_NAV.length})`,
              transform: `translateX(${shownIndex * 100}%)`,
            }}
          />
          {ADMIN_NAV.map((item, i) => {
            const Icon = item.Icon;
            const active = i === shownIndex;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                draggable={false}
                className={`relative z-10 flex-1 flex items-center justify-center py-3 rounded-full text-white transition-transform active:scale-95 ${
                  active ? "scale-110" : "scale-100"
                }`}
              >
                <Icon />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
