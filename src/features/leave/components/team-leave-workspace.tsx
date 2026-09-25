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
import { HolidaysView } from "./holidays-view";
import { LeaveBalanceAdjustmentView } from "./leave-balance-adjustment-view";
import { TeamCalendarView } from "./team-calendar-view";
import { LeavePolicyView } from "./leave-policy-view";
import { CreateLeaveTypeWizard } from "./create-leave-type-wizard";
import { cn } from "@/lib/utils";

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
  avatarText: string;
  workDate: string;
  workDay: string;
  hoursWorked: string;
  duration: string;
  reason: string;
  status: LeaveStatus;
  requestedOn: string;
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
  const [activeTab, setActiveTab] = useState<
    | "leave-requests"
    | "employee-leave"
    | "compensatory-requests"
    | "team-calendar"
    | "holidays"
    | "leave-policy"
    | "create-leave-type"
  >(initialTab);

  const [teamRequests, setTeamRequests] = useState<TeamLeaveItem[]>([]);
  const [teamCompRequests, setTeamCompRequests] = useState<TeamCompItem[]>([]);
  const [metrics, setMetrics] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    total: 0,
  });
  const [compMetrics, setCompMetrics] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    total: 0,
  });

  // Filters state
  const [searchEmployee, setSearchEmployee] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Load live team requests
  const loadData = async () => {
    try {
      const res = await getTeamLeaveRequestsAction({
        search: searchEmployee,
        status: selectedStatus,
        leaveTypeCode: selectedType,
        department: selectedDept,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTeamRequests(res.requests as any);
      setMetrics(res.metrics);

      const compRes = await getTeamCompensatoryRequestsAction({
        search: searchEmployee,
        status: selectedStatus,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTeamCompRequests(compRes.requests as any);
      setCompMetrics(compRes.metrics);
    } catch (err) {
      console.error("Failed to load team requests:", err);
    }
  };

  React.useEffect(() => {
    loadData();
  }, [searchEmployee, selectedStatus, selectedType, selectedDept]);

  // Actions
  const handleQuickApprove = async (id: string) => {
    try {
      await approveLeaveRequestAction(id);
      loadData();
    } catch (err) {
      console.error("Failed to approve request:", err);
    }
  };

  const handleQuickReject = async (id: string) => {
    try {
      await rejectLeaveRequestAction(id);
      loadData();
    } catch (err) {
      console.error("Failed to reject request:", err);
    }
  };

  const handleQuickCompApprove = async (id: string) => {
    try {
      await approveCompensatoryAction(id);
      loadData();
    } catch (err) {
      console.error("Failed to approve comp request:", err);
    }
  };

  const handleQuickCompReject = async (id: string) => {
    try {
      await rejectCompensatoryAction(id);
      loadData();
    } catch (err) {
      console.error("Failed to reject comp request:", err);
    }
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.length === teamRequests.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(teamRequests.map((r) => r.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Filtered Leave Requests
  const filteredTeamRequests = useMemo(() => {
    return teamRequests.filter((r) => {
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
  }, [teamRequests, searchEmployee, selectedStatus, selectedType, selectedDept]);

  // Filtered Compensatory Requests
  const filteredTeamCompRequests = useMemo(() => {
    return teamCompRequests.filter((r) => {
      if (
        searchEmployee &&
        !r.employeeName.toLowerCase().includes(searchEmployee.toLowerCase())
      ) {
        return false;
      }
      if (selectedStatus !== "ALL" && r.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [teamCompRequests, searchEmployee, selectedStatus]);

  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300">
            Rejected
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
            Pending
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background/50 px-6 py-6 space-y-6 select-none">
      {/* Top Navigation Tabs */}
      <div className="border-b border-border/80 pb-0">
        <nav className="flex items-center gap-8 -mb-px">
          <button
            type="button"
            onClick={() => setActiveTab("leave-requests")}
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
            onClick={() => setActiveTab("employee-leave")}
            className={cn(
              "py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer",
              activeTab === "employee-leave"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Employee Leave
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("compensatory-requests")}
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
            onClick={() => setActiveTab("team-calendar")}
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

          <button
            type="button"
            onClick={() => setActiveTab("leave-policy")}
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
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and take action on leave requests from your team
            </p>
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
                  {metrics.pending} <span className="text-[10px] font-normal text-muted-foreground">Requests</span>
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
                  {metrics.approved} <span className="text-[10px] font-normal text-muted-foreground">Requests</span>
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
                  {metrics.rejected} <span className="text-[10px] font-normal text-muted-foreground">Requests</span>
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
                  {metrics.cancelled} <span className="text-[10px] font-normal text-muted-foreground">Requests</span>
                </div>
              </div>
            </div>

            {/* Total Requests */}
            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-500">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Total Requests</div>
                <div className="text-lg font-bold text-foreground">
                  {metrics.total} <span className="text-[10px] font-normal text-muted-foreground">This Month</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-center">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                  placeholder="Search by employee"
                  className="h-9 pl-9 rounded-xl text-xs bg-background w-full"
                />
              </div>

              {/* Status */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
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
                <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                  <SelectValue placeholder="All Leave Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Leave Types</SelectItem>
                  <SelectItem value="SL">Sick Leave (SL)</SelectItem>
                  <SelectItem value="CL">Casual Leave (CL)</SelectItem>
                  <SelectItem value="PL">Privilege Leave (PL)</SelectItem>
                  <SelectItem value="EL">Early Leave</SelectItem>
                  <SelectItem value="HD">Half Day</SelectItem>
                  <SelectItem value="MAT">Maternity Leave</SelectItem>
                </SelectContent>
              </Select>

              {/* Department */}
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  <SelectItem value="Product Design">Product Design</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                </SelectContent>
              </Select>

              {/* Date range */}
              <div className="flex items-center gap-1.5 px-3 py-2 bg-background border rounded-xl text-[11px] font-medium text-foreground">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>01 May – 31 May</span>
              </div>
            </div>

            {/* Table */}
            <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/80 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={
                          selectedRowIds.length > 0 &&
                          selectedRowIds.length === teamRequests.length
                        }
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
                    <th className="py-3 px-3 font-semibold text-center">ACTION</th>
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
                            checked={selectedRowIds.includes(req.id)}
                            onChange={() => toggleSelectRow(req.id)}
                            className="rounded"
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
                              <div className="text-[10px] text-muted-foreground mt-0.5">
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
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Link
                              href={`/pulse/leave/requests/${req.id}`}
                              className="p-1 rounded-lg hover:bg-muted text-primary hover:text-primary"
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
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0 rounded-lg">1</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. EMPLOYEE LEAVE TAB */}
      {activeTab === "employee-leave" && (
        <LeaveBalanceAdjustmentView
          onSuccess={() => {
            loadData();
            setActiveTab("leave-requests");
          }}
          onCancel={() => setActiveTab("leave-requests")}
        />
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
              <p className="text-xs text-muted-foreground mt-0.5">
                Review and manage compensatory time off requests
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-9 px-4 rounded-xl text-xs font-semibold gap-2 self-start sm:self-auto"
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
                <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Pending</div>
                <div className="text-lg font-bold text-foreground">{compMetrics.pending} <span className="text-[10px] font-normal text-muted-foreground">Requests</span></div>
              </div>
            </div>

            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Approved</div>
                <div className="text-lg font-bold text-foreground">{compMetrics.approved} <span className="text-[10px] font-normal text-muted-foreground">Requests</span></div>
              </div>
            </div>

            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-500">
                <XCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Rejected</div>
                <div className="text-lg font-bold text-foreground">{compMetrics.rejected} <span className="text-[10px] font-normal text-muted-foreground">Requests</span></div>
              </div>
            </div>

            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
                <Ban className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Cancelled</div>
                <div className="text-lg font-bold text-foreground">{compMetrics.cancelled} <span className="text-[10px] font-normal text-muted-foreground">Requests</span></div>
              </div>
            </div>

            <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-500">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Total Requests</div>
                <div className="text-lg font-bold text-foreground">{compMetrics.total} <span className="text-[10px] font-normal text-muted-foreground">This Month</span></div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                  placeholder="Search by employee name..."
                  className="h-9 pl-9 rounded-xl text-xs bg-background"
                />
              </div>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
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
                <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Product Design">Product Design</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1.5 px-3 py-2 bg-background border rounded-xl text-[11px] font-medium text-foreground">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>01 May – 31 May</span>
              </div>
            </div>

            {/* Table */}
            <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/80 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">EMPLOYEE</th>
                    <th className="py-3 px-4 font-semibold">WORK DATE</th>
                    <th className="py-3 px-4 font-semibold">HOURS WORKED</th>
                    <th className="py-3 px-4 font-semibold">DURATION</th>
                    <th className="py-3 px-4 font-semibold">REASON</th>
                    <th className="py-3 px-4 font-semibold">STATUS</th>
                    <th className="py-3 px-4 font-semibold">REQUESTED ON</th>
                    <th className="py-3 px-4 font-semibold text-center">ACTION</th>
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
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 font-bold flex items-center justify-center text-xs shrink-0">
                              {comp.avatarText}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground leading-tight">
                                {comp.employeeName}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {comp.designation}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{comp.workDate}</div>
                          <div className="text-[10px] text-muted-foreground">({comp.workDay})</div>
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

                        <td className="py-3 px-4 text-center">
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
                                  className="p-1 rounded-lg hover:bg-emerald-50 text-emerald-600"
                                  title="Quick Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickCompReject(comp.id)}
                                  className="p-1 rounded-lg hover:bg-red-50 text-red-600"
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
      {activeTab === "holidays" && <HolidaysView />}

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
