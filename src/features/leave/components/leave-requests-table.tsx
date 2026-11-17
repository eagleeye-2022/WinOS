"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { LeaveRequest, LeaveStatus, isListedRequestType } from "../types";
import { PeriodNav, currentPeriod, overlapsPeriod, type Period } from "@/components/shared/period-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { StatusPill, TONE_DOT, type PulseTone } from "@/components/pulse/pulse-ui";

interface LeaveRequestsTableProps {
  requests: LeaveRequest[];
  onViewRequest: (request: LeaveRequest) => void;
  showFilters?: boolean;
  showDateRangeNav?: boolean;
  title?: string;
}

export function LeaveRequestsTable({
  requests: allRequests,
  onViewRequest,
  showFilters = false,
  showDateRangeNav = true,
  title = "MY REQUESTS/HOLIDAYS",
}: LeaveRequestsTableProps) {
  // Absent (ABS) entries aren't shown as requests.
  const requests = useMemo(() => allRequests.filter((r) => isListedRequestType(r.leaveTypeCode)), [allRequests]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Overview pages by month; the full Leave Request tab by year. Both start at the current one.
  const [period, setPeriod] = useState<Period>(() => currentPeriod(showFilters ? "year" : "month"));
  const changePeriod = (next: Period) => {
    setPeriod(next);
    setCurrentPage(1);
  };

  // Leave types this person actually has requests for.
  const typeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of requests) if (!seen.has(r.leaveTypeCode)) seen.set(r.leaveTypeCode, r.leaveTypeName);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (!overlapsPeriod(req.fromDate, req.toDate, period)) return false;
      // Reason search
      if (
        searchTerm &&
        !req.reason.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !req.leaveTypeName.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      // Type filter
      if (selectedType !== "ALL" && req.leaveTypeCode !== selectedType) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "ALL" && req.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [requests, searchTerm, selectedType, selectedStatus, period]);

  // Pagination
  const totalRecords = filteredRequests.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const STATUS_LOOK: Record<LeaveStatus, { label: string; tone: PulseTone }> = {
    APPROVED: { label: "Approved", tone: "green" },
    REJECTED: { label: "Rejected", tone: "red" },
    PENDING: { label: "Pending", tone: "amber" },
    CANCELLED: { label: "Cancelled", tone: "gray" },
  };
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
    <div className="space-y-4 rounded-lg border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {title && (
          <h3 className="text-[15px] font-semibold text-foreground">
            {title}
          </h3>
        )}

        {/* Date Navigator */}
        {showDateRangeNav && !showFilters && (
          <div className="self-end md:self-auto">
            <PeriodNav value={period} onChange={changePeriod} />
          </div>
        )}
      </div>

      {/* Advanced Filter Bar (For Leave Request Tab) */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <PeriodNav value={period} onChange={changePeriod} />

          {/* Leave Type Select */}
          <Select
            value={selectedType}
            onValueChange={(v) => {
              setSelectedType(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 rounded-md text-xs">
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

          {/* Status Select */}
          <Select
            value={selectedStatus}
            onValueChange={(v) => {
              setSelectedStatus(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 rounded-md text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by reason"
              className="h-8 pl-9 rounded-md text-xs"
            />
          </div>
        </div>
      )}

      {/* Requests Table */}
      <div className="overflow-hidden rounded-md border border-border/70">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-3 px-4 font-semibold">LEAVE TYPE</th>
                <th className="py-3 px-4 font-semibold">FROM</th>
                <th className="py-3 px-4 font-semibold">TO</th>
                <th className="py-3 px-4 font-semibold">DURATION</th>
                <th className="py-3 px-4 font-semibold">REASON</th>
                <th className="py-3 px-4 font-semibold">STATUS</th>
                <th className="py-3 px-4 font-semibold">APPLIED ON</th>
                <th className="py-3 px-4 font-semibold text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 text-xs">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No leave records found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="group transition-colors hover:bg-muted/40"
                  >
                    {/* Leave Type */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        {req.leaveTypeName}
                      </div>
                    </td>

                    {/* From Date */}
                    <td className="py-3 px-4 whitespace-pre-line text-muted-foreground font-medium">
                      {req.fromDateDisplay}
                    </td>

                    {/* To Date */}
                    <td className="py-3 px-4 whitespace-pre-line text-muted-foreground font-medium">
                      {req.toDateDisplay}
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {req.durationText}
                    </td>

                    {/* Reason */}
                    <td className="py-3 px-4 max-w-[200px] truncate text-muted-foreground" title={req.reason}>
                      {req.reason}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {getStatusBadge(req.status)}
                    </td>

                    {/* Applied On */}
                    <td className="py-3 px-4 text-muted-foreground">
                      {req.appliedOn}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => onViewRequest(req)}
                        className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-foreground hover:underline dark:text-blue-400"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      {showFilters && totalRecords > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Showing:</span>
            <span className="font-semibold text-foreground">
              {String(paginatedRequests.length).padStart(2, "0")}
            </span>
            <span>of {totalRecords} records</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 rounded-md"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                type="button"
                variant={currentPage === p ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(p)}
                className={cn(
                  "h-8 w-8 p-0 rounded-md text-xs font-medium",
                  currentPage === p ? "bg-blue-600 text-white hover:bg-blue-700" : "text-muted-foreground"
                )}
              >
                {p}
              </Button>
            ))}

            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 rounded-md"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-24 text-xs rounded-lg ml-2">
                <SelectValue placeholder="10 / page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 / page</SelectItem>
                <SelectItem value="10">10 / page</SelectItem>
                <SelectItem value="20">20 / page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
