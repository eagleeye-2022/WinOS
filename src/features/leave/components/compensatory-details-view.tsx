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
  Building,
  Check,
  CalendarDays,
} from "lucide-react";
import { CompensatoryRequest } from "../types";
import {
  approveCompensatoryAction,
  rejectCompensatoryAction,
} from "../actions/leave-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CompensatoryDetailsViewProps {
  request: CompensatoryRequest;
  onCancelRequest?: (id: string) => void;
  onBack?: () => void;
}

export function CompensatoryDetailsView({
  request,
  onCancelRequest,
  onBack,
}: CompensatoryDetailsViewProps) {
  const router = useRouter();
  const [status, setStatus] = useState(request.status);
  const [isProcessing, setIsProcessing] = useState(false);

  const employee = {
    name: request.employeeName || "Employee",
    empId: "EMP00123",
    role: request.designation || "Team Member",
  };

  const handlePrint = () => {
    window.print();
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await approveCompensatoryAction(request.id);
      setStatus("APPROVED");
    } catch (err) {
      console.error("Failed to approve compensatory request:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await rejectCompensatoryAction(request.id);
      setStatus("REJECTED");
    } catch (err) {
      console.error("Failed to reject compensatory request:", err);
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
    <div className="space-y-6 w-full pb-12 select-none">
      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <button
              type="button"
              onClick={() => (onBack ? onBack() : router.push("/pulse/leave"))}
              className="text-primary hover:underline hover:text-primary/80 transition-colors cursor-pointer"
            >
              Compensatory Requests
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
            <span className="text-foreground">Compensatory Request Details</span>
          </nav>

          <div className="pt-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Compensatory Request Details
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
            Requested on 18 Aug 2025 at 09:15 AM
          </p>
        </div>

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
        {/* Left Column: Employee & Request Details */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Employee & Request Details
              </h3>
            </div>

            {/* Employee Row */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                <span>VR</span>
              </div>
              <div>
                <div className="font-bold text-foreground text-sm">
                  {employee.name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {employee.empId} • {employee.role}
                </div>
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs pt-2">
              {/* Work Date */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">Work Date</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>15 May 2025 (Thu)</span>
                </div>
              </div>

              {/* Working Hours */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">Working Hours</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>07:00 PM – 10:30 PM</span>
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">Duration</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1">
                  <CalendarDays className="w-4 h-4 text-emerald-500" />
                  <span>{request.durationText || "Full Day"}</span>
                </div>
              </div>

              {/* Requested On */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">Requested On</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>16 May 2025 at 09:15 AM</span>
                </div>
              </div>

              {/* Expiry Date */}
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">Expiry Date</span>
                <div className="flex items-center gap-2 font-semibold text-foreground pt-1">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <span>15 Jun 2025 (in 26 days)</span>
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-muted-foreground font-medium text-[11px]">Reason</span>
                <div className="flex items-start gap-2 text-foreground font-medium pt-1">
                  <MessageSquare className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{request.reason || "Worked on product release support."}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Attachments Card */}
          <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Attachments (1)
              </h3>
            </div>

            <div className="flex items-center justify-between p-3 bg-background border rounded-xl">
              <div className="flex items-center gap-2.5 truncate">
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground truncate max-w-[280px]">
                    Doctor_Appointment_Proof.pdf
                  </div>
                  <div className="text-[10px] text-muted-foreground">245 KB</div>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Action Buttons: Reject / Approve */}
          {status === "PENDING" && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isProcessing}
                onClick={handleReject}
                className="h-10 px-8 rounded-xl text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50 flex items-center gap-1.5"
              >
                <X className="w-4 h-4 text-red-500" />
                <span>{isProcessing ? "Processing..." : "Reject"}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isProcessing}
                onClick={handleApprove}
                className="h-10 px-8 rounded-xl text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-emerald-500" />
                <span>{isProcessing ? "Processing..." : "Approve"}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Right Column: Approval Flow */}
        <div className="lg:col-span-4 space-y-4">
          <div className="w-full py-2.5 px-3 bg-primary text-primary-foreground rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs">
            <User className="w-4 h-4" />
            <span>Approval Flow</span>
          </div>

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
                    18 Aug 2025 at 09:15 AM
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
        </div>
      </div>
    </div>
  );
}
