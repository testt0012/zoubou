"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import BottomSheet from "@/components/admin/BottomSheet";
import { minutesToTime, timeToMinutes } from "@/lib/time";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const SETTLE_MS = 120;
const LAST_MINUTE = 24 * 60 - 1;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

interface WheelProps {
  label: string;
  values: number[];
  value: number;
  isDisabled: (value: number) => boolean;
  // Called once scrolling comes to rest. Returns the value actually
  // accepted, so the wheel can roll back when the pick wasn't allowed.
  onSettle: (value: number) => number;
}

// One scrolling column: the row resting in the middle band is the value.
function Wheel({ label, values, value, isDisabled, onSettle }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = values.indexOf(value);

  function scrollToIndex(i: number, behavior: ScrollBehavior) {
    ref.current?.scrollTo({ top: i * ITEM_HEIGHT, behavior });
  }

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = values.indexOf(value) * ITEM_HEIGHT;
    // Only on mount: afterwards the effect below follows value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The value can change from outside the wheel (the other column pushing
  // it back inside the allowed range) — roll to wherever it now is.
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ITEM_HEIGHT) !== index) scrollToIndex(index, "smooth");
  }, [index]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function handleScroll() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_HEIGHT)));
      const accepted = values.indexOf(onSettle(values[i]));
      if (accepted !== i) scrollToIndex(accepted, "smooth");
    }, SETTLE_MS);
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      aria-label={label}
      className="no-scrollbar relative w-24 overflow-y-scroll overscroll-contain snap-y snap-mandatory"
      style={{
        height: ITEM_HEIGHT * VISIBLE_ITEMS,
        paddingBlock: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
        maskImage: "linear-gradient(transparent, black 35%, black 65%, transparent)",
      }}
    >
      {values.map((v, i) => (
        <button
          type="button"
          key={v}
          tabIndex={-1}
          onClick={() => scrollToIndex(i, "smooth")}
          className={`snap-center w-full flex items-center justify-center text-2xl tabular-nums ${
            isDisabled(v) ? "text-neutral-300" : "text-neutral-900"
          }`}
          style={{ height: ITEM_HEIGHT }}
        >
          {String(v).padStart(2, "0")}
        </button>
      ))}
    </div>
  );
}

interface TimePickerProps {
  value: string; // "HH:MM", or "" for none
  onChange: (value: string) => void;
  title: string;
  className?: string;
  // Makes "no time" a real choice, offered as a button with this label
  // (for an optional field); it's also what the field shows when empty.
  emptyLabel?: string;
  // Limits on what can be picked, as "HH:MM": `min`/`max` are inclusive,
  // `after`/`before` exclusive. Times outside them are greyed out, and a
  // wheel left on one rolls back to the nearest allowed time.
  min?: string;
  max?: string;
  after?: string;
  before?: string;
}

// A field that opens an iPhone-style time picker from the bottom of the
// screen: one wheel for the hour (00–23), one for the minutes (00–59).
export default function TimePicker({
  value,
  onChange,
  title,
  className,
  emptyLabel,
  min,
  max,
  after,
  before,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(0);

  const lowest = Math.max(min ? timeToMinutes(min) : 0, after ? timeToMinutes(after) + 1 : 0);
  const highest = Math.min(max ? timeToMinutes(max) : LAST_MINUTE, before ? timeToMinutes(before) - 1 : LAST_MINUTE);
  const clamp = (minutes: number) => Math.min(highest, Math.max(lowest, minutes));

  const hour = Math.floor(draft / 60);
  const minute = draft % 60;

  function handleOpen() {
    setDraft(clamp(value ? timeToMinutes(value) : 9 * 60));
    setOpen(true);
  }

  function settleHour(h: number): number {
    const next = clamp(h * 60 + minute);
    setDraft(next);
    return Math.floor(next / 60);
  }

  function settleMinute(m: number): number {
    const next = clamp(hour * 60 + m);
    setDraft(next);
    // Clamping may have moved the hour instead; this wheel keeps its pick
    // only if the hour stayed put.
    return next % 60;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`${className ?? ""} flex items-center text-left tabular-nums ${value ? "" : "text-neutral-400"}`}
      >
        {value || emptyLabel || "Ώρα"}
      </button>

      {open && (
        <BottomSheet
          title={title}
          onClose={() => setOpen(false)}
          onDone={() => {
            onChange(minutesToTime(draft));
            setOpen(false);
          }}
        >
          <div className="relative flex items-center justify-center gap-2 py-2">
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-lg bg-neutral-100"
              style={{ height: ITEM_HEIGHT }}
              aria-hidden="true"
            />
            <Wheel
              label="Ώρα"
              values={HOURS}
              value={hour}
              isDisabled={(h) => h * 60 + 59 < lowest || h * 60 > highest}
              onSettle={settleHour}
            />
            <span className="relative text-2xl text-neutral-900">:</span>
            <Wheel
              label="Λεπτά"
              values={MINUTES}
              value={minute}
              isDisabled={(m) => hour * 60 + m < lowest || hour * 60 + m > highest}
              onSettle={settleMinute}
            />
          </div>

          {emptyLabel && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-2 w-full h-12 rounded-lg border border-neutral-300 font-medium text-neutral-700"
            >
              {emptyLabel}
            </button>
          )}
        </BottomSheet>
      )}
    </>
  );
}
