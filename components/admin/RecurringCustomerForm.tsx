"use client";

import { useState, useTransition } from "react";
import { addRecurringCustomer } from "@/lib/actions/recurring";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import AffectedAppointments, { appointmentToAffected } from "@/components/admin/AffectedAppointments";
import DatePicker from "@/components/admin/DatePicker";
import TimePicker from "@/components/admin/TimePicker";
import ToggleRow from "@/components/admin/ToggleRow";
import { occursOn } from "@/lib/recurring";
import { minutesToTime, timeToMinutes, weekdayLabel, weekdayOf } from "@/lib/time";
import type { AppointmentWithService } from "@/types/database";

interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
}

const INTERVALS = [1, 2, 3];
const FIELD_CLASS = "w-full min-w-0 h-12 border border-neutral-300 rounded-lg px-3 bg-white text-base text-neutral-900";
const LABEL_CLASS = "flex flex-col gap-1 text-sm text-neutral-500 min-w-0";

// Adds a regular customer: someone who comes every 1, 2 or 3 weeks on the
// same weekday. Either at a fixed time (that time is then never offered to
// anyone else), or — with "Ζώνη ώρας" on — anywhere inside a time zone, in
// which case the booking flow always keeps one opening in it for them.
export default function RecurringCustomerForm({
  services,
  defaultDate,
  minDate,
}: {
  services: ServiceOption[];
  defaultDate: string;
  minDate: string;
}) {
  const { appointments, refreshRecurringCustomers } = useAdminData();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [startDate, setStartDate] = useState(defaultDate);
  const [intervalWeeks, setIntervalWeeks] = useState(1);
  const [zone, setZone] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [conflicts, setConflicts] = useState<AppointmentWithService[] | null>(null);
  const [isSubmitting, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const duration = services.find((s) => s.id === serviceId)?.duration_minutes ?? 0;
  // The earliest a zone can end: it has to fit the service at least once.
  const earliestZoneEnd = startTime ? minutesToTime(Math.min(timeToMinutes(startTime) + duration, 24 * 60 - 1)) : undefined;
  const complete = !!firstName.trim() && !!lastName.trim() && !!serviceId && !!startDate && !!startTime && (!zone || !!endTime);

  function handleOpen() {
    setFirstName("");
    setLastName("");
    setMobile("");
    setServiceId(services[0]?.id ?? "");
    setStartDate(defaultDate);
    setIntervalWeeks(1);
    setZone(false);
    setStartTime("");
    setEndTime("");
    setConflicts(null);
    setSubmitError(null);
    setOpen(true);
  }

  // Already-booked appointments that a fixed standing time would land on.
  // (A zone never collides: it only claims an opening that is still free.)
  function findConflicts(): AppointmentWithService[] {
    if (zone) return [];
    const start = timeToMinutes(startTime);
    const end = start + duration;
    return appointments.filter(
      (a) =>
        occursOn({ startDate, intervalWeeks }, a.date) &&
        timeToMinutes(a.start_time) < end &&
        start < timeToMinutes(a.end_time)
    );
  }

  function submit() {
    setSubmitError(null);
    startTransition(async () => {
      const result = await addRecurringCustomer({
        firstName,
        lastName,
        mobile,
        serviceId,
        startDate,
        intervalWeeks,
        startTime,
        zoneEndTime: zone ? endTime : null,
      });
      if (result.success) {
        await refreshRecurringCustomers();
        setOpen(false);
      } else {
        setConflicts(null);
        setSubmitError(result.error ?? "Κάτι πήγε στραβά.");
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete) return;
    const found = findConflicts();
    if (found.length > 0) {
      setConflicts(found);
      return;
    }
    submit();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="shrink-0 border border-brand-purple text-brand-purple text-sm font-medium rounded-full px-3.5 py-1.5 active:scale-95 transition-transform"
      >
        Μόνιμος+
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl px-4 pt-4 pb-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Προσθήκη μόνιμου πελάτη</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Κλείσιμο"
                className="flex items-center justify-center w-10 h-10 -mr-2 text-neutral-400 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <label className={LABEL_CLASS}>
                  Όνομα
                  <input
                    required
                    autoComplete="off"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={FIELD_CLASS}
                  />
                </label>
                <label className={LABEL_CLASS}>
                  Επώνυμο
                  <input
                    required
                    autoComplete="off"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={FIELD_CLASS}
                  />
                </label>
              </div>

              <label className={LABEL_CLASS}>
                Κινητό (προαιρετικό)
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="69XXXXXXXX"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className={FIELD_CLASS}
                />
              </label>

              <label className={LABEL_CLASS}>
                Υπηρεσία
                <select
                  required
                  value={serviceId}
                  onChange={(e) => {
                    setServiceId(e.target.value);
                    setEndTime("");
                    setConflicts(null);
                  }}
                  className={FIELD_CLASS}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes}′)
                    </option>
                  ))}
                </select>
              </label>

              <div className={LABEL_CLASS}>
                Πρώτη επίσκεψη
                <DatePicker
                  title="Πρώτη επίσκεψη"
                  value={startDate}
                  minDate={minDate}
                  onChange={(v) => {
                    setStartDate(v);
                    setConflicts(null);
                  }}
                  className={FIELD_CLASS}
                />
              </div>

              <div className={LABEL_CLASS}>
                Κάθε πόσες εβδομάδες{startDate ? ` (${weekdayLabel(weekdayOf(startDate))})` : ""}
                <div className="grid grid-cols-3 gap-2">
                  {INTERVALS.map((n) => (
                    <button
                      type="button"
                      key={n}
                      aria-pressed={intervalWeeks === n}
                      onClick={() => {
                        setIntervalWeeks(n);
                        setConflicts(null);
                      }}
                      className={`h-12 rounded-lg border text-base font-medium ${
                        intervalWeeks === n
                          ? "border-brand-purple bg-brand-purple text-white"
                          : "border-neutral-300 bg-white text-neutral-700"
                      }`}
                    >
                      {n === 1 ? "Κάθε 1" : `Κάθε ${n}`}
                    </button>
                  ))}
                </div>
              </div>

              <ToggleRow
                label="Ζώνη ώρας"
                checked={zone}
                onChange={(next) => {
                  setZone(next);
                  setEndTime("");
                  setConflicts(null);
                }}
              />

              {zone ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={LABEL_CLASS}>
                      Από
                      <TimePicker
                        title="Ζώνη από"
                        value={startTime}
                        onChange={(v) => {
                          setStartTime(v);
                          if (endTime && timeToMinutes(endTime) - timeToMinutes(v) < duration) setEndTime("");
                        }}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div className={LABEL_CLASS}>
                      Έως
                      <TimePicker
                        title="Ζώνη έως"
                        value={endTime}
                        min={earliestZoneEnd}
                        onChange={setEndTime}
                        className={FIELD_CLASS}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-neutral-500">
                    Μέσα στη ζώνη θα μένει πάντα ένα κενό για αυτόν: όταν μείνει μόνο μία ελεύθερη ώρα, κλείνει
                    αυτόματα.
                  </p>
                </>
              ) : (
                <div className={LABEL_CLASS}>
                  Ώρα
                  <TimePicker
                    title="Ώρα"
                    value={startTime}
                    onChange={(v) => {
                      setStartTime(v);
                      setConflicts(null);
                    }}
                    className={FIELD_CLASS}
                  />
                </div>
              )}

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}

              {conflicts && conflicts.length > 0 ? (
                <AffectedAppointments
                  people={conflicts.map(appointmentToAffected)}
                  confirmed={false}
                  confirmLabel="Προσθήκη παρόλα αυτά"
                  onConfirm={submit}
                  onDismiss={() => setConflicts(null)}
                />
              ) : (
                <button
                  type="submit"
                  disabled={!complete || isSubmitting}
                  className="h-12 rounded-lg bg-brand-purple text-white font-medium disabled:opacity-60"
                >
                  {isSubmitting ? "Αποθήκευση…" : "Προσθήκη"}
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
