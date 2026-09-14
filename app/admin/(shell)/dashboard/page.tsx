"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SlideTransition from "@/components/admin/SlideTransition";
import AppointmentRow from "@/components/admin/AppointmentRow";
import ManualAppointmentForm from "@/components/admin/ManualAppointmentForm";
import WeekStrip from "@/components/admin/WeekStrip";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import {
  addDays,
  athensNow,
  formatDateLong,
  formatDateShort,
  timeToMinutes,
  todayAthens,
  weekdayLabel,
  weekdayOf,
} from "@/lib/time";
import { bookedMinutesForDate, occupancyPercent, workingMinutesForDate } from "@/lib/occupancy";
import { isValidDateString } from "@/lib/validation";

export default function AdminDashboardPage() {
  const searchParams = useSearchParams();
  const { services, availabilityRules, blockedSlots, appointments, ensureAppointmentsRange } = useAdminData();
  const today = todayAthens();

  const rawWeekStart = searchParams.get("weekStart");
  const weekStart = rawWeekStart && isValidDateString(rawWeekStart) && rawWeekStart >= today ? rawWeekStart : today;
  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const rawDate = searchParams.get("date");
  const selectedDate =
    rawDate && isValidDateString(rawDate) && rawDate >= weekStart && rawDate <= weekEnd ? rawDate : weekStart;

  useEffect(() => {
    ensureAppointmentsRange(weekStart, weekEnd);
  }, [weekStart, weekEnd, ensureAppointmentsRange]);

  const now = athensNow();
  const nextAppointment =
    appointments.find((a) => a.date === today && timeToMinutes(a.start_time) >= now.minutes) ?? null;
  const todayWorkingMinutes = workingMinutesForDate(availabilityRules, blockedSlots, today);

  const selectedDayAppointments = appointments.filter((a) => a.date === selectedDate);
  const selectedDayPercent = occupancyPercent(
    bookedMinutesForDate(appointments, selectedDate),
    workingMinutesForDate(availabilityRules, blockedSlots, selectedDate)
  );

  const prevWeekStart = addDays(weekStart, -7);
  const canGoPrevWeek = prevWeekStart >= today;
  const activeServices = services.filter((s) => s.active);

  return (
    <SlideTransition>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-lg font-semibold">Ραντεβού</h1>
        {activeServices.length > 0 && (
          <ManualAppointmentForm services={activeServices} defaultDate={selectedDate} minDate={today} />
        )}
      </div>

      {nextAppointment ? (
        <div className="rounded-xl bg-brand-pink-light px-4 py-4 mb-6">
          <div className="text-xs font-medium text-brand-purple mb-1">Επόμενο ραντεβού σήμερα</div>
          <div className="text-lg font-semibold">
            {nextAppointment.start_time.slice(0, 5)} · {nextAppointment.services?.name ?? "—"}
          </div>
          <div className="text-sm text-neutral-600">
            {nextAppointment.first_name} {nextAppointment.last_name}
          </div>
          {nextAppointment.mobile && (
            <a href={`tel:${nextAppointment.mobile}`} className="text-sm text-brand-purple">
              {nextAppointment.mobile}
            </a>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 px-4 py-4 mb-6 text-center text-neutral-500 text-sm">
          {todayWorkingMinutes === 0 ? "Σήμερα είσαι κλειστός." : "Δεν έχεις άλλα ραντεβού για σήμερα."}
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        {canGoPrevWeek ? (
          <Link
            href={`/admin/dashboard?weekStart=${prevWeekStart}`}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100"
            aria-label="Προηγούμενη εβδομάδα"
          >
            ‹
          </Link>
        ) : (
          <span className="w-8 h-8" />
        )}
        <span className="text-xs text-neutral-400">
          {formatDateShort(weekStart)} – {formatDateShort(weekEnd)}
        </span>
        <Link
          href={`/admin/dashboard?weekStart=${addDays(weekStart, 7)}`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100"
          aria-label="Επόμενη εβδομάδα"
        >
          ›
        </Link>
      </div>

      <WeekStrip weekStart={weekStart} canGoPrevWeek={canGoPrevWeek}>
        <div className="grid grid-cols-7 gap-1 mb-4">
          {days.map((d) => {
            const working = workingMinutesForDate(availabilityRules, blockedSlots, d);
            const booked = bookedMinutesForDate(appointments, d);
            const percent = occupancyPercent(booked, working);
            const isSelected = d === selectedDate;
            const isToday = d === today;
            return (
              <Link
                key={d}
                href={`/admin/dashboard?weekStart=${weekStart}&date=${d}`}
                className={`relative rounded-lg border px-1 py-2 flex flex-col items-center gap-1 transition-colors ${
                  isSelected ? "border-brand-purple bg-brand-pink-light" : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <div className="text-[11px] text-neutral-500">{weekdayLabel(weekdayOf(d)).slice(0, 2)}</div>
                <div className={`text-sm font-medium ${isToday ? "text-brand-purple" : ""}`}>{d.slice(8, 10)}</div>
                <div className={`text-xs font-semibold ${working === 0 ? "text-neutral-300" : "text-brand-purple"}`}>
                  {working === 0 ? "—" : `${percent}%`}
                </div>
                {isToday && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-brand-purple" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </div>
      </WeekStrip>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-neutral-500">{formatDateLong(selectedDate)}</h2>
        <span className="text-sm font-semibold text-brand-purple">{selectedDayPercent}% πληρότητα</span>
      </div>

      {selectedDayAppointments.length === 0 ? (
        <p className="text-neutral-500 text-sm">Δεν υπάρχουν ραντεβού αυτή την ημέρα.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {selectedDayAppointments.map((a, i) => (
            <AppointmentRow key={a.id} appointment={a} index={i} />
          ))}
        </div>
      )}
    </SlideTransition>
  );
}
