"use client";

import { useState } from "react";

// Replaces native <input type="time">, whose displayed format (24h vs
// 12h AM/PM) follows the device's system locale regardless of the page's
// own language — confirmed even `lang="el-GR"` on the input doesn't
// override it. A plain masked text input sidesteps that entirely: it
// always reads and displays "HH:MM", full stop.
//
// Works both as an uncontrolled field (pass `name` + `defaultValue`, for
// plain <form action={serverAction}> submission) and as a controlled one
// (pass `value` + `onChange`, when a parent needs the current value —
// e.g. for live conflict-checking).
interface TimeFieldProps {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
}

export default function TimeField({
  name,
  defaultValue,
  value: controlledValue,
  onChange,
  required,
  className,
}: TimeFieldProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = controlledValue ?? internalValue;

  function handleChange(raw: string) {
    let next = raw.replace(/[^0-9]/g, "").slice(0, 4);
    if (next.length >= 3) next = `${next.slice(0, 2)}:${next.slice(2)}`;
    if (onChange) onChange(next);
    else setInternalValue(next);
  }

  return (
    <input
      type="text"
      name={name}
      inputMode="numeric"
      required={required}
      placeholder="ΩΩ:ΛΛ"
      pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
      title="Ώρα σε μορφή 24ώρου, π.χ. 14:00"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className={className}
    />
  );
}
