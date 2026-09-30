"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ScissorsLoader from "@/components/ScissorsLoader";

// How long the screen stays at least, so the animation is seen rather than
// flashing past when everything is already fast.
const MIN_VISIBLE_MS = 900;
const FADE_MS = 350;

// The first thing a visitor sees: the logo with the scissors cutting hair,
// until the app has loaded. It is part of the page itself (server-rendered),
// so it is on screen as soon as the HTML arrives — before any script — and is
// removed once the app has started. Only on a full page load: moving between
// screens inside the app doesn't bring it back.
export default function SplashScreen() {
  // The customer screens are dark, the admin is light.
  const dark = !usePathname().startsWith("/admin");
  const [phase, setPhase] = useState<"shown" | "fading" | "gone">("shown");

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // performance.now() counts from the start of the page load, so slow loads
    // that have already taken longer than the minimum don't wait any more.
    const wait = reduceMotion ? 0 : Math.max(0, MIN_VISIBLE_MS - performance.now());
    const fade = setTimeout(() => setPhase("fading"), wait);
    const gone = setTimeout(() => setPhase("gone"), wait + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={phase === "fading"}
      data-splash
      style={{ transitionDuration: `${FADE_MS}ms` }}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 px-8 ${dark ? "bg-black" : "bg-white"} transition-opacity ${
        phase === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <Image
        src={dark ? "/logo-dark-720.webp" : "/logo-720.webp"}
        unoptimized
        alt="Zoubou"
        width={900}
        height={300}
        priority
        className="w-full max-w-[420px] h-auto"
      />
      <ScissorsLoader
        className={`w-44 h-auto ${dark ? "[&_[stroke='#262626']]:stroke-neutral-200" : ""}`}
      />
      <span className="sr-only">Φόρτωση…</span>
    </div>
  );
}
