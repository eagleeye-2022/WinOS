"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  LogIn,
  LogOut,
  CheckCircle2,
  Loader2,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import { submitRegularizationAction } from "../actions/attendance-actions";
import { getMyAttendanceData } from "../queries/attendance-queries";
import type { AttendanceRecord, EmployeeProfile } from "../types";
import { dateFromKey, formatLongDate, fullDayName, isWeekendKey } from "../utils";
import { RegularizationFields, useRegularizationForm } from "./regularization-fields";

interface RegularizeAttendanceFormPageProps {
  onBack: () => void;
  onSubmitSuccess?: () => void;
  /** "YYYY-MM-DD" preselected in the date picker. */
  initialDate: string;
  /** Latest selectable date ("YYYY-MM-DD"), normally today. */
  maxDate: string;
  /** Set when a manager regularizes for a team member — approved immediately. */
  onBehalfOf?: EmployeeProfile | null;
}

/** What's missing on a recorded day — drives the default reason. */
function issueOf(rec: AttendanceRecord | null): string | undefined {
  if (!rec) return undefined;
  if (rec.actionRequiredReason) return rec.actionRequiredReason;
  if (rec.checkInTime && !rec.checkOutTime) return "Missing Check-out";
  if (!rec.checkInTime) return "Missing Check-in & Check-out";
  return undefined;
}

export function RegularizeAttendanceFormPage({
  onBack,
  onSubmitSuccess,
  initialDate,
  maxDate,
  onBehalfOf,
}: RegularizeAttendanceFormPageProps) {
  const [attendanceDate, setAttendanceDate] = useState(initialDate);
  const [existing, setExisting] = useState<AttendanceRecord | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const form = useRegularizationForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show what is already recorded for the chosen day, and start the form from it.
  useEffect(() => {
    const d = dateFromKey(attendanceDate);
    if (!d) {
      setExisting(null);
      return;
    }
    let cancelled = false;
    setIsLoadingExisting(true);
    getMyAttendanceData(d.getUTCMonth(), d.getUTCFullYear(), onBehalfOf?.id)
      .then((data) => {
        if (cancelled) return;
        const rec = data.records.find((r) => r.date === attendanceDate) ?? null;
        setExisting(rec);
        form.reset(issueOf(rec), rec?.checkInTime);
      })
      .catch(() => !cancelled && setExisting(null))
      .finally(() => !cancelled && setIsLoadingExisting(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceDate, onBehalfOf?.id]);

  const { checkIn: checkInTime, checkOut: checkOutTime } = form.values;
  const workedDuration = form.worked ?? "--";
  const dateLabel = dateFromKey(attendanceDate)
    ? `${formatLongDate(attendanceDate)} (${fullDayName(attendanceDate)})`
    : "—";
  const dateError = !dateFromKey(attendanceDate)
    ? "Pick a date."
    : attendanceDate > maxDate
    ? "You can't regularize a future date."
    : isWeekendKey(attendanceDate)
    ? "That's a weekend — request a comp-off instead."
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dateError || !form.isValid) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await submitRegularizationAction({
        missingDate: attendanceDate,
        ...form.payload(),
        issueDescription: issueOf(existing),
        forUserId: onBehalfOf?.id,
      });
      if (!res.success) {
        setError(res.message);
        return;
      }
      onSubmitSuccess?.();
    } catch (err: unknown) {
      console.error("Failed to submit regularization:", err);
      setError("Failed to submit regularization. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Back Link */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Regularize Attendance
        </h1>
      </div>

      {/* Form + Summary Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form (2 cols) */}
        <div className="lg:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="p-6 rounded-2xl bg-card border border-border shadow-xs space-y-8"
          >
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Select Date */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-muted text-foreground font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-bold text-foreground">Select Date</h3>
              </div>

              <div className="pl-9">
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Attendance Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={attendanceDate}
                    max={maxDate}
                    aria-invalid={Boolean(dateError)}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className={`${inputClass} ${dateError ? "border-rose-500" : ""}`}
                    required
                  />
                </div>
                {dateError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{dateError}</p>}
              </div>
            </div>

            {/* Step 2: Existing Attendance */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-muted text-foreground font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-bold text-foreground">
                  Existing Attendance{" "}
                  <span className="text-xs font-normal text-muted-foreground">(Already Recorded)</span>
                </h3>
              </div>

              <div className="pl-9 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border bg-muted/40 flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
                    <LogIn className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Check-in</div>
                    <div className="text-sm font-bold text-foreground">
                      {isLoadingExisting ? "…" : existing?.checkInTime || "-"}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-muted/40 flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-500 flex items-center justify-center shrink-0">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Check-out</div>
                    <div className="text-sm font-bold text-foreground">
                      {isLoadingExisting ? "…" : existing?.checkOutTime || "-"}
                    </div>
                  </div>
                </div>
              </div>
              {existing?.leaveInfo && (
                <p className="pl-9 text-xs text-amber-700 dark:text-amber-400">
                  {existing.leaveInfo.leaveType} ({existing.leaveInfo.duration},{" "}
                  {existing.leaveInfo.status.toLowerCase()}) is recorded for this day.
                </p>
              )}
            </div>

            {/* Step 3: Regularization Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-muted text-foreground font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-bold text-foreground">Regularization Details</h3>
              </div>

              <div className="pl-9">
                <RegularizationFields form={form} idPrefix="reg-page" />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-2.5 rounded-lg border border-input bg-background text-foreground text-xs font-semibold hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || Boolean(dateError) || !form.isValid}
                className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs flex items-center gap-2 transition-all disabled:bg-zinc-300 disabled:text-zinc-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-300 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <span>{onBehalfOf ? "Regularize & Approve" : "Submit Regularization"}</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Summary Column */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-card border border-border shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 text-sm font-bold text-foreground">
              <Calendar className="w-4 h-4 text-primary" />
              <span>Attendance Summary</span>
            </div>

            <div className="space-y-3.5 text-xs">
              {onBehalfOf && (
                <div className="flex items-start justify-between">
                  <span className="text-muted-foreground">Employee</span>
                  <span className="font-bold text-foreground text-right">{onBehalfOf.name}</span>
                </div>
              )}
              <div className="flex items-start justify-between">
                <span className="text-muted-foreground">Attendance Date</span>
                <span className="font-bold text-foreground text-right max-w-[150px]">
                  {dateLabel}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Check-in</span>
                <span className="font-bold text-primary">{checkInTime || "--"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Check-out</span>
                <span className="font-bold text-primary">{checkOutTime || "--"}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-foreground font-semibold">Worked Duration</span>
                <span className="font-bold text-foreground text-sm">{workedDuration}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
              {onBehalfOf ? (
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <span>
                {onBehalfOf
                  ? "As a manager, this regularization is approved and applied immediately."
                  : "Your regularized attendance will be reviewed and updated after approval."}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
