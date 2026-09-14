"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "@/components/admin/adminNav";

// Plays a directional slide-in animation on the incoming tab's content.
//
// This used to be React's built-in <ViewTransition> (matching old and new
// page snapshots and animating between them), but Safari's implementation
// of the underlying View Transitions API renders it broken on real
// iPhones: the old tab's content stays visible, overlapping the new one,
// for a chunk of the animation. Chromium doesn't show the bug, which is
// why it slipped through earlier testing.
//
// A plain CSS mount animation sidesteps the whole class of bug: there's
// only ever one page's content in the DOM (React unmounts the old one
// before the new one mounts, as normal), so there's nothing for a stale
// snapshot to overlap.
export default function SlideTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [direction, setDirection] = useState<"forward" | "back" | null>(null);

  // Deriving state from a prop change during render — see
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (prevPathname !== pathname) {
    const prevIndex = ADMIN_NAV.findIndex((item) => item.href === prevPathname);
    const currentIndex = ADMIN_NAV.findIndex((item) => item.href === pathname);
    setDirection(
      prevIndex !== -1 && currentIndex !== -1 && currentIndex !== prevIndex
        ? currentIndex > prevIndex
          ? "forward"
          : "back"
        : null
    );
    setPrevPathname(pathname);
  }

  return (
    <div key={pathname} className={direction ? `admin-slide-${direction}` : undefined}>
      {children}
    </div>
  );
}
