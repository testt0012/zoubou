import { requireAdmin } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import {
  addAvailabilityRule,
  addBlockedSlot,
  deleteAvailabilityRule,
  deleteBlockedSlot,
  updateSettings,
} from "@/lib/actions/availability";
import { weekdayLabel, formatDateLong } from "@/lib/time";
import type { AvailabilityRule, BlockedSlot, Settings } from "@/types/database";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday..Sunday for display order

export default async function AdminAvailabilityPage() {
  const { supabase } = await requireAdmin();

  const [{ data: rules }, { data: blocked }, { data: settings }] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("*")
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase.from("blocked_slots").select("*").order("date", { ascending: true }),
    supabase.from("settings").select("*").eq("id", true).maybeSingle(),
  ]);

  const rulesByWeekday = new Map<number, AvailabilityRule[]>();
  for (const r of (rules ?? []) as AvailabilityRule[]) {
    const list = rulesByWeekday.get(r.weekday) ?? [];
    list.push(r);
    rulesByWeekday.set(r.weekday, list);
  }

  const s = settings as Settings | null;

  return (
    <AdminShell>
      <h1 className="text-lg font-semibold mb-4">Εβδομαδιαίο ωράριο</h1>
      <div className="flex flex-col gap-4 mb-8">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="border border-neutral-200 rounded-lg px-4 py-3">
            <div className="font-medium mb-2">{weekdayLabel(weekday)}</div>
            <div className="flex flex-col gap-2 mb-3">
              {(rulesByWeekday.get(weekday) ?? []).map((rule) => (
                <div key={rule.id} className="flex items-center justify-between text-sm">
                  <span>
                    {rule.start_time.slice(0, 5)} – {rule.end_time.slice(0, 5)}
                  </span>
                  <form action={deleteAvailabilityRule}>
                    <input type="hidden" name="id" value={rule.id} />
                    <button type="submit" className="text-red-600">
                      Διαγραφή
                    </button>
                  </form>
                </div>
              ))}
              {(rulesByWeekday.get(weekday) ?? []).length === 0 && (
                <p className="text-sm text-neutral-400">Κλειστά</p>
              )}
            </div>
            <form action={addAvailabilityRule} className="flex items-center gap-2">
              <input type="hidden" name="weekday" value={weekday} />
              <input
                type="time"
                name="start_time"
                required
                className="border border-neutral-300 rounded-md px-2 py-1 text-sm"
              />
              <span className="text-neutral-400">–</span>
              <input
                type="time"
                name="end_time"
                required
                className="border border-neutral-300 rounded-md px-2 py-1 text-sm"
              />
              <button
                type="submit"
                className="text-sm text-brand-purple font-medium ml-auto"
              >
                + Προσθήκη
              </button>
            </form>
          </div>
        ))}
      </div>

      <h2 className="text-base font-semibold mb-3">Κλειστές ημέρες / ώρες</h2>
      <div className="flex flex-col gap-2 mb-4">
        {(blocked ?? []).map((b: BlockedSlot) => (
          <div
            key={b.id}
            className="border border-neutral-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm"
          >
            <div>
              <div>{formatDateLong(b.date)}</div>
              <div className="text-neutral-500">
                {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
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
        {(blocked ?? []).length === 0 && (
          <p className="text-sm text-neutral-400">Δεν υπάρχουν καταχωρήσεις.</p>
        )}
      </div>

      <form
        action={addBlockedSlot}
        className="border border-neutral-200 rounded-lg px-4 py-3 flex flex-col gap-2 mb-8"
      >
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            name="date"
            required
            className="border border-neutral-300 rounded-md px-2 py-1 text-sm"
          />
          <input
            type="time"
            name="start_time"
            required
            className="border border-neutral-300 rounded-md px-2 py-1 text-sm"
          />
          <input
            type="time"
            name="end_time"
            required
            className="border border-neutral-300 rounded-md px-2 py-1 text-sm"
          />
        </div>
        <input
          type="text"
          name="reason"
          placeholder="Αιτία (προαιρετικό)"
          className="border border-neutral-300 rounded-md px-2 py-1 text-sm"
        />
        <button
          type="submit"
          className="self-start text-sm text-brand-purple font-medium"
        >
          + Προσθήκη κλειστής περιόδου
        </button>
      </form>

      <h2 className="text-base font-semibold mb-3">Ρυθμίσεις</h2>
      <form
        action={updateSettings}
        className="border border-neutral-200 rounded-lg px-4 py-3 flex flex-wrap items-end gap-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">
            Διάρκεια πλέγματος ωρών (λεπτά)
          </label>
          <input
            type="number"
            name="slot_granularity_minutes"
            defaultValue={s?.slot_granularity_minutes ?? 30}
            min={5}
            max={240}
            required
            className="w-28 border border-neutral-300 rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Χρόνος ασφαλείας μεταξύ ραντεβού (λεπτά)
          </label>
          <input
            type="number"
            name="buffer_minutes"
            defaultValue={s?.buffer_minutes ?? 0}
            min={0}
            max={120}
            required
            className="w-28 border border-neutral-300 rounded-md px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="bg-brand-purple text-white rounded-md px-4 py-2 text-sm font-medium"
        >
          Αποθήκευση
        </button>
      </form>
    </AdminShell>
  );
}
