"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import {
  ActionRequiredItem,
  CompensatoryRequest,
  LeaveRequest,
  LeaveTypeConfig,
} from "../types";
import { LeaveBalanceGrid } from "./leave-balance-grid";
import { ActionRequiredBanner } from "./action-required-banner";
import { LeaveRequestsTable } from "./leave-requests-table";
import { RegularizeAttendanceModal } from "@/features/attendance/components/regularize-attendance-modal";
import { CompensatoryRequestsTable } from "./compensatory-requests-table";
import { ApplyCompensatoryForm } from "./apply-compensatory-form";
import { HolidaysView } from "./holidays-view";
import { ApplyLeaveForm } from "./apply-leave-form";
import { LeaveRequestDetailsView } from "./leave-request-details-view";
import { CompensatoryDetailsView } from "./compensatory-details-view";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { toast } from "@/components/shared/toast";
import {
  getCompensatoryRequestByIdAction,
  getMyLeaveTrackerDataAction,
  getLeaveRequestByIdAction,
} from "../queries/leave-queries";
import { cancelLeaveRequestAction } from "../actions/leave-actions";
import { errorMessage, unwrap } from "../action-result";

type ActiveTab =
  | "overview"
  | "requests"
  | "compensatory"
  | "holidays"
  | "apply"
  | "apply-compensatory"
  | "request-details"
  | "compensatory-details";

const LIST_TABS = ["overview", "requests", "compensatory", "holidays"] as const;
type ListTab = (typeof LIST_TABS)[number];

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
  // List tabs live in the URL (restored on return, Back/Forward-able). Form / detail views depend
  // on in-memory selections, so they stay as a transient overlay on top of the list tab.
  const initialIsListTab = (LIST_TABS as readonly ActiveTab[]).includes(initialTab);
  const [listTab, setListTab] = useUrlState<ListTab>(
    "tab",
    initialIsListTab ? (initialTab as ListTab) : "overview",
    { allowed: LIST_TABS, history: "push" }
  );
  const [transientTab, setTransientTab] = useState<ActiveTab | null>(initialIsListTab ? null : initialTab);
  const activeTab: ActiveTab = transientTab ?? listTab;
  const setActiveTab = (tab: ActiveTab) => {
    if ((LIST_TABS as readonly ActiveTab[]).includes(tab)) {
      setTransientTab(null);
      setListTab(tab as ListTab);
    } else {
      setTransientTab(tab);
    }
  };
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            code: b.code as any,
            name: b.name,
            remainingDays: b.remainingDays,
            bookedDays: b.bookedDays,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            unit: b.unit as any,
            iconName: b.iconName,
            iconBgColor: b.iconBgColor,
            iconTextColor: b.iconTextColor,
          }))
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setLeaveRequests(data.requests as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCompensatoryRequests(data.compensatoryRequests as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              matched = singleData.request as any;
              if (singleData.balances && singleData.balances.length > 0) {
                setLeaveTypes(singleData.balances);
              }
            }
          }
          if (matched) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setSelectedRequest(matched as any);
            setActiveTab("request-details");
          } else {
            // Not found, or not theirs to open — back to the list instead of a blank page.
            setActiveTab("requests");
          }
        }

        if (initialSelectedCompRequestId) {
          // Fetched by id because a manager opens team members' comp-offs here too.
          const comp = await getCompensatoryRequestByIdAction(initialSelectedCompRequestId);
          if (comp) {
            setSelectedCompRequest(comp);
            setActiveTab("compensatory-details");
          } else {
            setActiveTab("compensatory");
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

  // Each view starts at the top, and the browser tab says which view this is.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    const titles: Record<ActiveTab, string> = {
      overview: "Leave Tracker",
      requests: "My Leave Requests",
      compensatory: "My Compensatory Requests",
      holidays: "Holidays",
      apply: "Apply for Leave",
      "apply-compensatory": "Compensatory Request",
      "request-details": "Leave Request Details",
      "compensatory-details": "Compensatory Request Details",
    };
    document.title = `${titles[activeTab]} | WinOS`;
  }, [activeTab]);

  // Handlers
  const handleViewRequest = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setActiveTab("request-details");
  };

  const handleViewCompRequest = async (request: CompensatoryRequest) => {
    setSelectedCompRequest(request);
    setActiveTab("compensatory-details");
    // The list row is a summary; the detail page needs the times, attachments and approval steps.
    const full = await getCompensatoryRequestByIdAction(request.id).catch(() => null);
    if (full) setSelectedCompRequest(full);
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      unwrap(await cancelLeaveRequestAction(requestId));
      loadData();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleRegularizeClick = (item: ActionRequiredItem) => {
    setRegularizeItem(item);
    setIsRegularizeModalOpen(true);
  };

  const handleApplyLeaveFromAction = (item: ActionRequiredItem) => {
    setPrefilledApplyDate(item.dateKey);
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
    <div ref={scrollRef} className="flex flex-col h-full overflow-y-auto bg-background/50 px-6 py-6 space-y-6 select-none">
      {/* 1. APPLY LEAVE VIEW */}
      {activeTab === "apply" && (
        <ApplyLeaveForm
          leaveTypes={leaveTypes}
          onSubmitLeave={(newReq) => {
            toast.success(`Leave applied: ${newReq.durationText}.`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            toast.success("Comp-off request submitted for approval.");
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
                        <span className="text-muted-foreground" title="Working days with no check-in and no leave — the same days Home counts as loss of pay">Absent this year : </span>
                        <span className="font-bold text-foreground">{stats.absentDays} day(s)</span>
                      </div>
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

      {/* Regularize Modal — the same dialog My Attendance uses */}
      <RegularizeAttendanceModal
        isOpen={isRegularizeModalOpen}
        onClose={() => setIsRegularizeModalOpen(false)}
        target={
          regularizeItem
            ? { dateKey: regularizeItem.dateKey, label: `${regularizeItem.date} (${regularizeItem.dayOfWeek})`, issue: regularizeItem.issue }
            : null
        }
        onSubmitSuccess={() => {
          toast.success("Regularization sent for approval.");
          loadData();
        }}
      />
    </div>
  );
}
