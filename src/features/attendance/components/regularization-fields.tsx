"use client";

import React, { useState } from "react";
import { Clock } from "lucide-react";
import {
  SHIFT_END,
  SHIFT_START,
  formatTime12h,
  formatWorkedDuration,
  parseTime12h,
  workedMinutesBetween,
} from "../utils";

// One set of regularization fields (times, reason, remarks) with the same choices and checks
// everywhere: the Action Required dialog (My Leaves and My Attendance) and the full page
// (including a manager regularizing on someone's behalf). The server re-checks all of it.

export const REGULARIZATION_REASONS = [
  "Forgot to check in",
  "Forgot to check out",
  "Forgot to check in and out",
  "Device was not working",
  "Official work outside office",
  "Internet / Network issue",
  "Other",
] as const;

const REMARKS_MAX = 250;

/**
 * The reason that matches the flagged issue, or "" (the employee must pick) when it isn't clear.
 * Issues come from resolveDay: "Missing Check-out", "Missing Check-in & Check-out", …
 */
export function defaultReasonFor(issue?: string | null): string {
  const s = (issue || "").toLowerCase();
  const noIn = /check-in|checkin|no attendance/.test(s);
  const noOut = /check-out|checkout/.test(s);
  if (noIn && noOut) return "Forgot to check in and out";
  if (noOut) return "Forgot to check out";
  if (noIn) return "Forgot to check in";
  return "";
}

/** "09:30 AM" ↔ "09:30" for <input type="time">. */
function to24h(value: string): string {
  const mins = parseTime12h(value);
  if (mins === null) return "";
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
function from24h(value: string): string {
  const mins = parseTime12h(value);
  return mins === null ? "" : formatTime12h(mins);
}

export interface RegularizationFormState {
  checkIn: string;
  checkOut: string;
  reason: string;
  /** Free text; required when the reason is "Other". */
  remarks: string;
}

export function useRegularizationForm(issue?: string | null, existingCheckIn?: string | null) {
  const [values, setValues] = useState<RegularizationFormState>({
    checkIn: existingCheckIn || SHIFT_START,
    checkOut: SHIFT_END,
    reason: defaultReasonFor(issue),
    remarks: "",
  });
  const set = (patch: Partial<RegularizationFormState>) => setValues((v) => ({ ...v, ...patch }));
  const reset = (nextIssue?: string | null, nextCheckIn?: string | null) =>
    setValues({ checkIn: nextCheckIn || SHIFT_START, checkOut: SHIFT_END, reason: defaultReasonFor(nextIssue), remarks: "" });

  const minutes = workedMinutesBetween(values.checkIn, values.checkOut);
  const errors = {
    times: !values.checkIn || !values.checkOut
      ? "Enter both times."
      : !minutes
      ? "Check-out must be after check-in."
      : null,
    reason: !values.reason ? "Pick a reason." : null,
    remarks:
      values.reason === "Other" && !values.remarks.trim()
        ? "Describe what happened."
        : values.remarks.length > REMARKS_MAX
        ? `Keep remarks under ${REMARKS_MAX} characters.`
        : null,
  };
  const isValid = !errors.times && !errors.reason && !errors.remarks;

  /** What submitRegularizationAction takes: "Other" sends the remarks as the reason. */
  const payload = () => {
    const remarks = values.remarks.trim();
    return values.reason === "Other"
      ? { checkInTime: values.checkIn, checkOutTime: values.checkOut, reason: remarks, remarks: undefined }
      : { checkInTime: values.checkIn, checkOutTime: values.checkOut, reason: values.reason, remarks: remarks || undefined };
  };

  return { values, set, reset, errors, isValid, worked: formatWorkedDuration(minutes), payload };
}

export type RegularizationForm = ReturnType<typeof useRegularizationForm>;

const inputClass =
  "w-full pl-10 pr-3 py-2.5 rounded-xl border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
const fieldClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function RegularizationFields({ form, idPrefix = "reg" }: { form: RegularizationForm; idPrefix?: string }) {
  const { values, set, errors, worked } = form;
  const timeBorder = errors.times ? "border-rose-500" : "border-input";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-in`} className="block text-xs font-semibold text-foreground mb-1.5">
            Check-in Time <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Clock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id={`${idPrefix}-in`}
              type="time"
              value={to24h(values.checkIn)}
              onChange={(e) => set({ checkIn: from24h(e.target.value) })}
              aria-invalid={Boolean(errors.times)}
              className={`${inputClass} ${timeBorder}`}
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-out`} className="block text-xs font-semibold text-foreground mb-1.5">
            Check-out Time <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Clock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id={`${idPrefix}-out`}
              type="time"
              value={to24h(values.checkOut)}
              onChange={(e) => set({ checkOut: from24h(e.target.value) })}
              aria-invalid={Boolean(errors.times)}
              className={`${inputClass} ${timeBorder}`}
              required
            />
          </div>
        </div>
      </div>
      <p className={`text-xs ${errors.times ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
        {errors.times ?? (
          <>
            Worked duration: <span className="font-semibold text-foreground">{worked ?? "--"}</span>
          </>
        )}
      </p>

      <div>
        <label htmlFor={`${idPrefix}-reason`} className="block text-xs font-semibold text-foreground mb-1.5">
          Reason for Regularization <span className="text-rose-500">*</span>
        </label>
        <select
          id={`${idPrefix}-reason`}
          value={values.reason}
          onChange={(e) => set({ reason: e.target.value })}
          className={`${fieldClass} font-semibold`}
          required
        >
          <option value="" disabled>
            Select a reason
          </option>
          {REGULARIZATION_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor={`${idPrefix}-remarks`} className="text-xs font-semibold text-foreground">
            {values.reason === "Other" ? (
              <>
                What happened? <span className="text-rose-500">*</span>
              </>
            ) : (
              "Remarks (Optional)"
            )}
          </label>
          <span className="text-xs text-muted-foreground">
            {values.remarks.length} / {REMARKS_MAX}
          </span>
        </div>
        <textarea
          id={`${idPrefix}-remarks`}
          rows={3}
          maxLength={REMARKS_MAX}
          value={values.remarks}
          onChange={(e) => set({ remarks: e.target.value })}
          placeholder="Add any details your manager should know…"
          className={`${fieldClass} resize-none`}
        />
        {errors.remarks && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.remarks}</p>}
      </div>
    </div>
  );
}
