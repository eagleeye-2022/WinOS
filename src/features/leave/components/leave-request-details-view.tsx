"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  FileText,
  Download,
  X,
  Printer,
  User,
  MessageSquare,
  Plane,
  CheckCircle2,
  GitCommit,
  Check,
  CalendarDays,
  Heart,
  CalendarCheck,
  History,
  Thermometer,
  Pill,
  Baby,
  Users,
  Gift,
  AlertTriangle,
  Sparkles,
  Laptop2,
  Coffee,
  Sun,
  Briefcase,
  TimerReset,
  HelpCircle,
  Eye,
  ExternalLink,
} from "lucide-react";
import { LeaveRequest, LeaveTypeConfig, ApprovalStep, LeaveStatus, LeaveAttachment } from "../types";
import {
  approveLeaveRequestAction,
  rejectLeaveRequestAction,
  cancelLeaveRequestAction,
} from "../actions/leave-actions";
import { errorMessage, unwrap } from "../action-result";
import { getLeaveRequestByIdAction } from "../queries/leave-queries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusPill, TONE_DOT, type PulseTone } from "@/components/pulse/pulse-ui";

const STATUS_TONE: Record<string, PulseTone> = { APPROVED: "green", REJECTED: "red", PENDING: "amber", CANCELLED: "gray" };
const STATUS_LABEL: Record<string, string> = { APPROVED: "Approved", REJECTED: "Rejected", PENDING: "Pending", CANCELLED: "Cancelled" };
import { UserAvatar } from "@/components/shared/user-avatar";
import { UserName } from "@/components/shared/user-card";

interface LeaveRequestDetailsViewProps {
  request: LeaveRequest;
  leaveTypes: LeaveTypeConfig[];
  onCancelRequest?: (id: string) => void;
  /** Someone else's request, opened by a manager: Approve / Reject show. */
  isManagerView?: boolean;
  /** The viewer's own request and they're a manager: they may approve it themselves. */
  canApproveOwn?: boolean;
}

