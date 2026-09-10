"use client";

import { cancelAppointment } from "@/lib/actions/appointments";

export default function CancelAppointmentButton({ id }: { id: string }) {
  return (
    <form
      action={cancelAppointment}
      onSubmit={(e) => {
        if (!confirm("Ακύρωση αυτού του ραντεβού;")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm text-red-600">
        Ακύρωση
      </button>
    </form>
  );
}
