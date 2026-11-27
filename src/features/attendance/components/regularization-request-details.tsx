"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
import { UserName } from "@/components/shared/user-card";
import React, { useState } from "react";
import {
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
import { PulseCard, StatusPill, type PulseTone } from "@/components/pulse/pulse-ui";
import { ApprovalNoteField, StepNote } from "@/features/leave/components/approve-note-dialog";

interface RegularizationRequestDetailsProps {
  request: RegularizationRequest;
  onCancelRequest?: (id: string) => void;
  onStatusUpdated?: () => void;
  /** Managers may approve / reject requests that aren't their own. */
  canReview?: boolean;
  currentUserId?: string;
}

export function RegularizationRequestDetails({
  request,
  onCancelRequest,
  onStatusUpdated,
  canReview = false,
  currentUserId,
}: RegularizationRequestDetailsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(request.status);
  const [error, setError] = useState<string | null>(null);
  /** The reviewer's optional note — sent with Approve, or as the reason with Reject. */
  const [note, setNote] = useState("");
  /** The note just sent from here, shown on the review step before the page reloads. */
  const [approvalNote, setApprovalNote] = useState<string | undefined>();

  const isOwn = request.employee.id === currentUserId;
  // Managers review other people's requests — never their own (the server refuses that too).
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

  const handleApprove = (note: string) =>
    run(
      () => reviewRegularizationAction({ requestId: request.id, status: "APPROVED", note }),
      () => {
        setCurrentStatus("Approved");
        setApprovalNote(note || undefined);
        onStatusUpdated?.();
      }
    );

  const handleReject = (reason: string) =>
    run(
      () =>
        reviewRegularizationAction({
          requestId: request.id,
          status: "REJECTED",
          rejectionReason: reason || undefined,
        }),
      () => {
        setCurrentStatus("Rejected");
        setApprovalNote(reason || undefined);
        onStatusUpdated?.();
      }
    );

  const handleCancel = () =>
    run(
      () => cancelRegularizationAction(request.id),
      () => onCancelRequest?.(request.id)
    );

  const STATUS_TONE: Record<string, PulseTone> = { Pending: "amber", Approved: "green", Rejected: "red" };
  const statusIcon =
    currentStatus === "Approved" ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : currentStatus === "Rejected" ? (
      <XCircle className="h-3.5 w-3.5" />
    ) : (
      <Hourglass className="h-3.5 w-3.5" />
    );
  const showActions = currentStatus === "Pending" && (isOwn || showReview);

  const fields: { label: string; value: React.ReactNode; sub?: string; icon: React.ReactNode }[] = [
    { label: "Attendance Date", value: request.attendanceDate, sub: request.attendanceDay, icon: <Calendar className="h-3.5 w-3.5" /> },
    { label: "Applied On", value: request.appliedOn, sub: request.appliedDay, icon: <FileText className="h-3.5 w-3.5" /> },
    { label: "Reason", value: request.reason, icon: <Info className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Header: who + status + actions */}
      <section className="rounded-xl border border-border/60 bg-card">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <UserAvatar
              userId={request.employee.id}
              name={request.employee.name}
              image={request.employee.avatarUrl}
              className="h-12 w-12 rounded-full bg-blue-50 text-sm font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
            >
              {request.employee.name.slice(0, 2).toUpperCase()}
            </UserAvatar>
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Regularization Request</p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  <UserName userId={request.employee.id} name={request.employee.name} />
                </h2>
                <StatusPill tone={STATUS_TONE[currentStatus] ?? "gray"}>
                  {statusIcon}
                  {currentStatus === "Pending" ? "Pending Approval" : currentStatus}
                </StatusPill>
              </div>
              <div className="text-xs text-muted-foreground">
                {request.employee.designation} •{" "}
                {/* Employee ID hidden for now: ID: {request.employee.employeeId} •{" "} */}
                {request.employee.department}
              </div>
            </div>
          </div>

          {/* Owner can withdraw; a manager reviews other people's requests */}
          {showActions && (
            <div className="flex flex-wrap items-center gap-2">
              {isOwn && (
                <button
                  disabled={isProcessing}
                  onClick={handleCancel}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50/50 disabled:opacity-50 dark:border-rose-900/80 dark:bg-card dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Withdraw Request
                </button>
              )}
              {showReview && (
                <>
                  <button
                    disabled={isProcessing}
                    onClick={() => handleReject(note.trim())}
                    className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/80 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
                  >
                    Reject
                  </button>
                  <button
                    disabled={isProcessing}
                    onClick={() => handleApprove(note.trim())}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Approve
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {showActions && showReview && (
          <div className="border-t border-border/70 px-5 py-3">
            <ApprovalNoteField value={note} onChange={setNote} disabled={isProcessing} />
          </div>
        )}

        {error && (
          <div className="border-t border-border/70 px-5 py-3">
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: details */}
        <div className="space-y-4 lg:col-span-2">
          <PulseCard title="Request Details" icon={<FileText className="h-4 w-4" />}>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
              {fields.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {f.icon}
                    {f.label}
                  </dt>
                  <dd className="mt-1 truncate text-[13px] font-semibold text-foreground">{f.value}</dd>
                  {f.sub && <dd className="text-xs text-muted-foreground">{f.sub}</dd>}
                </div>
              ))}
            </dl>
            <div className="mt-4 border-t border-border/70 pt-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Team Member Remarks
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground">{request.remarks || "No remarks provided."}</p>
            </div>
          </PulseCard>

          <PulseCard title="Timing Details" icon={<Clock className="h-4 w-4" />} bodyClassName="overflow-x-auto px-0 pb-0 pt-3">
            <table className="w-full border-t border-border/70 text-left text-xs">
              <thead>
                <tr className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5" />
                  <th className="px-5 py-2.5">Check-in</th>
                  <th className="px-5 py-2.5">Check-out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                <tr>
                  <td className="px-5 py-3 font-semibold text-muted-foreground">Existing</td>
                  <td className="px-5 py-3 text-foreground">{request.existingAttendance.checkIn || "--:--"}</td>
                  <td className="px-5 py-3 text-foreground">{request.existingAttendance.checkOut || "--:--"}</td>
                </tr>
                <tr className="bg-blue-50/50 dark:bg-blue-500/10">
                  <td className="px-5 py-3 font-semibold text-blue-700 dark:text-blue-300">Requested</td>
                  <td className="px-5 py-3 font-semibold text-foreground">{request.requestedAttendance.checkIn}</td>
                  <td className="px-5 py-3 font-semibold text-foreground">{request.requestedAttendance.checkOut}</td>
                </tr>
              </tbody>
            </table>
          </PulseCard>
        </div>

        {/* Right: approval timeline */}
        <div className="space-y-4">
          <PulseCard title="Approval Timeline" icon={<Hourglass className="h-4 w-4" />} iconTone="amber">
            <ol className="relative space-y-5 border-l-2 border-border/70 pl-6">
              {request.timeline.map((step, idx) => (
                <li key={idx} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[33px] top-0 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ring-4 ring-card",
                      step.status === "completed"
                        ? "bg-emerald-500 text-white"
                        : step.status === "current"
                        ? "bg-amber-500 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {step.status === "completed" ? "✓" : idx + 1}
                  </span>
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        "text-[13px] font-semibold",
                        step.status === "current" ? "text-amber-700 dark:text-amber-300" : "text-foreground"
                      )}
                    >
                      {step.title}
                    </p>
                    {step.timestamp && <span className="shrink-0 text-[11px] text-muted-foreground">{step.timestamp}</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.subtitle}</p>
                  {(() => {
                    const note = step.note ?? (idx === 1 && currentStatus !== "Pending" ? approvalNote : undefined);
                    return note ? <StepNote note={note} /> : null;
                  })()}
                </li>
              ))}
            </ol>
          </PulseCard>

          <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Once approved, the requested timings replace the attendance record for that day.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
