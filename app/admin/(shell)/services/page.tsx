"use client";

import SlideTransition from "@/components/admin/SlideTransition";
import ServiceRow from "@/components/admin/ServiceRow";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { createService } from "@/lib/actions/services";

export default function AdminServicesPage() {
  const { services } = useAdminData();
  const activeServices = services.filter((s) => s.active);

  return (
    <SlideTransition>
      <h1 className="text-lg font-semibold mb-4">Υπηρεσίες</h1>

      <div className="flex flex-col gap-3 mb-8">
        {activeServices.map((s) => (
          <ServiceRow key={s.id} service={s} />
        ))}
        {activeServices.length === 0 && (
          <p className="text-neutral-500 text-sm">Δεν υπάρχουν υπηρεσίες ακόμα.</p>
        )}
      </div>

      <details className="group border border-neutral-200 rounded-lg">
        <summary className="px-4 py-3 cursor-pointer select-none list-none flex items-center justify-between text-sm font-medium text-brand-purple">
          Νέα υπηρεσία
          <span className="text-neutral-400 transition-transform group-open:rotate-45">+</span>
        </summary>
        <form
          action={createService}
          className="px-4 pb-4 pt-3 border-t border-neutral-100 flex flex-col sm:flex-row gap-3"
        >
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
      </details>
    </SlideTransition>
  );
}
