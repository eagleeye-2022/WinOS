"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  ActionRequiredItem,
  CompensatoryRequest,
  LeaveRequest,
  LeaveTypeConfig,
} from "../types";
import { LeaveBalanceGrid } from "./leave-balance-grid";
import { ActionRequiredBanner } from "./action-required-banner";
import { LeaveRequestsTable } from "./leave-requests-table";
import { RegularizeModal } from "./regularize-modal";
import { CompensatoryRequestsTable } from "./compensatory-requests-table";
import { ApplyCompensatoryForm } from "./apply-compensatory-form";
import { HolidaysView } from "./holidays-view";
import { ApplyLeaveForm } from "./apply-leave-form";
import { LeaveRequestDetailsView } from "./leave-request-details-view";
import { CompensatoryDetailsView } from "./compensatory-details-view";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getMyLeaveTrackerDataAction,
  getLeaveRequestByIdAction,
} from "../queries/leave-queries";
import {
  cancelLeaveRequestAction,
  submitRegularizationAction,
} from "../actions/leave-actions";

type ActiveTab =
  | "overview"
  | "requests"
  | "compensatory"
  | "holidays"
  | "apply"
  | "apply-compensatory"
  | "request-details"
  | "compensatory-details";

interface LeaveWorkspaceProps {
  initialTab?: ActiveTab;
  initialSelectedRequestId?: string;
  initialSelectedCompRequestId?: string;
}

export function LeaveWorkspace({
  initialTab = "overview",
  initialSelectedRequestId,
  initialSelectedCompRequestId,
}: LeaveWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [isPending, startTransition] = useTransition();

  // Data state from Database
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([]);
  const [actionRequiredItems, setActionRequiredItems] = useState<ActionRequiredItem[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [compensatoryRequests, setCompensatoryRequests] = useState<CompensatoryRequest[]>([]);
  const [stats, setStats] = useState({ bookedThisYear: 0, absentDays: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Modals / View details state
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [selectedCompRequest, setSelectedCompRequest] = useState<CompensatoryRequest | null>(null);
  const [regularizeItem, setRegularizeItem] = useState<ActionRequiredItem | null>(null);
  const [isRegularizeModalOpen, setIsRegularizeModalOpen] = useState(false);
  const [prefilledApplyDate, setPrefilledApplyDate] = useState<string | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load real data from DB
  const loadData = () => {
    startTransition(async () => {
      try {
        const data = await getMyLeaveTrackerDataAction();
        setLeaveTypes(
          data.balances.map((b) => ({
            id: b.id,
            code: b.code as any,
            name: b.name,
            remainingDays: b.remainingDays,
            bookedDays: b.bookedDays,
            unit: b.unit as any,
            iconName: b.iconName,
            iconBgColor: b.iconBgColor,
            iconTextColor: b.iconTextColor,
          }))
        );
        setLeaveRequests(data.requests as any);
        setCompensatoryRequests(data.compensatoryRequests as any);
        setActionRequiredItems(data.actionRequiredItems as any);
        setStats(data.stats);
        if (data.currentUserId) {
          setCurrentUserId(data.currentUserId);
        }

        if (initialSelectedRequestId) {
          let matched = data.requests.find((r) => r.id === initialSelectedRequestId);
          if (!matched) {
            const singleData = await getLeaveRequestByIdAction(initialSelectedRequestId);
            if (singleData) {
              matched = singleData.request as any;
              if (singleData.balances && singleData.balances.length > 0) {
                setLeaveTypes(singleData.balances);
              }
            }
          }
          if (matched) {
            setSelectedRequest(matched as any);
            setActiveTab("request-details");
          }
        }

        if (initialSelectedCompRequestId) {
          const matchedComp = data.compensatoryRequests.find((c) => c.id === initialSelectedCompRequestId);
          if (matchedComp) {
            setSelectedCompRequest(matchedComp as any);
            setActiveTab("compensatory-details");
          }
        }
      } catch (error) {
        console.error("Failed to load leave tracker data:", error);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers
  const handleViewRequest = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setActiveTab("request-details");
  };

  const handleViewCompRequest = (request: CompensatoryRequest) => {
    setSelectedCompRequest(request);
    setActiveTab("compensatory-details");
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      await cancelLeaveRequestAction(requestId);
      loadData();
    } catch (err) {
      console.error("Failed to cancel request:", err);
    }
  };

  const handleRegularizeClick = (item: ActionRequiredItem) => {
    setRegularizeItem(item);
    setIsRegularizeModalOpen(true);
  };

  const handleRegularizeSubmit = async (
    itemId: string,
    checkIn: string,
    checkOut: string,
    reason: string
  ) => {
    try {
      await submitRegularizationAction({
        id: itemId,
        checkIn,
        checkOut,
        reason,
      });
      loadData();
    } catch (err) {
      console.error("Failed to regularize attendance:", err);
    }
  };

  const handleApplyLeaveFromAction = (item: ActionRequiredItem) => {
    setPrefilledApplyDate(item.date);
    setActiveTab("apply");
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Loading Leave Tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background/50 px-6 py-6 space-y-6 select-none">
      {/* 1. APPLY LEAVE VIEW */}
      {activeTab === "apply" && (
        <ApplyLeaveForm
          leaveTypes={leaveTypes}
          onSubmitLeave={(newReq) => {
            setSelectedRequest(newReq as any);
            loadData();
            setActiveTab("request-details");
          }}
          onCancel={() => setActiveTab("overview")}
          initialDate={prefilledApplyDate}
        />
      )}

      {/* 2. APPLY COMPENSATORY REQUEST VIEW */}
      {activeTab === "apply-compensatory" && (
        <ApplyCompensatoryForm
          onSubmitCompensatory={() => {
            loadData();
            setActiveTab("compensatory");
          }}
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
          isManagerView={Boolean(
            selectedRequest.employee?.id &&
            currentUserId &&
            selectedRequest.employee.id !== currentUserId
          )}
        />
      )}

      {/* 3b. COMPENSATORY REQUEST DETAILS VIEW */}
      {activeTab === "compensatory-details" && selectedCompRequest && (
        <CompensatoryDetailsView
          request={selectedCompRequest}
          onBack={() => setActiveTab("compensatory")}
        />
      )}

      {/* 4. MAIN TABS VIEW */}
      {activeTab !== "apply" &&
        activeTab !== "apply-compensatory" &&
        activeTab !== "request-details" &&
        activeTab !== "compensatory-details" && (
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
                        <span className="font-bold text-foreground">{stats.bookedThisYear} day(s)</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Absent : </span>
                        <span className="font-bold text-foreground">{stats.absentDays} day(s)</span>
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
                    onSelectType={() => {
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

            {/* COMPENSATORY REQUEST TAB */}
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
