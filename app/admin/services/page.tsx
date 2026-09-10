import { requireAdmin } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import { createService, toggleServiceActive, updateService } from "@/lib/actions/services";
import type { Service } from "@/types/database";

export default async function AdminServicesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });

  const services = (data ?? []) as Service[];

  return (
    <AdminShell>
      <h1 className="text-lg font-semibold mb-4">Υπηρεσίες</h1>

      <div className="flex flex-col gap-3 mb-8">
        {services.map((s) => (
          <form
            key={s.id}
            action={updateService}
            className="border border-neutral-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <input type="hidden" name="id" value={s.id} />
            <input
              name="name"
              defaultValue={s.name}
              required
              className="flex-1 border border-neutral-300 rounded-md px-3 py-2"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="duration_minutes"
                defaultValue={s.duration_minutes}
                min={1}
                max={480}
                required
                className="w-24 border border-neutral-300 rounded-md px-3 py-2"
              />
              <span className="text-sm text-neutral-500">λεπτά</span>
            </div>
            <button
              type="submit"
              className="bg-brand-purple text-white rounded-md px-4 py-2 text-sm font-medium"
            >
              Αποθήκευση
            </button>
            <ToggleActiveButton id={s.id} active={s.active} />
          </form>
        ))}
        {services.length === 0 && (
          <p className="text-neutral-500 text-sm">Δεν υπάρχουν υπηρεσίες ακόμα.</p>
        )}
      </div>

      <h2 className="text-base font-semibold mb-3">Νέα υπηρεσία</h2>
      <form action={createService} className="flex flex-col sm:flex-row gap-3">
        <input
          name="name"
          placeholder="π.χ. Παιδικό κούρεμα"
          required
          className="flex-1 border border-neutral-300 rounded-md px-3 py-2"
        />
        <input
          type="number"
          name="duration_minutes"
          placeholder="Λεπτά"
          min={1}
          max={480}
          required
          className="w-full sm:w-28 border border-neutral-300 rounded-md px-3 py-2"
        />
        <button
          type="submit"
          className="bg-brand-purple text-white rounded-md px-4 py-2 text-sm font-medium"
        >
          Προσθήκη
        </button>
      </form>
    </AdminShell>
  );
}

function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  return (
    <form action={toggleServiceActive}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(active)} />
      <button
        type="submit"
        className={`text-sm rounded-md px-3 py-2 border ${
          active ? "border-neutral-300 text-neutral-600" : "border-brand-purple text-brand-purple"
        }`}
      >
        {active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
      </button>
    </form>
  );
}
