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
  UserCheck,
} from "lucide-react";
import { UserTimeGroup, TimeLogEntry } from "../../types";
import {
  getTimeLogsAction,
  getProjectTimeLogSummaryAction,
  getCurrentUserRoleAction,
  deleteTimeLogAction,
  ProjectTimeSummary,
} from "../../actions/project-actions";
import { NewTimeLogModal } from "../modals/new-time-log-modal";
import { EditTimeLogModal } from "../modals/edit-time-log-modal";

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

  const isManagerOrAdmin =
    userRole === "ADMIN" ||
    userRole === "SUPER_ADMIN" ||
    userRole === "PROJECT_MANAGER" ||
    userRole === "MANAGER";

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [groups, summaryData, role] = await Promise.all([
        getTimeLogsAction(projectId),
        getProjectTimeLogSummaryAction(projectId),
        getCurrentUserRoleAction(),
      ]);
      setTimeGroups(groups);
      setSummary(summaryData);
      setUserRole(role);
    } catch (err) {
      console.error("Failed to load project time logs:", err);
    } finally {
      setIsLoading(false);
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

  const handleDeleteLog = async (logId: string) => {
    if (!confirm("Are you sure you want to delete this time log?")) return;
    try {
      await deleteTimeLogAction(logId);
      await loadData();
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
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Clock size={20} className="text-primary" />
            Project Time Logs
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isManagerOrAdmin
              ? "Viewing all time logs for this project (Manager / Admin view)"
              : "Viewing your logged time for this project (Team Member view)"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer self-start md:self-auto"
        >
          <Plus size={15} />
          Add Time Log
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      </div>

      {/* User & Task Hour Breakdown Cards (Managers / Admins or Project Summary) */}
      {summary && (summary.userBreakdown.length > 0 || summary.taskBreakdown.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* User Hours Breakdown */}
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

          {/* Task Hours Breakdown */}
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
      )}

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

      {/* Time Logs Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Description / Remarks</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground italic">
                    No time logs found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                      {log.date}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[9px]">
                          {log.userInitials}
                        </span>
                        <span className="font-medium text-foreground">{log.userName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.taskCode ? (
                        <span className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                          {log.taskCode}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">General</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-foreground/80">
                      {log.remarks || log.title}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">
                      {log.duration}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          log.billingType === "BILLABLE"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {log.billingType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingLog(log)}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Edit Log"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLog(log.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                          title="Delete Log"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
