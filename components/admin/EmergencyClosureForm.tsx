"use client";

import { useState } from "react";
import { addBlockedSlot } from "@/lib/actions/availability";
import { useAdminNotice } from "@/components/admin/AdminNotice";
import AffectedAppointments, { type AffectedPerson } from "@/components/admin/AffectedAppointments";
import { useClosureConflicts } from "@/components/admin/useClosureConflicts";
import DatePicker from "@/components/admin/DatePicker";
import TimePicker from "@/components/admin/TimePicker";
import ToggleRow from "@/components/admin/ToggleRow";
import { EMERGENCY_CLOSURE_REASON, FULL_DAY_END, FULL_DAY_START } from "@/lib/hours";
import { todayAthens } from "@/lib/time";

// A one-off closure on a single date: the whole day, or from a given time
// on — e.g. a Saturday normally open 09:00–16:00 that has to shut at 12:00.
// The closing time is optional; left empty it runs to the end of the day.
export default function EmergencyClosureForm() {
  const closureConflicts = useClosureConflicts();
  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [conflicts, setConflicts] = useState<AffectedPerson[] | null>(null);
  // Kept on screen after the closure is added, until dismissed — the list
  // of customers that now have to be called.
  const [affected, setAffected] = useState<AffectedPerson[] | null>(null);
  const notify = useAdminNotice();
  const [saving, setSaving] = useState(false);

  const start = allDay ? FULL_DAY_START : startTime;
  const end = allDay || !endTime ? FULL_DAY_END : endTime;

  function findConflicts(): AffectedPerson[] {
    return closureConflicts([date], start, end);
  }

  async function submit() {
    if (saving) return;
    const formData = new FormData();
    formData.set("dateFrom", date);
    formData.set("dateTo", date);
    formData.set("start_time", start);
    formData.set("end_time", end);
    formData.set("reason", EMERGENCY_CLOSURE_REASON);
    setSaving(true);
    let result: { success: boolean; error?: string };
    try {
      result = await addBlockedSlot(formData);
    } catch {
      result = { success: false, error: "Δεν αποθηκεύτηκε. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά." };
    }
    setSaving(false);
    if (!result.success) {
      // What was filled in stays in the form, ready for another try.
      notify(result.error ?? "Δεν αποθηκεύτηκε.");
      return;
    }
    setAffected(conflicts && conflicts.length > 0 ? conflicts : null);
    setDate("");
    setAllDay(false);
    setStartTime("");
    setEndTime("");
    setConflicts(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || (!allDay && !startTime)) return;
    const found = findConflicts();
    if (found.length > 0) {
      setConflicts(found);
      return;
    }
    submit();
  }

  const fieldClass = "w-full min-w-0 h-12 border border-neutral-300 rounded-lg px-3 bg-white text-base text-neutral-900";

  return (
    <details className="group border border-neutral-200 rounded-xl mb-8">
      <summary className="min-h-14 px-4 cursor-pointer select-none list-none flex items-center justify-between font-medium text-brand-purple">
        Προσθήκη έκτακτου κλεισίματος
        <span className="text-2xl text-neutral-400 transition-transform group-open:rotate-45">+</span>
      </summary>
      <form onSubmit={handleSubmit} className="px-4 pb-4 pt-3 border-t border-neutral-100 flex flex-col gap-3">
        <div className="flex flex-col gap-1 text-sm text-neutral-500 min-w-0">
          Ημερομηνία
          <DatePicker
            title="Ημερομηνία"
            value={date}
            minDate={todayAthens()}
            onChange={(v) => {
              setDate(v);
              setConflicts(null);
            }}
            className={fieldClass}
          />
        </div>

        <ToggleRow
          label="Όλη μέρα"
          checked={allDay}
          onChange={(next) => {
            setAllDay(next);
            setConflicts(null);
          }}
        />

        {!allDay && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 text-sm text-neutral-500 min-w-0">
              Κλειστά από
              <TimePicker
                title="Κλειστά από"
                value={startTime}
                before={FULL_DAY_END}
                onChange={(v) => {
                  setStartTime(v);
                  if (endTime && endTime <= v) setEndTime("");
                  setConflicts(null);
                }}
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-1 text-sm text-neutral-500 min-w-0">
              Έως (προαιρετικό)
              <TimePicker
                title="Κλειστά έως"
                value={endTime}
                after={startTime || undefined}
                emptyLabel="Τέλος ημέρας"
                onChange={(v) => {
                  setEndTime(v);
                  setConflicts(null);
                }}
                className={fieldClass}
              />
            </div>
          </div>
        )}

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
            disabled={!date || (!allDay && !startTime) || saving}
            className="h-12 rounded-lg bg-brand-purple text-white font-medium disabled:opacity-60"
          >
            {saving ? "Αποθήκευση…" : "Προσθήκη"}
          </button>
        )}
      </form>
    </details>
  );
}
