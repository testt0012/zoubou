function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function ScissorsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8.1 7.5 20 18M20 6 8.1 16.5" />
    </svg>
  );
}

export const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "Ραντεβού", Icon: CalendarIcon },
  { href: "/admin/reports", label: "Αναφορές", Icon: ReportsIcon },
  { href: "/admin/availability", label: "Διαθεσιμότητα", Icon: ClockIcon },
  { href: "/admin/services", label: "Υπηρεσίες", Icon: ScissorsIcon },
] as const;

export type NavTransitionType = "nav-forward" | "nav-back";

// Which directional slide to tag a navigation with, comparing tab order —
// moving right through the tabs slides content in from the right
// ("forward"), moving left slides back in from the left.
export function transitionTypeBetween(fromHref: string, toHref: string): [NavTransitionType] | undefined {
  const fromIndex = ADMIN_NAV.findIndex((item) => item.href === fromHref);
  const toIndex = ADMIN_NAV.findIndex((item) => item.href === toHref);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return undefined;
  return [toIndex > fromIndex ? "nav-forward" : "nav-back"];
}
