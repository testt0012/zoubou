"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function ScissorsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8.1 7.5 20 18M20 6 8.1 16.5" />
    </svg>
  );
}

const NAV = [
  { href: "/admin/dashboard", label: "Ραντεβού", Icon: CalendarIcon },
  { href: "/admin/reports", label: "Αναφορές", Icon: ReportsIcon },
  { href: "/admin/availability", label: "Διαθεσιμότητα", Icon: ClockIcon },
  { href: "/admin/services", label: "Υπηρεσίες", Icon: ScissorsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    NAV.findIndex((item) => item.href === pathname)
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto px-4">
        <div className="relative flex bg-brand-purple/10 backdrop-blur rounded-full p-1 shadow-lg shadow-black/15">
          <div
            aria-hidden="true"
            className="absolute inset-y-1 rounded-full bg-brand-pink transition-transform duration-300 ease-out"
            style={{
              width: `${100 / NAV.length}%`,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
          {NAV.map((item, i) => {
            const active = i === activeIndex;
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={`relative z-10 flex-1 flex items-center justify-center py-3 rounded-full transition-all active:scale-95 ${
                  active ? "text-white" : "text-brand-purple"
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
