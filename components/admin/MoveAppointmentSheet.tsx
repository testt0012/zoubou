"use client";

import { useEffect, useState, useTransition } from "react";
import BottomSheet from "@/components/admin/BottomSheet";
import WeekPicker from "@/components/admin/WeekPicker";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { getAdminSlots, moveAppointment } from "@/lib/actions/appointments";
import { formatDateLong, todayAthens } from "@/lib/time";
import type { AppointmentWithService } from "@/types/database";

// Picks a new date and one of that day's free times for an appointment.
// The times come from the same rules a new booking follows, with the
// appointment's own slot counted as free, so a small shift (e.g. 20
// minutes later) is possible too.
export default function MoveAppointmentSheet({
  appointment,
  onClose,
  onMoved,
}: {
  appointment: AppointmentWithService;
  onClose: () => void;
  onMoved: () => void;
}) {
  const { refreshAppointments } = useAdminData();
  const [date, setDate] = useState(appointment.date);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isMoving, startTransition] = useTransition();

  const currentStart = appointment.start_time.slice(0, 5);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      setSlots(null);
      setSelected("");
      setError(null);
    });

    getAdminSlots(appointment.service_id, date, appointment.id)
      .then((result) => {
        if (cancelled) return;
        if ("slots" in result) {
          // Its own current time isn't a move.
          setSlots(result.slots.filter((t) => !(date === appointment.date && t === currentStart)));
        } else {
          setSlots([]);
          setError(result.error);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setError("Σφάλμα φόρτωσης ωρών.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appointment.id, appointment.service_id, appointment.date, currentStart, date]);

  function handleMove() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await moveAppointment(appointment.id, date, selected);
      if (result.success) {
        await refreshAppointments();
        onMoved();
      } else {
        setError(result.error ?? "Κάτι πήγε στραβά.");
      }
    });
  }

  return (
    <BottomSheet title="Μετακίνηση" onClose={onClose}>
      <div className="flex flex-col gap-3 pt-1 pb-2">
        <div className="text-sm text-neutral-500">
          {appointment.first_name} {appointment.last_name} · τώρα {formatDateLong(appointment.date)},{" "}
          {currentStart}
        </div>

        <div className="flex flex-col gap-1 text-sm text-neutral-500">
          Νέα ημερομηνία
          <WeekPicker value={date} minDate={todayAthens()} onChange={setDate} />
        </div>

        <div className="text-sm text-neutral-500">Νέα ώρα</div>
        {slots === null ? (
          <p className="text-sm text-neutral-400">Φόρτωση ωρών…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-neutral-500">Δεν υπάρχουν άλλες διαθέσιμες ώρες αυτή την ημέρα.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((time) => (
              <button
                type="button"
                key={time}
                aria-pressed={selected === time}
                onClick={() => setSelected(time)}
                className={`h-12 rounded-lg border text-base tabular-nums ${
                  selected === time
                    ? "border-brand-purple bg-brand-purple text-white font-medium"
                    : "border-neutral-300 bg-white text-neutral-800"
                }`}
              >
                {time}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleMove}
          disabled={!selected || isMoving}
          className="h-12 rounded-lg bg-brand-purple text-white font-medium disabled:opacity-60"
        >
          {isMoving ? "Μετακίνηση…" : selected ? `Μετακίνηση στις ${selected}` : "Μετακίνηση"}
        </button>
      </div>
    </BottomSheet>
  );
}
