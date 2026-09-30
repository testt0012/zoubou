"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SlideTransition from "@/components/admin/SlideTransition";
import { useRecurringVisits } from "@/components/admin/useRecurringVisits";
import DatePicker from "@/components/admin/DatePicker";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  eachDate,
  formatDateLong,
  formatDateShort,
  startOfWeek,
  todayAthens,
  weekdayLabel,
  weekdayOf,
} from "@/lib/time";
import { bookedMinutesForDate, occupancyPercent, workingMinutesForDate } from "@/lib/occupancy";
import { recurringMinutesForDate } from "@/lib/recurring";
import { isValidDateString } from "@/lib/validation";

const MAX_REPORT_DAYS = 366;
const PAGE_SIZE = 1000; // PostgREST returns at most this many rows per request
const WEEKDAY_HISTORY_MONTHS = 6;
const SHORT_WEEKDAYS = ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday..Sunday, matching SHORT_WEEKDAYS
// "Τρίτες", "Σάββατα"… indexed like weekdayOf (0 = Sunday).
const WEEKDAY_PLURALS = ["Κυριακές", "Δευτέρες", "Τρίτες", "Τετάρτες", "Πέμπτες", "Παρασκευές", "Σάββατα"];

interface Span {
  date: string;
  start_time: string;
  end_time: string;
}

interface RangeReport {
  title: string;
  from: string;
  to: string;
  days: number;
  bookedHours: number;
  workingHours: number;
  percent: number;
}

// "YYYY-MM-DD" moved by whole months, keeping the day where the target
// month has it (31 March - 1 month = 28/29 February).
function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}

