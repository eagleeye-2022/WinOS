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

/** One form section: numbered title on the left (desktop), content on the right. */
function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-border/70 px-5 py-5 last:border-b-0 md:grid-cols-[200px_minmax(0,1fr)] md:gap-6">
      <div className="flex items-start gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          {n}
        </span>
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
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
    "h-9 w-full rounded-md border border-border/80 bg-background pl-9 pr-3 text-[13px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Back link */}
      <button
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-foreground hover:underline dark:text-blue-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Title bar */}
      <div className="rounded-lg border border-border/70 bg-card px-5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h1 className="text-lg font-semibold text-foreground">Regularize Attendance</h1>
        {onBehalfOf && <p className="text-xs text-muted-foreground">On behalf of {onBehalfOf.name}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            {error && (
              <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-5 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Section n={1} title="Select Date">
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Attendance Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative max-w-xs">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
              {dateError && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{dateError}</p>}
            </Section>

            <Section n={2} title="Existing Attendance">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { label: "Check-in", value: existing?.checkInTime, icon: <LogIn className="h-4 w-4" />, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300" },
                  { label: "Check-out", value: existing?.checkOutTime, icon: <LogOut className="h-4 w-4" />, tone: "text-rose-600 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300" },
                ].map((t) => (
                  <div key={t.label} className="flex items-center gap-3 rounded-md border border-border/70 px-3.5 py-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t.tone}`}>{t.icon}</span>
                    <div>
                      <p className="text-xs text-muted-foreground">{t.label}</p>
                      <p className="text-[13px] font-semibold text-foreground">{isLoadingExisting ? "…" : t.value || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
              {existing?.leaveInfo && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  {existing.leaveInfo.leaveType} ({existing.leaveInfo.duration}, {existing.leaveInfo.status.toLowerCase()}) is recorded for this day.
                </p>
              )}
            </Section>

            <Section n={3} title="Regularization Details">
              <RegularizationFields form={form} idPrefix="reg-page" />
            </Section>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 bg-muted/30 px-5 py-3">
              <button
                type="button"
                onClick={onBack}
                className="h-9 rounded-md border border-border/80 bg-background px-4 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || Boolean(dateError) || !form.isValid}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : onBehalfOf ? (
                  "Regularize & Approve"
                ) : (
                  "Submit Regularization"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <section className="rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <header className="flex items-center gap-2.5 px-5 pt-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <Calendar className="h-4 w-4" />
              </span>
              <h2 className="text-[15px] font-semibold text-foreground">Summary</h2>
            </header>
            <dl className="space-y-3 px-5 pb-5 pt-4 text-xs">
              {onBehalfOf && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Team Member</dt>
                  <dd className="text-right font-semibold text-foreground">{onBehalfOf.name}</dd>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Attendance Date</dt>
                <dd className="max-w-[160px] text-right font-semibold text-foreground">{dateLabel}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Check-in</dt>
                <dd className="font-semibold text-blue-600 dark:text-blue-400">{checkInTime || "--"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Check-out</dt>
                <dd className="font-semibold text-blue-600 dark:text-blue-400">{checkOutTime || "--"}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-border/70 pt-3">
                <dt className="font-semibold text-foreground">Worked Duration</dt>
                <dd className="text-sm font-bold text-foreground">{workedDuration}</dd>
              </div>
            </dl>
          </section>

          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-100 bg-emerald-50/70 p-4 text-xs text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            {onBehalfOf ? <UserCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              {onBehalfOf
                ? "As a manager, this regularization is approved and applied immediately."
                : "Your regularized attendance will be reviewed and updated after approval."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
