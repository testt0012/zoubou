"use client";

import SlideTransition from "@/components/admin/SlideTransition";
import AvailabilityRuleRow from "@/components/admin/AvailabilityRuleRow";
import AddAvailabilityRuleForm from "@/components/admin/AddAvailabilityRuleForm";
import AddBlockedSlotForm from "@/components/admin/AddBlockedSlotForm";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { deleteBlockedSlot } from "@/lib/actions/availability";
import { weekdayLabel, formatDateLong } from "@/lib/time";
import type { AvailabilityRule } from "@/types/database";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday..Sunday for display order

export default function AdminAvailabilityPage() {
  const { availabilityRules, blockedSlots } = useAdminData();

  const rulesByWeekday = new Map<number, AvailabilityRule[]>();
  for (const r of availabilityRules) {
    const list = rulesByWeekday.get(r.weekday) ?? [];
    list.push(r);
    rulesByWeekday.set(r.weekday, list);
  }

  return (
    <SlideTransition>
      <h1 className="text-lg font-semibold mb-4">Εβδομαδιαίο ωράριο</h1>

      <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-200 mb-8">
        {WEEKDAYS.map((weekday) => {
          const rules = rulesByWeekday.get(weekday) ?? [];
          const summary =
            rules.length === 0
              ? "Κλειστά"
              : rules.map((r) => `${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}`).join(", ");

          return (
            <details key={weekday} className="group">
              <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none list-none">
                <span className="font-medium">{weekdayLabel(weekday)}</span>
                <span className="flex items-center gap-2 text-sm text-neutral-500 min-w-0">
                  <span className={`truncate ${rules.length === 0 ? "text-neutral-400" : ""}`}>{summary}</span>
                  <span className="text-neutral-400 shrink-0 transition-transform group-open:rotate-90">›</span>
                </span>
              </summary>

              <div className="px-4 pb-4 flex flex-col gap-2 border-t border-neutral-100 pt-3">
                {rules.map((rule) => (
                  <AvailabilityRuleRow key={rule.id} rule={rule} />
                ))}

                <AddAvailabilityRuleForm weekday={weekday} allRules={availabilityRules} />
              </div>
            </details>
          );
        })}
      </div>

      <h2 className="text-base font-semibold mb-3">Κλειστές ημέρες</h2>
      <div className="flex flex-col gap-2 mb-3">
        {blockedSlots.map((b) => (
          <div
            key={b.id}
            className="border border-neutral-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm"
          >
            <div>
              <div>{formatDateLong(b.date)}</div>
              <div className="text-neutral-500">
                {b.start_time.slice(0, 5) === "00:00" && b.end_time.slice(0, 5) === "23:59"
                  ? "Όλη την ημέρα"
                  : `${b.start_time.slice(0, 5)} – ${b.end_time.slice(0, 5)}`}
                {b.reason ? ` · ${b.reason}` : ""}
              </div>
            </div>
            <form action={deleteBlockedSlot}>
              <input type="hidden" name="id" value={b.id} />
              <button type="submit" className="text-red-600">
                Διαγραφή
              </button>
            </form>
          </div>
        ))}
        {blockedSlots.length === 0 && (
          <p className="text-sm text-neutral-400">Δεν υπάρχουν καταχωρήσεις.</p>
        )}
      </div>

      <AddBlockedSlotForm />
    </SlideTransition>
  );
}
