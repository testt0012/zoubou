"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "@/components/admin/adminNav";

export default function BottomNav() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    ADMIN_NAV.findIndex((item) => item.href === pathname)
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
      <div className="max-w-3xl mx-auto px-4 flex justify-center">
        <div className="relative flex w-full max-w-[320px] bg-brand-purple/55 backdrop-blur rounded-full p-1.5 shadow-lg shadow-black/25">
          <div
            aria-hidden="true"
            className="absolute inset-y-1.5 left-1.5 rounded-full bg-brand-pink transition-transform duration-300 ease-out"
            style={{
              // Widths/left here must match the flex items' *content* box
              // (padding-box minus the container's own padding), not the
              // container's full padding-box — using a plain "100%" for
              // width made the indicator ~3px too wide per slot, drifting
              // further off the actual icon with every tab to the right.
              width: `calc((100% - 0.75rem) / ${ADMIN_NAV.length})`,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
          {ADMIN_NAV.map((item, i) => {
            const Icon = item.Icon;
            const active = i === activeIndex;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
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
