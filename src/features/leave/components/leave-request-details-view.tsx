"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  FileText,
  Download,
  X,
  Printer,
  ChevronRight,
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
import { getLeaveRequestByIdAction } from "../queries/leave-queries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LeaveRequestDetailsViewProps {
  request: LeaveRequest;
  leaveTypes: LeaveTypeConfig[];
  onCancelRequest?: (id: string) => void;
  onBack?: () => void;
  isManagerView?: boolean;
}

export function LeaveRequestDetailsView({
  request,
  leaveTypes,
  onCancelRequest,
  onBack,
  isManagerView = false,
}: LeaveRequestDetailsViewProps) {
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
        actorName: request.employee?.name || "Employee",
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
    name: "Employee",
    empId: "EMP001",
    role: "Team Member",
  };

  const handlePrint = () => {
    window.print();
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
      await approveLeaveRequestAction(request.id);
      const freshData = await getLeaveRequestByIdAction(request.id);
      if (freshData) {
        if (freshData.request?.status) setStatus(freshData.request.status as LeaveStatus);
        if (freshData.request?.approvalFlow) setApprovalFlow(freshData.request.approvalFlow);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (freshData.balances && freshData.balances.length > 0) setBalances(freshData.balances as any);
      }
      router.refresh();
    } catch (err) {
      console.error("Failed to approve leave request:", err);
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
      await rejectLeaveRequestAction(request.id);
      const freshData = await getLeaveRequestByIdAction(request.id);
      if (freshData) {
        if (freshData.request?.status) setStatus(freshData.request.status as LeaveStatus);
        if (freshData.request?.approvalFlow) setApprovalFlow(freshData.request.approvalFlow);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (freshData.balances && freshData.balances.length > 0) setBalances(freshData.balances as any);
      }
      router.refresh();
    } catch (err) {
      console.error("Failed to reject leave request:", err);
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
        await cancelLeaveRequestAction(request.id);
      }
      const freshData = await getLeaveRequestByIdAction(request.id);
      if (freshData) {
        if (freshData.request?.status) setStatus(freshData.request.status as LeaveStatus);
        if (freshData.request?.approvalFlow) setApprovalFlow(freshData.request.approvalFlow);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (freshData.balances && freshData.balances.length > 0) setBalances(freshData.balances as any);
      }
      router.refresh();
    } catch (err) {
      console.error("Failed to cancel request:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (att: LeaveAttachment) => {
    if (att.url) {
      const link = document.createElement("a");
      link.href = att.url;
      link.download = att.name;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const blob = new Blob([`Document Content for ${att.name}`], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = att.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <button
              type="button"
              onClick={() => (onBack ? onBack() : router.push("/pulse/leave"))}
              className="text-primary hover:underline hover:text-primary/80 transition-colors cursor-pointer"
            >
              Leave Requests
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
            <span className="text-foreground">Leave Request Details</span>
          </nav>

          <div className="pt-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Leave Request Details
            </h1>
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                status === "CANCELLED"
                  ? "bg-muted text-muted-foreground border-border"
                  : status === "APPROVED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : status === "REJECTED"
                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
              )}
            >
              {status === "CANCELLED" ? "Cancelled" : status === "PENDING" ? "Pending" : status}
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-0.5">
            Requested on {request.appliedOnDateTime || `${request.appliedOn} at 09:15 AM`}
          </p>
        </div>

        {/* Print Button */}
        <Button
          type="button"
          variant="outline"
          onClick={handlePrint}
          className="h-9 px-4 rounded-xl text-xs font-semibold gap-2 self-start sm:self-auto border-border"
        >
          <Printer className="w-4 h-4" />
          <span>Print</span>
        </Button>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Leave Information & Attachments */}
        <div className="lg:col-span-8 space-y-6">
          {/* Leave Information Card */}
          <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Leave Information
              </h3>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              {/* Employee */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">Employee</span>
                <div className="flex items-center gap-3 pt-0.5">
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                    {employee.avatarUrl ? (
                      <img src={employee.avatarUrl} alt={employee.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{employee.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-foreground text-sm leading-tight">
                      {employee.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {employee.empId} • {employee.role}
                    </div>
                  </div>
                </div>
              </div>

              {/* Applied On */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">Applied On</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{request.appliedOnDateTime || `${request.appliedOn} at 09:15 AM`}</span>
                </div>
              </div>

              {/* Leave Type */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">Leave Type</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  {React.createElement(getLeaveIcon(request.leaveTypeIcon || "Calendar"), {
                    className: "w-4 h-4 text-primary",
                  })}
                  <span>{request.leaveTypeName}</span>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">Status</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  <span>{status === "CANCELLED" ? "Cancelled" : status === "PENDING" ? "Pending" : status}</span>
                </div>
              </div>

              {/* From Date */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">From Date</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{request.fromDateDisplay.replace("\n", " ")}</span>
                </div>
              </div>

              {/* To Date */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">To Date</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{request.toDateDisplay.replace("\n", " ")}</span>
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">Duration</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>{request.durationText}</span>
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-muted-foreground font-medium text-[11px]">Reason</span>
                <div className="flex items-start gap-2 text-foreground font-medium pt-1.5">
                  <MessageSquare className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{request.reason}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Attachments Card */}
          <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Attachments ({request.attachments?.length || 1})
              </h3>
            </div>

            <div className="space-y-2">
              {(request.attachments && request.attachments.length > 0
                ? request.attachments
                : [
                    {
                      id: "att-default",
                      name: "Doctor_Appointment_Proof.pdf",
                      size: "245 KB",
                    },
                  ]
              ).map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3 bg-background border rounded-xl"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground truncate max-w-[280px]">
                        {att.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{att.size}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPreviewAttachment(att)}
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
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
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Employee Action: Cancel Request */}
              {onCancelRequest && !isManagerView && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isProcessing}
                  onClick={handleCancel}
                  className="h-10 px-5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border-border flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel Request</span>
                </Button>
              )}

              {/* Manager Actions: Reject / Approve */}
              {isManagerView && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isProcessing}
                    onClick={handleReject}
                    className="h-10 px-6 rounded-xl text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50 flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4 text-red-500" />
                    <span>{isProcessing ? "Processing..." : "Reject"}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isProcessing}
                    onClick={handleApprove}
                    className="h-10 px-6 rounded-xl text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4 text-emerald-500" />
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
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border">
            <button
              type="button"
              onClick={() => setActiveTab("approval")}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                activeTab === "approval"
                  ? "bg-primary text-primary-foreground shadow-2xs"
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
                "flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                activeTab === "balance"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Leave Balance</span>
            </button>
          </div>

          {/* Approval Flow Card */}
          {activeTab === "approval" && (
            <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-6">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Approval Flow
              </h3>

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
                            ? "bg-primary text-primary-foreground"
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
                          "p-3 rounded-xl border transition-all space-y-1",
                          isPending && "border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/40",
                          isCompleted && "bg-card border-border/80",
                          isRejected && "border-red-200/80 bg-red-50/40 dark:bg-red-950/20 dark:border-red-900/40"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-foreground">{step.title}</h4>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                              isCompleted
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200"
                                : isRejected
                                ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-200"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border-amber-200"
                            )}
                          >
                            {isCompleted ? "Approved" : isRejected ? "Rejected" : "Pending"}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {step.actorName} {step.actorRole ? `(${step.actorRole})` : ""}
                        </p>
                        {step.dateStr && (
                          <p className="text-[10px] text-muted-foreground/80">{step.dateStr}</p>
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
            <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Remaining Leaves
              </h3>

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
                        className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1 hover:border-primary/40 transition-colors"
                      >
                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center border shadow-2xs", type.iconBgColor, type.iconTextColor)}>
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div className="text-[11px] text-muted-foreground font-medium truncate max-w-[120px]" title={type.name}>
                          {type.name}
                        </div>
                        <div className="text-xs font-bold text-foreground">
                          {type.remainingDays} <span className="text-[10px] font-normal text-muted-foreground">{type.unit || "Days"}</span>
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
          <div className="bg-card border border-border/80 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2.5 truncate pr-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <h3 className="text-sm font-bold text-foreground truncate max-w-md">
                    {previewAttachment.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
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
                    className="max-h-[55vh] max-w-full object-contain rounded-lg border shadow-xs"
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
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-2xs border border-primary/20">
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
                      className="rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground"
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
