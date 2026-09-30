"use client";

import { useState } from "react";
import TimePicker from "@/components/admin/TimePicker";
import ToggleRow from "@/components/admin/ToggleRow";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { setWeekdayHours } from "@/lib/actions/availability";
import { isValidRange, MAX_RANGES_PER_DAY, rangesOverlap, type TimeRange } from "@/lib/hours";
import { minutesToTime, timeToMinutes, weekdayLabel } from "@/lib/time";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday..Sunday for display order
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_RANGE: TimeRange = { start: "09:00", end: "17:00" };
const LAST_TIME = "23:59";

const TIME_SELECT_CLASS = "min-w-0 flex-1 h-12 border border-neutral-300 rounded-lg px-3 bg-white";
const SECONDARY_BUTTON_CLASS =
  "h-12 rounded-lg border border-neutral-300 px-4 font-medium text-neutral-700 disabled:opacity-60";

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 7h16M9.5 7V4.8c0-.44.36-.8.8-.8h3.4c.44 0 .8.36.8.8V7M6.5 7l.7 12.1a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9L17.5 7" />
    </svg>
  );
}

function formatRanges(ranges: TimeRange[]): string {
  return ranges.length === 0 ? "Κλειστά" : ranges.map((r) => `${r.start}–${r.end}`).join(", ");
}

// "Τρί 10:00–20:00" / "Τετ–Κυρ 09:00–23:00": consecutive days sharing the
// same hours collapse into one line, closed days are left out.
function summarizeWeek(hoursByWeekday: Map<number, TimeRange[]>): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < WEEKDAYS.length) {
    const hours = formatRanges(hoursByWeekday.get(WEEKDAYS[i]) ?? []);
    let j = i;
    while (j + 1 < WEEKDAYS.length && formatRanges(hoursByWeekday.get(WEEKDAYS[j + 1]) ?? []) === hours) j++;
    if (hours !== "Κλειστά") {
      const from = weekdayLabel(WEEKDAYS[i]).slice(0, 3);
      const to = weekdayLabel(WEEKDAYS[j]).slice(0, 3);
      lines.push(`${i === j ? from : `${from}–${to}`} ${hours}`);
    }
    i = j + 1;
  }
  return lines;
}

interface DayEditorProps {
  initial: TimeRange[];
  // What a closed day starts from when it's switched to open.
  fallback: TimeRange[];
  saving: boolean;
  serverError: string | null;
  onSave: (ranges: TimeRange[], allDays: boolean) => void;
  onCancel: () => void;
}

// Edits a draft of one day's hours; nothing is stored until "Αποθήκευση".
function DayEditor({ initial, fallback, saving, serverError, onSave, onCancel }: DayEditorProps) {
  const [ranges, setRanges] = useState<TimeRange[]>(initial);
  const [confirmAllDays, setConfirmAllDays] = useState(false);
  const isOpen = ranges.length > 0;

  // The time pickers only accept times that keep the day's hours in order and
  // apart (see the min/after/before/max below), so this is just a backstop.
  const blocked = saving || ranges.some((r) => !isValidRange(r)) || rangesOverlap(ranges);

  function updateRange(index: number, patch: Partial<TimeRange>) {
    setRanges((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setConfirmAllDays(false);
  }

  // Moving the opening time past the closing time pushes the closing time
  // along with it (an hour later, but never into the next range).
  function updateStart(index: number, start: string) {
    const limit = ranges[index + 1]?.start ?? LAST_TIME;
    const end =
      ranges[index].end > start
        ? ranges[index].end
        : minutesToTime(Math.min(timeToMinutes(start) + 60, timeToMinutes(limit)));
    updateRange(index, { start, end });
  }

  function addRange() {
    const lastEnd = ranges[ranges.length - 1].end;
    setRanges((prev) => [...prev, { start: lastEnd, end: lastEnd < "23:00" ? "23:00" : LAST_TIME }]);
    setConfirmAllDays(false);
  }

  const canAddRange = isOpen && ranges.length < MAX_RANGES_PER_DAY && ranges[ranges.length - 1].end < LAST_TIME;

  return (
    <div className="px-4 pb-4 flex flex-col gap-3">
      <ToggleRow
        label={isOpen ? "Ανοιχτά" : "Κλειστά"}
        checked={isOpen}
        onChange={(open) => {
          setRanges(open ? fallback.map((r) => ({ ...r })) : []);
          setConfirmAllDays(false);
        }}
      />

      {ranges.map((range, index) => (
        <div key={index} className="flex items-center gap-2">
          <TimePicker
            title="Άνοιγμα"
            value={range.start}
            onChange={(start) => updateStart(index, start)}
            min={ranges[index - 1]?.end}
            before={ranges[index + 1]?.start ?? LAST_TIME}
            className={TIME_SELECT_CLASS}
          />
          <span className="text-neutral-400 shrink-0">–</span>
          <TimePicker
            title="Κλείσιμο"
            value={range.end}
            onChange={(end) => updateRange(index, { end })}
            after={range.start}
            max={ranges[index + 1]?.start}
            className={TIME_SELECT_CLASS}
          />
          {ranges.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setRanges((prev) => prev.filter((_, i) => i !== index));
                setConfirmAllDays(false);
              }}
              aria-label="Αφαίρεση ωραρίου"
              title="Αφαίρεση ωραρίου"
              className="shrink-0 flex items-center justify-center w-12 h-12 rounded-lg border border-neutral-300 text-red-600"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      ))}

      {canAddRange && (
        <button type="button" onClick={addRange} className="h-12 text-left font-medium text-brand-purple">
          + Δεύτερο ωράριο (με διάλειμμα)
        </button>
      )}

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(ranges, false)}
          disabled={blocked}
          className="flex-1 h-12 rounded-lg bg-brand-purple text-white font-medium disabled:opacity-60"
        >
          {saving ? "Αποθήκευση…" : "Αποθήκευση"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className={SECONDARY_BUTTON_CLASS}>
          Άκυρο
        </button>
      </div>

      {isOpen && confirmAllDays ? (
        <div className="rounded-lg bg-brand-pink-light px-4 py-3 flex flex-col gap-3">
          <p className="text-sm">
            Και οι 7 ημέρες θα γίνουν: <span className="font-medium">{formatRanges(ranges)}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSave(ranges, true)}
              disabled={blocked}
              className="flex-1 h-12 rounded-lg bg-brand-purple text-white font-medium disabled:opacity-60"
            >
              Ναι, σε όλες
            </button>
            <button
              type="button"
              onClick={() => setConfirmAllDays(false)}
              disabled={saving}
              className={`${SECONDARY_BUTTON_CLASS} bg-white`}
            >
              Όχι
            </button>
          </div>
        </div>
      ) : (
        isOpen && (
          <button
            type="button"
            onClick={() => setConfirmAllDays(true)}
            disabled={blocked}
            className={SECONDARY_BUTTON_CLASS}
          >
            Ίδιο ωράριο σε όλες τις ημέρες
          </button>
        )
      )}
    </div>
  );
}

