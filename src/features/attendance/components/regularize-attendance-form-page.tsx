"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  LogIn,
  LogOut,
  ChevronDown,
  CheckCircle2,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { submitRegularizationAction } from "../actions/attendance-actions";

interface RegularizeAttendanceFormPageProps {
  onBack: () => void;
  onSubmitSuccess?: () => void;
  initialDate?: string;
}

export function RegularizeAttendanceFormPage({
  onBack,
  onSubmitSuccess,
  initialDate = "15 August 2026 (Friday)",
}: RegularizeAttendanceFormPageProps) {
  const [attendanceDate, setAttendanceDate] = useState(initialDate);
  const [checkInTime, setCheckInTime] = useState("09:10 AM");
  const [checkOutTime, setCheckOutTime] = useState("06:15 PM");
  const [reason, setReason] = useState("Forgot to check out");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Worked duration computation
  const workedDuration = "9h 05m";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await submitRegularizationAction({
        missingDate: "2026-08-15",
        checkInTime,
        checkOutTime,
        reason,
        remarks,
        issueDescription: "Regularization Request for 15 Aug 2026",
      });
      setIsSubmitting(false);
      onSubmitSuccess?.();
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : "Failed to submit regularization");
    }
  };

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
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Regularize Attendance
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Correct or complete your attendance record.
        </p>
      </div>

      {/* Form + Summary Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form (2 cols) */}
        <div className="lg:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-8"
          >
            {/* Step 1: Select Date */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Select Date
                </h3>
              </div>

              <div className="pl-9">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Attendance Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Existing Attendance */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Existing Attendance{" "}
                  <span className="text-xs font-normal text-slate-400">
                    (Already Recorded)
                  </span>
                </h3>
              </div>

              <div className="pl-9 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Existing Check In */}
                <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
                    <LogIn className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Check-in</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      09:10 AM
                    </div>
                  </div>
                </div>

                {/* Existing Check Out */}
                <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-500 flex items-center justify-center shrink-0">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Check-out</div>
                    <div className="text-sm font-bold text-slate-400">-</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Regularization Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Regularization Details
                </h3>
              </div>

              <div className="pl-9 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Check-in Time */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Check-in Time <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <select
                        value={checkInTime}
                        onChange={(e) => setCheckInTime(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option>09:00 AM</option>
                        <option>09:10 AM</option>
                        <option>09:15 AM</option>
                        <option>09:30 AM</option>
                        <option>10:00 AM</option>
                      </select>
                    </div>
                  </div>

                  {/* Check-out Time */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Check-out Time <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <select
                        value={checkOutTime}
                        onChange={(e) => setCheckOutTime(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option>05:00 PM</option>
                        <option>06:00 PM</option>
                        <option>06:14 PM</option>
                        <option>06:15 PM</option>
                        <option>06:30 PM</option>
                        <option>07:00 PM</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Reason for Regularization <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Forgot to check out</option>
                    <option>Forgot to check in</option>
                    <option>Device was not working</option>
                    <option>Official work</option>
                    <option>Internet issue</option>
                  </select>
                </div>

                {/* Remarks */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Remarks (Optional)
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {remarks.length} / 250
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={250}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter additional details..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 transition-colors"
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
                  <>
                    <span>Submit Regularization</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Summary Column (Batch 3 Image 5) */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900 dark:text-slate-100">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Attendance Summary</span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-start justify-between">
                <span className="text-slate-500">Attendance Date</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-right max-w-[150px]">
                  {attendanceDate}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Check-in</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {checkInTime}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Check-out</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {checkOutTime}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-700 dark:text-slate-300 font-semibold">
                  Worked Duration
                </span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                  {workedDuration}
                </span>
              </div>
            </div>

            {/* Green Approval Note Callout */}
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Your regularized attendance will be reviewed and updated after approval.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