export function LeaveRequestDetailsView({
  request,
  leaveTypes,
  onCancelRequest,
  isManagerView = false,
  canApproveOwn = false,
}: LeaveRequestDetailsViewProps) {
  const showReview = isManagerView;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"approval" | "balance">("approval");
  const [status, setStatus] = useState<LeaveStatus>(request.status);
  const [approvalFlow, setApprovalFlow] = useState<ApprovalStep[]>(() => {
    if (request.approvalFlow && request.approvalFlow.length > 0) {
      return request.approvalFlow;
    }
    return [
      {
        id: "step-1",
        title: "Requested",
        actorName: request.employee?.name || "Team Member",
        dateStr: request.appliedOnDateTime || request.appliedOn,
        status: "COMPLETED" as const,
      },
      {
        id: "step-2",
        title: "Manager Approval",
        actorName: "Reporting Manager",
        status:
          request.status === "APPROVED"
            ? ("APPROVED" as const)
            : request.status === "REJECTED"
            ? ("REJECTED" as const)
            : ("PENDING" as const),
      },
    ];
  });
  const [balances, setBalances] = useState<LeaveTypeConfig[]>(leaveTypes);
  const [previewAttachment, setPreviewAttachment] = useState<LeaveAttachment | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Synchronize local state whenever props update
  React.useEffect(() => {
    setStatus(request.status);
    if (request.approvalFlow && request.approvalFlow.length > 0) {
      setApprovalFlow(request.approvalFlow);
    }
  }, [request]);

  React.useEffect(() => {
    setBalances(leaveTypes);
  }, [leaveTypes]);

  const getLeaveIcon = (name?: string) => {
    switch (name) {
      case "Thermometer":
        return Thermometer;
      case "Heart":
        return Heart;
      case "Pill":
        return Pill;
      case "Plane":
        return Plane;
      case "CalendarDays":
        return CalendarDays;
      case "Baby":
        return Baby;
      case "Users":
        return Users;
      case "Clock":
        return Clock;
      case "Gift":
        return Gift;
      case "AlertTriangle":
        return AlertTriangle;
      case "Sparkles":
        return Sparkles;
      case "FileText":
        return FileText;
      case "Laptop2":
        return Laptop2;
      case "Coffee":
        return Coffee;
      case "Sun":
        return Sun;
      case "Briefcase":
        return Briefcase;
      case "TimerReset":
        return TimerReset;
      default:
        return Calendar;
    }
  };

  const employee = request.employee || {
    name: "Team Member",
    empId: "—",
    role: "Team Member",
  };

  const handlePrint = () => {
    window.print();
  };

  /** Replaces optimistic state with what the server has (after success, and to undo it on failure). */
  const syncFromServer = async () => {
    const freshData = await getLeaveRequestByIdAction(request.id);
    if (freshData) {
      if (freshData.request?.status) setStatus(freshData.request.status as LeaveStatus);
      if (freshData.request?.approvalFlow) setApprovalFlow(freshData.request.approvalFlow);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (freshData.balances && freshData.balances.length > 0) setBalances(freshData.balances as any);
    }
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    const nowStr = `${new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })} at ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

    // Instant optimistic update
    setStatus("APPROVED");
    setApprovalFlow((prev) =>
      prev.map((step) =>
        step.title.includes("Manager") || step.id === "step-2" || step.id.includes("2")
          ? { ...step, status: "APPROVED", dateStr: nowStr }
          : step
      )
    );
    setBalances((prev) =>
      prev.map((b) =>
        b.code === request.leaveTypeCode
          ? {
              ...b,
              remainingDays: Math.max(0, b.remainingDays - (request.durationDays || 0)),
              bookedDays: b.bookedDays + (request.durationDays || 0),
            }
          : b
      )
    );

    try {
      const res = unwrap(await approveLeaveRequestAction(request.id));
      if (!res.completed) alert(`Approved. It now needs ${res.nextStep ?? "the next approval"}.`);
      else if (res.isLossOfPay) alert(`Approved. ${res.lopDays} day(s) exceed the balance and are marked as loss of pay.`);
      await syncFromServer();
      router.refresh();
    } catch (err) {
      alert(errorMessage(err));
      await syncFromServer().catch(() => {});
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    const nowStr = `${new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })} at ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

    // Instant optimistic update
    setStatus("REJECTED");
    setApprovalFlow((prev) =>
      prev.map((step) =>
        step.title.includes("Manager") || step.id === "step-2" || step.id.includes("2")
          ? { ...step, status: "REJECTED", dateStr: nowStr }
          : step
      )
    );

    try {
      unwrap(await rejectLeaveRequestAction(request.id));
      await syncFromServer();
      router.refresh();
    } catch (err) {
      alert(errorMessage(err));
      await syncFromServer().catch(() => {});
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    setIsProcessing(true);
    setStatus("CANCELLED");
    try {
      if (onCancelRequest) {
        onCancelRequest(request.id);
      } else {
        unwrap(await cancelLeaveRequestAction(request.id));
      }
      await syncFromServer();
      router.refresh();
    } catch (err) {
      alert(errorMessage(err));
      await syncFromServer().catch(() => {});
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (att: LeaveAttachment) => {
    if (!att.url) return;
    const link = document.createElement("a");
    link.href = att.url;
    link.download = att.name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-4 pb-12">
      {/* Breadcrumb Header */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-semibold text-foreground">
              Leave Request Details
            </h1>
            <StatusPill tone={STATUS_TONE[status] ?? "amber"}>
              <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[STATUS_TONE[status] ?? "amber"])} />
              {STATUS_LABEL[status] ?? status}
            </StatusPill>
          </div>

          <p className="text-xs text-muted-foreground">
            Requested on {request.appliedOnDateTime || `${request.appliedOn} at 09:15 AM`}
          </p>
        </div>

        {/* Print Button */}
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
        {/* Left Column: Leave Information & Attachments */}
        <div className="space-y-4 lg:col-span-8">
          {/* Leave Information Card */}
          <div className="space-y-5 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <FileText className="h-4 w-4" />
              </span>
              <h3 className="text-[15px] font-semibold text-foreground">Leave Information</h3>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-border/70 pt-5 text-xs sm:grid-cols-2">
              {/* Employee */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Team Member</span>
                <div className="flex items-center gap-3 pt-0.5">
                  <UserAvatar
                    userId={employee.id}
                    name={employee.name}
                    image={employee.avatarUrl}
                    className="h-9 w-9 bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                  >
                    {employee.name.slice(0, 2).toUpperCase()}
                  </UserAvatar>
                  <div>
                    <div className="font-bold text-foreground text-sm leading-tight">
                      <UserName userId={employee.id} name={employee.name} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {employee.empId} • {employee.role}
                    </div>
                  </div>
                </div>
              </div>

              {/* Applied On */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Applied On</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{request.appliedOnDateTime || `${request.appliedOn} at 09:15 AM`}</span>
                </div>
              </div>

              {/* Leave Type */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Leave Type</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  {React.createElement(getLeaveIcon(request.leaveTypeIcon || "Calendar"), {
                    className: "w-4 h-4 text-muted-foreground",
                  })}
                  <span>{request.leaveTypeName}</span>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  <span className={cn("inline-block h-2 w-2 rounded-full", TONE_DOT[STATUS_TONE[status] ?? "amber"])} />
                  <span>{STATUS_LABEL[status] ?? status}</span>
                </div>
              </div>

              {/* From Date */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">From Date</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{request.fromDateDisplay.replace("\n", " ")}</span>
                </div>
              </div>

              {/* To Date */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">To Date</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{request.toDateDisplay.replace("\n", " ")}</span>
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Duration</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>{request.durationText}</span>
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reason</span>
                <div className="flex items-start gap-2 text-foreground font-medium pt-1.5">
                  <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{request.reason}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Attachments Card */}
          <div className="space-y-4 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <FileText className="h-4 w-4" />
              </span>
              <h3 className="text-[15px] font-semibold text-foreground">
                Attachments ({request.attachments?.length ?? 0})
              </h3>
            </div>

            <div className="space-y-2">
              {!request.attachments?.length && <p className="text-xs text-muted-foreground">No attachments.</p>}
              {request.attachments?.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between rounded-md border border-border/70 bg-background p-3"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground truncate max-w-[280px]">
                        {att.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{att.size}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPreviewAttachment(att)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-primary/10"
                      title="View Document"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(att)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons: Manager Approve / Reject or Employee Cancel */}
          {status === "PENDING" && (
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-3">
              {/* Employee Action: Cancel Request */}
              {onCancelRequest && !isManagerView && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isProcessing}
                  onClick={handleCancel}
                  className="flex h-9 items-center gap-1.5 rounded-md border-border/80 px-4 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel Request</span>
                </Button>
              )}

              {/* A manager's own request: they may approve it themselves (rejecting = cancelling). */}
              {canApproveOwn && !isManagerView && (
                <Button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleApprove}
                  className="flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Check className="w-4 h-4" />
                  <span>{isProcessing ? "Processing..." : "Approve"}</span>
                </Button>
              )}

              {/* Manager Actions on someone else's request: Reject / Approve */}
              {showReview && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isProcessing}
                    onClick={handleReject}
                    className="flex h-9 items-center gap-1.5 rounded-md border-red-200 px-4 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-950/30"
                  >
                    <X className="w-4 h-4 text-red-500" />
                    <span>{isProcessing ? "Processing..." : "Reject"}</span>
                  </Button>

                  <Button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleApprove}
                    className="flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isProcessing ? "Processing..." : "Approve"}</span>
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Approval Flow vs Leave Balance Switcher */}
        <div className="lg:col-span-4 space-y-4">
          {/* Switcher Buttons */}
          <div className="flex items-center gap-1 rounded-md border border-border/70 bg-card p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <button
              type="button"
              onClick={() => setActiveTab("approval")}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded py-2 text-xs font-semibold transition-colors",
                activeTab === "approval"
                  ? "bg-blue-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>Approval Flow</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("balance")}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded py-2 text-xs font-semibold transition-colors",
                activeTab === "balance"
                  ? "bg-blue-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Leave Balance</span>
            </button>
          </div>

          {/* Approval Flow Card */}
          {activeTab === "approval" && (
            <div className="space-y-6 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
              <h3 className="text-[15px] font-semibold text-foreground">Approval Flow</h3>

              <div className="relative pl-6 space-y-8 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
                {(approvalFlow && approvalFlow.length > 0
                  ? approvalFlow
                  : [
                      {
                        id: "step-1",
                        title: "Requested",
                        actorName: employee.name,
                        dateStr: request.appliedOnDateTime || `${request.appliedOn}`,
                        status: "COMPLETED" as const,
                      },
                      {
                        id: "step-2",
                        title: "Manager Approval",
                        actorName: "Reporting Manager",
                        status:
                          status === "APPROVED"
                            ? ("APPROVED" as const)
                            : status === "REJECTED"
                            ? ("REJECTED" as const)
                            : ("PENDING" as const),
                      },
                    ]
                ).map((step, idx) => {
                  const isCompleted = step.status === "COMPLETED" || step.status === "APPROVED";
                  const isPending = step.status === "PENDING";
                  const isRejected = step.status === "REJECTED";

                  return (
                    <div key={step.id || idx} className="relative">
                      <div
                        className={cn(
                          "absolute -left-[27px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-card",
                          isCompleted
                            ? "bg-emerald-500 text-white"
                            : isRejected
                            ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 border border-red-300 dark:border-red-800"
                            : "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                        )}
                      >
                        {isCompleted ? (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        ) : isRejected ? (
                          <X className="w-3.5 h-3.5" />
                        ) : (
                          <User className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div
                        className={cn(
                          "p-3 rounded-md border transition-all space-y-1",
                          isPending && "border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/40",
                          isCompleted && "bg-card border-border/80",
                          isRejected && "border-red-200/80 bg-red-50/40 dark:bg-red-950/20 dark:border-red-900/40"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-foreground">{step.title}</h4>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              isCompleted
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                : isRejected
                                ? "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                            )}
                          >
                            {isCompleted ? "Approved" : isRejected ? "Rejected" : "Pending"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {step.actorName}
                          {step.actorRole && step.actorRole !== step.actorName ? ` (${step.actorRole})` : ""}
                        </p>
                        {step.dateStr && (
                          <p className="text-xs text-muted-foreground/80">{step.dateStr}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Leave Balance Card */}
          {activeTab === "balance" && (
            <div className="space-y-4 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
              <h3 className="text-[15px] font-semibold text-foreground">Remaining Leaves</h3>

              {balances.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No active leave balances available.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {balances.map((type) => {
                    const TypeIcon = getLeaveIcon(type.iconName || "Calendar");
                    return (
                      <div
                        key={type.id || type.code}
                        className="flex flex-col items-center justify-center space-y-1 rounded-md border border-border/70 bg-background p-3 text-center transition-colors hover:border-blue-300 dark:hover:border-blue-500/50"
                      >
                        <div className={cn("flex h-9 w-9 items-center justify-center rounded-full", type.iconBgColor, type.iconTextColor)}>
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div className="text-xs text-muted-foreground font-medium truncate max-w-[120px]" title={type.name}>
                          {type.name}
                        </div>
                        <div className="text-xs font-bold text-foreground">
                          {type.remainingDays} <span className="text-xs font-normal text-muted-foreground">{type.unit || "Days"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 w-full max-w-2xl rounded-lg shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2.5 truncate pr-2">
                <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <h3 className="text-sm font-bold text-foreground truncate max-w-md">
                    {previewAttachment.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {previewAttachment.size} • {previewAttachment.type || "Document"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {previewAttachment.url && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewAttachment.url, "_blank")}
                    className="h-8 px-2.5 text-xs gap-1.5 rounded-lg border-border"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Open</span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(previewAttachment)}
                  className="h-8 px-2.5 text-xs gap-1.5 rounded-lg border-border"
                  title="Download Document"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewAttachment(null)}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center min-h-[300px] bg-muted/10">
              {previewAttachment.url &&
              (previewAttachment.type?.startsWith("image/") ||
                /\.(png|jpe?g|webp|gif|svg)$/i.test(previewAttachment.name)) ? (
                <div className="w-full flex items-center justify-center">
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    className="max-h-[55vh] max-w-full object-contain rounded-lg border shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  />
                </div>
              ) : previewAttachment.url &&
                (previewAttachment.type?.includes("pdf") ||
                  /\.pdf$/i.test(previewAttachment.name)) ? (
                <div className="w-full h-[55vh] rounded-lg border overflow-hidden bg-background">
                  <iframe
                    src={previewAttachment.url}
                    className="w-full h-full border-0"
                    title={previewAttachment.name}
                  />
                </div>
              ) : (
                <div className="text-center space-y-3 py-8 max-w-sm">
                  <div className="w-16 h-16 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-[0_1px_2px_rgba(15,23,42,0.04)] border border-primary/20">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground">
                      {previewAttachment.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Document attached to this leave request.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleDownload(previewAttachment)}
                      className="rounded-md text-xs gap-1.5 bg-primary text-primary-foreground"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Document
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
