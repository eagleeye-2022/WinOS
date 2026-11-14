"use client";

import React, { useState, useEffect, useTransition } from "react";
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
import { TeamMemberAttendance } from "../types";
import { getTeamAttendanceData } from "../queries/attendance-queries";
import { cn } from "@/lib/utils";
import { formatShortDate, istDateKey } from "../utils";
import { PersonAvatar } from "./person-avatar";

interface TeamAttendanceViewProps {
  onViewEmployee?: (member: TeamMemberAttendance) => void;
}

export function TeamAttendanceView({ onViewEmployee }: TeamAttendanceViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
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

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header with Date Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Team Attendance
          </h1>
        </div>

        <PeriodNav modes={["day"]} value={dateKey} label={dateLabel} onChange={setDateKey} />
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
        {/* Total Team */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">
              Total Members
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground mt-0.5">
              {counts.total}
            </div>
            {counts.dayOff > 0 && (
              <div className="text-xs text-muted-foreground mt-0.5">{counts.dayOff} on a day off</div>
            )}
          </div>
        </div>

        {/* Working Now */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">
              Working Now
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground mt-0.5">
              {counts.workingNow}
            </div>
          </div>
        </div>

        {/* Completed (checked in and out) */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">
              Completed
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground mt-0.5">
              {counts.completed}
            </div>
          </div>
        </div>

        {/* On Leave */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">
              On Leave
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground mt-0.5">
              {counts.onLeave}
            </div>
          </div>
        </div>

        {/* Absent */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">
              Absent
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground mt-0.5">
              {counts.absent}
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
            <option value="Working Now">Working Now</option>
            <option value="Completed">Completed</option>
            <option value="On Leave">On Leave</option>
            <option value="Absent">Absent</option>
            <option value="Day Off">Day Off (weekend / holiday)</option>
          </select>

          {/* Work Mode Dropdown */}
          <select
            value={workModeFilter}
            onChange={(e) => setWorkModeFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="All">All Modes</option>
            <option value="Office">Office</option>
            <option value="Remote">Remote</option>
          </select>

          {/* Department Dropdown */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="All">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Search & Export Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search team member..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-input bg-zinc-50 dark:bg-zinc-800/80 text-xs text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-input bg-background text-xs font-semibold text-foreground hover:bg-accent shadow-xs transition-colors shrink-0">
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Team Attendance Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3.5 px-5">Team Member</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Check-in</th>
                <th className="py-3.5 px-5">Check-out</th>
                <th className="py-3.5 px-5">Worked Hours</th>
                <th className="py-3.5 px-5">Work Mode</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
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
                shownMembers.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => onViewEmployee?.(member)}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    {/* Member Profile */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <PersonAvatar name={member.name} image={member.avatarUrl} userId={member.id} />
                        <div>
                          <div className="font-bold text-foreground">
                            {member.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.designation}
                            {/* Employee ID hidden for now: {" "}• ID: {member.employeeId} */}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-5">
                      {member.status === "Working Now" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-accent dark:border-zinc-700/60 dark:text-blue-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          Working Now
                        </span>
                      )}
                      {member.status === "Completed" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-900/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Completed
                        </span>
                      )}
                      {member.status === "On Leave" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:border-amber-900/60 dark:text-amber-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {member.leaveType || "On Leave"}
                        </span>
                      )}
                      {member.status === "Absent" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:border-rose-900/60 dark:text-rose-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Absent
                        </span>
                      )}
                      {member.status === "Day Off" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                          Day Off
                        </span>
                      )}
                    </td>

                    {/* Check In */}
                    <td className="py-3.5 px-5">
                      {member.checkInTime ? (
                        <div>
                          <div className="font-semibold text-foreground">
                            {member.checkInTime}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.checkInSource}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Check Out */}
                    <td className="py-3.5 px-5">
                      {member.checkOutTime ? (
                        <div>
                          <div className="font-semibold text-foreground">
                            {member.checkOutTime}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.checkOutSource}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Worked Hours */}
                    <td className="py-3.5 px-5">
                      {member.workedHours ? (
                        <div>
                          <div className="font-bold text-foreground">
                            {member.workedHours}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.workedHoursSubtext}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Work Mode */}
                    <td className="py-3.5 px-5">
                      {member.workMode ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {member.workMode === "Office" ? (
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <Wifi className="w-3 h-3 text-muted-foreground" />
                          )}
                          <span>{member.workMode}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewEmployee?.(member);
                        }}
                        className="text-xs font-bold text-primary hover:text-foreground hover:underline"
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

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
          <div>
            Showing <span className="font-bold text-foreground">{shownMembers.length}</span> members
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
