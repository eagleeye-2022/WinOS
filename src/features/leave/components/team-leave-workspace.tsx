"use client";

import React, { useState, useMemo } from "react";
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
import { LeaveStatus, LeaveTypeCode } from "../types";
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
import { LeaveBalanceAdjustmentView } from "./leave-balance-adjustment-view";
import { TeamCalendarView } from "./team-calendar-view";
import { LeavePolicyView } from "./leave-policy-view";
import { CreateLeaveTypeWizard } from "./create-leave-type-wizard";
import { cn } from "@/lib/utils";
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
  const activeTab: TeamLeaveListTab | "create-leave-type" = isCreatingLeaveType ? "create-leave-type" : listTab;
  const setActiveTab = (tab: TeamLeaveListTab | "create-leave-type") => {
    if (tab === "create-leave-type") {
      setIsCreatingLeaveType(true);
    } else {
      setIsCreatingLeaveType(false);
      setListTab(tab);
    }
  };

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTeamRequests(res.requests as any);
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
      "employee-leave": "Leave Balance Adjustment",
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
  const handleQuickApprove = async (id: string) => {
    try {
      const res = unwrap(await approveLeaveRequestAction(id));
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

  const handleQuickReject = async (id: string) => {
    try {
      unwrap(await rejectLeaveRequestAction(id));
      loadData();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleQuickCompApprove = async (id: string) => {
    try {
      unwrap(await approveCompensatoryAction(id));
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
  const selectableIdsInView = filteredTeamRequests.filter((r) => r.status === "PENDING").map((r) => r.id);
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
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300">
            Rejected
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
            Pending
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
            Cancelled
          </span>
        );
    }
  };

  return (
    <div ref={scrollRef} className="flex flex-col h-full overflow-y-auto bg-background/50 px-6 py-6 space-y-6 select-none">
      {/* Top Navigation Tabs */}
      <div className="border-b border-border/80 pb-0">
        <nav className="flex items-center gap-8 -mb-px">
          <button
            type="button"
            onClick={() => switchTab("leave-requests")}
            className={cn(
              "py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer",
              activeTab === "leave-requests"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Leave Requests
          </button>

          <button
            type="button"
            onClick={() => switchTab("employee-leave")}
            className={cn(
              "py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer",
              activeTab === "employee-leave"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Team Member Leave
          </button>

          <button
            type="button"
            onClick={() => switchTab("compensatory-requests")}
            className={cn(
              "py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer",
              activeTab === "compensatory-requests"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Compensatory Requests
          </button>

          <button
            type="button"
            onClick={() => switchTab("team-calendar")}
            className={cn(
              "py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer",
              activeTab === "team-calendar"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Team Calendar
          </button>

          <button
            type="button"
            onClick={() => switchTab("holidays")}
            className={cn(
              "py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer",
              activeTab === "holidays"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Holidays
          </button>

          <button
            type="button"
            onClick={() => switchTab("leave-policy")}
            className={cn(
              "py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer",
              activeTab === "leave-policy"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Leave Policy
          </button>
        </nav>
      </div>

      {/* 1. LEAVE REQUESTS TAB (IMAGE 3) */}
      {activeTab === "leave-requests" && (
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              All Leave Requests
            </h1>
          </div>

          {/* 5 Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Pending */}
            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Pending</div>
                <div className="text-lg font-bold text-foreground">
                  {metrics.pending} <span className="text-xs font-normal text-muted-foreground">Requests</span>
                </div>
              </div>
            </div>

            {/* Approved */}
            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Approved</div>
                <div className="text-lg font-bold text-foreground">
                  {metrics.approved} <span className="text-xs font-normal text-muted-foreground">Requests</span>
                </div>
              </div>
            </div>

            {/* Rejected */}
            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-500">
                <XCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Rejected</div>
                <div className="text-lg font-bold text-foreground">
                  {metrics.rejected} <span className="text-xs font-normal text-muted-foreground">Requests</span>
                </div>
              </div>
            </div>

            {/* Cancelled */}
            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
                <Ban className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Cancelled</div>
                <div className="text-lg font-bold text-foreground">
                  {metrics.cancelled} <span className="text-xs font-normal text-muted-foreground">Requests</span>
                </div>
              </div>
            </div>

            {/* Total Requests */}
            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-accent text-blue-500">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Total Requests</div>
                <div className="text-lg font-bold text-foreground">
                  {metrics.total} <span className="text-xs font-normal text-muted-foreground">In Period</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                  placeholder="Search by team member"
                  className="h-9 pl-9 rounded-xl text-xs bg-background w-full"
                />
              </div>

              {/* Status */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 w-36 rounded-xl text-xs bg-background">
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
                <SelectTrigger className="h-9 w-48 rounded-xl text-xs bg-background">
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
                <SelectTrigger className="h-9 w-44 rounded-xl text-xs bg-background">
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
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-xs">
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
            <div className="border border-border/80 rounded-xl overflow-x-auto bg-background">
              <table className="w-full min-w-[960px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/80 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                    <th className="py-3 px-3 font-semibold">EMPLOYEE</th>
                    <th className="py-3 px-3 font-semibold">LEAVE TYPE</th>
                    <th className="py-3 px-3 font-semibold">DURATION</th>
                    <th className="py-3 px-3 font-semibold">DATE/TIME</th>
                    <th className="py-3 px-3 font-semibold">REASON</th>
                    <th className="py-3 px-3 font-semibold">STATUS</th>
                    <th className="py-3 px-3 font-semibold">APPLIED ON</th>
                    <th className="py-3 px-3 font-semibold text-center sticky right-0 bg-muted">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTeamRequests.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-xs text-muted-foreground">
                        No leave records found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTeamRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                        {/* Checkbox */}
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${req.employeeName}'s request`}
                            disabled={req.status !== "PENDING"}
                            checked={selectedRowIds.includes(req.id)}
                            onChange={() => toggleSelectRow(req.id)}
                            className="rounded disabled:opacity-30"
                          />
                        </td>

                        {/* Employee */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                              {req.avatarText}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground leading-tight">
                                {req.employeeName}
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

                        {/* Actions */}
                        <td className="py-3 px-3 text-center sticky right-0 bg-background">
                          <div className="flex items-center justify-center gap-1">
                            <Link
                              href={`/pulse/leave/requests/${req.id}`}
                              className="p-1 rounded-lg hover:bg-muted text-primary hover:text-foreground"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            {req.status === "PENDING" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleQuickApprove(req.id)}
                                  className="p-1 rounded-lg hover:bg-emerald-50 text-emerald-600 dark:hover:bg-emerald-950/40"
                                  title="Quick Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickReject(req.id)}
                                  className="p-1 rounded-lg hover:bg-red-50 text-red-600 dark:hover:bg-red-950/40"
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
              <span>Showing: <strong className="text-foreground">{filteredTeamRequests.length}</strong> of {metrics.total} records</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. EMPLOYEE LEAVE TAB */}
      {activeTab === "employee-leave" && (
        <LeaveBalanceAdjustmentView onCancel={() => switchTab("leave-requests")} />
      )}

      {/* 3. COMPENSATORY REQUESTS TAB (IMAGE 5) */}
      {activeTab === "compensatory-requests" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Compensatory Requests
              </h1>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-9 px-4 rounded-lg text-xs font-semibold gap-2 self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </Button>
          </div>

          {/* 5 Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Pending</div>
                <div className="text-lg font-bold text-foreground">{compMetrics.pending} <span className="text-xs font-normal text-muted-foreground">Requests</span></div>
              </div>
            </div>

            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Approved</div>
                <div className="text-lg font-bold text-foreground">{compMetrics.approved} <span className="text-xs font-normal text-muted-foreground">Requests</span></div>
              </div>
            </div>

            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-500">
                <XCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Rejected</div>
                <div className="text-lg font-bold text-foreground">{compMetrics.rejected} <span className="text-xs font-normal text-muted-foreground">Requests</span></div>
              </div>
            </div>

            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
                <Ban className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Cancelled</div>
                <div className="text-lg font-bold text-foreground">{compMetrics.cancelled} <span className="text-xs font-normal text-muted-foreground">Requests</span></div>
              </div>
            </div>

            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-accent text-blue-500">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Total Requests</div>
                <div className="text-lg font-bold text-foreground">{compMetrics.total} <span className="text-xs font-normal text-muted-foreground">In Period</span></div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                  placeholder="Search by team member name..."
                  className="h-9 pl-9 rounded-xl text-xs bg-background"
                />
              </div>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 w-36 rounded-xl text-xs bg-background">
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
                <SelectTrigger className="h-9 w-44 rounded-xl text-xs bg-background">
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
            <div className="border border-border/80 rounded-xl overflow-x-auto bg-background">
              <table className="w-full min-w-[900px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/80 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">EMPLOYEE</th>
                    <th className="py-3 px-4 font-semibold">WORK DATE</th>
                    <th className="py-3 px-4 font-semibold">HOURS WORKED</th>
                    <th className="py-3 px-4 font-semibold">DURATION</th>
                    <th className="py-3 px-4 font-semibold">REASON</th>
                    <th className="py-3 px-4 font-semibold">STATUS</th>
                    <th className="py-3 px-4 font-semibold">REQUESTED ON</th>
                    <th className="py-3 px-4 font-semibold text-center sticky right-0 bg-muted">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTeamCompRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-muted-foreground">
                        No compensatory requests found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTeamCompRequests.map((comp) => (
                      <tr key={comp.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-accent text-primary font-bold flex items-center justify-center text-xs shrink-0">
                              {comp.avatarText}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground leading-tight">
                                {comp.employeeName}
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
                              href={`/pulse/leave/compensatory/${comp.id}`}
                              className="p-1 rounded-lg hover:bg-muted text-primary"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            {comp.status === "PENDING" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleQuickCompApprove(comp.id)}
                                  className="p-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                  title="Quick Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickCompReject(comp.id)}
                                  className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400"
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
                <Button variant="outline" size="sm" className="h-7 w-7 p-0 rounded-lg">1</Button>
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
        <LeavePolicyView onCreateNew={() => setActiveTab("create-leave-type")} />
      )}

      {/* 7. CREATE LEAVE TYPE WIZARD (IMAGE 2 & 3) */}
      {activeTab === "create-leave-type" && (
        <CreateLeaveTypeWizard
          onCancel={() => setActiveTab("leave-policy")}
          onSuccess={() => setActiveTab("leave-policy")}
        />
      )}
    </div>
  );
}
