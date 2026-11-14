"use client";

import React, { useState } from "react";
import { X, Calendar, Check, Loader2, Award, AlertCircle } from "lucide-react";
import { AttendanceRecord } from "../types";
import { submitCompOffAction } from "../actions/attendance-actions";
import { workedMinutesBetween } from "../utils";

interface CompensatoryRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  onSubmitSuccess?: () => void;
}

export function CompensatoryRequestModal({
  isOpen,
  onClose,
  record,
  onSubmitSuccess,
}: CompensatoryRequestModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const minutes = workedMinutesBetween(record.checkInTime, record.checkOutTime);
    if (!minutes) {
      setIsSubmitting(false);
      setError("Check in and check out on this day before requesting a comp-off.");
      return;
    }
    try {
      const res = await submitCompOffAction({
        workDate: record.date,
        fromTime: record.checkInTime!,
        toTime: record.checkOutTime!,
        hoursWorked: Math.round((minutes / 60) * 100) / 100,
        reason,
      });
      if (!res.success) {
        setError(res.message);
        return;
      }
      onSubmitSuccess?.();
      onClose();
    } catch (err: unknown) {
      console.error("Failed to submit comp-off:", err);
      setError("Failed to submit compensatory off request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-accent text-primary">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Compensatory Off Request
              </h3>
              <p className="text-xs text-muted-foreground">
                Worked on Holiday: {record.holidayInfo?.name || record.formattedDate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
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

          <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-accent border border-blue-100 dark:border-zinc-700/40 text-xs text-blue-800 dark:text-blue-300">
            You worked on <span className="font-bold">{record.formattedDate}</span> from{" "}
            <span className="font-bold">{record.checkInTime || "—"}</span> to{" "}
            <span className="font-bold">{record.checkOutTime || "not checked out"}</span>. Submitting this request will credit 1 Compensatory Leave upon manager approval.
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Work Description / Reason
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Describe tasks completed on this holiday..."
              required
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Submit Compensatory Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
