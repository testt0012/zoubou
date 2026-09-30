"use client";

// A full-width, thumb-sized on/off row: label on the left, switch on the right.
export default function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="h-12 flex items-center justify-between gap-3"
    >
      <span className="font-medium">{label}</span>
      <span className={`relative w-14 h-8 rounded-full transition-colors ${checked ? "bg-brand-purple" : "bg-neutral-300"}`}>
        <span
          className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : ""
          }`}
        />
      </span>
    </button>
  );
}
