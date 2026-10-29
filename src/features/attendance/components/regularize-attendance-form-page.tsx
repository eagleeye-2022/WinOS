"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
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
import {
  SHIFT_END,
  SHIFT_START,
  dateFromKey,
  formatLongDate,
  formatWorkedDuration,
  fullDayName,
  parseTime12h,
  formatTime12h,
  workedMinutesBetween,
} from "../utils";

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

const REASONS = [
  "Forgot to check out",
  "Forgot to check in",
  "Device was not working",
  "Official work outside office",
  "Internet / Network issue",
];

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
  const [checkInTime, setCheckInTime] = useState(SHIFT_START);
  const [checkOutTime, setCheckOutTime] = useState(SHIFT_END);
  const [reason, setReason] = useState(REASONS[0]);
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show what is already recorded for the chosen day.
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
        if (rec?.checkInTime) setCheckInTime(rec.checkInTime);
      })
      .catch(() => !cancelled && setExisting(null))
      .finally(() => !cancelled && setIsLoadingExisting(false));
    return () => {
      cancelled = true;
    };
  }, [attendanceDate, onBehalfOf?.id]);

  const workedDuration = formatWorkedDuration(workedMinutesBetween(checkInTime, checkOutTime)) ?? "--";
  const dateLabel = dateFromKey(attendanceDate)
    ? `${formatLongDate(attendanceDate)} (${fullDayName(attendanceDate)})`
    : "—";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await submitRegularizationAction({
        missingDate: attendanceDate,
        checkInTime,
        checkOutTime,
        reason,
        remarks,
        issueDescription: existing?.actionRequiredReason,
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
    "w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Back Link */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Regularize Attendance
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {onBehalfOf
            ? `Correcting attendance for ${onBehalfOf.name}.`
            : "Correct or complete your attendance record."}
        </p>
      </div>

      {/* Form + Summary Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form (2 cols) */}
        <div className="lg:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="p-6 rounded-2xl bg-white dark:bg-card border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-8"
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
                <span className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Select Date</h3>
              </div>

              <div className="pl-9">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Attendance Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={attendanceDate}
                    max={maxDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Existing Attendance */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Existing Attendance{" "}
                  <span className="text-xs font-normal text-zinc-400">(Already Recorded)</span>
                </h3>
              </div>

              <div className="pl-9 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
                    <LogIn className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400">Check-in</div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {isLoadingExisting ? "…" : existing?.checkInTime || "-"}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-500 flex items-center justify-center shrink-0">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400">Check-out</div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
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
                <span className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Regularization Details</h3>
              </div>

              <div className="pl-9 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Check-in Time <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="time"
                        value={to24h(checkInTime)}
                        onChange={(e) => setCheckInTime(from24h(e.target.value))}
                        className={inputClass}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Check-out Time <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="time"
                        value={to24h(checkOutTime)}
                        onChange={(e) => setCheckOutTime(from24h(e.target.value))}
                        className={inputClass}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Reason for Regularization <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {REASONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Remarks (Optional)
                    </label>
                    <span className="text-xs text-zinc-400">{remarks.length} / 250</span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={250}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter additional details..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition-all disabled:opacity-50"
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
          <div className="p-6 rounded-2xl bg-white dark:bg-card border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Attendance Summary</span>
            </div>

            <div className="space-y-3.5 text-xs">
              {onBehalfOf && (
                <div className="flex items-start justify-between">
                  <span className="text-zinc-500">Employee</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 text-right">{onBehalfOf.name}</span>
                </div>
              )}
              <div className="flex items-start justify-between">
                <span className="text-zinc-500">Attendance Date</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 text-right max-w-[150px]">
                  {dateLabel}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Check-in</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{checkInTime || "--"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Check-out</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{checkOutTime || "--"}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Worked Duration</span>
                <span className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm">{workedDuration}</span>
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
