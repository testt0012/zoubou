"use client";

import { useState, useTransition } from "react";
import { addBlockedSlot } from "@/lib/actions/availability";
import DatePicker from "@/components/admin/DatePicker";
import AffectedAppointments, { type AffectedPerson } from "@/components/admin/AffectedAppointments";
import { useClosureConflicts } from "@/components/admin/useClosureConflicts";
import { FULL_DAY_END, FULL_DAY_START } from "@/lib/hours";
import { eachDate, todayAthens } from "@/lib/time";

// Time off is always whole days — only the dates are asked for.

export default function AddBlockedSlotForm() {
  const closureConflicts = useClosureConflicts();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [conflicts, setConflicts] = useState<AffectedPerson[] | null>(null);
  // Kept on screen after the closure is added, until dismissed — the list
  // of customers that now have to be called.
  const [affected, setAffected] = useState<AffectedPerson[] | null>(null);
  const [, startTransition] = useTransition();

  function handleDateFromChange(value: string) {
    setDateFrom(value);
    // "Έως" always moves forward with "Από" — never left dangling before it.
    setDateTo((prevTo) => (!prevTo || prevTo < value ? value : prevTo));
    setConflicts(null);
  }

  function findConflicts(): AffectedPerson[] {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return [];
    return closureConflicts(eachDate(dateFrom, dateTo), FULL_DAY_START, FULL_DAY_END);
  }

  function submit() {
    const formData = new FormData();
    formData.set("dateFrom", dateFrom);
    formData.set("dateTo", dateTo);
    formData.set("start_time", FULL_DAY_START);
    formData.set("end_time", FULL_DAY_END);
    startTransition(() => {
      addBlockedSlot(formData);
    });
    setAffected(conflicts && conflicts.length > 0 ? conflicts : null);
    setDateFrom("");
    setDateTo("");
    setConflicts(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dateFrom || !dateTo) return;
    const found = findConflicts();
    if (found.length > 0) {
      setConflicts(found);
      return;
    }
    submit();
  }

  const today = todayAthens();
  const fieldClass = "w-full min-w-0 h-12 border border-neutral-300 rounded-lg px-3 bg-white text-base text-neutral-900";

  return (
    <details className="group border border-neutral-200 rounded-xl mb-8">
      <summary className="min-h-14 px-4 cursor-pointer select-none list-none flex items-center justify-between font-medium text-brand-purple">
        Προσθήκη διακοπών
        <span className="text-2xl text-neutral-400 transition-transform group-open:rotate-45">+</span>
      </summary>
      <form onSubmit={handleSubmit} className="px-4 pb-4 pt-3 border-t border-neutral-100 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 text-sm text-neutral-500 min-w-0">
            Από
            <DatePicker
              title="Διακοπές από"
              value={dateFrom}
              minDate={today}
              onChange={handleDateFromChange}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1 text-sm text-neutral-500 min-w-0">
            Έως
            <DatePicker
              title="Διακοπές έως"
              value={dateTo}
              minDate={dateFrom || today}
              onChange={(v) => {
                setDateTo(v);
                setConflicts(null);
              }}
              className={fieldClass}
            />
          </div>
        </div>

        {conflicts && conflicts.length > 0 ? (
          <AffectedAppointments
            people={conflicts}
            confirmed={false}
            onConfirm={submit}
            onDismiss={() => setConflicts(null)}
          />
        ) : (
          affected && (
            <AffectedAppointments
              people={affected}
              confirmed
              onConfirm={() => {}}
              onDismiss={() => setAffected(null)}
            />
          )
        )}

        {!(conflicts && conflicts.length > 0) && (
          <button
            type="submit"
            disabled={!dateFrom || !dateTo}
            className="h-12 rounded-lg bg-brand-purple text-white font-medium disabled:opacity-60"
          >
            Προσθήκη
          </button>
        )}
      </form>
    </details>
  );
}
