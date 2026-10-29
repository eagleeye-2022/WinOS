"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Hourglass,
  ArrowRight,
  MessageSquare,
  XCircle,
  CheckCircle2,
  Info,
  Layers,
  Loader2,
  Check,
} from "lucide-react";
import { RegularizationRequest } from "../types";
import { reviewRegularizationAction, cancelRegularizationAction } from "../actions/attendance-actions";
import { cn } from "@/lib/utils";

interface RegularizationRequestDetailsProps {
  request: RegularizationRequest;
  onBack: () => void;
  onCancelRequest?: (id: string) => void;
  onStatusUpdated?: () => void;
  /** Managers may approve / reject requests that aren't their own. */
  canReview?: boolean;
  currentUserId?: string;
}

export function RegularizationRequestDetails({
  request,
  onBack,
  onCancelRequest,
  onStatusUpdated,
  canReview = false,
  currentUserId,
}: RegularizationRequestDetailsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(request.status);
  const [error, setError] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const isOwn = request.employee.id === currentUserId;
  const showReview = canReview && !isOwn;

  const run = async (action: () => Promise<{ success: boolean; message?: string }>, onOk: () => void) => {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await action();
      if (!res.success) {
        setError(res.message || "Something went wrong.");
        return;
      }
      onOk();
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = () =>
    run(
      () => reviewRegularizationAction({ requestId: request.id, status: "APPROVED" }),
      () => {
        setCurrentStatus("Approved");
        onStatusUpdated?.();
      }
    );

  const handleReject = () => {
    if (!isRejecting) {
      setIsRejecting(true);
      return;
    }
    return run(
      () =>
        reviewRegularizationAction({
          requestId: request.id,
          status: "REJECTED",
          rejectionReason: rejectionReason.trim() || undefined,
        }),
      () => {
        setCurrentStatus("Rejected");
        onStatusUpdated?.();
      }
    );
  };

  const handleCancel = () =>
    run(
      () => cancelRegularizationAction(request.id),
      () => onCancelRequest?.(request.id)
    );

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Back Link */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Regularization Requests</span>
      </button>

      {/* Main Content Layout (2 columns: Left details, Right timeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Employee Header Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-card border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {request.employee.avatarUrl ? (
                <img
                  src={request.employee.avatarUrl}
                  alt={request.employee.name}
                  className="w-14 h-14 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-accent text-blue-600 dark:text-blue-300 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-base font-bold shrink-0">
                  {request.employee.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                    {request.employee.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {request.employee.status}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {request.employee.designation} • ID: {request.employee.employeeId} •{" "}
                  {request.employee.department}
                </div>
              </div>
            </div>

            {/* Status Pill Badge */}
            <div>
              {currentStatus === "Pending" && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50/60 dark:bg-amber-950/40 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-bold">
                  <Hourglass className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pending Approval</span>
                </div>
              )}
              {currentStatus === "Approved" && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Approved</span>
                </div>
              )}
              {currentStatus === "Rejected" && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-rose-300 bg-rose-50/60 dark:bg-rose-950/40 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Rejected</span>
                </div>
              )}
            </div>
          </div>

          {/* 3 Summary Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Attendance Date */}
            <div className="p-4 rounded-2xl bg-white dark:bg-card border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-accent text-blue-600 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-zinc-400 font-medium">Attendance Date</div>
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {request.attendanceDate}
                </div>
                <div className="text-xs text-zinc-400">{request.attendanceDay}</div>
              </div>
            </div>

            {/* Application Date */}
            <div className="p-4 rounded-2xl bg-white dark:bg-card border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-zinc-400 font-medium">Applied On</div>
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {request.appliedOn}
                </div>
                <div className="text-xs text-zinc-400">{request.appliedDay}</div>
              </div>
            </div>

            {/* Reason */}
            <div className="p-4 rounded-2xl bg-white dark:bg-card border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-zinc-400 font-medium">Reason</div>
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 truncate max-w-[130px]">
                  {request.reason}
                </div>
                <div className="text-xs text-zinc-400">Regularization</div>
              </div>
            </div>
          </div>

          {/* Timings Comparison Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-card border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Timing Details Comparison</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Existing Timing */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-2 text-xs">
                <div className="font-bold text-zinc-700 dark:text-zinc-300 pb-1 border-b border-zinc-200/60 dark:border-zinc-700">
                  Existing Recorded Timing
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Check-in</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {request.existingAttendance.checkIn || "--:--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Check-out</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {request.existingAttendance.checkOut || "--:--"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500">Worked Duration</span>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">
                    {request.existingAttendance.workedDuration || "--"}
                  </span>
                </div>
              </div>

              {/* Requested Timing */}
              <div className="p-4 rounded-xl border border-blue-200 dark:border-zinc-700/60 bg-blue-50/30 dark:bg-accent space-y-2 text-xs">
                <div className="font-bold text-blue-700 dark:text-blue-300 pb-1 border-b border-blue-100 dark:border-zinc-700/40">
                  Requested Correction Timing
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Check-in</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {request.requestedAttendance.checkIn}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Check-out</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {request.requestedAttendance.checkOut}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500">Worked Duration</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {request.requestedAttendance.workedDuration}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Employee Remarks Box */}
          <div className="p-5 rounded-2xl bg-white dark:bg-card border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-2">
            <div className="flex items-center gap-2.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-accent text-blue-600">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <span>Employee Remarks</span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 pl-8 leading-relaxed">
              {request.remarks || "No remarks provided."}
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Bottom Actions: owner can withdraw, a manager (not the owner) can review */}
          {currentStatus === "Pending" && (isOwn || showReview) && (
            <div className="p-4 rounded-2xl bg-white dark:bg-card border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-3">
              {showReview && isRejecting && (
                <textarea
                  rows={2}
                  maxLength={250}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason for rejection (shared with the employee)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {isOwn ? (
                  <button
                    disabled={isProcessing}
                    onClick={handleCancel}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/80 bg-white hover:bg-rose-50/50 dark:bg-card text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors shadow-2xs disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Withdraw Request</span>
                  </button>
                ) : (
                  <span />
                )}

                {showReview && (
                  <div className="flex items-center gap-2.5">
                    <button
                      disabled={isProcessing}
                      onClick={handleReject}
                      className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/80 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 transition-colors disabled:opacity-50"
                    >
                      {isRejecting ? "Confirm Reject" : "Reject"}
                    </button>
                    <button
                      disabled={isProcessing}
                      onClick={handleApprove}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Approve Request</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Request Timeline */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-card border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-6">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span>Request Timeline</span>
            </div>

            {/* Timeline Steps */}
            <div className="relative pl-6 border-l-2 border-zinc-100 dark:border-zinc-800 space-y-6 py-1">
              {request.timeline.map((step, idx) => (
                <div key={idx} className="relative">
                  <div className={cn(
                    "absolute -left-[31px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs",
                    step.status === "completed" ? "bg-blue-600 text-white" :
                    step.status === "current" ? "bg-amber-500 text-white" :
                    "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                  )}>
                    {step.status === "completed" ? "✓" : "•"}
                  </div>
                  <div className="flex items-center justify-between">
                    <h5 className={cn(
                      "text-xs font-bold",
                      step.status === "current" ? "text-amber-700 dark:text-amber-300" :
                      "text-zinc-900 dark:text-zinc-100"
                    )}>
                      {step.title}
                    </h5>
                    {step.timestamp && (
                      <span className="text-xs text-zinc-400">
                        {step.timestamp}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {step.subtitle}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Info Callout */}
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-accent border border-blue-100 dark:border-zinc-700/40 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>
              Once approved, the requested timings replace the attendance record for that day.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
