"use client";

import { useState, useTransition } from "react";
import { cancelAppointment, uncancelAppointment } from "@/lib/actions/appointments";
import type { AppointmentWithService } from "@/types/database";

// Rendered as one cell in a 3-column grid — just the time, tap for a modal
// with the full details (end time, service, phone, cancel). Cancelling is
// immediate but shows an inline "Ακυρώθηκε — Αναίρεση" undo bar for a few
// seconds instead of a blocking confirm() dialog, since there's nowhere
// else to recover a mis-cancelled appointment from (no history by design).
const UNDO_WINDOW_MS = 5000;

export default function AppointmentRow({
  appointment,
  index = 0,
}: {
  appointment: AppointmentWithService;
  index?: number;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  function handleCancel() {
    setCancelled(true);
    setModalOpen(false);
    startTransition(() => {
      cancelAppointment(appointment.id);
    });
    window.setTimeout(() => setHidden(true), UNDO_WINDOW_MS);
  }

  function handleUndo() {
    setCancelled(false);
    startTransition(() => {
      uncancelAppointment(appointment.id);
    });
  }

  if (hidden) return null;

  if (cancelled) {
    return (
      <div className="col-span-full flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-400">
        <span className="truncate">
          Ακυρώθηκε — {appointment.first_name} {appointment.last_name}
        </span>
        <button type="button" onClick={handleUndo} className="text-brand-purple font-medium shrink-0">
          Αναίρεση
        </button>
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
              onClick={handleCancel}
              className="mt-5 w-full text-sm text-red-600 border border-red-200 rounded-md py-2.5"
            >
              Ακύρωση ραντεβού
            </button>
          </div>
        </div>
      )}
    </>
  );
}
