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
import { PULSE_PAGE_BG, PulseStickyTabs, PulseTabs, StatusPill } from "@/components/pulse/pulse-ui";
import { usePathTab, usePageViewState } from "@/lib/navigation/use-url-state";
import { ROUTES } from "@/constants/routes";
import { usePulseCrumbs } from "@/components/pulse/pulse-breadcrumbs";
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
  /**
   * A team member's request opened by a manager (/pulse/team/leaves/…): the breadcrumb and the
   * not-found fallback go back to the Team Leave lists instead of the manager's own leave.
   */
  teamView?: boolean;
  /** Shown as a tab inside another page (the profile): no page frame, no sticky tabs, no breadcrumb. */
  embedded?: boolean;
}

/** The Team Leave tab each detail view belongs to. */
const TEAM_LIST = {
  requests: { label: "Leave Requests", href: ROUTES.pulseTeamLeaveRequests },
  compensatory: { label: "Compensatory Requests", href: ROUTES.pulseTeamLeaveCompensatory },
} as const;

/** Each My Leaves tab is its own path. */
const LIST_TAB_PATHS: Readonly<Record<ListTab, string>> = {
  overview: ROUTES.pulseLeave,
  requests: ROUTES.pulseLeaveRequests,
  compensatory: ROUTES.pulseLeaveCompensatory,
  holidays: ROUTES.pulseLeaveHolidays,
};

export function LeaveWorkspace({
  initialTab = "overview",
  initialSelectedRequestId,
  initialSelectedCompRequestId,
  teamView = false,
  embedded = false,
}: LeaveWorkspaceProps) {
  const router = useRouter();
  // List tabs are paths (/pulse/my/leaves/requests …: restored on return, Back/Forward-able).
  // Form / detail views depend on in-memory selections, so they stay as a transient overlay on top
  // of the list tab. Embedded (profile page) and team-detail views never rewrite the URL.
  const initialIsListTab = (LIST_TABS as readonly ActiveTab[]).includes(initialTab);
  const [listTab, setListTab] = usePathTab<ListTab>(
    LIST_TAB_PATHS,
    initialIsListTab ? (initialTab as ListTab) : "overview",
    !embedded && !teamView
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

  // Breadcrumb steps after "Pulse › My Leaves": the tab, then the open form / details view.
  const LIST_LABEL: Record<ListTab, string> = {
    overview: "Overview",
    requests: "Leave Request",
    compensatory: "Compensatory Request",
    holidays: "Holidays",
  };
  const SUB_VIEW: Partial<Record<ActiveTab, { parent: ListTab; label: string }>> = {
    apply: { parent: "overview", label: "Apply Leave" },
    "apply-compensatory": { parent: "compensatory", label: "Apply Comp-off" },
    "request-details": { parent: "requests", label: "Request Details" },
    "compensatory-details": { parent: "compensatory", label: "Request Details" },
  };
  const subView = SUB_VIEW[activeTab];
  const crumbTab: ListTab = subView ? subView.parent : (activeTab as ListTab);
  const teamList = teamView && (crumbTab === "requests" || crumbTab === "compensatory") ? TEAM_LIST[crumbTab] : null;
  usePulseCrumbs(embedded ? null : [
    teamList
      ? { label: teamList.label, href: teamList.href }
      : { label: LIST_LABEL[crumbTab], onClick: () => setActiveTab(crumbTab) },
    ...(subView ? [{ label: subView.label }] : []),
  ]);

  const [isPending, startTransition] = useTransition();

  // Data state from Database
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([]);
  const [actionRequiredItems, setActionRequiredItems] = useState<ActionRequiredItem[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [compensatoryRequests, setCompensatoryRequests] = useState<CompensatoryRequest[]>([]);
  const [stats, setStats] = useState({ bookedThisYear: 0, absentDays: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Modals / View details state
  const [selectedRequest, setSelectedRequest] = usePageViewState<LeaveRequest | null>("LeaveWorkspace:selectedRequest", null);
  const [selectedCompRequest, setSelectedCompRequest] = usePageViewState<CompensatoryRequest | null>("LeaveWorkspace:selectedCompRequest", null);
  const [regularizeItem, setRegularizeItem] = useState<ActionRequiredItem | null>(null);
  const [isRegularizeModalOpen, setIsRegularizeModalOpen] = usePageViewState("LeaveWorkspace:isRegularizeModalOpen", false);
  const [prefilledApplyDate, setPrefilledApplyDate] = useState<string | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  /** Signed-in person is a manager (they may approve their own pending leave). */
  const [isManager, setIsManager] = useState(false);

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
            hideBooked: b.hideBooked,
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
        setIsManager(Boolean(data.isManager));

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
          } else if (teamView) {
            // Not found, or not theirs to review — back to the team's list, not the manager's own.
            router.replace(TEAM_LIST.requests.href);
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
          } else if (teamView) {
            router.replace(TEAM_LIST.compensatory.href);
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

  const LeaveTabs = embedded ? PulseTabs : PulseStickyTabs;

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex flex-col space-y-4 select-none",
        // Embedded: the host page already scrolls and has its own background and padding.
        !embedded && "h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-6",
        !embedded && PULSE_PAGE_BG
      )}
    >
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
          isManagerView={Boolean(
            selectedRequest.employee?.id &&
            currentUserId &&
            selectedRequest.employee.id !== currentUserId
          )}
          canApproveOwn={Boolean(
            isManager &&
              currentUserId &&
              (!selectedRequest.employee?.id || selectedRequest.employee.id === currentUserId)
          )}
        />
      )}

      {/* 3b. COMPENSATORY REQUEST DETAILS VIEW */}
      {activeTab === "compensatory-details" && selectedCompRequest && (
        <CompensatoryDetailsView
          request={selectedCompRequest}
        />
      )}

      {/* 4. MAIN TABS VIEW */}
      {activeTab !== "apply" &&
        activeTab !== "apply-compensatory" &&
        activeTab !== "request-details" &&
        activeTab !== "compensatory-details" && (
          <>
            {/* Top Navigation Tabs — sticky (not fixed): pinned to the top while this page scrolls. */}
            <LeaveTabs
              tabs={[
                { label: "Overview", active: activeTab === "overview", onClick: () => setActiveTab("overview") },
                { label: "Leave Request", active: activeTab === "requests", onClick: () => setActiveTab("requests") },
                { label: "Compensatory Request", active: activeTab === "compensatory", onClick: () => setActiveTab("compensatory") },
                { label: "Holidays", active: activeTab === "holidays", onClick: () => setActiveTab("holidays") },
              ]}
            />

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <>
                {/* Toolbar: title, yearly stats, Apply Leave */}
                <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <h1 className="text-lg font-semibold text-foreground">Leave Tracker</h1>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <StatusPill tone="blue">Booked this year · {stats.bookedThisYear} day(s)</StatusPill>
                      <span title="Working days with no check-in and no leave — the same days Home counts as loss of pay">
                        <StatusPill tone={stats.absentDays > 0 ? "red" : "gray"}>Absent this year · {stats.absentDays} day(s)</StatusPill>
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setActiveTab("apply")}
                    className="h-9 self-start rounded-md bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 sm:self-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Apply Leave
                  </Button>
                </div>

                <div className="space-y-4">
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
              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-lg font-semibold text-foreground">Leave Requests</h1>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setActiveTab("apply")}
                    className="h-9 self-start rounded-md bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 sm:self-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Apply Leave
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