// The weekly hours change rarely, so the whole section is a closed dropdown
// showing just a summary; opening it lists the days, and tapping a day opens
// its editor.
export default function WeeklyHoursEditor() {
  const { availabilityRules, refreshAvailabilityRules } = useAdminData();
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const hoursByWeekday = new Map<number, TimeRange[]>();
  for (const rule of availabilityRules) {
    const list = hoursByWeekday.get(rule.weekday) ?? [];
    list.push({ start: rule.start_time.slice(0, 5), end: rule.end_time.slice(0, 5) });
    hoursByWeekday.set(rule.weekday, list);
  }

  const summary = summarizeWeek(hoursByWeekday);
  const firstOpenDay = WEEKDAYS.find((d) => (hoursByWeekday.get(d) ?? []).length > 0);
  const fallback = firstOpenDay === undefined ? [DEFAULT_RANGE] : hoursByWeekday.get(firstOpenDay)!;

  async function handleSave(weekday: number, ranges: TimeRange[], allDays: boolean) {
    setSaving(true);
    setServerError(null);
    const result = await setWeekdayHours(allDays ? ALL_WEEKDAYS : [weekday], ranges);
    await refreshAvailabilityRules();
    setSaving(false);
    if (result.success) setEditingDay(null);
    else setServerError(result.error ?? "Σφάλμα αποθήκευσης ωραρίου.");
  }

  function toggleDay(weekday: number) {
    if (saving) return;
    setServerError(null);
    setEditingDay((current) => (current === weekday ? null : weekday));
  }

  return (
    <details className="group border border-neutral-200 rounded-xl mb-8">
      <summary className="min-h-16 px-4 py-3 cursor-pointer select-none list-none flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-semibold">Εβδομαδιαίο ωράριο</span>
          {summary.length === 0 ? (
            <span className="block text-sm text-neutral-400">Κλειστά όλες τις ημέρες</span>
          ) : (
            summary.map((line) => (
              <span key={line} className="block text-sm text-neutral-500">
                {line}
              </span>
            ))
          )}
        </span>
        <span className="shrink-0 text-2xl text-neutral-400 transition-transform group-open:rotate-90">›</span>
      </summary>

      <div className="border-t border-neutral-200 divide-y divide-neutral-100">
        {WEEKDAYS.map((weekday) => {
          const ranges = hoursByWeekday.get(weekday) ?? [];
          const isEditing = editingDay === weekday;
          return (
            <div key={weekday}>
              <button
                type="button"
                onClick={() => toggleDay(weekday)}
                aria-expanded={isEditing}
                className="w-full min-h-14 px-4 py-2 flex items-center justify-between gap-3 text-left"
              >
                <span className="font-medium">{weekdayLabel(weekday)}</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`text-sm ${ranges.length === 0 ? "text-neutral-400" : "text-neutral-600"}`}>
                    {formatRanges(ranges)}
                  </span>
                  <span className={`text-xl text-neutral-400 shrink-0 transition-transform ${isEditing ? "rotate-90" : ""}`}>
                    ›
                  </span>
                </span>
              </button>
              {isEditing && (
                <DayEditor
                  initial={ranges}
                  fallback={fallback}
                  saving={saving}
                  serverError={serverError}
                  onSave={(next, allDays) => handleSave(weekday, next, allDays)}
                  onCancel={() => toggleDay(weekday)}
                />
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
