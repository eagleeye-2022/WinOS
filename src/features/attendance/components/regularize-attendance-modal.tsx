"use client";

import React, { useEffect, useState } from "react";
import { X, Calendar, Check, Loader2, AlertCircle } from "lucide-react";
import { submitRegularizationAction } from "../actions/attendance-actions";
import { RegularizationFields, useRegularizationForm } from "./regularization-fields";

/** The day being regularized. */
export interface RegularizeTarget {
  /** "YYYY-MM-DD" */
  dateKey: string;
  /** e.g. "06 Nov 2026 (Friday)" */
  label: string;
  /** What's wrong with the day, e.g. "Missing Check-out" — picks the default reason. */
  issue?: string;
  /** Check-in already recorded that day, if any. */
  existingCheckIn?: string | null;
}

interface RegularizeAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: RegularizeTarget | null;
  onSubmitSuccess?: () => void;
}

/**
 * The one regularization dialog, used from My Attendance and My Leaves (Action Required). The full
 * page form (regularize-attendance-form-page) uses the same fields.
 */
export function RegularizeAttendanceModal({ isOpen, onClose, target, onSubmitSuccess }: RegularizeAttendanceModalProps) {
  const form = useRegularizationForm(target?.issue, target?.existingCheckIn);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh form for each day opened.
  const targetKey = isOpen && target ? `${target.dateKey}|${target.issue ?? ""}` : null;
  useEffect(() => {
    if (!targetKey) return;
    form.reset(target?.issue, target?.existingCheckIn);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !isSubmitting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.isValid) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await submitRegularizationAction({
        missingDate: target.dateKey,
        ...form.payload(),
        issueDescription: target.issue,
      });
      if (!res.success) {
        setError(res.message);
        return;
      }
      onSubmitSuccess?.();
      onClose();
    } catch (err: unknown) {
      console.error("Failed to submit regularization:", err);
      setError("Failed to submit regularization. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="regularize-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card rounded-2xl shadow-2xl border border-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-accent text-primary">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 id="regularize-title" className="text-base font-bold text-foreground">
                Regularize Attendance
              </h3>
              <p className="text-xs text-muted-foreground">
                {target.label}
                {target.issue ? ` · ${target.issue}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <RegularizationFields form={form} idPrefix="reg-modal" />

          <p className="text-xs text-muted-foreground">Your manager reviews this before attendance is updated.</p>

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
              disabled={isSubmitting || !form.isValid}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs flex items-center gap-2 transition-all disabled:bg-zinc-300 disabled:text-zinc-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
