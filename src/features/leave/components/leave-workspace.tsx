"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import {
  INITIAL_ACTION_REQUIRED,
  INITIAL_COMPENSATORY_REQUESTS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_LEAVE_TYPES,
} from "../data/mock-leave-data";
import {
  ActionRequiredItem,
  CompensatoryRequest,
  LeaveRequest,
  LeaveTypeConfig,
} from "../types";
import { LeaveBalanceGrid } from "./leave-balance-grid";
import { ActionRequiredBanner } from "./action-required-banner";
import { LeaveRequestsTable } from "./leave-requests-table";
import { LeaveDetailModal } from "./leave-detail-modal";
import { RegularizeModal } from "./regularize-modal";
import { CompensatoryRequestsTable } from "./compensatory-requests-table";
import { ApplyCompensatoryForm } from "./apply-compensatory-form";
import { HolidaysView } from "./holidays-view";
import { ApplyLeaveForm } from "./apply-leave-form";
import { LeaveRequestDetailsView } from "./leave-request-details-view";
import { TeamLeaveWorkspace } from "./team-leave-workspace";
import { Button } from "@/components/ui/button";
import { User, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveTab =
  | "overview"
  | "requests"
  | "compensatory"
  | "holidays"
  | "apply"
  | "apply-compensatory"
  | "request-details";

interface LeaveWorkspaceProps {
  initialTab?: ActiveTab;
  initialSelectedRequestId?: string;
  initialViewMode?: "member" | "manager";
}

export function LeaveWorkspace({
  initialTab = "overview",
  initialSelectedRequestId,
  initialViewMode = "member",
}: LeaveWorkspaceProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"member" | "manager">(initialViewMode);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  // Data state
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>(INITIAL_LEAVE_TYPES);
  const [actionRequiredItems, setActionRequiredItems] =
    useState<ActionRequiredItem[]>(INITIAL_ACTION_REQUIRED);
  const [leaveRequests, setLeaveRequests] =
    useState<LeaveRequest[]>(INITIAL_LEAVE_REQUESTS);
  const [compensatoryRequests, setCompensatoryRequests] =
    useState<CompensatoryRequest[]>(INITIAL_COMPENSATORY_REQUESTS);

  // Modals / View details state
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(
    initialSelectedRequestId
      ? leaveRequests.find((r) => r.id === initialSelectedRequestId) || leaveRequests[0]
      : null
  );
  const [selectedCompRequest, setSelectedCompRequest] =
    useState<CompensatoryRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [regularizeItem, setRegularizeItem] = useState<ActionRequiredItem | null>(null);
  const [isRegularizeModalOpen, setIsRegularizeModalOpen] = useState(false);
  const [prefilledApplyDate, setPrefilledApplyDate] = useState<string | undefined>(undefined);

  // Handlers
  const handleViewRequest = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setActiveTab("request-details");
  };

  const handleViewCompRequest = (request: CompensatoryRequest) => {
    setSelectedCompRequest(request);
  };

  const handleCancelRequest = (requestId: string) => {
    setLeaveRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: "CANCELLED" } : r))
    );
  };

  const handleRegularizeClick = (item: ActionRequiredItem) => {
    setRegularizeItem(item);
    setIsRegularizeModalOpen(true);
  };

  const handleRegularizeSubmit = (
    itemId: string,
    checkIn: string,
    checkOut: string,
    reason: string
  ) => {
    setActionRequiredItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleApplyLeaveFromAction = (item: ActionRequiredItem) => {
    setPrefilledApplyDate("2026-08-14");
    setActiveTab("apply");
  };

  const handleNewLeaveSubmitted = (newLeave: LeaveRequest) => {
    setLeaveRequests([newLeave, ...leaveRequests]);
    // Deduct balance from matching leave type
    setLeaveTypes((prev) =>
      prev.map((lt) => {
        if (lt.code === newLeave.leaveTypeCode) {
          return {
            ...lt,
            remainingDays: lt.remainingDays - newLeave.durationDays,
            bookedDays: lt.bookedDays + newLeave.durationDays,
          };
        }
        return lt;
      })
    );
    setActiveTab("requests");
  };

  const handleNewCompensatorySubmitted = (newComp: CompensatoryRequest) => {
    setCompensatoryRequests([newComp, ...compensatoryRequests]);
    setActiveTab("compensatory");
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background/50 px-6 py-6 space-y-6 select-none">
      {/* 1. APPLY LEAVE VIEW */}
      {activeTab === "apply" && (
            <ApplyLeaveForm
              leaveTypes={leaveTypes}
              onSubmitLeave={handleNewLeaveSubmitted}
              onCancel={() => setActiveTab("overview")}
              initialDate={prefilledApplyDate}
            />
          )}

          {/* 2. APPLY COMPENSATORY REQUEST VIEW */}
          {activeTab === "apply-compensatory" && (
            <ApplyCompensatoryForm
              onSubmitCompensatory={handleNewCompensatorySubmitted}
              onCancel={() => setActiveTab("compensatory")}
            />
          )}

          {/* 3. LEAVE REQUEST DETAILS VIEW */}
          {activeTab === "request-details" && selectedRequest && (
            <LeaveRequestDetailsView
              request={selectedRequest}
              leaveTypes={leaveTypes}
              onCancelRequest={handleCancelRequest}
              onBack={() => setActiveTab("requests")}
            />
          )}

          {/* 4. MAIN TABS VIEW */}
          {activeTab !== "apply" &&
            activeTab !== "apply-compensatory" &&
            activeTab !== "request-details" && (
              <>
                {/* Top Navigation Tabs */}
                <div className="border-b border-border/80 pb-0">
                  <nav className="flex items-center gap-8 -mb-px">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={cn(
                    "py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer",
                    activeTab === "overview"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Overview
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("requests")}
                  className={cn(
                    "py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer",
                    activeTab === "requests"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Leave Request
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("compensatory")}
                  className={cn(
                    "py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer",
                    activeTab === "compensatory"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Compensatory Request
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("holidays")}
                  className={cn(
                    "py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer",
                    activeTab === "holidays"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Holidays
                </button>
              </nav>
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <>
                {/* Header Row: Title, Subtitle, and + Apply Leave button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      Leave Tracker
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Manage your time off and leave requests
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setActiveTab("apply")}
                    className="h-10 px-5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Apply Leave</span>
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Yearly Stat / Range Bar */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-6 font-medium text-foreground">
                      <div>
                        <span className="text-muted-foreground">Leave booked this year : </span>
                        <span className="font-bold text-foreground">6 day(s)</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Absent : </span>
                        <span className="font-bold text-foreground">23 day(s)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end md:self-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg border-border/80 text-muted-foreground"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border/80 rounded-lg text-xs font-medium text-foreground">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>01/01/2026 - 31/01/2026</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg border-border/80 text-muted-foreground"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* 1. Leave Balance Grid */}
                  <LeaveBalanceGrid
                    leaveTypes={leaveTypes}
                    onSelectType={(type) => {
                      setSelectedRequest(null);
                      setActiveTab("apply");
                    }}
                  />

                  {/* 2. Action Required Banner */}
                  <ActionRequiredBanner
                    items={actionRequiredItems}
                    onRegularize={handleRegularizeClick}
                    onApplyLeave={handleApplyLeaveFromAction}
                  />

                  {/* 3. My Requests / Holidays Table */}
                  <LeaveRequestsTable
                    requests={leaveRequests}
                    onViewRequest={handleViewRequest}
                    showFilters={false}
                    showDateRangeNav={true}
                    title="MY REQUESTS/HOLIDAYS"
                  />
                </div>
              </>
            )}

            {/* LEAVE REQUEST TAB */}
            {activeTab === "requests" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      Leave Requests
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Manage your time off and leave requests
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setActiveTab("apply")}
                    className="h-10 px-5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Apply Leave</span>
                  </Button>
                </div>

                <LeaveRequestsTable
                  requests={leaveRequests}
                  onViewRequest={handleViewRequest}
                  showFilters={true}
                  showDateRangeNav={false}
                  title=""
                />
              </div>
            )}

            {/* COMPENSATORY REQUEST TAB (Matching Image 2) */}
            {activeTab === "compensatory" && (
              <CompensatoryRequestsTable
                requests={compensatoryRequests}
                onApplyClick={() => setActiveTab("apply-compensatory")}
                onViewRequest={handleViewCompRequest}
              />
            )}

            {/* HOLIDAYS TAB */}
            {activeTab === "holidays" && <HolidaysView />}
          </>
        )}

      {/* Regularize Modal */}
      <RegularizeModal
        item={regularizeItem}
        isOpen={isRegularizeModalOpen}
        onClose={() => setIsRegularizeModalOpen(false)}
        onSubmit={handleRegularizeSubmit}
      />
    </div>
  );
}
