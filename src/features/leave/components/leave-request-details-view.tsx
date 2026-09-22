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
} from "lucide-react";
import { LeaveRequest, LeaveTypeConfig } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LeaveRequestDetailsViewProps {
  request: LeaveRequest;
  leaveTypes: LeaveTypeConfig[];
  onCancelRequest?: (id: string) => void;
  onBack?: () => void;
}

export function LeaveRequestDetailsView({
  request,
  leaveTypes,
  onCancelRequest,
  onBack,
}: LeaveRequestDetailsViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"approval" | "balance">("approval");
  const [isCancelled, setIsCancelled] = useState(request.status === "CANCELLED");

  const employee = request.employee || {
    name: "Vamshi R",
    empId: "EMP00123",
    role: "Product Manager",
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCancel = () => {
    if (onCancelRequest) {
      onCancelRequest(request.id);
    }
    setIsCancelled(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
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
                isCancelled
                  ? "bg-muted text-muted-foreground border-border"
                  : request.status === "APPROVED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : request.status === "REJECTED"
                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
              )}
            >
              {isCancelled ? "Cancelled" : request.status === "PENDING" ? "Pending" : request.status}
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
                  <Plane className="w-4 h-4 text-primary" />
                  <span>{request.leaveTypeName}</span>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">Status</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  <span>{isCancelled ? "Cancelled" : request.status === "PENDING" ? "Pending" : request.status}</span>
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

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons: Manager Approve / Reject or Employee Cancel */}
          {!isCancelled && request.status === "PENDING" && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (onCancelRequest) onCancelRequest(request.id);
                  setIsCancelled(true);
                }}
                className="h-10 px-8 rounded-xl text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50 flex items-center gap-1.5"
              >
                <X className="w-4 h-4 text-red-500" />
                <span>Reject</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  request.status = "APPROVED";
                  setIsCancelled(false);
                }}
                className="h-10 px-8 rounded-xl text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Approve</span>
              </Button>
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

          {/* Approval Flow Card (Image 4) */}
          {activeTab === "approval" && (
            <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-6">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Approval Flow
              </h3>

              <div className="relative pl-6 space-y-8 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
                {/* Step 1: Requested */}
                <div className="relative">
                  <div className="absolute -left-[27px] top-0.5 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-4 ring-card">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Requested</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{employee.name}</p>
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                      {request.appliedOnDateTime || `${request.appliedOn} at 09:15 AM`}
                    </p>
                  </div>
                </div>

                {/* Step 2: Manager Approval */}
                <div className="relative">
                  <div className="absolute -left-[27px] top-0.5 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center ring-4 ring-card border border-amber-300 dark:border-amber-800">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground">Manager Approval</h4>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Pending
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Rajesh N (Product Director)
                    </p>
                  </div>
                </div>

                {/* Step 3: Final Approval */}
                <div className="relative">
                  <div className="absolute -left-[27px] top-0.5 w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center ring-4 ring-card border border-border">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground">Final Approval</h4>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">Pending</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Leave Balance Card (Image 3) */}
          {activeTab === "balance" && (
            <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Remaining Leaves
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Casual Leave */}
                <div className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1">
                  <div className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-500">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">Casual Leave</div>
                  <div className="text-xs font-bold text-primary">4 Days</div>
                </div>

                {/* Sick Leave */}
                <div className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1">
                  <div className="p-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500">
                    <Heart className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">Sick Leave</div>
                  <div className="text-xs font-bold text-primary">3 Days</div>
                </div>

                {/* Annual Leave */}
                <div className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1">
                  <div className="p-1.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-500">
                    <CalendarCheck className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">Annual Leave</div>
                  <div className="text-xs font-bold text-primary">5 Days</div>
                </div>

                {/* Comp Off */}
                <div className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1">
                  <div className="p-1.5 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-500">
                    <History className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">Comp Off</div>
                  <div className="text-xs font-bold text-primary">1 Day</div>
                </div>

                {/* Early Leave */}
                <div className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1">
                  <div className="p-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 text-cyan-500">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">Early Leave</div>
                  <div className="text-xs font-bold text-primary">2 Days</div>
                </div>

                {/* +4 More */}
                <div className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1">
                  <div className="text-sm font-bold text-foreground">+4</div>
                  <div className="text-[11px] text-muted-foreground font-medium">More</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
