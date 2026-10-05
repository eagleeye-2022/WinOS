"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Users,
  CheckCircle2,
  CalendarCheck,
  UserX,
  Search,
  ChevronDown,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
  Building2,
  Home as HomeIcon,
  Wifi,
  Calendar,
  Loader2,
} from "lucide-react";
import { TeamMemberAttendance } from "../types";
import { getTeamAttendanceData } from "../queries/attendance-queries";
import { cn } from "@/lib/utils";

interface TeamAttendanceViewProps {
  onViewEmployee?: (member: TeamMemberAttendance) => void;
}

export function TeamAttendanceView({ onViewEmployee }: TeamAttendanceViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [workModeFilter, setWorkModeFilter] = useState("All");
  const [selectedDate, setSelectedDate] = useState("Today, 20 Aug 2026");
  const [currentDateObj, setCurrentDateObj] = useState(new Date("2026-08-20"));
  const [teamMembers, setTeamMembers] = useState<TeamMemberAttendance[]>([]);
  const [counts, setCounts] = useState({ total: 0, workingNow: 0, completed: 0, onLeave: 0, absent: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const dateStr = currentDateObj.toISOString().split("T")[0];
        const res = await getTeamAttendanceData(dateStr, {
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
  }, [currentDateObj, statusFilter, workModeFilter, searchTerm]);

  const handlePrevDay = () => {
    const prev = new Date(currentDateObj);
    prev.setDate(prev.getDate() - 1);
    setCurrentDateObj(prev);
    setSelectedDate(prev.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
  };

  const handleNextDay = () => {
    const next = new Date(currentDateObj);
    next.setDate(next.getDate() + 1);
    setCurrentDateObj(next);
    setSelectedDate(next.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header with Date Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Team Attendance
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track your team's daily attendance and availability.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{selectedDate}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={handlePrevDay}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <button
            onClick={handleNextDay}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Team */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Members
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
              {counts.total}
            </div>
          </div>
        </div>

        {/* Working Now */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Working Now
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
              {counts.workingNow}
            </div>
          </div>
        </div>

        {/* On Leave */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              On Leave
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
              {counts.onLeave}
            </div>
          </div>
        </div>

        {/* Absent */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Absent
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
              {counts.absent}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="All">All Status</option>
            <option value="Working Now">Working Now</option>
            <option value="Completed">Completed</option>
            <option value="On Leave">On Leave</option>
            <option value="Absent">Absent</option>
          </select>

          {/* Work Mode Dropdown */}
          <select
            value={workModeFilter}
            onChange={(e) => setWorkModeFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="All">All Modes</option>
            <option value="Office">Office</option>
            <option value="Remote">Remote</option>
          </select>

          {/* Department Dropdown */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="All">All Departments</option>
            <option value="Design">Design</option>
            <option value="Frontend">Frontend</option>
            <option value="Backend">Backend</option>
            <option value="QA">QA</option>
          </select>
        </div>

        {/* Search & Export Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search team member..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs transition-colors shrink-0">
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Team Attendance Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-5">Team Member</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Check-in</th>
                <th className="py-3.5 px-5">Check-out</th>
                <th className="py-3.5 px-5">Worked Hours</th>
                <th className="py-3.5 px-5">Work Mode</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading team attendance...
                  </td>
                </tr>
              ) : teamMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No team members found for this date.
                  </td>
                </tr>
              ) : (
                teamMembers.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => onViewEmployee?.(member)}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    {/* Member Profile */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <img
                          src={member.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"}
                          alt={member.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {member.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {member.designation} • ID: {member.employeeId}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-5">
                      {member.status === "Working Now" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:border-blue-900/60 dark:text-blue-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          Working Now
                        </span>
                      )}
                      {member.status === "Completed" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-900/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Completed
                        </span>
                      )}
                      {member.status === "On Leave" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:border-amber-900/60 dark:text-amber-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {member.leaveType || "On Leave"}
                        </span>
                      )}
                      {member.status === "Absent" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:border-rose-900/60 dark:text-rose-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Absent
                        </span>
                      )}
                    </td>

                    {/* Check In */}
                    <td className="py-3.5 px-5">
                      {member.checkInTime ? (
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {member.checkInTime}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {member.checkInSource}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Check Out */}
                    <td className="py-3.5 px-5">
                      {member.checkOutTime ? (
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {member.checkOutTime}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {member.checkOutSource}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Worked Hours */}
                    <td className="py-3.5 px-5">
                      {member.workedHours ? (
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-slate-100">
                            {member.workedHours}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {member.workedHoursSubtext}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Work Mode */}
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {member.workMode === "Office" ? (
                          <Building2 className="w-3 h-3 text-slate-500" />
                        ) : (
                          <Wifi className="w-3 h-3 text-slate-500" />
                        )}
                        <span>{member.workMode}</span>
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewEmployee?.(member);
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
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
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-800 dark:text-slate-200">{teamMembers.length}</span> members
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-bold text-slate-800 dark:text-slate-200">1</span>
            <button className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 disabled:opacity-40">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
