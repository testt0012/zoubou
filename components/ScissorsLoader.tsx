import type { CSSProperties } from "react";

// A pair of scissors snipping through a lock of hair, clippings falling —
// pure SVG and CSS (see globals.css), so it animates before any script has
// loaded. Colours follow the brand: purple handles, pink screw.
const CLIPPINGS: { d: string; dx: string; rot: string; delay: string }[] = [
  { d: "M124 37 q4 -4 9 0", dx: "-10px", rot: "-50deg", delay: "0s" },
  { d: "M130 45 q4 -4 9 0", dx: "6px", rot: "40deg", delay: "0.25s" },
  { d: "M122 52 q4 -4 9 0", dx: "-4px", rot: "-30deg", delay: "0.5s" },
  { d: "M134 40 q4 -4 9 0", dx: "12px", rot: "60deg", delay: "0.75s" },
  { d: "M127 48 q4 -4 9 0", dx: "-14px", rot: "-70deg", delay: "1s" },
];

// The svg has overflow visible: the handles swing outside the box when the
// blades open and the clippings fall below it.
export default function ScissorsLoader({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 90" fill="none" overflow="visible" className={className} role="img" aria-label="Φόρτωση">
      {/* the lock of hair being cut */}
      <g stroke="#262626" strokeWidth="3" strokeLinecap="round">
        <path d="M118 38 C132 34 146 42 160 38 S184 34 198 38" />
        <path d="M118 45 C132 41 146 49 160 45 S184 41 198 45" />
        <path d="M118 52 C132 48 146 56 160 52 S184 48 198 52" />
      </g>

      {/* cut-off pieces falling */}
      <g stroke="#262626" strokeWidth="3" strokeLinecap="round">
        {CLIPPINGS.map((c) => (
          <path
            key={c.d}
            d={c.d}
            className="hair-clip"
            style={{ "--dx": c.dx, "--rot": c.rot, animationDelay: c.delay } as CSSProperties}
          />
        ))}
      </g>

      {/* the two halves of the scissors, each a blade plus the handle on the far side of the screw */}
      <g className="scissors-a">
        <path d="M56 41 L118 45 L56 49 Z" fill="#e4e4e7" stroke="#52525b" strokeWidth="2" strokeLinejoin="round" />
        <path d="M56 45 L30 62" stroke="#6d28d9" strokeWidth="6" strokeLinecap="round" />
        <circle cx="23" cy="67" r="12" stroke="#6d28d9" strokeWidth="6" />
      </g>
      <g className="scissors-b">
        <path d="M56 41 L118 45 L56 49 Z" fill="#d4d4d8" stroke="#52525b" strokeWidth="2" strokeLinejoin="round" />
        <path d="M56 45 L30 28" stroke="#6d28d9" strokeWidth="6" strokeLinecap="round" />
        <circle cx="23" cy="23" r="12" stroke="#6d28d9" strokeWidth="6" />
      </g>
      <circle cx="56" cy="45" r="5" fill="#e6198f" stroke="#831843" strokeWidth="2" />
    </svg>
  );
}
