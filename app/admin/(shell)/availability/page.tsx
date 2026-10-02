"use client";

import { useState } from "react";
import SlideTransition from "@/components/admin/SlideTransition";
import WeeklyHoursEditor from "@/components/admin/WeeklyHoursEditor";
import AddBlockedSlotForm from "@/components/admin/AddBlockedSlotForm";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { deleteBlockedSlot } from "@/lib/actions/availability";
import { useAdminNotice } from "@/components/admin/AdminNotice";
import EmergencyClosureForm from "@/components/admin/EmergencyClosureForm";
import { EMERGENCY_CLOSURE_REASON, FULL_DAY_END, FULL_DAY_START } from "@/lib/hours";
import { formatDateLong } from "@/lib/time";
import type { BlockedSlot } from "@/types/database";

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 7h16M9.5 7V4.8c0-.44.36-.8.8-.8h3.4c.44 0 .8.36.8.8V7M6.5 7l.7 12.1a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9L17.5 7" />
    </svg>
  );
}

function closureHours(b: BlockedSlot): string {
  const start = b.start_time.slice(0, 5);
  const end = b.end_time.slice(0, 5);
  if (end !== FULL_DAY_END) return `${start} – ${end}`;
  return start === FULL_DAY_START ? "Όλη μέρα" : `Από ${start}`;
}

function BlockedSlotList({ slots, detail }: { slots: BlockedSlot[]; detail?: (b: BlockedSlot) => string }) {
  const notify = useAdminNotice();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (deleting) return;
    setDeleting(id);
    try {
      const result = await deleteBlockedSlot(id);
      if (!result.success) notify(result.error ?? "Δεν διαγράφηκε.");
    } catch {
      notify("Δεν διαγράφηκε. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.");
    }
    setDeleting(null);
  }

  return (
    <div className="flex flex-col gap-2 mb-3">
      {slots.map((b) => (
        <div
          key={b.id}
          className="border border-neutral-200 rounded-xl pl-4 pr-2 py-2 min-h-14 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="font-medium">{formatDateLong(b.date)}</div>
            {detail && <div className="text-sm text-neutral-500">{detail(b)}</div>}
          </div>
          <button
            type="button"
            onClick={() => handleDelete(b.id)}
            disabled={deleting !== null}
            aria-label="Διαγραφή"
            title="Διαγραφή"
            className="shrink-0 flex items-center justify-center w-12 h-12 rounded-lg text-red-600 disabled:opacity-50"
          >
            <TrashIcon />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function AdminAvailabilityPage() {
  const { blockedSlots } = useAdminData();
  const closures = blockedSlots.filter((b) => b.reason === EMERGENCY_CLOSURE_REASON);
  const vacations = blockedSlots.filter((b) => b.reason !== EMERGENCY_CLOSURE_REASON);

  return (
    <SlideTransition>
      <h1 className="text-lg font-semibold mb-4">Ωράριο</h1>

      <WeeklyHoursEditor />

      <h2 className="text-base font-semibold mb-3">Έκτακτο κλείσιμο</h2>
      <BlockedSlotList slots={closures} detail={closureHours} />
      <EmergencyClosureForm />

      <h2 className="text-base font-semibold mb-3">Διακοπές</h2>
      <BlockedSlotList slots={vacations} />
      <AddBlockedSlotForm />
    </SlideTransition>
  );
}
