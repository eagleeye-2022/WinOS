"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  FileText,
  Search,
  Plus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { RegularizationRequest, RegularizationStatus } from "../types";
import { getRegularizationRequestsData } from "../queries/attendance-queries";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./person-avatar";
import { UserName } from "@/components/shared/user-card";
import { StatusPill, TONE_DOT, type PulseTone } from "@/components/pulse/pulse-ui";

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

  const STATUS_TONE: Record<RegularizationStatus, PulseTone> = { Pending: "amber", Approved: "green", Rejected: "red" };
  const statusTabs: { value: string; label: string; count: number }[] = [
    { value: "All", label: "All", count: counts.all },
    { value: "Pending", label: "Pending", count: counts.pending },
    { value: "Approved", label: "Approved", count: counts.approved },
    { value: "Rejected", label: "Rejected", count: counts.rejected },
  ];
  const selectCls =
    "h-8 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Regularization Requests</h1>
        </div>
        <button
          onClick={onNewRequest}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Regularize Attendance
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {/* Status tabs with counts */}
        <div className="flex gap-1 overflow-x-auto border-b border-border/70 px-2">
          {statusTabs.map((t) => {
            const active = statusFilter === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setStatusFilter(t.value)}
                className={cn(
                  "relative inline-flex shrink-0 items-center gap-1.5 px-3.5 py-3 text-[13px] font-medium transition-colors",
                  "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full",
                  active
                    ? "font-semibold text-blue-600 after:bg-blue-600 dark:text-blue-400 dark:after:bg-blue-400"
                    : "text-muted-foreground after:bg-transparent hover:text-foreground"
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[10px] font-bold",
                    active ? "bg-blue-600 text-white dark:bg-blue-500" : "bg-muted text-muted-foreground"
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={issueFilter} onChange={(e) => setIssueFilter(e.target.value)} className={selectCls}>
              <option value="All">All Issues</option>
              <option value="MISSING_CHECK_IN">Missing Check-in</option>
              <option value="MISSING_CHECK_OUT">Missing Check-out</option>
              <option value="OTHER">Other corrections</option>
            </select>
            <button
              onClick={handleReset}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-background px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search request or team member..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-full rounded-md border border-border/80 bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Team Member</th>
                <th className="px-4 py-2.5">Attendance Date</th>
                <th className="px-4 py-2.5">Existing Timing</th>
                <th className="px-4 py-2.5">Requested Timing</th>
                <th className="px-4 py-2.5">Reason</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
                    Loading regularization requests...
                  </td>
                </tr>
              ) : visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-muted-foreground">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    No regularization requests found
                  </td>
                </tr>
              ) : (
                visibleRequests.map((req) => {
                  const tone = STATUS_TONE[req.status];
                  return (
                    <tr key={req.id} onClick={() => onViewRequest?.(req)} className="cursor-pointer transition-colors hover:bg-muted/40">
                      {/* Team member */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <PersonAvatar name={req.employee.name} image={req.employee.avatarUrl} userId={req.employee.id} />
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-foreground">
                              <UserName userId={req.employee.id} name={req.employee.name} />
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {req.employee.designation}
                              {/* Employee ID hidden for now: {" "}• ID: {req.employee.employeeId} */}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{req.attendanceDate}</div>
                        <div className="text-[11px] text-muted-foreground">{req.attendanceDay}</div>
                      </td>

                      {/* Existing */}
                      <td className="px-4 py-3">
                        <div className="text-muted-foreground line-through decoration-muted-foreground/40">
                          {req.existingAttendance.checkIn || "--:--"} → {req.existingAttendance.checkOut || "--:--"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{req.existingAttendance.workedDuration || "--"}</div>
                      </td>

                      {/* Requested */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-blue-600 dark:text-blue-400">
                          {req.requestedAttendance.checkIn} → {req.requestedAttendance.checkOut}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{req.requestedAttendance.workedDuration}</div>
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3">
                        <div className="max-w-[180px] truncate font-medium text-foreground">{req.reason}</div>
                        <div className="max-w-[180px] truncate text-[11px] text-muted-foreground">{req.remarks || "No remarks"}</div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusPill tone={tone}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone], req.status === "Pending" && "animate-pulse")} />
                          {req.status}
                        </StatusPill>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewRequest?.(req);
                          }}
                          className="text-xs font-semibold text-blue-600 hover:text-foreground hover:underline dark:text-blue-400"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
          <div>
            Showing <span className="font-semibold text-foreground">{visibleRequests.length}</span> results
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-border/80 p-1.5 hover:bg-accent disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="font-semibold text-foreground">1</span>
            <button className="rounded-md border border-border/80 p-1.5 hover:bg-accent disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
