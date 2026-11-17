"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
} from "lucide-react";
import { CompensatoryRequest, LeaveStatus } from "../types";
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

interface CompensatoryRequestsTableProps {
  requests: CompensatoryRequest[];
  /** Omit to hide "Apply Compensatory Request" (e.g. a manager viewing someone else). */
  onApplyClick?: () => void;
  onViewRequest: (request: CompensatoryRequest) => void;
}

export function CompensatoryRequestsTable({
  requests,
  onApplyClick,
  onViewRequest,
}: CompensatoryRequestsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter requests
  const filtered = useMemo(() => {
    return requests.filter((req) => {
      if (
        searchTerm &&
        !req.reason.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !req.workDate.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      if (selectedStatus !== "ALL" && req.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [requests, searchTerm, selectedStatus]);

  const totalRecords = filtered.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const STATUS_LOOK: Record<LeaveStatus, { label: string; tone: PulseTone }> = {
    APPROVED: { label: "Approved", tone: "green" },
    CANCELLED: { label: "Cancelled", tone: "gray" },
    PENDING: { label: "Pending", tone: "amber" },
    REJECTED: { label: "Rejected", tone: "red" },
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
    <div className="space-y-4">
      {/* Toolbar: title + apply */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Compensatory Requests</h1>
        </div>

        {onApplyClick && (
          <Button
            type="button"
            onClick={onApplyClick}
            className="h-9 self-start rounded-md bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Apply Compensatory Request</span>
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="space-y-4 rounded-lg border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Date range picker display */}
          <div className="flex h-8 items-center gap-2 rounded-md border border-border/80 bg-background px-3 text-xs font-medium text-foreground">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>01 Jan 2025 - 31 Dec 2025</span>
          </div>

          {/* Status Select */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-8 rounded-md text-xs bg-background">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>

          {/* Search by reason */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by reason"
              className="h-8 pl-9 rounded-md text-xs bg-background"
            />
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-hidden rounded-md border border-border/70 bg-background">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-3 px-4 font-semibold">WORK DATE<br /><span className="text-xs font-normal lowercase">(date worked)</span></th>
                  <th className="py-3 px-4 font-semibold">HOURS WORKED</th>
                  <th className="py-3 px-4 font-semibold">DURATION</th>
                  <th className="py-3 px-4 font-semibold">REASON</th>
                  <th className="py-3 px-4 font-semibold">STATUS</th>
                  <th className="py-3 px-4 font-semibold">REQUESTED ON</th>
                  <th className="py-3 px-4 font-semibold text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No compensatory requests found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((r) => (
                    <tr
                      key={r.id}
                      className="group transition-colors hover:bg-muted/40"
                    >
                      {/* Work Date */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{r.workDate}</div>
                        <div className="text-xs text-muted-foreground">{r.workDayOfWeek}</div>
                      </td>

                      {/* Hours Worked */}
                      <td className="py-3 px-4 whitespace-pre-line text-muted-foreground font-medium">
                        {r.hoursWorkedDisplay}
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {r.durationText}
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 max-w-[220px] truncate text-muted-foreground" title={r.reason}>
                        {r.reason}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {getStatusBadge(r.status)}
                      </td>

                      {/* Requested On */}
                      <td className="py-3 px-4 text-muted-foreground font-medium">
                        {r.requestedOn}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onViewRequest(r)}
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Showing:</span>
            <span className="font-semibold text-foreground">
              {String(paginated.length).padStart(2, "0")}
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
              className="h-8 w-8 rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
