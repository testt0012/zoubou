"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { addRecurringCustomer, updateRecurringCustomer } from "@/lib/actions/recurring";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import AffectedAppointments, { appointmentToAffected } from "@/components/admin/AffectedAppointments";
import DatePicker from "@/components/admin/DatePicker";
import TimePicker from "@/components/admin/TimePicker";
import ToggleRow from "@/components/admin/ToggleRow";
import { occursOn } from "@/lib/recurring";
import { minutesToTime, timeToMinutes, weekdayLabel, weekdayOf } from "@/lib/time";
import type { AppointmentWithService, RecurringCustomer } from "@/types/database";

interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
}

const INTERVALS = [1, 2, 3];
const FIELD_CLASS = "w-full min-w-0 h-12 border border-neutral-300 rounded-lg px-3 bg-white text-base text-neutral-900";
const LABEL_CLASS = "flex flex-col gap-1 text-sm text-neutral-500 min-w-0";

// The add / edit form for a regular customer: someone who comes every 1, 2
// or 3 weeks on the same weekday. Either at a fixed time (that time is then
// never offered to anyone else), or — with "Ζώνη ώρας" on — anywhere inside
// a time zone, in which case the booking flow always keeps one opening in
// it for them. With `initial` it edits that customer instead of adding one.
// Mounted only while open, so it always starts from fresh state.
export function RecurringCustomerModal({
  services,
  initial,
  defaultDate,
  minDate,
  onClose,
  onSaved,
}: {
  services: ServiceOption[];
  initial?: RecurringCustomer;
  defaultDate: string;
  minDate?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { appointments, refreshRecurringCustomers } = useAdminData();
  const [firstName, setFirstName] = useState(initial?.first_name ?? "");
  const [lastName, setLastName] = useState(initial?.last_name ?? "");
  const [mobile, setMobile] = useState(initial?.mobile ?? "");
  const [serviceId, setServiceId] = useState(initial?.service_id ?? services[0]?.id ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? defaultDate);
  const [intervalWeeks, setIntervalWeeks] = useState(initial?.interval_weeks ?? 1);
  const [zone, setZone] = useState(!!initial?.zone_end_time);
  const [startTime, setStartTime] = useState(initial?.start_time.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(initial?.zone_end_time?.slice(0, 5) ?? "");
  const [conflicts, setConflicts] = useState<AppointmentWithService[] | null>(null);
  const [isSubmitting, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const duration = services.find((s) => s.id === serviceId)?.duration_minutes ?? 0;
  // The earliest a zone can end: it has to fit the service at least once.
  const earliestZoneEnd = startTime ? minutesToTime(Math.min(timeToMinutes(startTime) + duration, 24 * 60 - 1)) : undefined;
  const complete = !!firstName.trim() && !!lastName.trim() && !!serviceId && !!startDate && !!startTime && (!zone || !!endTime);

  // Already-booked appointments that a fixed standing time would land on.
  // (A zone never collides: it only claims an opening that is still free.)
  function findConflicts(): AppointmentWithService[] {
    if (zone) return [];
    const start = timeToMinutes(startTime);
    const end = start + duration;
    return appointments.filter(
      (a) =>
        a.first_name !== null &&
        occursOn({ startDate, intervalWeeks, skippedDates: initial?.skipped_dates }, a.date) &&
        timeToMinutes(a.start_time) < end &&
        start < timeToMinutes(a.end_time)
    );
  }

  function submit() {
    setSubmitError(null);
    startTransition(async () => {
      const input = {
        firstName,
        lastName,
        mobile,
        serviceId,
        startDate,
        intervalWeeks,
        startTime,
        zoneEndTime: zone ? endTime : null,
      };
      const result = initial ? await updateRecurringCustomer(initial.id, input) : await addRecurringCustomer(input);
      if (result.success) {
        await refreshRecurringCustomers();
        onSaved?.();
        onClose();
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl px-4 pt-4 pb-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">
            {initial ? "Επεξεργασία μόνιμου πελάτη" : "Προσθήκη μόνιμου πελάτη"}
          </h2>
          <button
            type="button"
            onClick={onClose}
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
                  confirmLabel={initial ? "Αποθήκευση παρόλα αυτά" : "Προσθήκη παρόλα αυτά"}
                  onConfirm={submit}
                  onDismiss={() => setConflicts(null)}
                />
              ) : (
                <button
                  type="submit"
                  disabled={!complete || isSubmitting}
                  className="h-12 rounded-lg bg-brand-purple text-white font-medium disabled:opacity-60"
                >
                  {isSubmitting ? "Αποθήκευση…" : initial ? "Αποθήκευση" : "Προσθήκη"}
                </button>
              )}
        </form>
      </div>
    </div>,
    document.body
  );
}

// The "Μόνιμος+" button in the appointments header: opens the add form.
export default function RecurringCustomerForm({
  services,
  defaultDate,
  minDate,
}: {
  services: ServiceOption[];
  defaultDate: string;
  minDate: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 border border-brand-purple text-brand-purple text-sm font-medium rounded-full px-3.5 py-1.5 active:scale-95 transition-transform"
      >
        Μόνιμος+
      </button>

      {open && (
        <RecurringCustomerModal
          services={services}
          defaultDate={defaultDate}
          minDate={minDate}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