// Every row of a date-ranged read, a page at a time: six months of
// appointments can run past the single-request row cap.
async function fetchSpans(table: "appointments" | "blocked_slots", from: string, to: string): Promise<Span[]> {
  const supabase = createClient();
  const rows: Span[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase.from(table).select("date, start_time, end_time").gte("date", from).lte("date", to);
    if (table === "appointments") query = query.eq("status", "confirmed");
    const { data } = await query.order("date", { ascending: true }).order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    rows.push(...((data ?? []) as Span[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export default function AdminReportsPage() {
  const searchParams = useSearchParams();
  const { availabilityRules, blockedSlots, ensureAppointmentsRange } = useAdminData();
  const { visits, takenMinutesFor } = useRecurringVisits();
  const today = todayAthens();

  const rawCalDate = searchParams.get("calDate");
  const calDate = rawCalDate && isValidDateString(rawCalDate) ? rawCalDate : today;

  const rangeStart = startOfWeek(calDate);
  const rangeEnd = addDays(rangeStart, 6);
  const rangeDates = eachDate(rangeStart, rangeEnd);

  useEffect(() => {
    ensureAppointmentsRange(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd, ensureAppointmentsRange]);

  // Occupancy for a span of dates (% booked hours vs. working hours), either
  // from one of the one-tap buttons or the "από/έως" form. Its own on-demand
  // fetch: it targets historical dates outside the forward-looking cache
  // window. `activeKey` is which button asked, so it can show as pressed.
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<RangeReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // `weekday` narrows the span to just that day of the week (0 = Sunday).
  async function runReport(key: string, title: string, from: string, to: string, weekday?: number) {
    setActiveKey(key);
    setReport(null);
    setReportError(null);
    setReportLoading(true);

    const [reportBlockedList, reportAppointmentsList] = await Promise.all([
      fetchSpans("blocked_slots", from, to),
      fetchSpans("appointments", from, to),
    ]);
    setReportLoading(false);

    const dates = eachDate(from, to).filter((d) => weekday === undefined || weekdayOf(d) === weekday);
    let workingMinutes = 0;
    let bookedMinutes = 0;
    for (const d of dates) {
      workingMinutes += workingMinutesForDate(availabilityRules, reportBlockedList, d);
      // Regular customers' standing visits count as booked time too.
      bookedMinutes +=
        bookedMinutesForDate(reportAppointmentsList, d) +
        recurringMinutesForDate(visits, availabilityRules, reportBlockedList, reportAppointmentsList, d);
    }

    setReport({
      title,
      from,
      to,
      days: dates.length,
      workingHours: Math.round((workingMinutes / 60) * 10) / 10,
      bookedHours: Math.round((bookedMinutes / 60) * 10) / 10,
      percent: occupancyPercent(bookedMinutes, workingMinutes),
    });
  }

  // Monday to Sunday of the week before this one.
  function runPreviousWeek() {
    const from = addDays(startOfWeek(today), -7);
    runReport("week", "Προηγούμενη εβδομάδα", from, addDays(from, 6));
  }

  // The whole previous month, 1st to last day.
  function runPreviousMonth() {
    const firstOfThisMonth = `${today.slice(0, 8)}01`;
    runReport("month", "Προηγούμενος μήνας", addMonths(firstOfThisMonth, -1), addDays(firstOfThisMonth, -1));
  }

  // Every e.g. Tuesday of the last six months, up to yesterday.
  function runWeekday(weekday: number) {
    runReport(
      `weekday-${weekday}`,
      `${WEEKDAY_PLURALS[weekday]} · τελευταίοι ${WEEKDAY_HISTORY_MONTHS} μήνες`,
      addMonths(today, -WEEKDAY_HISTORY_MONTHS),
      addDays(today, -1),
      weekday
    );
  }

  function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidDateString(reportFrom) || !isValidDateString(reportTo) || reportFrom > reportTo) {
      setReport(null);
      setReportError("Επιλέξτε έγκυρο εύρος ημερομηνιών.");
      return;
    }

    const spanDays =
      Math.round(
        (new Date(`${reportTo}T00:00:00Z`).getTime() - new Date(`${reportFrom}T00:00:00Z`).getTime()) / 86400000
      ) + 1;

    if (spanDays > MAX_REPORT_DAYS) {
      setReport(null);
      setReportError("Το εύρος είναι πολύ μεγάλο.");
      return;
    }

    runReport("custom", "Διάστημα", reportFrom, reportTo);
  }

  const quickButtonClass = (key: string) =>
    `h-12 rounded-lg border font-medium disabled:opacity-60 ${
      activeKey === key ? "border-brand-purple bg-brand-purple text-white" : "border-neutral-300 bg-white text-neutral-700"
    }`;

  return (
    <SlideTransition>
      <h1 className="text-lg font-semibold mb-6">Αναφορές</h1>

      <div className="flex flex-col gap-8">
        <section>
          <h2 className="text-base font-semibold mb-4">Πληρότητα εβδομάδας</h2>

          <div className="flex items-center justify-between mb-4">
            <Link
              href={`/admin/reports?calDate=${addDays(calDate, -7)}`}
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl text-neutral-500 hover:bg-neutral-100 shrink-0"
              aria-label="Προηγούμενη εβδομάδα"
            >
              ‹
            </Link>
            <div className="text-sm font-medium text-center">
              {formatDateShort(rangeStart)} – {formatDateShort(rangeEnd)}
              {(today < rangeStart || today > rangeEnd) && (
                <Link href="/admin/reports" className="block text-xs text-brand-purple mt-0.5">
                  Σήμερα
                </Link>
              )}
            </div>
            <Link
              href={`/admin/reports?calDate=${addDays(calDate, 7)}`}
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl text-neutral-500 hover:bg-neutral-100 shrink-0"
              aria-label="Επόμενη εβδομάδα"
            >
              ›
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {rangeDates.map((d, i) => {
              const working = workingMinutesForDate(availabilityRules, blockedSlots, d);
              const percent = occupancyPercent(takenMinutesFor(d), working);
              return (
                <div
                  key={d}
                  className={`rounded-lg border px-1 py-2 flex flex-col items-center gap-1 ${
                    d === today ? "border-brand-purple" : "border-neutral-200"
                  }`}
                >
                  <div className="text-[11px] text-neutral-500">{SHORT_WEEKDAYS[i]}</div>
                  <div className="text-sm font-medium">{d.slice(8, 10)}</div>
                  <div className={`text-xs font-semibold ${working === 0 ? "text-neutral-300" : "text-brand-purple"}`}>
                    {working === 0 ? "—" : `${percent}%`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">Ποσοστό πληρότητας</h2>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button type="button" onClick={runPreviousWeek} disabled={reportLoading} className={quickButtonClass("week")}>
              Προηγ. εβδομάδα
            </button>
            <button type="button" onClick={runPreviousMonth} disabled={reportLoading} className={quickButtonClass("month")}>
              Προηγ. μήνας
            </button>
          </div>

          <div className="text-sm text-neutral-500 mb-1">Ανά ημέρα, τελευταίοι {WEEKDAY_HISTORY_MONTHS} μήνες</div>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {WEEKDAYS.map((weekday, i) => (
              <button
                type="button"
                key={weekday}
                onClick={() => runWeekday(weekday)}
                disabled={reportLoading}
                aria-label={weekdayLabel(weekday)}
                className={quickButtonClass(`weekday-${weekday}`)}
              >
                {SHORT_WEEKDAYS[i]}
              </button>
            ))}
          </div>

          <div className="text-sm text-neutral-500 mb-1">Δικό σου διάστημα</div>
          <form onSubmit={handleReportSubmit} className="grid grid-cols-2 gap-2">
            <DatePicker
              title="Από"
              value={reportFrom}
              onChange={setReportFrom}
              className="w-full min-w-0 h-12 border border-neutral-300 rounded-lg px-3 bg-white"
            />
            <DatePicker
              title="Έως"
              value={reportTo}
              minDate={reportFrom || undefined}
              onChange={setReportTo}
              className="w-full min-w-0 h-12 border border-neutral-300 rounded-lg px-3 bg-white"
            />
            <button
              type="submit"
              disabled={reportLoading || !reportFrom || !reportTo}
              className={`col-span-2 ${quickButtonClass("custom")}`}
            >
              Υπολογισμός
            </button>
          </form>

          {reportLoading && <p className="text-neutral-500 text-sm mt-4">Υπολογισμός…</p>}
          {reportError && <p className="text-red-600 text-sm mt-4">{reportError}</p>}

          {report && (
            <div className="mt-4 border border-neutral-200 rounded-xl px-4 py-4 flex items-center gap-4">
              <div className="text-3xl font-bold text-brand-purple shrink-0">
                {report.workingHours === 0 ? "—" : `${report.percent}%`}
              </div>
              <div className="text-sm text-neutral-500 min-w-0">
                <div className="font-medium text-neutral-900">{report.title}</div>
                {report.workingHours === 0
                  ? "Κλειστά σε όλο το διάστημα"
                  : `${report.bookedHours} ώρες κλεισμένες από ${report.workingHours} ώρες λειτουργίας`}
                <br />
                {formatDateLong(report.from)} – {formatDateLong(report.to)} · {report.days}{" "}
                {report.days === 1 ? "ημέρα" : "ημέρες"}
              </div>
            </div>
          )}
        </section>
      </div>
    </SlideTransition>
  );
}
