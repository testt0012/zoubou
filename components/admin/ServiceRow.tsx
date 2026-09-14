"use client";

import { useState } from "react";
import { deleteService, updateService } from "@/lib/actions/services";
import type { Service } from "@/types/database";

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M4 7h16M9.5 7V4.8c0-.44.36-.8.8-.8h3.4c.44 0 .8.36.8.8V7M6.5 7l.7 12.1a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9L17.5 7" />
    </svg>
  );
}

// Shows as plain text by default (not editable inputs) — tap the pencil icon
// to switch the row into an editable form, which also holds delete.
export default function ServiceRow({ service: s }: { service: Service }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="border border-neutral-200 rounded-lg px-4 py-3 flex flex-col gap-3">
        <form
          action={async (formData) => {
            await updateService(formData);
            setEditing(false);
          }}
          className="flex flex-col sm:flex-row sm:items-center gap-3"
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
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="bg-brand-purple text-white rounded-md px-4 py-2 text-sm font-medium"
            >
              Αποθήκευση
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-neutral-500 px-2"
            >
              Άκυρο
            </button>
          </div>
        </form>
        <form action={deleteService} className="self-start">
          <input type="hidden" name="id" value={s.id} />
          <button
            type="submit"
            aria-label="Διαγραφή"
            title="Διαγραφή"
            className="flex items-center gap-1.5 text-sm text-red-600 px-2 py-1"
          >
            <TrashIcon />
            Διαγραφή
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium">{s.name}</div>
        <div className="text-sm text-neutral-500">{s.duration_minutes} λεπτά</div>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Επεξεργασία"
        title="Επεξεργασία"
        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-md border border-neutral-300 text-neutral-600"
      >
        <EditIcon />
      </button>
    </div>
  );
}
