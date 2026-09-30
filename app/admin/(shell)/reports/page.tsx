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
import { addMonths, classifyDays, dayTotals, previousMonthRange, previousWeekRange, type DayTotals } from "@/lib/reports";
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
  // Set when part of the period has no recorded days (the app has no data
  // from before then): the figures cover only the days from this date on.
  coveredFrom: string | null;
  // The whole period is older than anything recorded: there is nothing to
  // report (as opposed to a period the shop was simply closed for).
  noData: boolean;
  firstRecorded: string | null;
  days: number;
  bookedHours: number;
  workingHours: number;
  percent: number;
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

// The frozen per-day totals (see migration 0013 / lib/stats.ts) for the
// dates in [from, to], plus the first day ever recorded. Null when they
// can't be read (e.g. the table doesn't exist yet) — callers then compute
// every day live, as before.
async function loadSnapshots(
  from: string,
  to: string
): Promise<{ days: Map<string, DayTotals>; first: string | null } | null> {
  const supabase = createClient();
  const days = new Map<string, DayTotals>();

  const { data: first, error: firstError } = await supabase
    .from("daily_stats")
    .select("date")
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (firstError) return null;

  if (from <= to) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("daily_stats")
        .select("date, working_minutes, booked_minutes")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) return null;
      for (const row of data ?? []) {
        days.set(row.date as string, { working: row.working_minutes as number, booked: row.booked_minutes as number });
      }
      if (!data || data.length < PAGE_SIZE) break;
    }
  }

  return { days, first: (first?.date as string | undefined) ?? null };
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

  // Past days of the shown week come from the frozen totals rather than
  // being recomputed from today's hours and regulars.
  const yesterday = addDays(today, -1);
  const [weekSnapshots, setWeekSnapshots] = useState<Map<string, DayTotals>>(new Map());
  useEffect(() => {
    if (rangeStart > yesterday) return;
    let cancelled = false;
    loadSnapshots(rangeStart, rangeEnd < yesterday ? rangeEnd : yesterday).then((snapshots) => {
      if (!cancelled) setWeekSnapshots(snapshots?.days ?? new Map());
    });
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, yesterday]);

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

    const dates = eachDate(from, to).filter((d) => weekday === undefined || weekdayOf(d) === weekday);
    const snapshots = await loadSnapshots(from, to < yesterday ? to : yesterday);

    // Each day is one of: read from the frozen totals; left out, because it
    // is older than anything ever recorded; or computed live from the
    // current hours (today and later, or a day the nightly job hasn't
    // frozen yet).
    const sorted = classifyDays(dates, today, snapshots?.days ?? null, snapshots?.first ?? null);
    const live = sorted.live;
    const counted = [...sorted.frozen.map((f) => f.date), ...live].sort();
    let workingMinutes = 0;
    let bookedMinutes = 0;
    for (const { totals } of sorted.frozen) {
      workingMinutes += totals.working;
      bookedMinutes += totals.booked;
    }

    if (live.length > 0) {
      const liveFrom = live[0];
      const liveTo = live[live.length - 1];
      const [reportBlockedList, reportAppointmentsList] = await Promise.all([
        fetchSpans("blocked_slots", liveFrom, liveTo),
        fetchSpans("appointments", liveFrom, liveTo),
      ]);
      for (const d of live) {
        // Regular customers' standing visits count as booked time too.
        const totals = dayTotals(
          workingMinutesForDate(availabilityRules, reportBlockedList, d),
          bookedMinutesForDate(reportAppointmentsList, d) +
            recurringMinutesForDate(visits, availabilityRules, reportBlockedList, reportAppointmentsList, d)
        );
        workingMinutes += totals.working;
        bookedMinutes += totals.booked;
      }
    }
    setReportLoading(false);

    setReport({
      title,
      from,
      to,
      coveredFrom: counted.length < dates.length && counted.length > 0 ? counted[0] : null,
      noData: counted.length === 0 && dates.length > 0,
      firstRecorded: snapshots?.first ?? null,
      days: counted.length,
      workingHours: Math.round((workingMinutes / 60) * 10) / 10,
      bookedHours: Math.round((bookedMinutes / 60) * 10) / 10,
      percent: occupancyPercent(bookedMinutes, workingMinutes),
    });
  }

  // Monday to Sunday of the week before this one.
  function runPreviousWeek() {
    const { from, to } = previousWeekRange(today);
    runReport("week", "Προηγούμενη εβδομάδα", from, to);
  }

  // The whole previous month, 1st to last day.
  function runPreviousMonth() {
    const { from, to } = previousMonthRange(today);
    runReport("month", "Προηγούμενος μήνας", from, to);
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
              const frozen = d < today ? weekSnapshots.get(d) : undefined;
              const working = frozen ? frozen.working : workingMinutesForDate(availabilityRules, blockedSlots, d);
              const percent = occupancyPercent(frozen ? frozen.booked : takenMinutesFor(d), working);
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
                {report.noData || report.workingHours === 0 ? "—" : `${report.percent}%`}
              </div>
              <div className="text-sm text-neutral-500 min-w-0">
                <div className="font-medium text-neutral-900">{report.title}</div>
                {report.noData ? (
                  <>
                    Δεν υπάρχουν καταγραφές για αυτό το διάστημα
                    {report.firstRecorded && <> — οι καταγραφές ξεκινούν από {formatDateShort(report.firstRecorded)}</>}.
                  </>
                ) : report.workingHours === 0 ? (
                  "Κλειστά σε όλο το διάστημα"
                ) : (
                  `${report.bookedHours} ώρες κλεισμένες από ${report.workingHours} ώρες λειτουργίας`
                )}
                <br />
                {formatDateLong(report.from)} – {formatDateLong(report.to)}
                {!report.noData && (
                  <>
                    {" "}
                    · {report.days} {report.days === 1 ? "ημέρα" : "ημέρες"}
                  </>
                )}
                {report.coveredFrom && (
                  <span className="block mt-1 text-xs text-neutral-400">
                    Υπολογίστηκε από {formatDateShort(report.coveredFrom)} — δεν υπάρχουν καταγραφές πριν.
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </SlideTransition>
  );
}
