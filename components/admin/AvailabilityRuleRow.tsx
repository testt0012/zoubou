"use client";

import { useState, useTransition } from "react";
import { deleteAvailabilityRule, updateAvailabilityRule } from "@/lib/actions/availability";
import TimeSelect from "@/components/admin/TimeSelect";
import type { AvailabilityRule } from "@/types/database";

// Tap the time range to edit it in place instead of deleting the rule and
// re-adding a new one for a simple time change.
export default function AvailabilityRuleRow({ rule }: { rule: AvailabilityRule }) {
  const [editing, setEditing] = useState(false);
  const [startTime, setStartTime] = useState(rule.start_time.slice(0, 5));
  const [endTime, setEndTime] = useState(rule.end_time.slice(0, 5));
  const [, startTransition] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("id", rule.id);
    formData.set("start_time", startTime);
    formData.set("end_time", endTime);
    startTransition(() => {
      updateAvailabilityRule(formData);
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex items-center gap-2 text-sm">
        <TimeSelect
          required
          value={startTime}
          onChange={setStartTime}
          className="min-w-0 flex-1 border border-neutral-300 rounded-md px-2 py-1 text-sm"
        />
        <span className="text-neutral-400 shrink-0">–</span>
        <TimeSelect
          required
          value={endTime}
          onChange={setEndTime}
          className="min-w-0 flex-1 border border-neutral-300 rounded-md px-2 py-1 text-sm"
        />
        <button type="submit" className="text-brand-purple font-medium shrink-0">
          Αποθήκευση
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-neutral-400 shrink-0">
          Άκυρο
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="underline decoration-dotted decoration-neutral-300 underline-offset-4"
      >
        {rule.start_time.slice(0, 5)} – {rule.end_time.slice(0, 5)}
      </button>
      <form action={deleteAvailabilityRule}>
        <input type="hidden" name="id" value={rule.id} />
        <button type="submit" className="text-red-600">
          Διαγραφή
        </button>
      </form>
    </div>
  );
}
