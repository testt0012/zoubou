"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SlideTransition from "@/components/admin/SlideTransition";
import AppointmentRow from "@/components/admin/AppointmentRow";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { createClient } from "@/lib/supabase/client";
import { addDays, eachDate, formatDateLong, formatDateShort, startOfWeek, todayAthens } from "@/lib/time";
import { bookedMinutesForDate, occupancyPercent, workingMinutesForDate } from "@/lib/occupancy";
import { isValidDateString } from "@/lib/validation";
import type { AppointmentWithService, BlockedSlot } from "@/types/database";

const MAX_REPORT_DAYS = 366;
const SHORT_WEEKDAYS = ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"];

interface RangeReport {
  from: string;
  to: string;
  bookedHours: number;
  workingHours: number;
  percent: number;
}

export default function AdminReportsPage() {
  const searchParams = useSearchParams();
  const { availabilityRules, blockedSlots, appointments, ensureAppointmentsRange } = useAdminData();
  const today = todayAthens();

  const view = searchParams.get("calView") === "day" ? "day" : "week";
  const rawCalDate = searchParams.get("calDate");
  const calDate = rawCalDate && isValidDateString(rawCalDate) ? rawCalDate : today;

  const rangeStart = view === "week" ? startOfWeek(calDate) : calDate;
  const rangeEnd = view === "week" ? addDays(rangeStart, 6) : calDate;
  const rangeDates = eachDate(rangeStart, rangeEnd);

  useEffect(() => {
    ensureAppointmentsRange(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd, ensureAppointmentsRange]);

  // Custom-range occupancy report ("από/έως" -> % booked hours vs. working
  // hours). Kept as its own on-demand fetch — it can target historical
  // dates outside the forward-looking cache window, and it's an explicit
  // "calculate" action anyway, so a moment's fetch is expected.
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<RangeReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  async function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setReport(null);
    setReportError(null);

    if (!isValidDateString(reportFrom) || !isValidDateString(reportTo) || reportFrom > reportTo) {
      setReportError("Επιλέξτε έγκυρο εύρος ημερομηνιών.");
      return;
    }

    const spanDays =
      Math.round(
        (new Date(`${reportTo}T00:00:00Z`).getTime() - new Date(`${reportFrom}T00:00:00Z`).getTime()) / 86400000
      ) + 1;

    if (spanDays > MAX_REPORT_DAYS) {
      setReportError("Το εύρος είναι πολύ μεγάλο.");
      return;
    }

    setReportLoading(true);
    const supabase = createClient();
    const [{ data: reportBlocked }, { data: reportAppointments }] = await Promise.all([
      supabase.from("blocked_slots").select("date, start_time, end_time").gte("date", reportFrom).lte("date", reportTo),
      supabase
        .from("appointments")
        .select("date, start_time, end_time")
        .eq("status", "confirmed")
        .gte("date", reportFrom)
        .lte("date", reportTo),
    ]);
    setReportLoading(false);

    const reportBlockedList = (reportBlocked ?? []) as BlockedSlot[];
    const reportAppointmentsList = (reportAppointments ?? []) as {
      date: string;
      start_time: string;
      end_time: string;
    }[];

    let workingMinutes = 0;
    let bookedMinutes = 0;
    for (const d of eachDate(reportFrom, reportTo)) {
      workingMinutes += workingMinutesForDate(availabilityRules, reportBlockedList, d);
      bookedMinutes += bookedMinutesForDate(reportAppointmentsList, d);
    }

    setReport({
      from: reportFrom,
      to: reportTo,
      workingHours: Math.round((workingMinutes / 60) * 10) / 10,
      bookedHours: Math.round((bookedMinutes / 60) * 10) / 10,
      percent: occupancyPercent(bookedMinutes, workingMinutes),
    });
  }

  return (
    <SlideTransition>
      <h1 className="text-lg font-semibold mb-6">Αναφορές</h1>

      <div className="flex flex-col gap-8">
        <section>
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-base font-semibold">Πληρότητα ραντεβού</h2>
            <div className="flex rounded-full bg-neutral-100 p-1 text-sm shrink-0">
              <Link
                href={`/admin/reports?calView=day&calDate=${calDate}`}
                className={`px-3 py-1 rounded-full transition-colors ${
                  view === "day" ? "bg-white shadow-sm font-medium" : "text-neutral-500"
                }`}
              >
                Ημέρα
              </Link>
              <Link
                href={`/admin/reports?calView=week&calDate=${calDate}`}
                className={`px-3 py-1 rounded-full transition-colors ${
                  view === "week" ? "bg-white shadow-sm font-medium" : "text-neutral-500"
                }`}
              >
                Εβδομάδα
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <Link
              href={`/admin/reports?calView=${view}&calDate=${addDays(calDate, view === "week" ? -7 : -1)}`}
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 shrink-0"
              aria-label="Προηγούμενο"
            >
              ‹
            </Link>
            <div className="text-sm font-medium text-center">
              {view === "week" ? (
                <>
                  {formatDateShort(rangeStart)} – {formatDateShort(rangeEnd)}
                </>
              ) : (
                formatDateLong(calDate)
              )}
              {calDate !== today && (
                <Link
                  href={`/admin/reports?calView=${view}&calDate=${today}`}
                  className="block text-xs text-brand-purple mt-0.5"
                >
                  Σήμερα
                </Link>
              )}
            </div>
            <Link
              href={`/admin/reports?calView=${view}&calDate=${addDays(calDate, view === "week" ? 7 : 1)}`}
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 shrink-0"
              aria-label="Επόμενο"
            >
              ›
            </Link>
          </div>

          {view === "week" ? (
            <div className="grid grid-cols-7 gap-1">
              {rangeDates.map((d, i) => {
                const working = workingMinutesForDate(availabilityRules, blockedSlots, d);
                const booked = bookedMinutesForDate(appointments, d);
                const percent = occupancyPercent(booked, working);
                const isToday = d === today;
                return (
                  <Link
                    key={d}
                    href={`/admin/reports?calView=day&calDate=${d}`}
                    className={`rounded-lg border px-1 py-2 flex flex-col items-center gap-1 ${
                      isToday ? "border-brand-purple" : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <div className="text-[11px] text-neutral-500">{SHORT_WEEKDAYS[i]}</div>
                    <div className="text-sm font-medium">{d.slice(8, 10)}</div>
                    <div
                      className={`text-xs font-semibold ${
                        working === 0 ? "text-neutral-300" : "text-brand-purple"
                      }`}
                    >
                      {working === 0 ? "—" : `${percent}%`}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <DaySchedule
              date={calDate}
              appointments={appointments}
              percent={occupancyPercent(
                bookedMinutesForDate(appointments, calDate),
                workingMinutesForDate(availabilityRules, blockedSlots, calDate)
              )}
            />
          )}
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">Ποσοστό πληρότητας για διάστημα</h2>
          <form onSubmit={handleReportSubmit} className="border border-neutral-200 rounded-lg px-4 py-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="reportFrom" className="block text-sm font-medium mb-1">
                Από
              </label>
              <input
                id="reportFrom"
                type="date"
                required
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="reportTo" className="block text-sm font-medium mb-1">
                Έως
              </label>
              <input
                id="reportTo"
                type="date"
                required
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={reportLoading}
              className="bg-brand-purple text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {reportLoading ? "Υπολογισμός…" : "Υπολογισμός"}
            </button>
          </form>

          {reportError && <p className="text-red-600 text-sm mt-3">{reportError}</p>}

          {report && (
            <div className="mt-4 border border-neutral-200 rounded-lg px-4 py-4 flex items-center gap-4">
              <div className="text-3xl font-bold text-brand-purple shrink-0">{report.percent}%</div>
              <div className="text-sm text-neutral-500">
                {report.bookedHours} ώρες κλεισμένες από {report.workingHours} ώρες λειτουργίας
                <br />
                {formatDateLong(report.from)} – {formatDateLong(report.to)}
              </div>
            </div>
          )}
        </section>
      </div>
    </SlideTransition>
  );
}

function DaySchedule({
  date,
  appointments,
  percent,
}: {
  date: string;
  appointments: AppointmentWithService[];
  percent: number;
}) {
  const dayAppointments = appointments.filter((a) => a.date === date);

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-neutral-500">Πληρότητα ημέρας</span>
          <span className="font-semibold text-brand-purple">{percent}%</span>
        </div>
        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
          <div
            className="h-full bg-brand-purple rounded-full transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {dayAppointments.length === 0 ? (
        <p className="text-neutral-500 text-sm">Δεν υπάρχουν ραντεβού αυτή την ημέρα.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {dayAppointments.map((a, i) => (
            <AppointmentRow key={a.id} appointment={a} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
