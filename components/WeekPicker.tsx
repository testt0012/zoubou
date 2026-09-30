"use client";

import { useRef, useState } from "react";
import {
  addDays,
  formatDateLong,
  formatDateShort,
  startOfWeek,
  todayAthens,
  weekdayLabel,
  weekdayOf,
} from "@/lib/time";

const SWIPE_THRESHOLD_PX = 50;

function availabilityText(info: { open: boolean; count: number }): string {
  if (!info.open) return "Κλειστά";
  return info.count === 1 ? "1 ραντεβού διαθέσιμο" : `${info.count} ραντεβού διαθέσιμα`;
}

// Picks a day one week at a time: a row of seven days (Monday to Sunday)
// with arrows — or a swipe — to move to the next or previous week. Meant for
// placing appointments, which are nearly always within the next few days,
// where a whole month grid is more than needed. Used by both the customers'
// booking screens and the admin.
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
  // Earlier / later days can't be picked (nor can the strip page past them).
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
  const firstWeek = startOfWeek(minDate && minDate > (value || "") ? minDate : value || minDate || todayAthens());
  const [weekStart, setWeekStart] = useState(firstWeek);
  const [direction, setDirection] = useState<1 | -1 | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // The week shown follows the chosen day when that changes from outside.
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    if (value && startOfWeek(value) !== weekStart) setWeekStart(startOfWeek(value));
  }

  const earliestWeek = minDate ? startOfWeek(minDate) : null;
  const canGoBack = !earliestWeek || weekStart > earliestWeek;
  const canGoForward = !maxDate || addDays(weekStart, 7) <= maxDate;
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function changeWeek(delta: 1 | -1) {
    if (delta === -1 && !canGoBack) return;
    if (delta === 1 && !canGoForward) return;
    setDirection(delta);
    setWeekStart(addDays(weekStart, delta * 7));
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  // Swipe left for the next week, right for the previous one — only a clearly
  // horizontal drag counts, so scrolling the page still works.
  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const deltaX = e.changedTouches[0].clientX - start.x;
    const deltaY = e.changedTouches[0].clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
    changeWeek(deltaX < 0 ? 1 : -1);
  }

  return (
    <div data-no-swipe onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="touch-pan-y overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => changeWeek(-1)}
          disabled={!canGoBack}
          aria-label="Προηγούμενη εβδομάδα"
          className="w-11 h-11 rounded-full text-xl text-neutral-500 disabled:opacity-30 hover:bg-neutral-100"
        >
          ‹
        </button>
        <div className="text-sm font-medium">
          {formatDateShort(weekStart)} – {formatDateShort(addDays(weekStart, 6))}
        </div>
        <button
          type="button"
          onClick={() => changeWeek(1)}
          disabled={!canGoForward}
          aria-label="Επόμενη εβδομάδα"
          className="w-11 h-11 rounded-full text-xl text-neutral-500 disabled:opacity-30 hover:bg-neutral-100"
        >
          ›
        </button>
      </div>

      <div
        key={weekStart}
        className={`grid grid-cols-7 gap-1 ${
          direction === null ? "" : direction === 1 ? "calendar-slide-next" : "calendar-slide-prev"
        }`}
      >
        {days.map((date) => {
          const selected = date === value;
          const info = dayInfo?.[date];
          // With per-day info, a day is pickable whenever the shop is open —
          // a full day can be tapped to read "0 ραντεβού διαθέσιμα". Without it,
          // `availableDates` (if given) decides.
          const disabled =
            (!!minDate && date < minDate) ||
            (!!maxDate && date > maxDate) ||
            (dayInfo ? !info?.open : !!availableDates && !availableDates.has(date));
          return (
            <button
              type="button"
              key={date}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={formatDateLong(date)}
              onClick={() => onChange(date)}
              className={`${dayInfo ? "h-[72px]" : "h-16"} rounded-lg border flex flex-col items-center justify-center gap-0.5 ${
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
