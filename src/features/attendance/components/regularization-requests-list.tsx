"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Plus,
  RotateCcw,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { RegularizationRequest, RegularizationStatus } from "../types";
import { getRegularizationRequestsData } from "../queries/attendance-queries";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./person-avatar";

interface RegularizationRequestsListProps {
  onNewRequest?: () => void;
  onViewRequest?: (request: RegularizationRequest) => void;
}

export function RegularizationRequestsList({
  onNewRequest,
  onViewRequest,
}: RegularizationRequestsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [issueFilter, setIssueFilter] = useState("All");
  const [dateRange, setDateRange] = useState("All Records");
  const [requests, setRequests] = useState<RegularizationRequest[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const res = await getRegularizationRequestsData({
          status: statusFilter,
          search: searchTerm,
        });
        setRequests(res.requests);
        setCounts(res.counts);
      } catch (err) {
        console.error("Failed to fetch regularization requests:", err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, searchTerm]);

  const visibleRequests =
    issueFilter === "All" ? requests : requests.filter((r) => (r.issueType ?? "OTHER") === issueFilter);

  const handleReset = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setIssueFilter("All");
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Regularization Requests
          </h1>
        </div>

        <button
          onClick={onNewRequest}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Regularize Attendance</span>
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Requests */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">
              Total Requests
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground mt-0.5">
              {counts.all}
            </div>
          </div>
        </div>

        {/* Pending */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">
              Pending
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground mt-0.5">
              {counts.pending}
            </div>
          </div>
        </div>

        {/* Approved */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">
              Approved
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground mt-0.5">
              {counts.approved}
            </div>
          </div>
        </div>

        {/* Rejected */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">
              Rejected
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground mt-0.5">
              {counts.rejected}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Issue Type Dropdown */}
          <select
            value={issueFilter}
            onChange={(e) => setIssueFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="All">All Issues</option>
            <option value="MISSING_CHECK_IN">Missing Check-in</option>
            <option value="MISSING_CHECK_OUT">Missing Check-out</option>
            <option value="OTHER">Other corrections</option>
          </select>

          {/* Reset Filters */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input bg-background text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search request or employee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-input bg-zinc-50 dark:bg-zinc-800/80 text-xs text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3.5 px-5">Employee</th>
                <th className="py-3.5 px-5">Attendance Date</th>
                <th className="py-3.5 px-5">Existing Timing</th>
                <th className="py-3.5 px-5">Requested Timing</th>
                <th className="py-3.5 px-5">Reason</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading regularization requests...
                  </td>
                </tr>
              ) : visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <HelpCircle className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                    No regularization requests found
                  </td>
                </tr>
              ) : (
                visibleRequests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => onViewRequest?.(req)}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    {/* Employee */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <PersonAvatar name={req.employee.name} image={req.employee.avatarUrl} userId={req.employee.id} />
                        <div>
                          <div className="font-bold text-foreground">
                            {req.employee.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {req.employee.designation} • ID: {req.employee.employeeId}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Attendance Date */}
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-foreground">
                        {req.attendanceDate}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {req.attendanceDay}
                      </div>
                    </td>

                    {/* Existing Timing */}
                    <td className="py-3.5 px-5">
                      <div className="font-medium text-muted-foreground">
                        {req.existingAttendance.checkIn || "--:--"} →{" "}
                        {req.existingAttendance.checkOut || "--:--"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {req.existingAttendance.workedDuration || "--"}
                      </div>
                    </td>

                    {/* Requested Timing */}
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-primary">
                        {req.requestedAttendance.checkIn} →{" "}
                        {req.requestedAttendance.checkOut}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {req.requestedAttendance.workedDuration}
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="py-3.5 px-5">
                      <div className="font-medium text-foreground max-w-[180px] truncate">
                        {req.reason}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {req.remarks || "No remarks"}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-5">
                      {req.status === "Pending" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:border-amber-900/60 dark:text-amber-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending
                        </span>
                      )}
                      {req.status === "Approved" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-900/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Approved
                        </span>
                      )}
                      {req.status === "Rejected" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:border-rose-900/60 dark:text-rose-300">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Rejected
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewRequest?.(req);
                        }}
                        className="text-xs font-bold text-primary hover:text-blue-700 hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
          <div>
            Showing <span className="font-bold text-foreground">{visibleRequests.length}</span> results
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg border border-input hover:bg-accent disabled:opacity-40">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-bold text-foreground">1</span>
            <button className="p-1.5 rounded-lg border border-input hover:bg-accent disabled:opacity-40">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
