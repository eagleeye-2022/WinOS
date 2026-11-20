"use client";

// Work-week picker: a quick-pick list plus one toggle per Saturday of the month (1st–5th).
// Highlighted = off. The value is the form text from work-week.ts ("1,3" / "none").

import { cn } from "@/lib/utils";
import { ALL_SATURDAYS_OFF, SATURDAY_WEEKS } from "@/features/attendance/utils";
import {
  decodeSaturdaysOff,
  encodeSaturdaysOff,
  SATURDAY_ORDINALS,
  WORK_WEEK_PRESETS,
} from "@/features/users/work-week";

const CUSTOM = "custom";

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
  /** Styles the quick-pick dropdown like the form's other inputs. */
  selectClassName?: string;
}) {
  const selected = decodeSaturdaysOff(value) ?? [...ALL_SATURDAYS_OFF];
  const encoded = encodeSaturdaysOff(selected);
  const preset = WORK_WEEK_PRESETS.find((p) => encodeSaturdaysOff(p.value) === encoded);

  const toggle = (n: number) =>
    onChange(encodeSaturdaysOff(selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n]));

  return (
    <div className="min-w-0">
      <select
        id={id}
        value={preset ? encoded : CUSTOM}
        disabled={disabled}
        aria-invalid={invalid}
        onChange={(e) => e.target.value !== CUSTOM && onChange(e.target.value)}
        className={selectClassName}
      >
        {WORK_WEEK_PRESETS.map((p) => (
          <option key={p.label} value={encodeSaturdaysOff(p.value)}>
            {p.label}
          </option>
        ))}
        <option value={CUSTOM} disabled>
          Custom
        </option>
      </select>
      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Saturdays off">
        {SATURDAY_WEEKS.map((n) => {
          const off = selected.includes(n);
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              aria-pressed={off}
              title={`${SATURDAY_ORDINALS[n - 1]} Saturday: ${off ? "off" : "working"} (click to change)`}
              onClick={() => toggle(n)}
              className={cn(
                "h-7 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                off
                  ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                  : "border-border/80 bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {SATURDAY_ORDINALS[n - 1]} Sat
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">Blue Saturdays are off. Sundays are always off.</p>
    </div>
  );
}
