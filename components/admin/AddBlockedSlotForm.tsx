"use client";

import { useState, useTransition } from "react";
import { addBlockedSlot } from "@/lib/actions/availability";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import TimeSelect from "@/components/admin/TimeSelect";
import { eachDate, timeToMinutes } from "@/lib/time";
import type { AppointmentWithService } from "@/types/database";

// Defaults to the full day (closing for a vacation/holiday is the common
// case) but the hours stay editable for a partial closure.
const FULL_DAY_START = "00:00";
const FULL_DAY_END = "23:59";

export default function AddBlockedSlotForm() {
  const { appointments } = useAdminData();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [startTime, setStartTime] = useState(FULL_DAY_START);
  const [endTime, setEndTime] = useState(FULL_DAY_END);
  const [conflicts, setConflicts] = useState<AppointmentWithService[] | null>(null);
  const [, startTransition] = useTransition();

  function handleDateFromChange(value: string) {
    setDateFrom(value);
    // "Έως" always moves forward with "Από" — never left dangling before it.
    setDateTo((prevTo) => (!prevTo || prevTo < value ? value : prevTo));
    setConflicts(null);
  }

  function findConflicts(): AppointmentWithService[] {
    if (!dateFrom || !dateTo || !startTime || !endTime || dateFrom > dateTo) return [];
    const dates = new Set(eachDate(dateFrom, dateTo));
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);
    return appointments.filter((a) => {
      if (!dates.has(a.date)) return false;
      return timeToMinutes(a.start_time) < e && s < timeToMinutes(a.end_time);
    });
  }

  function submit() {
    const formData = new FormData();
    formData.set("dateFrom", dateFrom);
    formData.set("dateTo", dateTo);
    formData.set("start_time", startTime);
    formData.set("end_time", endTime);
    startTransition(() => {
      addBlockedSlot(formData);
    });
    setDateFrom("");
    setDateTo("");
    setStartTime(FULL_DAY_START);
    setEndTime(FULL_DAY_END);
    setConflicts(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = findConflicts();
    if (found.length > 0) {
      setConflicts(found);
      return;
    }
    submit();
  }

  return (
    <details className="group border border-neutral-200 rounded-lg mb-8">
      <summary className="px-4 py-3 cursor-pointer select-none list-none flex items-center justify-between text-sm font-medium text-brand-purple">
        Προσθήκη κλειστής περιόδου
        <span className="text-neutral-400 transition-transform group-open:rotate-45">+</span>
      </summary>
      <form onSubmit={handleSubmit} className="px-4 pb-4 pt-3 border-t border-neutral-100 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <label className="text-sm text-neutral-500">Από</label>
            <input
              type="date"
              required
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="border border-neutral-300 rounded-md px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-sm text-neutral-500">Έως</label>
            <input
              type="date"
              required
              min={dateFrom || undefined}
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setConflicts(null);
              }}
              className="border border-neutral-300 rounded-md px-2 py-1 text-sm"
            />
          </div>
          <button type="submit" className="ml-auto text-sm text-brand-purple font-medium">
            Προσθήκη
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-neutral-500">Ώρα</label>
          <TimeSelect
            required
            value={startTime}
            onChange={(v) => {
              setStartTime(v);
              setConflicts(null);
            }}
            className="w-16 border border-neutral-300 rounded-md px-2 py-1 text-sm"
          />
          <span className="text-neutral-400">–</span>
          <TimeSelect
            required
            value={endTime}
            onChange={(v) => {
              setEndTime(v);
              setConflicts(null);
            }}
            className="w-16 border border-neutral-300 rounded-md px-2 py-1 text-sm"
          />
        </div>

        {conflicts && conflicts.length > 0 && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex flex-col gap-1">
            <div className="font-medium">
              Υπάρχουν ήδη {conflicts.length} ραντεβού σε αυτό το διάστημα:
            </div>
            {conflicts.map((c) => (
              <div key={c.id}>
                {c.date} · {c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)} · {c.first_name} {c.last_name}
              </div>
            ))}
            <button
              type="button"
              onClick={submit}
              className="self-start mt-1 text-red-700 font-medium underline"
            >
              Προσθήκη παρόλα αυτά
            </button>
          </div>
        )}
      </form>
    </details>
  );
}
