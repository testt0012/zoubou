"use client";

import { useState, useTransition } from "react";
import { cancelAppointment } from "@/lib/actions/appointments";
import MoveAppointmentSheet from "@/components/admin/MoveAppointmentSheet";
import type { AppointmentWithService } from "@/types/database";

// Rendered as one cell in a 3-column grid — just the time, tap for a modal
// with the full details (end time, service, phone, move, cancel). Cancelling
// is immediate; the "Ακυρώθηκε — Αναίρεση" undo bar that follows is owned by
// the grid (DayAppointmentGrid), not by this row: the live refresh drops a
// cancelled appointment from the list within a second, which would take the
// row — and its undo bar — with it.
export default function AppointmentRow({
  appointment,
  index = 0,
  onCancelled,
}: {
  appointment: AppointmentWithService;
  index?: number;
  onCancelled?: (appointment: AppointmentWithService) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleCancel() {
    setModalOpen(false);
    onCancelled?.(appointment);
    startTransition(() => {
      cancelAppointment(appointment.id);
    });
  }

  // The customer's details are wiped an hour after the appointment ends;
  // what's left is just the time slot it took up.
  if (appointment.first_name === null) {
    return (
      <div className="rounded-lg px-1 py-2 flex flex-col items-center gap-0.5 bg-neutral-100">
        <span className="text-sm font-semibold text-neutral-400">{appointment.start_time.slice(0, 5)}</span>
        <span className="text-[11px] text-neutral-400 leading-tight">ολοκληρώθηκε</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`rounded-lg px-1 py-2 flex flex-col items-center gap-0.5 active:opacity-70 ${
          index % 2 === 0 ? "bg-brand-purple/25" : "bg-brand-pink/25"
        }`}
      >
        <span className="text-sm font-semibold text-brand-purple">
          {appointment.start_time.slice(0, 5)}
        </span>
        <span className="text-[11px] text-neutral-500 leading-tight text-center line-clamp-2 max-w-full break-words">
          {appointment.first_name} {appointment.last_name}
        </span>
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl px-4 pt-4 pb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">
                {appointment.first_name} {appointment.last_name}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Κλείσιμο"
                className="text-neutral-400 text-2xl leading-none px-1"
              >
                ×
              </button>
            </div>

            <div className="text-sm text-neutral-600 mb-1">
              {appointment.start_time.slice(0, 5)} – {appointment.end_time.slice(0, 5)} ·{" "}
              {appointment.services?.name ?? "—"}
            </div>
            {appointment.mobile && (
              <a href={`tel:${appointment.mobile}`} className="text-sm text-brand-purple">
                {appointment.mobile}
              </a>
            )}

            <button
              type="button"
              onClick={() => setMoveOpen(true)}
              className="mt-5 w-full h-12 text-base font-medium text-brand-purple border border-brand-purple/40 rounded-lg"
            >
              Μετακίνηση
            </button>

            <button
              type="button"
              onClick={handleCancel}
              className="mt-3 w-full h-12 text-base text-red-600 border border-red-200 rounded-lg"
            >
              Ακύρωση ραντεβού
            </button>
          </div>
        </div>
      )}

      {moveOpen && (
        <MoveAppointmentSheet
          appointment={appointment}
          onClose={() => setMoveOpen(false)}
          onMoved={() => {
            setMoveOpen(false);
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}
