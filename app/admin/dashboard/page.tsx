import { requireAdmin } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import CancelAppointmentButton from "@/components/admin/CancelAppointmentButton";
import { formatDateLong, todayAthens } from "@/lib/time";
import type { AppointmentWithService } from "@/types/database";

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();
  const today = todayAthens();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, services(id, name, duration_minutes)")
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  const all = (appointments ?? []) as AppointmentWithService[];
  const upcoming = all.filter((a) => a.status === "confirmed" && a.date >= today);
  const history = all
    .filter((a) => a.status === "cancelled" || a.date < today)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <AdminShell>
      <h1 className="text-lg font-semibold mb-4">Επερχόμενα ραντεβού</h1>
      {upcoming.length === 0 ? (
        <p className="text-neutral-500 text-sm mb-8">Δεν υπάρχουν επερχόμενα ραντεβού.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-8">
          {upcoming.map((a) => (
            <AppointmentRow key={a.id} appointment={a} showCancel />
          ))}
        </div>
      )}

      <h2 className="text-base font-semibold mb-4">Ιστορικό</h2>
      {history.length === 0 ? (
        <p className="text-neutral-500 text-sm">Δεν υπάρχει ιστορικό ακόμα.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((a) => (
            <AppointmentRow key={a.id} appointment={a} />
          ))}
        </div>
      )}
    </AdminShell>
  );
}

function AppointmentRow({
  appointment,
  showCancel,
}: {
  appointment: AppointmentWithService;
  showCancel?: boolean;
}) {
  return (
    <div className="border border-neutral-200 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
      <div className="text-sm">
        <div className="font-medium">
          {appointment.first_name} {appointment.last_name}
        </div>
        <div className="text-neutral-500">{formatDateLong(appointment.date)}</div>
        <div className="text-neutral-500">
          {appointment.start_time.slice(0, 5)} – {appointment.end_time.slice(0, 5)} ·{" "}
          {appointment.services?.name ?? "—"}
        </div>
        <a href={`tel:${appointment.mobile}`} className="text-brand-purple">
          {appointment.mobile}
        </a>
      </div>
      <div className="text-right flex flex-col items-end gap-2 shrink-0">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            appointment.status === "cancelled"
              ? "bg-neutral-100 text-neutral-500"
              : "bg-brand-pink-light text-brand-purple"
          }`}
        >
          {appointment.status === "cancelled" ? "Ακυρωμένο" : "Επιβεβαιωμένο"}
        </span>
        {showCancel && appointment.status === "confirmed" && (
          <CancelAppointmentButton id={appointment.id} />
        )}
      </div>
    </div>
  );
}
