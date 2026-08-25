"use client";

import React, { useState, useEffect } from "react";
import { X, Clock, Calendar, FileText, Loader2, Check, AlertCircle } from "lucide-react";
import { TimeLogEntry } from "../../types";
import { updateTimeLogAction } from "../../actions/project-actions";

interface EditTimeLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: TimeLogEntry | null;
  onLogUpdated: () => void;
  isAdmin?: boolean;
}

export function EditTimeLogModal({
  isOpen,
  onClose,
  log,
  onLogUpdated,
  isAdmin = false,
}: EditTimeLogModalProps) {
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState("");
  const [billingType, setBillingType] = useState<"NON BILLABLE" | "BILLABLE">("NON BILLABLE");
  const [remarks, setRemarks] = useState("");
  const [approvalStatus, setApprovalStatus] = useState<"Pending" | "Approved" | "Rejected">("Pending");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (log && isOpen) {
      React.startTransition(() => {
        setTitle(log.title || "");
        setProject(log.project || "");
        setDuration(log.duration || "01:00");
        setDate(log.date || new Date().toISOString().split("T")[0]);
        setBillingType(log.billingType || "NON BILLABLE");
        setRemarks(log.remarks || "");
        setApprovalStatus(log.approvalStatus || "Pending");
        setError(null);
      });
    }
  }, [log, isOpen]);

  if (!isOpen || !log) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await updateTimeLogAction(log.id, {
        title,
        project,
        duration,
        date,
        billingType,
        remarks,
        approvalStatus,
      });

      onLogUpdated();
      onClose();
    } catch (err) {
      console.error("Failed to update time log:", err);
      setError("Failed to update time log entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl border bg-card text-card-foreground shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Edit Time Log</h2>
              <p className="text-xs text-muted-foreground">Log ID: {log.code || log.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">
              Task / Activity Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Project</label>
              <input
                type="text"
                required
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Duration (e.g. 01:30)
              </label>
              <input
                type="text"
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="01:30"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Billing Type</label>
              <select
                value={billingType}
                onChange={(e) => setBillingType(e.target.value as "NON BILLABLE" | "BILLABLE")}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="NON BILLABLE">Non-Billable</option>
                <option value="BILLABLE">Billable</option>
              </select>
            </div>
          </div>

          {isAdmin && (
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Approval Status</label>
              <select
                value={approvalStatus}
                onChange={(e) => setApprovalStatus(e.target.value as "Pending" | "Approved" | "Rejected")}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
              >
                <option value="Pending">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Description / Notes</label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Describe work performed..."
              className="w-full rounded-lg border border-input bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-input bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
