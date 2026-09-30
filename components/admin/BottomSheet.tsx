"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  onClose: () => void;
  // Shows a "Τέλος" button on the right of the header when given.
  onDone?: () => void;
  children: React.ReactNode;
}

function stopPropagation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

// A panel that slides up from the bottom edge over a dimmed page, the way
// the phone's own pickers do. Rendered into <body> so no animated/clipped
// ancestor can trap it.
export default function BottomSheet({ title, onClose, onDone, children }: Props) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    // React events bubble through a portal to its React ancestors — stopped
    // here so dragging inside the sheet can't trigger the admin shell's
    // swipe-between-tabs handler.
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onTouchStart={stopPropagation}
      onTouchEnd={stopPropagation}
    >
      <div className="absolute inset-0 bg-black/40 sheet-fade" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-up relative w-full sm:max-w-md bg-white rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-14">
          <button type="button" onClick={onClose} className="justify-self-start h-12 pr-4 text-neutral-500">
            Άκυρο
          </button>
          <div className="font-semibold">{title}</div>
          {onDone && (
            <button
              type="button"
              onClick={onDone}
              className="justify-self-end h-12 pl-4 font-semibold text-brand-purple"
            >
              Τέλος
            </button>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
