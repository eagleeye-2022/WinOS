"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  FileText,
} from "lucide-react";
import { LeaveRequest, LeaveStatus, LeaveTypeCode } from "../types";
import { Badge } from "@/components/ui/badge";
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

interface LeaveRequestsTableProps {
  requests: LeaveRequest[];
  onViewRequest: (request: LeaveRequest) => void;
  showFilters?: boolean;
  showDateRangeNav?: boolean;
  title?: string;
  defaultDateRangeText?: string;
}

export function LeaveRequestsTable({
  requests,
  onViewRequest,
  showFilters = false,
  showDateRangeNav = true,
  title = "MY REQUESTS/HOLIDAYS",
  defaultDateRangeText = "01/01/2026 - 31/01/2026",
}: LeaveRequestsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateRangeIndex, setDateRangeIndex] = useState(0);

  const dateRanges = [
    defaultDateRangeText,
    "01/02/2026 - 28/02/2026",
    "01/03/2026 - 31/03/2026",
    "01/04/2026 - 30/04/2026",
    "01/05/2026 - 31/05/2026",
  ];

  const currentDateRange = dateRanges[dateRangeIndex % dateRanges.length];

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
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
  }, [requests, searchTerm, selectedType, selectedStatus]);

  // Pagination
  const totalRecords = filteredRequests.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800">
            Rejected
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Pending
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {title && (
          <h3 className="text-sm font-bold tracking-wider text-muted-foreground uppercase">
            {title}
          </h3>
        )}

        {/* Date Navigator */}
        {showDateRangeNav && (
          <div className="flex items-center gap-1.5 self-end md:self-auto">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setDateRangeIndex((prev) => (prev > 0 ? prev - 1 : dateRanges.length - 1))}
              className="h-8 w-8 rounded-lg border-border/80 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border/80 rounded-lg text-xs font-medium text-foreground">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{currentDateRange}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setDateRangeIndex((prev) => prev + 1)}
              className="h-8 w-8 rounded-lg border-border/80 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Advanced Filter Bar (For Leave Request Tab) */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Date range display */}
          <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>01 Jan 2025 - 31 Dec 2025</span>
          </div>

          {/* Leave Type Select */}
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="h-9 rounded-xl text-xs">
              <SelectValue placeholder="All Leave Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Leave Types</SelectItem>
              <SelectItem value="CL">Casual Leave (CL)</SelectItem>
              <SelectItem value="SL">Sick Leave (SL)</SelectItem>
              <SelectItem value="HD">Half Day (HD)</SelectItem>
              <SelectItem value="EL">Early Leave (EL)</SelectItem>
              <SelectItem value="PL">Paid Leave (PL)</SelectItem>
              <SelectItem value="WFH">Work From Home (WFH)</SelectItem>
              <SelectItem value="COMP">Comp Off</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Select */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-9 rounded-xl text-xs">
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
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by reason"
              className="h-9 pl-9 rounded-xl text-xs"
            />
          </div>
        </div>
      )}

      {/* Requests Table */}
      <div className="border border-border/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border/80 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
            <tbody className="divide-y divide-border/60 text-xs">
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
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    {/* Leave Type */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">
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
                        className="text-xs font-semibold text-primary hover:underline cursor-pointer"
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
              className="h-8 w-8 rounded-lg"
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
                  "h-8 w-8 p-0 rounded-lg text-xs font-medium",
                  currentPage === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"
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
              className="h-8 w-8 rounded-lg"
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
