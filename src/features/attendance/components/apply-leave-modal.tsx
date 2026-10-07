"use client";

import React, { useState } from "react";
import { X, CalendarPlus, Check, Loader2, AlertCircle } from "lucide-react";
import { ActionRequiredItem } from "../types";
import { applyLeaveAction } from "@/features/leave/actions/leave-actions";

interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ActionRequiredItem | null;
  onSubmitSuccess?: () => void;
}

export function ApplyLeaveModal({
  isOpen,
  onClose,
  item,
  onSubmitSuccess,
}: ApplyLeaveModalProps) {
  const [leaveTypeCode, setLeaveTypeCode] = useState("CL");
  const [durationType, setDurationType] = useState<"FULL_DAY" | "HALF_DAY">("FULL_DAY");
  const [halfDayType, setHalfDayType] = useState<"FIRST_HALF" | "SECOND_HALF">("FIRST_HALF");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await applyLeaveAction({
        leaveTypeCode,
        durationType,
        halfDayType: durationType === "HALF_DAY" ? halfDayType : undefined,
        fromDate: item.date,
        toDate: item.date,
        durationDays: durationType === "HALF_DAY" ? 0.5 : 1.0,
        reason,
      });
      setIsSubmitting(false);
      onSubmitSuccess?.();
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : "Failed to apply leave");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <CalendarPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Apply Leave
              </h3>
              <p className="text-xs text-slate-400">
                {item.formattedDate} ({item.dayName})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Leave Type
              </label>
              <select
                value={leaveTypeCode}
                onChange={(e) => setLeaveTypeCode(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="CL">Casual Leave (CL)</option>
                <option value="SL">Sick Leave (SL)</option>
                <option value="PL">Paid Leave (PL)</option>
                <option value="COMP">Compensatory Off (COMP)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Duration
              </label>
              <select
                value={durationType}
                onChange={(e) => setDurationType(e.target.value as "FULL_DAY" | "HALF_DAY")}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="FULL_DAY">Full Day (1.0 day)</option>
                <option value="HALF_DAY">Half Day (0.5 day)</option>
              </select>
            </div>
          </div>

          {durationType === "HALF_DAY" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Session
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="halfDay"
                    checked={halfDayType === "FIRST_HALF"}
                    onChange={() => setHalfDayType("FIRST_HALF")}
                    className="accent-amber-600"
                  />
                  <span>First Half</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="halfDay"
                    checked={halfDayType === "SECOND_HALF"}
                    onChange={() => setHalfDayType("SECOND_HALF")}
                    className="accent-amber-600"
                  />
                  <span>Second Half</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Reason
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              placeholder="Provide reason for leave..."
              required
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Apply Leave
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
