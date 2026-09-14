import CancelAppointmentButton from "@/components/admin/CancelAppointmentButton";
import type { AppointmentWithService } from "@/types/database";

export default function AppointmentRow({ appointment }: { appointment: AppointmentWithService }) {
  return (
    <div className="flex items-stretch gap-3 rounded-lg border border-neutral-200 overflow-hidden">
      <div className="w-16 shrink-0 bg-brand-pink-light text-brand-purple flex flex-col items-center justify-center text-sm font-semibold py-2">
        <span>{appointment.start_time.slice(0, 5)}</span>
        <span className="text-[11px] font-normal opacity-70">{appointment.end_time.slice(0, 5)}</span>
      </div>
      <div className="flex-1 py-2 pr-3 flex items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-medium">
            {appointment.first_name} {appointment.last_name}
          </div>
          <div className="text-neutral-500">{appointment.services?.name ?? "—"}</div>
          {appointment.mobile && (
            <a href={`tel:${appointment.mobile}`} className="text-brand-purple">
              {appointment.mobile}
            </a>
          )}
        </div>
        <CancelAppointmentButton id={appointment.id} />
      </div>
    </div>
  );
}
