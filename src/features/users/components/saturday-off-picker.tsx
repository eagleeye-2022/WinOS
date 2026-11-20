"use client";

// Work-week picker: one of the WORK_WEEK_PRESETS (1st & 3rd / 3rd & 4th Saturday off).
// The value is the form text from work-week.ts ("1,3" / "3,4").

import { ALL_SATURDAYS_OFF } from "@/features/attendance/utils";
import {
  decodeSaturdaysOff,
  describeSaturdaysOff,
  encodeSaturdaysOff,
  WORK_WEEK_PRESETS,
} from "@/features/users/work-week";

export function SaturdayOffPicker({
  id,
  value,
  onChange,
  disabled,
  invalid,
  selectClassName,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Styles the dropdown like the form's other inputs. */
  selectClassName?: string;
}) {
  const selected = decodeSaturdaysOff(value) ?? [...ALL_SATURDAYS_OFF];
  const encoded = encodeSaturdaysOff(selected);
  // Saved before these were the only choices (e.g. every Saturday off): shown, but not pickable.
  const isLegacy = !WORK_WEEK_PRESETS.some((p) => encodeSaturdaysOff(p.value) === encoded);

  return (
    <div className="min-w-0">
      <select
        id={id}
        value={encoded}
        disabled={disabled}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
        className={selectClassName}
      >
        {isLegacy && (
          <option value={encoded} disabled>
            Current: {describeSaturdaysOff(selected)}
          </option>
        )}
        {WORK_WEEK_PRESETS.map((p) => (
          <option key={p.label} value={encodeSaturdaysOff(p.value)}>
            {p.label}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs text-muted-foreground">Sundays are always off.</p>
    </div>
  );
}
