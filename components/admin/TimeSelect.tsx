"use client";

import { useState } from "react";

// A native <select> of 24h "HH:MM" options instead of a typed field — the
// admin picks from a menu, immune to locale formatting the same way
// TimeField was, but with zero risk of a malformed/half-typed value.
interface TimeSelectProps {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
}

const STEP_MINUTES = 15;
const FULL_DAY_END = "23:59"; // off the 15-min grid — the "whole day" blocked-slot marker

function buildOptions(current: string): string[] {
  const options: string[] = [];
  for (let m = 0; m < 24 * 60; m += STEP_MINUTES) {
    const h = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    options.push(`${h}:${mm}`);
  }
  options.push(FULL_DAY_END);
  // Keeps an existing off-grid value (e.g. set before this became a select,
  // or via direct DB edit) selectable/visible instead of silently dropped.
  if (current && !options.includes(current)) options.push(current);
  return options.sort();
}

export default function TimeSelect({
  name,
  defaultValue,
  value: controlledValue,
  onChange,
  required,
  className,
}: TimeSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = controlledValue ?? internalValue;

  function handleChange(next: string) {
    if (onChange) onChange(next);
    else setInternalValue(next);
  }

  return (
    <select
      name={name}
      required={required}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className={className}
    >
      {!value && (
        <option value="" disabled>
          Ώρα
        </option>
      )}
      {buildOptions(value).map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
