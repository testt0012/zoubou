"use client";

import { useRef, useState } from "react";
import { todayAthens } from "@/lib/time";

const WEEKDAY_HEADERS = ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateString(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseDateString(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

// Monday-first weekday index (0 = Monday ... 6 = Sunday) for the 1st of the month.
function firstWeekdayIndex(year: number, month: number) {
  const jsDay = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0 = Sunday
  return (jsDay + 6) % 7;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

const SWIPE_THRESHOLD_PX = 50;

interface CalendarProps {
  selectedDate: string;
  // Earlier days can't be picked. Left out, any date (past included) can.
  minDate?: string;
  onSelect: (date: string) => void;
}

export default function Calendar({ selectedDate, minDate, onSelect }: CalendarProps) {
  const initial = parseDateString(selectedDate || minDate || todayAthens());
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  // Which way the month last moved, so the new grid slides in from that
  // side (null until it first moves: the opening month just appears).
  const [direction, setDirection] = useState<1 | -1 | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const min = minDate ? parseDateString(minDate) : null;
  const minKey = min ? min.year * 12 + min.month : -Infinity;
  const viewKey = viewYear * 12 + viewMonth;

  const monthLabel = new Intl.DateTimeFormat("el-GR", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Athens",
  }).format(new Date(Date.UTC(viewYear, viewMonth, 1)));

  function changeMonth(delta: 1 | -1) {
    if (delta === -1 && viewKey <= minKey) return;
    setDirection(delta);
    let y = viewYear;
    let m = viewMonth + delta;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
  }

  const leading = firstWeekdayIndex(viewYear, viewMonth);
  const total = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(leading).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  function handleTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  // Swipe left for the next month, right for the previous one — same as the
  // arrows. Only a clearly horizontal drag counts, so scrolling the page
  // with a finger on the calendar still works.
  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;

    const deltaX = e.changedTouches[0].clientX - start.x;
    const deltaY = e.changedTouches[0].clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

    changeMonth(deltaX < 0 ? 1 : -1);
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="touch-pan-y overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          disabled={viewKey <= minKey}
          className="w-10 h-10 rounded-full text-xl text-neutral-500 disabled:opacity-30 hover:bg-neutral-100"
          aria-label="Προηγούμενος μήνας"
        >
          ‹
        </button>
        <div className="text-sm font-medium capitalize">{monthLabel}</div>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="w-10 h-10 rounded-full text-xl text-neutral-500 hover:bg-neutral-100"
          aria-label="Επόμενος μήνας"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-400 mb-1">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div
        key={viewKey}
        className={`grid grid-cols-7 gap-1 ${direction === null ? "" : direction === 1 ? "calendar-slide-next" : "calendar-slide-prev"}`}
      >
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;

          const dateStr = toDateString(viewYear, viewMonth, day);
          const disabled = !!minDate && dateStr < minDate;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              type="button"
              key={dateStr}
              disabled={disabled}
              onClick={() => onSelect(dateStr)}
              className={`aspect-square rounded-full text-sm flex items-center justify-center ${
                isSelected
                  ? "bg-brand-purple text-white font-semibold"
                  : disabled
                    ? "text-neutral-300 pointer-events-none"
                    : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
