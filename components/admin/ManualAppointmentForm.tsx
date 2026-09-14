"use client";

import { useEffect, useState, useTransition } from "react";
import { createManualAppointment } from "@/lib/actions/appointments";

interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
}

export default function ManualAppointmentForm({
  services,
  defaultDate,
  minDate,
}: {
  services: ServiceOption[];
  defaultDate: string;
  minDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [isSubmitting, startTransition] = useTransition();

  // The modal unmounts the form entirely when closed, so this effect
  // (unlike its old <details>-based version) already only fetches while
  // the admin is actually looking at it.
  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      setSelectedSlot("");
      setSlots(null);
      setLoadingSlots(open && !!serviceId && !!date);
    });

    if (!open || !serviceId || !date) {
      return () => {
        cancelled = true;
      };
    }

    fetch(`/api/slots?serviceId=${serviceId}&date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, serviceId, date]);

  const hasSlots = !!slots && slots.length > 0;

  function handleOpen() {
    setServiceId(services[0]?.id ?? "");
    setDate(defaultDate);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await createManualAppointment(formData);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="shrink-0 bg-brand-purple text-white text-sm font-medium rounded-full px-3.5 py-1.5 active:scale-95 transition-transform"
      >
        Προσθήκη+
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl px-4 pt-4 pb-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Προσθήκη ραντεβού</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Κλείσιμο"
                className="text-neutral-400 text-2xl leading-none px-1"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label htmlFor="service_id" className="block text-sm font-medium mb-1">
                  Υπηρεσία
                </label>
                <select
                  id="service_id"
                  name="service_id"
                  required
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes}′)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="date" className="block text-sm font-medium mb-1">
                    Ημερομηνία
                  </label>
                  <input
                    id="date"
                    type="date"
                    name="date"
                    required
                    min={minDate}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="start_time" className="block text-sm font-medium mb-1">
                    Ώρα
                  </label>
                  <select
                    id="start_time"
                    name="start_time"
                    required
                    disabled={!hasSlots}
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm disabled:text-neutral-400"
                  >
                    <option value="" disabled>
                      {loadingSlots
                        ? "Φόρτωση…"
                        : hasSlots
                          ? "Επιλέξτε ώρα"
                          : "Καμία διαθέσιμη ώρα"}
                    </option>
                    {slots?.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="first_name" className="block text-sm font-medium mb-1">
                    Όνομα
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    required
                    maxLength={60}
                    className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="last_name" className="block text-sm font-medium mb-1">
                    Επώνυμο
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    required
                    maxLength={60}
                    className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="mobile" className="block text-sm font-medium mb-1">
                  Κινητό τηλέφωνο (προαιρετικό)
                </label>
                <input
                  id="mobile"
                  name="mobile"
                  inputMode="numeric"
                  placeholder="69XXXXXXXX"
                  maxLength={10}
                  className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={!hasSlots || !selectedSlot || isSubmitting}
                className="bg-brand-purple text-white rounded-md py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {isSubmitting ? "Προσθήκη…" : "Προσθήκη ραντεβού"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
