"use client";

import React, { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Calendar,
  Search,
  Filter,
  Check,
  X,
  Eye,
  Download,
  Sliders,
  Plus,
  ArrowUpDown,
  Building,
  User,
  Users2,
} from "lucide-react";
import { LeaveStatus, LeaveTypeCode, isListedRequestType } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage, unwrap } from "../action-result";
import { HolidaysView } from "./holidays-view";
import { TeamMemberLeaveList } from "./team-member-leave-list";
import { ApproveNoteDialog } from "./approve-note-dialog";
import { TeamCalendarView } from "./team-calendar-view";
import { LeavePolicyView } from "./leave-policy-view";
import { CreateLeaveTypeWizard } from "./create-leave-type-wizard";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { UserName } from "@/components/shared/user-card";
import {
  PULSE_PAGE_BG,
  PulseStatTiles,
  PulseStickyTabs,
  StatusPill,
  TONE_DOT,
  scrollToList,
  type PulseStat,
  type PulseTone,
} from "@/components/pulse/pulse-ui";
import { usePulseCrumbs } from "@/components/pulse/pulse-breadcrumbs";

const STATUS_LOOK: Record<string, { label: string; tone: PulseTone }> = {
  APPROVED: { label: "Approved", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
  PENDING: { label: "Pending", tone: "amber" },
  CANCELLED: { label: "Cancelled", tone: "gray" },
};

type StatusCounts = { pending: number; approved: number; rejected: number; cancelled: number; total: number };
import { useUrlState } from "@/lib/navigation/use-url-state";
import { PeriodNav, currentPeriod, overlapsPeriod, type Period } from "@/components/shared/period-nav";

const TEAM_LEAVE_LIST_TABS = [
  "leave-requests",
  "employee-leave",
  "compensatory-requests",
  "team-calendar",
  "holidays",
  "leave-policy",
] as const;
type TeamLeaveListTab = (typeof TEAM_LEAVE_LIST_TABS)[number];

import {
  getTeamLeaveRequestsAction,
  getTeamCompensatoryRequestsAction,
} from "../queries/leave-queries";
import {
  approveLeaveRequestAction,
  rejectLeaveRequestAction,
  approveCompensatoryAction,
  rejectCompensatoryAction,
} from "../actions/leave-actions";

interface TeamLeaveItem {
  id: string;
  /** The viewer's own request: they can approve it (managers only see this list) but not reject it. */
  isOwn?: boolean;
  /** Opens this person's leave page. */
  userId?: string;
  employeeName: string;
  department: string;
  avatarText: string;
  leaveType: string;
  leaveTypeCode: string;
  fromKey: string;
  toKey: string;
  duration: string;
  dateTime: string;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
}

interface TeamCompItem {
  id: string;
  employeeName: string;
  designation: string;
  department: string;
  avatarText: string;
  workDate: string;
  workDay: string;
  workKey: string;
  hoursWorked: string;
  duration: string;
  reason: string;
  status: LeaveStatus;
  requestedOn: string;
}

/** Metric-card figures for a set of requests. */
function countByStatus(rows: { status: LeaveStatus }[]) {
  return {
    pending: rows.filter((r) => r.status === "PENDING").length,
    approved: rows.filter((r) => r.status === "APPROVED").length,
    rejected: rows.filter((r) => r.status === "REJECTED").length,
    cancelled: rows.filter((r) => r.status === "CANCELLED").length,
    total: rows.length,
  };
}

export function TeamLeaveWorkspace({
  initialTab = "leave-requests",
}: {
  initialTab?:
    | "leave-requests"
    | "employee-leave"
    | "compensatory-requests"
    | "team-calendar"
    | "holidays"
    | "leave-policy"
    | "create-leave-type";
}) {
  const router = useRouter();
  // Tabs live in the URL (restored on return, Back/Forward-able). The create-leave-type wizard is
  // a transient form on top of the Leave Policy tab, not a URL-addressable view.
  const [listTab, setListTab] = useUrlState<TeamLeaveListTab>(
    "tab",
    initialTab === "create-leave-type" ? "leave-policy" : initialTab,
    { allowed: TEAM_LEAVE_LIST_TABS, history: "push" }
  );
  const [isCreatingLeaveType, setIsCreatingLeaveType] = useState(initialTab === "create-leave-type");
  /** Set while the wizard is editing an existing leave type (null = creating a new one). */
  const [editingLeaveTypeId, setEditingLeaveTypeId] = useState<string | null>(null);
  const activeTab: TeamLeaveListTab | "create-leave-type" = isCreatingLeaveType ? "create-leave-type" : listTab;
  const setActiveTab = (tab: TeamLeaveListTab | "create-leave-type") => {
    if (tab === "create-leave-type") {
      setIsCreatingLeaveType(true);
    } else {
      setIsCreatingLeaveType(false);
      setListTab(tab);
    }
  };

  // Breadcrumb steps after "Pulse › Team Leave": the tab, then the leave-type wizard when open.
  const TAB_LABEL: Record<TeamLeaveListTab, string> = {
    "leave-requests": "Leave Requests",
    "employee-leave": "Team Member Leave",
    "compensatory-requests": "Compensatory Requests",
    "team-calendar": "Team Calendar",
    holidays: "Holidays",
    "leave-policy": "Leave Policy",
  };
  const crumbTab: TeamLeaveListTab = isCreatingLeaveType ? "leave-policy" : listTab;
  usePulseCrumbs([
    { label: TAB_LABEL[crumbTab], onClick: () => setActiveTab(crumbTab) },
    ...(isCreatingLeaveType ? [{ label: editingLeaveTypeId ? "Edit Leave Type" : "Create Leave Type" }] : []),
  ]);

  const [teamRequests, setTeamRequests] = useState<TeamLeaveItem[]>([]);
  const [teamCompRequests, setTeamCompRequests] = useState<TeamCompItem[]>([]);

  // Filters state
  const [searchEmployee, setSearchEmployee] = useUrlState("q", "");
  const [selectedStatus, setSelectedStatus] = useUrlState("status", "ALL");
  const [selectedType, setSelectedType] = useUrlState("type", "ALL");
  const [selectedDept, setSelectedDept] = useUrlState("dept", "ALL");
  const [period, setPeriod] = useUrlState<Period>("month", currentPeriod("month"));
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Stat tiles: click one to set the Status filter to it and jump to the list (again to clear).
  const requestsFilterRef = useRef<HTMLDivElement>(null);
  const compFilterRef = useRef<HTMLDivElement>(null);
  const statusTiles = (m: StatusCounts, list: "requests" | "compensatory"): PulseStat[] => {
    const pick = (status: string) => () => {
      setSelectedStatus(status !== "ALL" && selectedStatus === status ? "ALL" : status);
      scrollToList((list === "requests" ? requestsFilterRef : compFilterRef).current);
    };
    return [
      { label: "Pending", value: m.pending, tone: "amber", icon: <Clock className="h-4 w-4" />, onClick: pick("PENDING"), active: selectedStatus === "PENDING" },
      { label: "Approved", value: m.approved, tone: "green", icon: <CheckCircle2 className="h-4 w-4" />, onClick: pick("APPROVED"), active: selectedStatus === "APPROVED" },
      { label: "Rejected", value: m.rejected, tone: "red", icon: <XCircle className="h-4 w-4" />, onClick: pick("REJECTED"), active: selectedStatus === "REJECTED" },
      { label: "Cancelled", value: m.cancelled, tone: "gray", icon: <Ban className="h-4 w-4" />, onClick: pick("CANCELLED"), active: selectedStatus === "CANCELLED" },
      { label: "Total In Period", value: m.total, tone: "blue", icon: <Calendar className="h-4 w-4" />, onClick: pick("ALL"), active: selectedStatus === "ALL" },
    ];
  };
  /** The request the approve-with-note dialog is open for. */
  const [approveTarget, setApproveTarget] = useState<{ kind: "leave" | "comp"; id: string; label: string } | null>(null);

  /** Switching tabs starts each list with clean filters (they're shared URL params). */
  const switchTab = (tab: TeamLeaveListTab | "create-leave-type") => {
    setSearchEmployee("");
    setSelectedStatus("ALL");
    setSelectedType("ALL");
    setSelectedDept("ALL");
    setSelectedRowIds([]);
    setActiveTab(tab);
  };

  // Load the whole team queue once; filters (month, status, type, department, search) apply below,
  // so the metric cards and the table always describe the same rows.
  const loadData = async () => {
    try {
      const [res, compRes] = await Promise.all([getTeamLeaveRequestsAction(), getTeamCompensatoryRequestsAction()]);
      // Absent (ABS) entries aren't listed as requests (so they're left out of the counts too).
      setTeamRequests(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (res.requests as any[]).filter((r) => isListedRequestType(r.leaveTypeCode))
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTeamCompRequests(compRes.requests as any);
    } catch (err) {
      console.error("Failed to load team requests:", err);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  // Each tab starts at the top, and the browser tab says which one this is.
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    const titles: Record<TeamLeaveListTab | "create-leave-type", string> = {
      "leave-requests": "Team Leave Requests",
      "employee-leave": "Team Member Leave",
      "compensatory-requests": "Team Compensatory Requests",
      "team-calendar": "Team Calendar",
      holidays: "Holidays",
      "leave-policy": "Leave Policy",
      "create-leave-type": "Create Leave Type",
    };
    document.title = `${titles[activeTab]} | WinOS`;
  }, [activeTab]);

  React.useEffect(() => {
    setSelectedRowIds([]);
  }, [searchEmployee, selectedStatus, selectedType, selectedDept, period]);

  const inPeriodRequests = useMemo(
    () => teamRequests.filter((r) => overlapsPeriod(r.fromKey, r.toKey, period)),
    [teamRequests, period]
  );
  const inPeriodComp = useMemo(
    () => teamCompRequests.filter((r) => overlapsPeriod(r.workKey, r.workKey, period)),
    [teamCompRequests, period]
  );
  const metrics = useMemo(() => countByStatus(inPeriodRequests), [inPeriodRequests]);
  const compMetrics = useMemo(() => countByStatus(inPeriodComp), [inPeriodComp]);

  // Filter options from the data itself, not a hardcoded list.
  const typeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of teamRequests) if (!seen.has(r.leaveTypeCode)) seen.set(r.leaveTypeCode, r.leaveType);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [teamRequests]);
  const deptOptions = useMemo(
    () => [...new Set([...teamRequests, ...teamCompRequests].map((r) => r.department))].sort(),
    [teamRequests, teamCompRequests]
  );

  // Actions
  const handleQuickApprove = async (id: string, note?: string) => {
    try {
      const res = unwrap(await approveLeaveRequestAction(id, note));
      if (!res.completed) alert(`Approved. It now needs ${res.nextStep ?? "the next approval"}.`);
      else if (res.isLossOfPay) alert(`Approved. ${res.lopDays} day(s) exceed the balance and are marked as loss of pay.`);
      loadData();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  /** Approve / reject every selected pending request; reports the ones that failed. */
  const handleBulk = async (decision: "approve" | "reject") => {
    const ids = selectedRowIds.filter((id) => teamRequests.find((r) => r.id === id)?.status === "PENDING");
    if (!ids.length) return;
    if (!confirm(`${decision === "approve" ? "Approve" : "Reject"} ${ids.length} pending request(s)?`)) return;
    setIsBulkProcessing(true);
    const failures: string[] = [];
    for (const id of ids) {
      const res = decision === "approve" ? await approveLeaveRequestAction(id) : await rejectLeaveRequestAction(id);
      if (!res.success) {
        const name = teamRequests.find((r) => r.id === id)?.employeeName ?? "A request";
        failures.push(`${name}: ${res.message}`);
      }
    }
    setIsBulkProcessing(false);
    setSelectedRowIds([]);
    loadData();
    if (failures.length) alert(`Some requests weren't updated:\n${failures.join("\n")}`);
  };

  const handleQuickCompApprove = async (id: string, note?: string) => {
    try {
      unwrap(await approveCompensatoryAction(id, note));
      loadData();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleQuickCompReject = async (id: string) => {
    try {
      unwrap(await rejectCompensatoryAction(id));
      loadData();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Filtered Leave Requests
  const filteredTeamRequests = useMemo(() => {
    return inPeriodRequests.filter((r) => {
      if (
        searchEmployee &&
        !r.employeeName.toLowerCase().includes(searchEmployee.toLowerCase())
      ) {
        return false;
      }
      if (selectedStatus !== "ALL" && r.status !== selectedStatus) {
        return false;
      }
      if (selectedType !== "ALL" && r.leaveTypeCode !== selectedType) {
        return false;
      }
      if (selectedDept !== "ALL" && r.department !== selectedDept) {
        return false;
      }
      return true;
    });
  }, [inPeriodRequests, searchEmployee, selectedStatus, selectedType, selectedDept]);

  // Only pending rows can be acted on in bulk, so only they are selectable.
  // Only other people's pending requests can be bulk-approved / rejected.
  const selectableIdsInView = filteredTeamRequests.filter((r) => r.status === "PENDING" && !r.isOwn).map((r) => r.id);
  const allInViewSelected =
    selectableIdsInView.length > 0 && selectableIdsInView.every((id) => selectedRowIds.includes(id));
  const toggleSelectAll = () => setSelectedRowIds(allInViewSelected ? [] : selectableIdsInView);

  // Filtered Compensatory Requests
  const filteredTeamCompRequests = useMemo(() => {
    return inPeriodComp.filter((r) => {
      if (
        searchEmployee &&
        !r.employeeName.toLowerCase().includes(searchEmployee.toLowerCase())
      ) {
        return false;
      }
      if (selectedStatus !== "ALL" && r.status !== selectedStatus) {
        return false;
      }
      if (selectedDept !== "ALL" && r.department !== selectedDept) {
        return false;
      }
      return true;
    });
  }, [inPeriodComp, searchEmployee, selectedStatus, selectedDept]);

  const getStatusBadge = (status: LeaveStatus) => {
    const look = STATUS_LOOK[status];
    if (!look) return null;
    return (
      <StatusPill tone={look.tone}>
        <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[look.tone])} />
        {look.label}
      </StatusPill>
    );
  };

  return (
    <div ref={scrollRef} className={cn("flex flex-col h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 space-y-4 select-none", PULSE_PAGE_BG)}>
      <ApproveNoteDialog
        open={approveTarget !== null}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title={approveTarget?.kind === "comp" ? "Approve comp-off request" : "Approve leave request"}
        description={approveTarget?.label}
        onConfirm={async (note) => {
          if (!approveTarget) return;
          if (approveTarget.kind === "comp") await handleQuickCompApprove(approveTarget.id, note);
          else await handleQuickApprove(approveTarget.id, note);
        }}
      />
      {/* Top Navigation Tabs — sticky, so they stay visible on every tab while the page scrolls. */}
      <PulseStickyTabs
        tabs={[
          { label: "Leave Requests", active: activeTab === "leave-requests", onClick: () => switchTab("leave-requests"), count: metrics.pending },
          { label: "Team Member Leave", active: activeTab === "employee-leave", onClick: () => switchTab("employee-leave") },
          { label: "Compensatory Requests", active: activeTab === "compensatory-requests", onClick: () => switchTab("compensatory-requests"), count: compMetrics.pending },
          { label: "Team Calendar", active: activeTab === "team-calendar", onClick: () => switchTab("team-calendar") },
          { label: "Holidays", active: activeTab === "holidays", onClick: () => switchTab("holidays") },
          {
            label: "Leave Policy",
            // The new-leave-type wizard is part of Leave Policy, so keep that tab highlighted.
            active: activeTab === "leave-policy" || activeTab === "create-leave-type",
            onClick: () => switchTab("leave-policy"),
          },
        ]}
      />

      {/* 1. LEAVE REQUESTS TAB (IMAGE 3) */}
      {activeTab === "leave-requests" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-4 py-3">
            <h1 className="text-lg font-semibold text-foreground">All Leave Requests</h1>
          </div>

          <PulseStatTiles items={statusTiles(metrics, "requests")} />

          {/* Filter Bar (stat tiles scroll here; scroll-mt clears the sticky tabs) */}
          <div ref={requestsFilterRef} className="scroll-mt-24 space-y-4 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                  placeholder="Search by team member"
                  className="h-8 w-full rounded-md bg-background pl-9 text-xs"
                />
              </div>

              {/* Status */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-8 w-36 rounded-md text-xs bg-background">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Leave Type */}
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="h-8 w-48 rounded-md text-xs bg-background">
                  <SelectValue placeholder="All Leave Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Leave Types</SelectItem>
                  {typeOptions.map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Department */}
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="h-8 w-44 rounded-md text-xs bg-background">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  {deptOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <PeriodNav value={period} onChange={setPeriod} />
            </div>

            {/* Bulk actions for the selected pending requests */}
            {selectedRowIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs dark:border-blue-500/30 dark:bg-blue-500/10">
                <span className="font-semibold text-foreground">{selectedRowIds.length} pending request(s) selected</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isBulkProcessing}
                    onClick={() => setSelectedRowIds([])}
                    className="h-8 text-xs"
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBulkProcessing}
                    onClick={() => handleBulk("reject")}
                    className="h-8 text-xs border-red-200 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 dark:border-red-900 dark:text-red-300"
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isBulkProcessing}
                    onClick={() => handleBulk("approve")}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isBulkProcessing ? "Working…" : "Approve"}
                  </Button>
                </div>
              </div>
            )}

            {/* Table — scrolls sideways on narrow screens; the action column stays pinned */}
            <div className="overflow-x-auto rounded-md border border-border/70 bg-background">
              <table className="w-full min-w-[960px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        aria-label="Select all pending requests"
                        disabled={selectableIdsInView.length === 0}
                        checked={allInViewSelected}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="py-3 px-3 font-semibold">TEAM MEMBER</th>
                    <th className="py-3 px-3 font-semibold">LEAVE TYPE</th>
                    <th className="py-3 px-3 font-semibold">DURATION</th>
                    <th className="py-3 px-3 font-semibold">DATE/TIME</th>
                    <th className="py-3 px-3 font-semibold">REASON</th>
                    <th className="py-3 px-3 font-semibold">STATUS</th>
                    <th className="py-3 px-3 font-semibold">APPLIED ON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {filteredTeamRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-muted-foreground">
                        No leave records found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTeamRequests.map((req) => (
                      <tr
                        key={req.id}
                        onClick={() => router.push(`/pulse/leave/team/requests/${req.id}`)}
                        title="Open request"
                        className="cursor-pointer transition-colors hover:bg-muted/40"
                      >
                        {/* Checkbox — selecting a row doesn't open it */}
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${req.employeeName}'s request`}
                            disabled={req.status !== "PENDING" || req.isOwn}
                            title={req.isOwn ? "Your own request — open it to approve" : undefined}
                            checked={selectedRowIds.includes(req.id)}
                            onChange={() => toggleSelectRow(req.id)}
                            className="rounded disabled:opacity-30"
                          />
                        </td>

                        {/* Employee */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              name={req.employeeName}
                              className="h-8 w-8 bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                            >
                              {req.avatarText}
                            </UserAvatar>
                            <div>
                              <div className="flex items-center gap-1.5 font-semibold text-foreground leading-tight">
                                {req.userId && !req.isOwn ? (
                                  <Link
                                    href={`/pulse/leave/employee/${req.userId}`}
                                    onClick={(e) => e.stopPropagation()}
                                    title={`Open ${req.employeeName}'s leave`}
                                    className="hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                                  >
                                    {req.employeeName}
                                  </Link>
                                ) : (
                                  <UserName name={req.employeeName} />
                                )}
                                {req.isOwn && <StatusPill tone="blue">You</StatusPill>}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {req.department}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Leave Type */}
                        <td className="py-3 px-3 font-medium text-foreground">
                          {req.leaveType}
                        </td>

                        {/* Duration */}
                        <td className="py-3 px-3 font-semibold text-foreground">
                          {req.duration}
                        </td>

                        {/* Date / Time */}
                        <td className="py-3 px-3 text-muted-foreground font-medium whitespace-nowrap">
                          {req.dateTime}
                        </td>

                        {/* Reason */}
                        <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate" title={req.reason}>
                          {req.reason}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          {getStatusBadge(req.status)}
                        </td>

                        {/* Applied On */}
                        <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                          {req.appliedOn}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Showing: <strong className="text-foreground">{filteredTeamRequests.length}</strong> of {metrics.total} records</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. EMPLOYEE LEAVE TAB */}
      {activeTab === "employee-leave" && <TeamMemberLeaveList />}

      {/* 3. COMPENSATORY REQUESTS TAB (IMAGE 5) */}
      {activeTab === "compensatory-requests" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Compensatory Requests</h1>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-8 gap-1.5 self-start rounded-md px-3 text-xs font-semibold sm:self-auto"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>

          <PulseStatTiles items={statusTiles(compMetrics, "compensatory")} />

          {/* Filter Bar (stat tiles scroll here; scroll-mt clears the sticky tabs) */}
          <div ref={compFilterRef} className="scroll-mt-24 space-y-4 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                  placeholder="Search by team member name..."
                  className="h-8 rounded-md bg-background pl-9 text-xs"
                />
              </div>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-8 w-36 rounded-md text-xs bg-background">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="h-8 w-44 rounded-md text-xs bg-background">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  {deptOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <PeriodNav value={period} onChange={setPeriod} />
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-md border border-border/70 bg-background">
              <table className="w-full min-w-[900px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 px-4 font-semibold">TEAM MEMBER</th>
                    <th className="py-3 px-4 font-semibold">WORK DATE</th>
                    <th className="py-3 px-4 font-semibold">HOURS WORKED</th>
                    <th className="py-3 px-4 font-semibold">DURATION</th>
                    <th className="py-3 px-4 font-semibold">REASON</th>
                    <th className="py-3 px-4 font-semibold">STATUS</th>
                    <th className="py-3 px-4 font-semibold">REQUESTED ON</th>
                    <th className="py-3 px-4 font-semibold text-center sticky right-0 bg-muted">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {filteredTeamCompRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-muted-foreground">
                        No compensatory requests found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTeamCompRequests.map((comp) => (
                      <tr key={comp.id} className="transition-colors hover:bg-muted/40">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              name={comp.employeeName}
                              className="h-8 w-8 bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                            >
                              {comp.avatarText}
                            </UserAvatar>
                            <div>
                              <div className="font-semibold text-foreground leading-tight">
                                <UserName name={comp.employeeName} />
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {comp.designation}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{comp.workDate}</div>
                          <div className="text-xs text-muted-foreground">({comp.workDay})</div>
                        </td>

                        <td className="py-3 px-4 whitespace-pre-line text-muted-foreground font-medium">
                          {comp.hoursWorked}
                        </td>

                        <td className="py-3 px-4 font-semibold text-foreground">
                          {comp.duration}
                        </td>

                        <td className="py-3 px-4 text-muted-foreground max-w-[180px] truncate" title={comp.reason}>
                          {comp.reason}
                        </td>

                        <td className="py-3 px-4">
                          {getStatusBadge(comp.status)}
                        </td>

                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {comp.requestedOn}
                        </td>

                        <td className="py-3 px-4 text-center sticky right-0 bg-background">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link
                              href={`/pulse/leave/team/compensatory/${comp.id}`}
                              className="rounded-md p-1.5 text-blue-600 hover:bg-muted hover:text-foreground dark:text-blue-400"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            {comp.status === "PENDING" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setApproveTarget({ kind: "comp", id: comp.id, label: `${comp.employeeName} · comp-off` })
                                  }
                                  className="rounded-md p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                  title="Quick Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickCompReject(comp.id)}
                                  className="rounded-md p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400"
                                  title="Quick Reject"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Showing: <strong className="text-foreground">{filteredTeamCompRequests.length}</strong> of {compMetrics.total} records</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 rounded-md p-0">1</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TEAM CALENDAR TAB (IMAGE 2) */}
      {activeTab === "team-calendar" && <TeamCalendarView />}

      {/* 5. HOLIDAYS TAB */}
      {activeTab === "holidays" && <HolidaysView canManage />}

      {/* 6. LEAVE POLICY TAB (IMAGE 4) */}
      {activeTab === "leave-policy" && (
        <LeavePolicyView
          onCreateNew={() => {
            setEditingLeaveTypeId(null);
            setActiveTab("create-leave-type");
          }}
          onEdit={(id) => {
            setEditingLeaveTypeId(id);
            setActiveTab("create-leave-type");
          }}
        />
      )}

      {/* 7. CREATE / EDIT LEAVE TYPE WIZARD */}
      {activeTab === "create-leave-type" && (
        <CreateLeaveTypeWizard
          // A new key per leave type so switching between edits always reloads the form.
          key={editingLeaveTypeId ?? "new"}
          editId={editingLeaveTypeId ?? undefined}
          onCancel={() => {
            setEditingLeaveTypeId(null);
            setActiveTab("leave-policy");
          }}
          onSuccess={() => {
            setEditingLeaveTypeId(null);
            setActiveTab("leave-policy");
          }}
        />
      )}
    </div>
  );
}
