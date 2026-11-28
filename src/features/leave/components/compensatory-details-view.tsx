"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  FileText,
  Download,
  X,
  Printer,
  User,
  MessageSquare,
  Building,
  Check,
  CalendarDays,
} from "lucide-react";
import { CompensatoryRequest } from "../types";
import {
  approveCompensatoryAction,
  rejectCompensatoryAction,
} from "../actions/leave-actions";
import { errorMessage, unwrap } from "../action-result";
import { Button } from "@/components/ui/button";
import { ApprovalNoteField, StepNote } from "./approve-note-dialog";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { UserName } from "@/components/shared/user-card";
import { StatusPill, TONE_DOT, type PulseTone } from "@/components/pulse/pulse-ui";

const STATUS_TONE: Record<string, PulseTone> = { APPROVED: "green", REJECTED: "red", PENDING: "amber", CANCELLED: "gray" };
const STATUS_LABEL: Record<string, string> = { APPROVED: "Approved", REJECTED: "Rejected", PENDING: "Pending", CANCELLED: "Cancelled" };

interface CompensatoryDetailsViewProps {
  request: CompensatoryRequest;
  onCancelRequest?: (id: string) => void;
}

export function CompensatoryDetailsView({
  request,
  onCancelRequest,
}: CompensatoryDetailsViewProps) {
  const [status, setStatus] = useState(request.status);
  const [isProcessing, setIsProcessing] = useState(false);
  /** The reviewer's optional note — sent with Approve, or as the reason with Reject. */
  const [note, setNote] = useState("");
  /** The note just sent from here, shown on the step it decided. */
  const [approvalNote, setApprovalNote] = useState<string | undefined>();

  const employee = {
    name: request.employeeName || "Team Member",
    empId: request.employeeCode,
    role: request.designation || "Team Member",
  };
  const attachments = request.attachments ?? [];
  const workingHours = request.fromTime
    ? `${request.fromTime} – ${request.toTime}`
    : request.hoursWorked?.split("\n")[0];
  // Comp-offs from before approval steps were recorded have none, so show the status itself.
  const approvalSteps = request.approvalSteps?.length
    ? request.approvalSteps
    : [
        { id: "requested", title: "Requested", actorName: employee.name, dateStr: request.requestedOn, status: "APPROVED" },
        { id: "manager", title: "Manager Approval", actorName: "Reporting Manager", status: "PENDING" },
      ];
  /** A step still waiting takes the request's outcome once it has been reviewed here. */
  const stepStatus = (s: string) => (s === "PENDING" && status !== "PENDING" ? status : s);

  const handlePrint = () => {
    window.print();
  };

  const handleApprove = async (note: string) => {
    setIsProcessing(true);
    try {
      unwrap(await approveCompensatoryAction(request.id, note));
      setStatus("APPROVED");
      setApprovalNote(note || undefined);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (reason: string) => {
    setIsProcessing(true);
    try {
      unwrap(await rejectCompensatoryAction(request.id, reason || undefined));
      setStatus("REJECTED");
      setApprovalNote(reason || undefined);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (onCancelRequest) {
      onCancelRequest(request.id);
    }
    setStatus("CANCELLED");
  };

  return (
    <div className="w-full select-none space-y-4 pb-12">
      {/* Breadcrumb Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-semibold text-foreground">
              Compensatory Request Details
            </h1>
            <StatusPill tone={STATUS_TONE[status] ?? "amber"}>
              <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[STATUS_TONE[status] ?? "amber"])} />
              {STATUS_LABEL[status] ?? status}
            </StatusPill>
          </div>

          <p className="text-xs text-muted-foreground">
            Requested on {request.requestedOn}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handlePrint}
          className="h-8 gap-1.5 self-start rounded-md border-border/80 px-3 text-xs font-semibold sm:self-auto"
        >
          <Printer className="w-4 h-4" />
          <span>Print</span>
        </Button>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {/* Left Column: Team Member & Request Details */}
        <div className="space-y-4 lg:col-span-8">
          <div className="space-y-5 rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <FileText className="h-4 w-4" />
              </span>
              <h3 className="text-[15px] font-semibold text-foreground">Team Member & Request Details</h3>
            </div>

            {/* Employee Row */}
            <div className="flex items-center gap-3">
              <UserAvatar
                name={employee.name}
                className="h-10 w-10 bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
              >
                {request.avatarText}
              </UserAvatar>
              <div>
                <div className="font-bold text-foreground text-sm">
                  <UserName name={employee.name} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {employee.empId ? `${employee.empId} • ` : ""}
                  {employee.role}
                </div>
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-border/70 pt-5 text-xs sm:grid-cols-2">
              {/* Work Date */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Work Date</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {request.workDate}
                    {request.workDayOfWeek ? ` (${request.workDayOfWeek})` : ""}
                  </span>
                </div>
              </div>

              {/* Working Hours */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Working Hours</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>{workingHours || "—"}</span>
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Duration</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <span>{request.durationText || request.duration || "—"}</span>
                </div>
              </div>

              {/* Requested On */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Requested On</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{request.requestedOn}</span>
                </div>
              </div>

              {/* Expiry Date */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Expiry Date</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{request.expiryDate}</span>
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reason</span>
                <div className="flex items-start gap-2 text-foreground font-medium pt-1">
                  <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{request.reason}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Attachments Card */}
          <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <FileText className="h-4 w-4" />
              </span>
              <h3 className="text-[15px] font-semibold text-foreground">
                Attachments ({attachments.length})
              </h3>
            </div>

            {attachments.length === 0 && <p className="text-xs text-muted-foreground">No attachments.</p>}
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center justify-between rounded-md border border-border/70 bg-background p-3">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground truncate max-w-[280px]">{att.name}</div>
                    <div className="text-xs text-muted-foreground">{att.size}</div>
                  </div>
                </div>

                {att.url && (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${att.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons: Reject / Approve — only for a manager responsible for this person */}
          {status === "PENDING" && request.canReview && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-card px-5 py-3">
            <ApprovalNoteField value={note} onChange={setNote} disabled={isProcessing} />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isProcessing}
                onClick={() => handleReject(note.trim())}
                className="flex h-9 items-center gap-1.5 rounded-md border-red-200 px-4 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-950/30"
              >
                <X className="w-4 h-4 text-red-500" />
                <span>{isProcessing ? "Processing..." : "Reject"}</span>
              </Button>

              <Button
                type="button"
                disabled={isProcessing}
                onClick={() => handleApprove(note.trim())}
                className="flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Check className="w-4 h-4" />
                <span>{isProcessing ? "Processing..." : "Approve"}</span>
              </Button>
            </div>
            </div>
          )}
        </div>

        {/* Right Column: Approval Flow */}
        <div className="lg:col-span-4 space-y-4">

          <div className="space-y-6 rounded-xl border border-border/60 bg-card p-5">
            <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-foreground">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <User className="h-4 w-4" />
              </span>
              Approval Flow
            </h3>

            <div className="relative pl-6 space-y-8 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
              {approvalSteps.map((step) => {
                const current = stepStatus(step.status);
                return (
                  <div key={step.id} className="relative">
                    <div
                      className={cn(
                        "absolute -left-[27px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-card",
                        current === "APPROVED" && "bg-emerald-500 text-white",
                        current === "REJECTED" && "bg-red-500 text-white",
                        current !== "APPROVED" && current !== "REJECTED" && "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {current === "APPROVED" ? (
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      ) : current === "REJECTED" ? (
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      ) : (
                        <User className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-foreground">{step.title}</h4>
                      {current !== "APPROVED" && (
                        <StatusPill tone={current === "REJECTED" ? "red" : "amber"}>
                          {current === "REJECTED" ? "Rejected" : current === "PENDING" ? "Pending" : current}
                        </StatusPill>
                      )}
                    </div>
                    {step.actorName && <p className="text-xs text-muted-foreground mt-0.5">{step.actorName}</p>}
                    {step.dateStr && <p className="text-xs text-muted-foreground/80 mt-0.5">{step.dateStr}</p>}
                    {(() => {
                      const note = step.note ?? (step.status === "PENDING" ? approvalNote : undefined);
                      return note ? <StepNote note={note} /> : null;
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
