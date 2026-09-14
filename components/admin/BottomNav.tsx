"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, transitionTypeBetween } from "@/components/admin/adminNav";

export default function BottomNav() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    ADMIN_NAV.findIndex((item) => item.href === pathname)
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto px-4">
        <div className="relative flex bg-brand-purple/90 backdrop-blur rounded-full p-1 shadow-lg shadow-black/25">
          <div
            aria-hidden="true"
            className="absolute inset-y-1 rounded-full bg-brand-pink transition-transform duration-300 ease-out"
            style={{
              width: `${100 / ADMIN_NAV.length}%`,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
          {ADMIN_NAV.map((item) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                transitionTypes={transitionTypeBetween(pathname, item.href)}
                className="relative z-10 flex-1 flex items-center justify-center py-3 rounded-full text-white transition-transform active:scale-95"
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
