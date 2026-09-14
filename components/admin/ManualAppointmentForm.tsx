"use client";

import { useEffect, useState } from "react";
import { createManualAppointment } from "@/lib/actions/appointments";

interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
}

export default function ManualAppointmentForm({
  services,
  defaultDate,
}: {
  services: ServiceOption[];
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");

  // <details> doesn't unmount its content when collapsed, so without the
  // `open` check this effect would fetch /api/slots on every dashboard
  // page load even if the admin never opens this panel.
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

  return (
    <details
      className="group mb-4 border border-neutral-200 rounded-lg overflow-hidden"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-brand-purple flex items-center justify-between">
        + Προσθήκη ραντεβού
        <span className="text-neutral-400 transition-transform group-open:rotate-45">+</span>
      </summary>
      <form
        action={createManualAppointment}
        className="px-4 pb-4 pt-4 border-t border-neutral-200 flex flex-col gap-3"
      >
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
          disabled={!hasSlots || !selectedSlot}
          className="bg-brand-purple text-white rounded-md py-2.5 text-sm font-medium disabled:opacity-60"
        >
          Προσθήκη ραντεβού
        </button>
      </form>
    </details>
  );
}
