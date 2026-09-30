"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, formatDateLong, formatDateShort, startOfWeek, todayAthens, weekdayLabel, weekdayOf } from "@/lib/time";

// Seven days are in view at a time.
const VISIBLE_DAYS = 7;
// Without an upper limit (the admin) the strip reaches this far ahead.
const DEFAULT_WEEKS_AHEAD = 52;
const DAY_MS = 24 * 60 * 60 * 1000;

function availabilityText(info: { open: boolean; count: number }): string {
  if (!info.open) return "Κλειστά";
  return info.count === 1 ? "1 ραντεβού διαθέσιμο" : `${info.count} ραντεβού διαθέσιμα`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
}

// Picks a day from a row of days that scrolls sideways under the finger and
// settles on a day (scroll-snap), with arrows that move a week at a time. Used
// by both the customers' booking screens and the admin. The row starts at
// `minDate` (today) so there's nothing to scroll back through.
export default function WeekPicker({
  value,
  onChange,
  minDate,
  maxDate,
  availableDates,
  dayInfo,
  hideLabel = false,
}: {
  value: string;
  onChange: (date: string) => void;
  // Earlier / later days aren't shown at all (the row starts and ends there).
  minDate?: string;
  maxDate?: string;
  // When given (and no `dayInfo`), only these days can be picked — every other
  // day is greyed out. Null/undefined: no such restriction (e.g. while loading).
  availableDates?: ReadonlySet<string> | null;
  // When given, each day shows how many free times it has — "—" if the shop
  // isn't open that day (greyed out, can't be picked), "0" if it's open but
  // full (can be picked to read "0 ραντεβού διαθέσιμα") — and so does the
  // line under the strip.
  dayInfo?: Readonly<Record<string, { open: boolean; count: number }>> | null;
  // The chosen day is also written out under the strip unless this is set.
  hideLabel?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const first = minDate ?? startOfWeek(value || todayAthens());
  const lastBookable = maxDate ?? addDays(first, DEFAULT_WEEKS_AHEAD * 7 - 1);
  // A chosen day beyond the limit is still reachable.
  const last = value && value > lastBookable ? value : lastBookable;
  const days = useMemo(
    () => Array.from({ length: daysBetween(first, last) + 1 }, (_, i) => addDays(first, i)),
    [first, last]
  );

  const [firstVisible, setFirstVisible] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const cellWidth = () => (scroller.current?.clientWidth ?? 0) / VISIBLE_DAYS;

  const syncFromScroll = useCallback(() => {
    const el = scroller.current;
    if (!el || !el.clientWidth) return;
    setFirstVisible(Math.max(0, Math.round(el.scrollLeft / (el.clientWidth / VISIBLE_DAYS))));
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  // Start with the chosen day in view: from the beginning, unless it's further on.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) {
      const index = value ? daysBetween(first, value) : 0;
      el.scrollLeft = index > VISIBLE_DAYS - 1 ? index * cellWidth() : 0;
    }
    syncFromScroll();
    // Only on mount: later changes of the chosen day are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the chosen day changes from outside (e.g. the booking screen jumping
  // to the first day with free times) bring it into view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !value || !el.clientWidth) return;
    const index = daysBetween(first, value);
    const cell = el.clientWidth / VISIBLE_DAYS;
    const left = Math.round(el.scrollLeft / cell);
    if (index < left || index > left + VISIBLE_DAYS - 1) {
      el.scrollTo({ left: Math.min(index, days.length - VISIBLE_DAYS) * cell, behavior: "smooth" });
    }
  }, [value, first, days.length]);

  function scrollByWeek(direction: 1 | -1) {
    scroller.current?.scrollBy({ left: direction * VISIBLE_DAYS * cellWidth(), behavior: "smooth" });
  }

  const visibleStart = days[Math.min(firstVisible, days.length - 1)];
  const visibleEnd = days[Math.min(firstVisible + VISIBLE_DAYS - 1, days.length - 1)];

  return (
    // The row scrolls itself; a drag inside it must not also flip the admin's tabs.
    <div data-no-swipe data-week-picker>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => scrollByWeek(-1)}
          disabled={atStart}
          aria-label="Προηγούμενη εβδομάδα"
          className="w-11 h-11 rounded-full text-xl text-neutral-500 disabled:opacity-30 hover:bg-neutral-100"
        >
          ‹
        </button>
        <div className="text-sm font-medium">
          {formatDateShort(visibleStart)} – {formatDateShort(visibleEnd)}
        </div>
        <button
          type="button"
          onClick={() => scrollByWeek(1)}
          disabled={atEnd}
          aria-label="Επόμενη εβδομάδα"
          className="w-11 h-11 rounded-full text-xl text-neutral-500 disabled:opacity-30 hover:bg-neutral-100"
        >
          ›
        </button>
      </div>

      <div
        ref={scroller}
        onScroll={syncFromScroll}
        role="group"
        aria-label="Επιλογή ημέρας"
        className="no-scrollbar flex overflow-x-auto overscroll-x-contain snap-x snap-mandatory"
      >
        {days.map((date) => {
          const selected = date === value;
          const info = dayInfo?.[date];
          // With per-day info, a day is pickable whenever the shop is open —
          // a full day can be tapped to read "0 ραντεβού διαθέσιμα". Without it,
          // `availableDates` (if given) decides.
          const disabled = dayInfo ? !info?.open : !!availableDates && !availableDates.has(date);
          return (
            <div key={date} className="flex-none snap-start px-0.5" style={{ width: `${100 / VISIBLE_DAYS}%` }}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={formatDateLong(date)}
                onClick={() => onChange(date)}
                className={`${dayInfo ? "h-[72px]" : "h-16"} w-full rounded-lg border flex flex-col items-center justify-center gap-0.5 ${
                  selected
                    ? "border-brand-purple bg-brand-purple text-white"
                    : disabled
                      ? "border-neutral-100 text-neutral-300"
                      : "border-neutral-200 text-neutral-800 hover:border-neutral-300"
                }`}
              >
                <span className={`text-[11px] ${selected ? "text-white/80" : disabled ? "" : "text-neutral-500"}`}>
                  {weekdayLabel(weekdayOf(date)).slice(0, 2)}
                </span>
                <span className="text-base font-semibold">{date.slice(8, 10)}</span>
                {info && (
                  <span className={`text-[11px] font-medium ${selected ? "text-white/90" : disabled ? "" : "text-brand-purple"}`}>
                    {info.open ? info.count : "—"}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {value && !hideLabel && (
        <p className="mt-2 text-sm text-neutral-500">
          {formatDateLong(value)}
          {dayInfo?.[value] && <> · {availabilityText(dayInfo[value])}</>}
        </p>
      )}
    </div>
  );
}
