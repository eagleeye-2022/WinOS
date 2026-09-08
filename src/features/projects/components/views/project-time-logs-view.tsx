"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  Calendar,
  Plus,
  Search,
  Filter,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Edit2,
  X,
  FileSpreadsheet,
  Lock,
  ChevronDown,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserTimeGroup, TimeLogEntry } from "../../types";
import {
  getTimeLogsAction,
  getProjectTimeLogSummaryAction,
  getCurrentUserRoleAction,
  deleteTimeLogAction,
  updateTimeLogAction,
  ProjectTimeSummary,
} from "../../actions/project-actions";
import { NewTimeLogModal } from "../modals/new-time-log-modal";
import { EditTimeLogModal } from "../modals/edit-time-log-modal";
import { ActiveTeamTimersCard } from "../active-team-timers-card";
import {
  parseDurationMinutes,
  formatDurationDisplay,
  formatTimePeriodRange,
  calculateMinutesFromTimeRange,
} from "../../utils/time-helpers";

interface ProjectTimeLogsViewProps {
  projectId: string;
  projectName: string;
}

export function ProjectTimeLogsView({ projectId, projectName }: ProjectTimeLogsViewProps) {
  const [timeGroups, setTimeGroups] = useState<UserTimeGroup[]>([]);
  const [summary, setSummary] = useState<ProjectTimeSummary | null>(null);
  const [userRole, setUserRole] = useState<string>("TEAM_MEMBER");
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUser, setFilterUser] = useState("ALL");
  const [filterTask, setFilterTask] = useState("ALL");
  const [filterBilling, setFilterBilling] = useState("ALL");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<TimeLogEntry | null>(null);

  const isClient = userRole === "CLIENT";
  const isManagerOrAdmin =
    userRole === "ADMIN" ||
    userRole === "SUPER_ADMIN" ||
    userRole === "PROJECT_MANAGER" ||
    userRole === "MANAGER";

  const canViewAll = isManagerOrAdmin || isClient;

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const [groups, summaryData, role] = await Promise.all([
        getTimeLogsAction(projectId),
        getProjectTimeLogSummaryAction(projectId),
        getCurrentUserRoleAction(projectId),
      ]);
      setTimeGroups(groups);
      setSummary(summaryData);
      setUserRole(role);
    } catch (err) {
      console.error("Failed to load project time logs:", err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  // Flatten all logs across user groups
  const allLogs = useMemo(() => {
    return timeGroups.flatMap((group) => group.timeLogs);
  }, [timeGroups]);

  // Available unique users & tasks for filter dropdowns
  const userOptions = useMemo(() => {
    return Array.from(new Set(allLogs.map((log) => log.userName).filter(Boolean)));
  }, [allLogs]);

  const taskOptions = useMemo(() => {
    const tasks = Array.from(new Set(allLogs.map((log) => log.taskCode).filter(Boolean) as string[]));
    const hasNoTaskLogs = allLogs.some((log) => !log.taskCode);
    return { tasks, hasNoTaskLogs };
  }, [allLogs]);

  // Filtered log entries
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      if (filterUser !== "ALL" && log.userName !== filterUser) return false;
      if (filterTask === "NO_TASK" && log.taskCode) return false;
      if (filterTask !== "ALL" && filterTask !== "NO_TASK" && log.taskCode !== filterTask) return false;
      if (filterBilling !== "ALL" && log.billingType !== filterBilling) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = log.code?.toLowerCase().includes(q);
        const matchesTitle = log.title?.toLowerCase().includes(q);
        const matchesUser = log.userName?.toLowerCase().includes(q);
        const matchesTask = log.taskCode?.toLowerCase().includes(q);
        const matchesRemarks = log.remarks?.toLowerCase().includes(q);
        if (!matchesCode && !matchesTitle && !matchesUser && !matchesTask && !matchesRemarks) {
          return false;
        }
      }
      return true;
    });
  }, [allLogs, filterUser, filterTask, filterBilling, searchQuery]);

  const [collapsedUserIds, setCollapsedUserIds] = useState<Record<string, boolean>>({});

  const toggleUserCollapse = (uId: string) => {
    setCollapsedUserIds((prev) => ({
      ...prev,
      [uId]: !prev[uId],
    }));
  };

  const userGroupMap = useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string;
        userName: string;
        userInitials: string;
        timeLogs: TimeLogEntry[];
        totalMinutes: number;
        billableMinutes: number;
        nonBillableMinutes: number;
      }
    >();

    for (const log of filteredLogs) {
      const uKey = log.userName || log.userId || "Unassigned User";
      if (!map.has(uKey)) {
        map.set(uKey, {
          userId: uKey,
          userName: uKey,
          userInitials: log.userInitials || "US",
          timeLogs: [],
          totalMinutes: 0,
          billableMinutes: 0,
          nonBillableMinutes: 0,
        });
      }

      const group = map.get(uKey)!;
      group.timeLogs.push(log);

      const mins = parseDurationMinutes(log.duration);
      group.totalMinutes += mins;
      if (log.billingType === "BILLABLE") group.billableMinutes += mins;
      else group.nonBillableMinutes += mins;
    }

    return Array.from(map.values());
  }, [filteredLogs]);

  const formatMinsToStr = (m: number): string => {
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")} h`;
  };

  type EditableField = "remarks" | "duration" | "timePeriod";
  const [editingCell, setEditingCell] = useState<{ logId: string; field: EditableField } | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const getFieldValue = (log: TimeLogEntry, field: EditableField): string => {
    if (field === "remarks") return log.remarks || log.title || "";
    if (field === "timePeriod") return log.timePeriod || "";
    return log.duration || "";
  };

  const handleStartEditCell = (log: TimeLogEntry, field: EditableField) => {
    if (isClient) return;
    setEditingCell({ logId: log.id, field });
    setEditDraft(getFieldValue(log, field));
  };

  const commitCellEdit = async (log: TimeLogEntry, field: EditableField) => {
    setEditingCell(null);
    const original = getFieldValue(log, field);
    if (editDraft === original) return;
    try {
      const updatePayload: Partial<TimeLogEntry> = { [field]: editDraft };

      // Daily Log Hours (duration) is derived from the Time Period range whenever it's editable.
      if (field === "timePeriod" && (editDraft.includes("-") || editDraft.includes("–"))) {
        const parts = editDraft.split(/[-–]/);
        if (parts.length === 2) {
          const rangeStr = formatTimePeriodRange(parts[0], parts[1]);
          const mins = calculateMinutesFromTimeRange(parts[0], parts[1]);
          if (rangeStr) updatePayload.timePeriod = rangeStr;
          if (mins && mins > 0) {
            updatePayload.duration = formatDurationDisplay(mins);
          }
        }
      }

      await updateTimeLogAction(log.id, updatePayload);
      await loadData(false);
    } catch (err) {
      console.error("Failed to update time log:", err);
      alert(err instanceof Error ? err.message : "Failed to update time log.");
    }
  };

  const handleChangeBillingType = async (log: TimeLogEntry, billingType: "BILLABLE" | "NON BILLABLE") => {
    if (isClient || billingType === log.billingType) return;
    try {
      await updateTimeLogAction(log.id, { billingType });
      await loadData(false);
    } catch (err) {
      console.error("Failed to update billing type:", err);
      alert(err instanceof Error ? err.message : "Failed to update billing type.");
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm("Are you sure you want to delete this time log?")) return;
    try {
      await deleteTimeLogAction(logId);
      await loadData(false);
    } catch (err) {
      console.error("Failed to delete log:", err);
      alert("Failed to delete time log. You may only delete your own logs.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-y-auto p-6 space-y-6">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Clock size={20} className="text-primary" />
            Project Time Logs
          </h2> */}
          {/* <p className="text-xs text-muted-foreground mt-0.5">
            {isManagerOrAdmin
              ? "Viewing all time logs for this project (Manager / Admin view)"
              : "Viewing your logged time for this project (Team Member view)"}
          </p> */}
        </div>

        {/* {!isClient ? (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer self-start md:self-auto"
          >
            <Plus size={15} />
            Add Time Log
          </button>
        ) : ( */}
        {isClient && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <Lock size={13} />
            Client Read-Only Mode
          </span>
        )}
        {/* )} */}
      </div>

      {/* Summary KPI Cards */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Project Hours</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              <Clock size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-foreground font-mono mt-2">
            {summary?.totalHoursStr || "00:00 h"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {allLogs.length} time log{allLogs.length !== 1 ? "s" : ""} recorded
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Billable Hours</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
              $
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-2">
            {summary?.billableHoursStr || "00:00 h"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Client billable time</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Non-Billable Hours</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
              NB
            </div>
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-2">
            {summary?.nonBillableHoursStr || "00:00 h"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Internal / overhead time</p>
        </div>
      </div> */}

      {/* Real-Time Active Team Timers Live Monitoring */}
      {/* <ActiveTeamTimersCard projectId={projectId} /> */}

      {/* User & Task Hour Breakdown Cards (Managers / Admins or Project Summary) */}
      {/* {summary && (summary.userBreakdown.length > 0 || summary.taskBreakdown.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summary.userBreakdown.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users size={14} className="text-primary" />
                Hours by User
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {summary.userBreakdown.map((u) => (
                  <div
                    key={u.userId}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                        {u.userInitials}
                      </span>
                      <span className="font-semibold text-foreground truncate">{u.userName}</span>
                    </div>
                    <span className="font-mono font-bold text-primary shrink-0 ml-2">
                      {u.totalHoursStr}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.taskBreakdown.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock size={14} className="text-primary" />
                Hours by Task
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {summary.taskBreakdown.map((t) => (
                  <div
                    key={t.taskCode}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-semibold text-info shrink-0">{t.taskCode}</span>
                      <span className="text-foreground/80 truncate text-[11px]">{t.taskTitle}</span>
                    </div>
                    <span className="font-mono font-bold text-foreground shrink-0 ml-2">
                      {t.totalHoursStr}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )} */}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search time logs..."
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* User Filter (For managers/admins) */}
          {isManagerOrAdmin && userOptions.length > 0 && (
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Users</option>
              {userOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          )}

          {/* Task Filter */}
          {(taskOptions.tasks.length > 0 || taskOptions.hasNoTaskLogs) && (
            <select
              value={filterTask}
              onChange={(e) => setFilterTask(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Tasks</option>
              {taskOptions.hasNoTaskLogs && (
                <option value="NO_TASK">General / Direct Project (No Task)</option>
              )}
              {taskOptions.tasks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {/* Billing Filter */}
          <select
            value={filterBilling}
            onChange={(e) => setFilterBilling(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="ALL">All Billing</option>
            <option value="BILLABLE">Billable</option>
            <option value="NON BILLABLE">Non Billable</option>
          </select>
        </div>
      </div>

      {/* Time Logs View (Manager User Accordion View vs Flat Table for Team Members) */}
      {canViewAll ? (
        <div className="space-y-3">
          {userGroupMap.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground italic">
              No time logs found matching your criteria.
            </div>
          ) : (
            userGroupMap.map((userGroup) => {
              const isCollapsed = Boolean(collapsedUserIds[userGroup.userId]);

              return (
                <div
                  key={userGroup.userId}
                  className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs transition-all"
                >
                  {/* User Accordion Header */}
                  <div
                    onClick={() => toggleUserCollapse(userGroup.userId)}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground p-1 rounded"
                      >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {userGroup.userInitials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            {userGroup.userName}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {userGroup.timeLogs.length} log{userGroup.timeLogs.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* User Hours Summary Pills */}
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <div className="flex items-center gap-1.5 bg-background border border-border px-2.5 py-1 rounded-md shadow-2xs">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold">Total:</span>
                        <span className="font-bold text-foreground">{formatMinsToStr(userGroup.totalMinutes)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-md shadow-2xs">
                        <span className="text-[10px] uppercase font-bold">Billable:</span>
                        <span className="font-bold">{formatMinsToStr(userGroup.billableMinutes)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-md shadow-2xs">
                        <span className="text-[10px] uppercase font-bold">Non-Billable:</span>
                        <span className="font-bold">{formatMinsToStr(userGroup.nonBillableMinutes)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded User Time Logs Table */}
                  {!isCollapsed && (
                    <div className="border-t border-border overflow-x-auto dsm-columns-scrollbar">
                      <table className="w-full min-w-[1100px] text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-muted/60 text-muted-foreground font-semibold">
                            <th className="py-2.5 px-4 border-r border-border whitespace-nowrap">ID</th>
                            <th className="py-2.5 px-4 border-r border-border whitespace-nowrap min-w-[160px]">LOG TITLE</th>
                            <th className="py-2.5 px-4 border-r border-border whitespace-nowrap min-w-[140px]">PROJECT</th>
                            <th className="py-2.5 px-4 border-r border-border whitespace-nowrap">DAILY LOG HOURS</th>
                            <th className="py-2.5 px-4 border-r border-border whitespace-nowrap">TIME PERIOD</th>
                            <th className="py-2.5 px-4 border-r border-border whitespace-nowrap">DATE</th>
                            <th className="py-2.5 px-4 border-r border-border whitespace-nowrap">BILLING TYPE</th>
                            <th className="py-2.5 px-4 border-r border-border whitespace-nowrap min-w-[140px]">APPROVAL STATUS</th>
                            <th className="py-2.5 px-4 whitespace-nowrap min-w-[160px]">REMARKS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {userGroup.timeLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2.5 border-r border-border font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                                {log.taskCode || log.code}
                              </td>
                              <td className="px-4 py-2.5 border-r border-border font-semibold text-foreground whitespace-nowrap">
                                {log.title}
                              </td>
                              <td className="px-4 py-2.5 border-r border-border text-foreground whitespace-nowrap">
                                {log.project || projectName}
                              </td>
                              <td className="px-3 py-2 border-r border-border whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                {editingCell?.logId === log.id && editingCell.field === "duration" ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    onBlur={() => commitCellEdit(log, "duration")}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") e.currentTarget.blur();
                                      if (e.key === "Escape") setEditingCell(null);
                                    }}
                                    className="w-20 rounded-md border border-primary/50 bg-transparent px-1 -mx-1 py-0.5 text-xs font-mono font-bold text-foreground outline-none ring-1 ring-primary/30 focus:ring-primary"
                                  />
                                ) : (
                                  <span
                                    onClick={() => handleStartEditCell(log, "duration")}
                                    title="Click to edit"
                                    className={cn("inline-block rounded-md px-1 -mx-1 font-mono font-bold text-foreground", !isClient && "cursor-text hover:bg-muted/60")}
                                  >
                                    {log.duration}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 border-r border-border whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                {editingCell?.logId === log.id && editingCell.field === "timePeriod" ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    onBlur={() => commitCellEdit(log, "timePeriod")}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") e.currentTarget.blur();
                                      if (e.key === "Escape") setEditingCell(null);
                                    }}
                                    placeholder="00:00 - 00:00"
                                    className="w-40 rounded-md border border-primary/50 bg-transparent px-1 -mx-1 py-0.5 text-[11px] text-muted-foreground outline-none ring-1 ring-primary/30 focus:ring-primary"
                                  />
                                ) : (
                                  <span
                                    onClick={() => handleStartEditCell(log, "timePeriod")}
                                    title="Click to edit"
                                    className={cn("inline-block rounded-md px-1 -mx-1 text-[11px] text-muted-foreground", !isClient && "cursor-text hover:bg-muted/60")}
                                  >
                                    {log.timePeriod || "—"}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 border-r border-border font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                                {log.date}
                              </td>
                              <td className="px-3 py-2 border-r border-border whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={log.billingType}
                                  onChange={(e) => handleChangeBillingType(log, e.target.value as "BILLABLE" | "NON BILLABLE")}
                                  disabled={isClient}
                                  title="Click to edit Billing Type inline"
                                  className={cn(
                                    "rounded border border-transparent hover:border-input bg-transparent px-2 py-0.5 text-xs font-semibold outline-hidden transition-all",
                                    isClient ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                                    log.billingType === "BILLABLE" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                                  )}
                                >
                                  <option value="BILLABLE" className="bg-card text-emerald-600 font-bold">BILLABLE</option>
                                  <option value="NON BILLABLE" className="bg-card text-amber-600 font-bold">NON BILLABLE</option>
                                </select>
                              </td>
                              <td className="px-4 py-2.5 border-r border-border whitespace-nowrap">
                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${log.approvalStatus === "Approved" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : log.approvalStatus === "Rejected" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                                  {log.approvalStatus || "Pending"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground max-w-[220px] truncate" title={log.remarks} onClick={(e) => e.stopPropagation()}>
                                {editingCell?.logId === log.id && editingCell.field === "remarks" ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    onBlur={() => commitCellEdit(log, "remarks")}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") e.currentTarget.blur();
                                      if (e.key === "Escape") setEditingCell(null);
                                    }}
                                    className="w-full rounded-md border border-primary/50 bg-transparent px-1 -mx-1 py-0.5 text-xs text-foreground outline-none ring-1 ring-primary/30 focus:ring-primary"
                                  />
                                ) : (
                                  <span
                                    onClick={() => handleStartEditCell(log, "remarks")}
                                    title="Click to edit"
                                    className={cn("block truncate rounded-md px-1 -mx-1", !isClient && "cursor-text hover:bg-muted/60")}
                                  >
                                    {log.remarks || "—"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto dsm-columns-scrollbar">
            <table className="w-full min-w-[1100px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-muted-foreground font-semibold">
                  <th className="py-3 px-4 border-r border-border whitespace-nowrap">ID</th>
                  <th className="py-3 px-4 border-r border-border whitespace-nowrap min-w-[160px]">LOG TITLE</th>
                  <th className="py-3 px-4 border-r border-border whitespace-nowrap min-w-[140px]">PROJECT</th>
                  <th className="py-3 px-4 border-r border-border whitespace-nowrap">DAILY LOG HOURS</th>
                  <th className="py-3 px-4 border-r border-border whitespace-nowrap">TIME PERIOD</th>
                  <th className="py-3 px-4 border-r border-border whitespace-nowrap">DATE</th>
                  <th className="py-3 px-4 border-r border-border whitespace-nowrap">BILLING TYPE</th>
                  <th className="py-3 px-4 border-r border-border whitespace-nowrap min-w-[140px]">APPROVAL STATUS</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[160px]">REMARKS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground italic">
                      No time logs found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 border-r border-border font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                        {log.taskCode || log.code}
                      </td>
                      <td className="px-4 py-3 border-r border-border font-semibold text-foreground whitespace-nowrap">
                        {log.title}
                      </td>
                      <td className="px-4 py-3 border-r border-border text-foreground whitespace-nowrap">
                        {log.project || projectName}
                      </td>
                      <td className="px-3 py-2 border-r border-border whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {editingCell?.logId === log.id && editingCell.field === "duration" ? (
                          <input
                            type="text"
                            autoFocus
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onBlur={() => commitCellEdit(log, "duration")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            className="w-20 rounded-md border border-primary/50 bg-transparent px-1 -mx-1 py-0.5 text-xs font-mono font-bold text-foreground outline-none ring-1 ring-primary/30 focus:ring-primary"
                          />
                        ) : (
                          <span
                            onClick={() => handleStartEditCell(log, "duration")}
                            title="Click to edit"
                            className={cn("inline-block rounded-md px-1 -mx-1 font-mono font-bold text-foreground", !isClient && "cursor-text hover:bg-muted/60")}
                          >
                            {log.duration}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-border whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {editingCell?.logId === log.id && editingCell.field === "timePeriod" ? (
                          <input
                            type="text"
                            autoFocus
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onBlur={() => commitCellEdit(log, "timePeriod")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            className="w-40 rounded-md border border-primary/50 bg-transparent px-1 -mx-1 py-0.5 text-[11px] text-muted-foreground outline-none ring-1 ring-primary/30 focus:ring-primary"
                          />
                        ) : (
                          <span
                            onClick={() => handleStartEditCell(log, "timePeriod")}
                            title="Click to edit"
                            className={cn("inline-block rounded-md px-1 -mx-1 text-[11px] text-muted-foreground", !isClient && "cursor-text hover:bg-muted/60")}
                          >
                            {log.timePeriod || "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 border-r border-border font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {log.date}
                      </td>
                      <td className="px-3 py-2 border-r border-border whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={log.billingType}
                          onChange={(e) => handleChangeBillingType(log, e.target.value as "BILLABLE" | "NON BILLABLE")}
                          disabled={isClient}
                          title="Click to edit Billing Type inline"
                          className={cn(
                            "rounded border border-transparent hover:border-input bg-transparent px-2 py-0.5 text-xs font-semibold outline-hidden transition-all",
                            isClient ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                            log.billingType === "BILLABLE" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                          )}
                        >
                          <option value="BILLABLE" className="bg-card text-emerald-600 font-bold">BILLABLE</option>
                          <option value="NON BILLABLE" className="bg-card text-amber-600 font-bold">NON BILLABLE</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 border-r border-border whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${log.approvalStatus === "Approved" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : log.approvalStatus === "Rejected" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                          {log.approvalStatus || "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[220px] truncate" title={log.remarks} onClick={(e) => e.stopPropagation()}>
                        {editingCell?.logId === log.id && editingCell.field === "remarks" ? (
                          <input
                            type="text"
                            autoFocus
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onBlur={() => commitCellEdit(log, "remarks")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            className="w-full rounded-md border border-primary/50 bg-transparent px-1 -mx-1 py-0.5 text-xs text-foreground outline-none ring-1 ring-primary/30 focus:ring-primary"
                          />
                        ) : (
                          <span
                            onClick={() => handleStartEditCell(log, "remarks")}
                            title="Click to edit"
                            className={cn("block truncate rounded-md px-1 -mx-1", !isClient && "cursor-text hover:bg-muted/60")}
                          >
                            {log.remarks || "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Time Log Modal */}
      {isAddModalOpen && (
        <NewTimeLogModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          projectId={projectId}
          projectName={projectName}
          onLogAdded={() => {
            loadData();
            setIsAddModalOpen(false);
          }}
        />
      )}

      {/* Edit Time Log Modal */}
      {editingLog && (
        <EditTimeLogModal
          isOpen={Boolean(editingLog)}
          onClose={() => setEditingLog(null)}
          log={editingLog}
          onLogUpdated={() => {
            loadData();
            setEditingLog(null);
          }}
        />
      )}
    </div>
  );
}
