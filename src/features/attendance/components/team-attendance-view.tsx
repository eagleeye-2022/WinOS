"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import {
  Users,
  CheckCircle2,
  CalendarCheck,
  UserX,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
  Building2,
  Home as HomeIcon,
  Wifi,
  Loader2,
} from "lucide-react";
import { PeriodNav } from "@/components/shared/period-nav";
import {
  PulseStatTiles,
  StatusPill,
  TONE_DOT,
  scrollToList,
  type PulseStat,
  type PulseTone,
} from "@/components/pulse/pulse-ui";
import { TeamMemberAttendance } from "../types";
import { getTeamAttendanceData } from "../queries/attendance-queries";
import { cn } from "@/lib/utils";
import { formatShortDate, istDateKey } from "../utils";
import { PersonAvatar } from "./person-avatar";
import { UserName } from "@/components/shared/user-card";

interface TeamAttendanceViewProps {
  onViewEmployee?: (member: TeamMemberAttendance) => void;
}

export function TeamAttendanceView({ onViewEmployee }: TeamAttendanceViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  /** The table the stat tiles jump to. */
  const tableRef = useRef<HTMLDivElement>(null);
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [workModeFilter, setWorkModeFilter] = useState("All");
  const [dateKey, setDateKey] = useState(() => istDateKey());
  const dateLabel = dateKey === istDateKey() ? `Today, ${formatShortDate(dateKey)}` : formatShortDate(dateKey);
  const [teamMembers, setTeamMembers] = useState<TeamMemberAttendance[]>([]);
  const [counts, setCounts] = useState({ total: 0, workingNow: 0, completed: 0, onLeave: 0, absent: 0, dayOff: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  /** `quiet`: a background refresh — keep the current rows on screen instead of the loader. */
  const loadData = (quiet = false) => {
    startTransition(async () => {
      if (!quiet) setIsLoading(true);
      try {
        const res = await getTeamAttendanceData(dateKey, {
          search: searchTerm,
          status: statusFilter,
          workMode: workModeFilter,
        });
        setTeamMembers(res.teamMembers);
        setCounts(res.counts);
      } catch (err) {
        console.error("Failed to load team attendance:", err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [dateKey, statusFilter, workModeFilter, searchTerm]);

  // Check-ins and check-outs happen on other people's devices: refresh every minute and when this
  // tab comes back into view, so the list stays live without a manual reload.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") loadData(true);
    };
    const timer = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  });

  // Departments come from the team itself; filtering by one happens here (the counts stay team-wide).
  const departments = [...new Set(teamMembers.map((m) => m.department).filter((d) => d && d !== "—"))].sort();
  const shownMembers =
    departmentFilter === "All" ? teamMembers : teamMembers.filter((m) => m.department === departmentFilter);

  const STATUS_TONE: Record<TeamMemberAttendance["status"], PulseTone> = {
    "Working Now": "blue",
    Completed: "green",
    "On Leave": "amber",
    Absent: "red",
    "Day Off": "gray",
  };

  // Click a tile to filter the table to that status and jump to it (again, or Total Members, to clear).
  const pickStatus = (status: string) => () => {
    setStatusFilter(status !== "All" && statusFilter === status ? "All" : status);
    scrollToList(tableRef.current);
  };
  const stats: PulseStat[] = [
    {
      label: "Total Members",
      value: counts.total,
      tone: "blue",
      icon: <Users className="h-4 w-4" />,
      note: counts.dayOff > 0 ? `${counts.dayOff} on a day off` : undefined,
      onClick: pickStatus("All"),
      active: statusFilter === "All",
    },
    { label: "Working Now", value: counts.workingNow, tone: "blue", icon: <Clock className="h-4 w-4" />, onClick: pickStatus("Working Now"), active: statusFilter === "Working Now" },
    { label: "Completed", value: counts.completed, tone: "green", icon: <CheckCircle2 className="h-4 w-4" />, onClick: pickStatus("Completed"), active: statusFilter === "Completed" },
    { label: "On Leave", value: counts.onLeave, tone: "amber", icon: <CalendarCheck className="h-4 w-4" />, onClick: pickStatus("On Leave"), active: statusFilter === "On Leave" },
    { label: "Absent", value: counts.absent, tone: "red", icon: <UserX className="h-4 w-4" />, onClick: pickStatus("Absent"), active: statusFilter === "Absent" },
  ];

  const selectCls =
    "h-8 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Toolbar: title + date */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Team Attendance</h1>
        </div>
        <PeriodNav modes={["day"]} value={dateKey} label={dateLabel} onChange={setDateKey} />
      </div>

      {/* Summary tiles — clickable filters */}
      <PulseStatTiles items={stats} />

      {/* Table card with its filter bar (tiles scroll here; scroll-mt clears the sticky tabs) */}
      <div ref={tableRef} className="scroll-mt-24 overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="All">All Status</option>
              <option value="Working Now">Working Now</option>
              <option value="Completed">Completed</option>
              <option value="On Leave">On Leave</option>
              <option value="Absent">Absent</option>
              <option value="Day Off">Day Off (weekend / holiday)</option>
            </select>
            <select value={workModeFilter} onChange={(e) => setWorkModeFilter(e.target.value)} className={selectCls}>
              <option value="All">All Modes</option>
              <option value="Office">Office</option>
              <option value="Remote">Remote</option>
            </select>
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className={selectCls}>
              <option value="All">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search team member..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-full rounded-md border border-border/80 bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <button className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border/80 bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent">
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Team Member</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Check-in</th>
                <th className="px-4 py-2.5">Check-out</th>
                <th className="px-4 py-2.5">Worked Hours</th>
                <th className="px-4 py-2.5">Work Mode</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
                    Loading team attendance...
                  </td>
                </tr>
              ) : shownMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No team members found for this date.
                  </td>
                </tr>
              ) : (
                shownMembers.map((member) => {
                  const tone = STATUS_TONE[member.status];
                  return (
                    <tr
                      key={member.id}
                      onClick={() => onViewEmployee?.(member)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      {/* Member */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <PersonAvatar name={member.name} image={member.avatarUrl} userId={member.id} />
                            <span
                              className={cn(
                                "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-card",
                                TONE_DOT[tone],
                                member.status === "Working Now" && "animate-pulse"
                              )}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-foreground">
                              <UserName userId={member.id} name={member.name} />
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {member.designation}
                              {/* Employee ID hidden for now: {" "}• ID: {member.employeeId} */}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusPill tone={tone}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} />
                          {member.status === "On Leave" ? member.leaveType || "On Leave" : member.status}
                        </StatusPill>
                      </td>

                      {/* Check-in */}
                      <td className="px-4 py-3">
                        {member.checkInTime ? (
                          <div>
                            <div className="font-semibold text-foreground">{member.checkInTime}</div>
                            <div className="text-[11px] text-muted-foreground">{member.checkInSource}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Check-out */}
                      <td className="px-4 py-3">
                        {member.checkOutTime ? (
                          <div>
                            <div className="font-semibold text-foreground">{member.checkOutTime}</div>
                            <div className="text-[11px] text-muted-foreground">{member.checkOutSource}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Worked hours */}
                      <td className="px-4 py-3">
                        {member.workedHours ? (
                          <div>
                            <div className="font-semibold text-foreground">{member.workedHours}</div>
                            <div className="text-[11px] text-muted-foreground">{member.workedHoursSubtext}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Work mode */}
                      <td className="px-4 py-3">
                        {member.workMode ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2 py-0.5 text-[11px] font-medium text-foreground">
                            {member.workMode === "Office" ? (
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <Wifi className="h-3 w-3 text-muted-foreground" />
                            )}
                            {member.workMode}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewEmployee?.(member);
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
            Showing <span className="font-semibold text-foreground">{shownMembers.length}</span> members
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
