"use client";

import { useState } from "react";
import BottomSheet from "@/components/admin/BottomSheet";
import Calendar from "@/components/Calendar";
import { ATHENS_TZ } from "@/lib/time";

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("el-GR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: ATHENS_TZ,
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

interface DatePickerProps {
  value: string; // "YYYY-MM-DD", or "" for none
  onChange: (value: string) => void;
  title: string;
  minDate?: string;
  className?: string;
}

// A field that opens a month calendar from the bottom of the screen;
// tapping a day picks it and closes the sheet.
export default function DatePicker({ value, onChange, title, minDate, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${className ?? ""} flex items-center text-left ${value ? "" : "text-neutral-400"}`}
      >
        {value ? formatDate(value) : "Επιλογή"}
      </button>

      {open && (
        <BottomSheet title={title} onClose={() => setOpen(false)}>
          <div className="pb-2">
            <Calendar
              selectedDate={value}
              minDate={minDate}
              onSelect={(date) => {
                onChange(date);
                setOpen(false);
              }}
            />
          </div>
        </BottomSheet>
      )}
    </>
  );
}
