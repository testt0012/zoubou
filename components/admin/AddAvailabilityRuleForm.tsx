"use client";

import { useState, useTransition } from "react";
import { addAvailabilityRule, addAvailabilityRuleAllDays, deleteAvailabilityRule } from "@/lib/actions/availability";
import TimeSelect from "@/components/admin/TimeSelect";
import { timeToMinutes } from "@/lib/time";
import type { AvailabilityRule } from "@/types/database";

// Adding an hour range that overlaps one already set for that day used to
// just insert both, silently leaving two overlapping rules active at once
// (e.g. 09:00–17:00 and 09:00–23:00 both listed). Now it's caught and the
// admin picks which one wins instead of the two coexisting.
export default function AddAvailabilityRuleForm({
  weekday,
  allRules,
}: {
  weekday: number;
  allRules: AvailabilityRule[];
}) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [conflicts, setConflicts] = useState<AvailabilityRule[] | null>(null);
  const [, startTransition] = useTransition();

  function overlapping(rules: AvailabilityRule[]): AvailabilityRule[] {
    if (!startTime || !endTime || startTime >= endTime) return [];
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);
    return rules.filter((r) => timeToMinutes(r.start_time) < e && s < timeToMinutes(r.end_time));
  }

  async function replaceAndAdd(toDelete: AvailabilityRule[], addFormData: FormData) {
    for (const rule of toDelete) {
      const delFd = new FormData();
      delFd.set("id", rule.id);
      await deleteAvailabilityRule(delFd);
    }
    await addAvailabilityRule(addFormData);
  }

  function submitReplacing() {
    const formData = new FormData();
    formData.set("weekday", String(weekday));
    formData.set("start_time", startTime);
    formData.set("end_time", endTime);
    const toDelete = conflicts ?? [];
    startTransition(() => {
      replaceAndAdd(toDelete, formData);
    });
    setStartTime("");
    setEndTime("");
    setConflicts(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = overlapping(allRules.filter((r) => r.weekday === weekday));
    if (found.length > 0) {
      setConflicts(found);
      return;
    }
    submitReplacing();
  }

  function handleAllDays() {
    if (!startTime || !endTime) return;
    const conflicting = overlapping(allRules);
    const formData = new FormData();
    formData.set("start_time", startTime);
    formData.set("end_time", endTime);
    startTransition(async () => {
      for (const rule of conflicting) {
        const delFd = new FormData();
        delFd.set("id", rule.id);
        await deleteAvailabilityRule(delFd);
      }
      await addAvailabilityRuleAllDays(formData);
    });
    setStartTime("");
    setEndTime("");
    setConflicts(null);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-1">
      <div className="flex flex-wrap items-center gap-2">
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
        <button type="submit" className="text-sm text-brand-purple font-medium ml-auto">
          + Προσθήκη
        </button>
        <button type="button" onClick={handleAllDays} className="text-xs text-neutral-500 underline">
          Εφαρμογή σε όλες τις ημέρες
        </button>
      </div>

      {conflicts && conflicts.length > 0 && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex flex-col gap-1">
          <div className="font-medium">
            Επικαλύπτεται με {conflicts.length === 1 ? "το υπάρχον ωράριο" : "τα υπάρχοντα ωράρια"}:
          </div>
          {conflicts.map((c) => (
            <div key={c.id}>
              {c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)}
            </div>
          ))}
          <div className="flex gap-3 mt-1">
            <button type="button" onClick={submitReplacing} className="text-red-700 font-medium underline">
              Κράτησε το νέο
            </button>
            <button type="button" onClick={() => setConflicts(null)} className="text-neutral-500 underline">
              Κράτησε το παλιό
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
