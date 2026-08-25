"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Filter,
  MoreVertical,
  ClipboardList,
  Folder,
  X,
  Check,
  Loader2,
  Search,
  Bell,
  SlidersHorizontal,
  Sparkles,
  Grid,
  User as UserIcon,
  List,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Printer,
  BarChart3,
  TrendingUp,
  Trash2,
  Play,
  Square,
  Edit2,
  AlertTriangle,
} from "lucide-react";
import { UserTimeGroup, TimeLogEntry } from "../../types";
import { TimerWidget } from "../timer-widget";
import { NewTimeLogModal } from "../modals/new-time-log-modal";
import { EditTimeLogModal } from "../modals/edit-time-log-modal";
import {
  updateTimeLogAction,
  deleteTimeLogAction,
  approveTimeLogsAction,
  rejectTimeLogsAction,
  createTimeLogAction,
  getCurrentUserRoleAction,
} from "../../actions/project-actions";

interface TimeTrackerViewProps {
  initialGroups: UserTimeGroup[];
  projectId?: string;
  projectName?: string;
  assignedUsers?: string[];
}

export function TimeTrackerView({ initialGroups, projectId, projectName, assignedUsers }: TimeTrackerViewProps) {
  const [userGroups, setUserGroups] = useState<UserTimeGroup[]>(initialGroups);
  const [prevInitialGroups, setPrevInitialGroups] = useState(initialGroups);

  if (initialGroups !== prevInitialGroups) {
    setPrevInitialGroups(initialGroups);
    setUserGroups(initialGroups);
  }

  // Role Perspective Switcher
  const [roleMode, setRoleMode] = useState<"ADMIN" | "USER">("ADMIN");

  // Default views matching the user screenshot
  const [groupBy, setGroupBy] = useState<"Group By Date" | "Group By User" | "Group By Project">("Group By Date");
  const [timeSheetView, setTimeSheetView] = useState<"My Time Logs" | "All Time Logs" | "Team Time Logs">("All Time Logs");
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  // Filters State
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [filterUser, setFilterUser] = useState("ALL");
  const [filterProject, setFilterProject] = useState("ALL");
  const [filterBilling, setFilterBilling] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);

  // Rejection Reason Modal State
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReasonText, setRejectionReasonText] = useState("");

  // Add Time Log Modal State
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [modalTargetDate, setModalTargetDate] = useState("");
  const [modalTargetProject, setModalTargetProject] = useState("");

  // Date range navigator string
  const [dateRangeStr, setDateRangeStr] = useState("17/08/2026 to 23/08/2026 (WEEK - 34)");

  // Collapsible date sections state
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const toggleDateCollapse = (dateKey: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  const handleToggleSelectLog = (id: string) => {
    if (selectedLogIds.includes(id)) {
      setSelectedLogIds(selectedLogIds.filter((lId) => lId !== id));
    } else {
      setSelectedLogIds([...selectedLogIds, id]);
    }
  };

  const handleSelectAllLogs = (logsToSelect: TimeLogEntry[]) => {
    const allIds = logsToSelect.map((l) => l.id);
    const allSelected = allIds.every((id) => selectedLogIds.includes(id));
    if (allSelected) {
      setSelectedLogIds(selectedLogIds.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedLogIds(Array.from(new Set([...selectedLogIds, ...allIds])));
    }
  };

  // Edit Time Log State
  const [editingLog, setEditingLog] = useState<TimeLogEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Single Running Timer State
  const [runningTimer, setRunningTimer] = useState<{
    project: string;
    taskTitle: string;
    taskCode?: string;
    startTime: Date;
    elapsedSeconds: number;
  } | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (runningTimer) {
      interval = setInterval(() => {
        setRunningTimer((prev) =>
          prev ? { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 } : null
        );
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [runningTimer]);

  const handleStartGlobalTimer = (project: string, taskTitle: string, taskCode?: string) => {
    if (runningTimer) {
      alert(
        `A timer is already running for "${runningTimer.taskTitle}" in project "${runningTimer.project}". Please stop the active timer before starting a new one.`
      );
      return;
    }
    setRunningTimer({
      project,
      taskTitle,
      taskCode,
      startTime: new Date(),
      elapsedSeconds: 0,
    });
  };

  const handleStopGlobalTimer = async () => {
    if (!runningTimer) return;
    const durationMins = Math.max(1, Math.round(runningTimer.elapsedSeconds / 60));
    const hours = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    const formattedDuration = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

    try {
      const createdLog = await createTimeLogAction({
        title: runningTimer.taskTitle,
        project: runningTimer.project,
        taskCode: runningTimer.taskCode,
        duration: formattedDuration,
        date: new Date().toISOString().split("T")[0],
        billingType: "NON BILLABLE",
        remarks: "Logged via timer",
      });

      setUserGroups((prev) => {
        const next = [...prev];
        if (next.length > 0) {
          next[0] = {
            ...next[0],
            timeLogs: [createdLog, ...next[0].timeLogs],
          };
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to save timer log:", err);
    } finally {
      setRunningTimer(null);
    }
  };

  // Approvals & Status Actions (Server Backed)
  const handleApproveSelected = async () => {
    if (selectedLogIds.length === 0) return;
    try {
      await approveTimeLogsAction(selectedLogIds);
      setUserGroups((prevGroups) =>
        prevGroups.map((g) => ({
          ...g,
          timeLogs: g.timeLogs.map((l) =>
            selectedLogIds.includes(l.id)
              ? { ...l, approvalStatus: "Approved" }
              : l
          ),
        }))
      );
      setSelectedLogIds([]);
    } catch (err) {
      console.error("Failed to approve time logs:", err);
    }
  };

  const handleRejectSelected = async () => {
    if (selectedLogIds.length === 0) return;
    try {
      await rejectTimeLogsAction(selectedLogIds, rejectionReasonText);
      setUserGroups((prevGroups) =>
        prevGroups.map((g) => ({
          ...g,
          timeLogs: g.timeLogs.map((l) =>
            selectedLogIds.includes(l.id)
              ? {
                  ...l,
                  approvalStatus: "Rejected",
                  rejectionReason: rejectionReasonText.trim() || "Does not meet timesheet criteria",
                }
              : l
          ),
        }))
      );
      setSelectedLogIds([]);
      setShowRejectionModal(false);
      setRejectionReasonText("");
    } catch (err) {
      console.error("Failed to reject time logs:", err);
    }
  };

  const handleSubmitTimesheet = () => {
    if (selectedLogIds.length === 0) return;
    setUserGroups((prevGroups) =>
      prevGroups.map((g) => ({
        ...g,
        timeLogs: g.timeLogs.map((l) =>
          selectedLogIds.includes(l.id)
            ? { ...l, approvalStatus: "Pending" }
            : l
        ),
      }))
    );
    setSelectedLogIds([]);
  };

  const handleDeleteSelected = async () => {
    if (selectedLogIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedLogIds.length} selected time logs?`)) return;
    try {
      for (const logId of selectedLogIds) {
        await deleteTimeLogAction(logId);
      }
      setUserGroups((prevGroups) =>
        prevGroups.map((g) => ({
          ...g,
          timeLogs: g.timeLogs.filter((l) => !selectedLogIds.includes(l.id)),
        }))
      );
      setSelectedLogIds([]);
    } catch (err) {
      console.error("Failed to delete time logs:", err);
    }
  };

  const handleDeleteSingleLog = async (logId: string) => {
    if (!confirm("Are you sure you want to delete this time log?")) return;
    try {
      await deleteTimeLogAction(logId);
      setUserGroups((prevGroups) =>
        prevGroups.map((g) => ({
          ...g,
          timeLogs: g.timeLogs.filter((l) => l.id !== logId),
        }))
      );
    } catch (err) {
      console.error("Failed to delete time log:", err);
    }
  };

  const handleOpenAddModalForDate = (dateStr: string) => {
    setModalTargetDate(dateStr);
    setShowAddLogModal(true);
  };

  // Duration helpers
  const parseDurationMinutes = (duration: string): number => {
    const match = duration.match(/(\d+):(\d+)/);
    if (!match) return 0;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  };

  const formatMinutes = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} h`;
  };

  const formatMinutesShort = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const normalizeDateStr = (dateStr: string): string => {
    if (!dateStr) return "Today";
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = dateStr.split("-");
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  };

  // Extract all logs for calculation and filtering
  const rawAllLogs = userGroups.flatMap((g) =>
    g.timeLogs.map((l) => ({
      ...l,
      userName:
        l.userName && l.userName !== "User"
          ? l.userName
          : g.userName && g.userName !== "User"
          ? g.userName
          : "test",
    }))
  );

  // Applied Filtering
  const filteredAllLogs = rawAllLogs.filter((l) => {
    if (filterUser !== "ALL" && l.userName.toLowerCase() !== filterUser.toLowerCase()) return false;
    if (filterProject !== "ALL" && l.project.toLowerCase() !== filterProject.toLowerCase()) return false;
    if (filterBilling !== "ALL" && l.billingType !== filterBilling) return false;
    if (filterStatus !== "ALL" && (l.approvalStatus || "Pending") !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = l.title.toLowerCase().includes(q);
      const matchCode = l.code.toLowerCase().includes(q);
      const matchRemarks = l.remarks.toLowerCase().includes(q);
      if (!matchTitle && !matchCode && !matchRemarks) return false;
    }
    return true;
  });

  const billableMinutes = filteredAllLogs
    .filter((l) => l.billingType === "BILLABLE")
    .reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);

  const nonBillableMinutes = filteredAllLogs
    .filter((l) => l.billingType !== "BILLABLE")
    .reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);

  const pendingApprovalsCount = filteredAllLogs.filter(
    (l) => (l.approvalStatus || "Pending") === "Pending"
  ).length;

  const totalMinutesAll = billableMinutes + nonBillableMinutes;
  const billablePercentage = totalMinutesAll > 0 ? Math.round((billableMinutes / totalMinutesAll) * 100) : 0;

  // Real "Group By Date" data
  const dateGroupsData = React.useMemo(() => {
    const byDate = new Map<
      string,
      { date: string; logs: (TimeLogEntry & { userName: string })[] }
    >();
    for (const log of filteredAllLogs) {
      const normalizedDate = normalizeDateStr(log.date);
      if (!byDate.has(normalizedDate)) byDate.set(normalizedDate, { date: normalizedDate, logs: [] });
      byDate.get(normalizedDate)!.logs.push({ ...log, date: normalizedDate });
    }
    return Array.from(byDate.values())
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((g) => {
        const billable = g.logs
          .filter((l) => l.billingType === "BILLABLE")
          .reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);
        const nonBillable = g.logs
          .filter((l) => l.billingType !== "BILLABLE")
          .reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);
        return {
          date: g.date,
          totalHours: formatMinutesShort(billable + nonBillable),
          billableHours: formatMinutesShort(billable),
          nonBillableHours: formatMinutesShort(nonBillable),
          logs: g.logs,
        };
      });
  }, [filteredAllLogs]);

  // Unique list options for filters
  const uniqueUsers = Array.from(new Set(rawAllLogs.map((l) => l.userName)));
  const uniqueProjects = Array.from(new Set(rawAllLogs.map((l) => l.project)));

  const handleExportCSV = () => {
    const headers = "Log ID,User,Project,Task Code,Task Title,Date,Time Period,Duration,Billing Type,Approval Status,Remarks\n";
    const rows = filteredAllLogs
      .map(
        (l) =>
          `"${l.code || l.id}","${l.userName}","${l.project}","${l.taskCode || ""}","${l.title}","${l.date}","${l.timePeriod}","${l.duration}","${l.billingType}","${l.approvalStatus || "Pending"}","${(l.remarks || "").replace(/"/g, '""')}"`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `timesheet-export-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden relative text-xs">
      {/* ── Top App Title Bar with Role Switcher (Commented out per user request) ────────────────
      <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-card text-card-foreground shadow-2xs">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold tracking-wide text-foreground">
            Time Logs
          </h1>
          <span className="text-muted-foreground">•</span>
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/50 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setRoleMode("ADMIN");
                setTimeSheetView("All Time Logs");
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
                roleMode === "ADMIN"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck size={13} />
              <span>Admin View</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleMode("USER");
                setTimeSheetView("My Time Logs");
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
                roleMode === "USER"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCheck size={13} />
              <span>User View</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card hover:bg-accent px-3 py-1.5 text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-2xs"
            title="Export filtered logs to CSV"
          >
            <FileSpreadsheet size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card hover:bg-accent px-3 py-1.5 text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-2xs"
          >
            <BarChart3 size={14} className="text-primary" />
            <span>Generate Report</span>
          </button>
        </div>
      </div>
      ────────────────────────────────────────────────────────────────────────────────────────── */}

      {/* ── Active Running Timer Indicator Banner ──────────────── */}
      {runningTimer && (
        <div className="flex items-center justify-between bg-primary/10 border-b border-primary/30 px-6 py-2.5 text-xs text-foreground animate-in slide-in-from-top-1">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Active Running Timer:</span>
              <span className="font-bold text-primary">{runningTimer.taskTitle}</span>
              <span className="text-muted-foreground">({runningTimer.project})</span>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono">
            <span className="text-sm font-bold text-foreground">
              {formatMinutesShort(Math.floor(runningTimer.elapsedSeconds / 60))}:{String(runningTimer.elapsedSeconds % 60).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={handleStopGlobalTimer}
              className="flex items-center gap-1 px-3 py-1 rounded bg-destructive text-destructive-foreground font-bold hover:bg-destructive/90 transition-colors shadow-2xs cursor-pointer"
            >
              <Square size={11} fill="currentColor" />
              <span>Stop Timer</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Admin Dashboard Summary Cards (Commented out per user request) ────────────────
      {roleMode === "ADMIN" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3 border-b border-border bg-muted/20">
          <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Hours Logged
              </span>
              <span className="text-base font-extrabold text-foreground font-mono mt-0.5 block">
                {formatMinutes(totalMinutesAll)}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Clock size={16} />
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Billable Ratio
              </span>
              <span className="text-base font-extrabold text-info font-mono mt-0.5 block">
                {billablePercentage}% <span className="text-xs font-normal text-muted-foreground">({formatMinutes(billableMinutes)})</span>
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-info/10 flex items-center justify-center text-info">
              <TrendingUp size={16} />
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Non-Billable Hours
              </span>
              <span className="text-base font-extrabold text-warning font-mono mt-0.5 block">
                {formatMinutes(nonBillableMinutes)}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center text-warning">
              <Clock size={16} />
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Pending Approvals
              </span>
              <span className="text-base font-extrabold text-amber-500 font-mono mt-0.5 block">
                {pendingApprovalsCount} Logs
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <ShieldCheck size={16} />
            </div>
          </div>
        </div>
      )}
      ────────────────────────────────────────────────────────────────────────────────────────── */}

      {/* ── Secondary Control Bar (Breadcrumbs, Date Range & Actions) ──────────── */}
      <div className="flex flex-wrap items-center justify-between border-b border-border px-6 py-2.5 bg-muted/40 text-foreground gap-3">
        {/* Left Sub-Nav Filters */}
        <div className="flex items-center gap-2 text-xs">
          {/* Group By Select */}
          <div className="relative inline-flex items-center gap-1 text-primary font-semibold cursor-pointer hover:underline">
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
              className="bg-transparent text-primary font-semibold outline-none cursor-pointer appearance-none pr-4"
            >
              <option value="Group By Date" className="bg-card text-foreground">Group By Date</option>
              <option value="Group By User" className="bg-card text-foreground">Group By User</option>
              <option value="Group By Project" className="bg-card text-foreground">Group By Project</option>
            </select>
            <ChevronDown size={14} className="text-primary pointer-events-none -ml-3" />
          </div>

          <span className="text-muted-foreground font-bold">&gt;</span>

          {/* Time Sheet View Select */}
          <div className="relative inline-flex items-center gap-1 text-primary font-semibold cursor-pointer hover:underline">
            <select
              value={timeSheetView}
              onChange={(e) => setTimeSheetView(e.target.value as typeof timeSheetView)}
              className="bg-transparent text-primary font-semibold outline-none cursor-pointer appearance-none pr-4"
            >
              <option value="My Time Logs" className="bg-card text-foreground">My Time Logs</option>
              <option value="All Time Logs" className="bg-card text-foreground">All Time Logs</option>
              <option value="Team Time Logs" className="bg-card text-foreground">Team Time Logs</option>
            </select>
            <ChevronDown size={14} className="text-primary pointer-events-none -ml-3" />
          </div>
        </div>

        {/* Center Date Range Navigator */}
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground bg-card border border-border px-3 py-1 rounded-md shadow-2xs">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Previous Week"
          >
            <ChevronLeft size={14} />
          </button>
          <CalendarIcon size={13} className="text-primary" />
          <span>{dateRangeStr}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Next Week"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Right Action Buttons & Batch Operations */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* Selected Action Buttons */}
          {selectedLogIds.length > 0 && (
            <div className="flex items-center gap-1.5 animate-in fade-in-0 duration-150 pr-2 border-r border-border">
              <span className="text-[11px] font-bold text-muted-foreground mr-1">
                {selectedLogIds.length} Selected:
              </span>
              {roleMode === "ADMIN" ? (
                <>
                  <button
                    type="button"
                    onClick={handleApproveSelected}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
                  >
                    <CheckCircle2 size={13} />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectionModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
                  >
                    <XCircle size={13} />
                    <span>Reject</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitTimesheet}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
                >
                  <CheckCircle2 size={13} />
                  <span>Submit Approval</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                title="Delete Selected Logs"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          {/* Add Time Log Split Button */}
          <div className="inline-flex rounded bg-primary text-primary-foreground shadow-xs font-semibold overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAddLogModal(true)}
              className="px-3.5 py-1 text-xs hover:bg-primary/90 transition-colors border-r border-primary-foreground/20 cursor-pointer"
            >
              Add Time Log
            </button>
            <button
              type="button"
              onClick={() => setShowAddLogModal(true)}
              className="px-2 py-1 hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Filter Icon */}
          <button
            type="button"
            onClick={() => setShowFilterBar(!showFilterBar)}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              showFilterBar || filterUser !== "ALL" || filterProject !== "ALL" || filterBilling !== "ALL" || filterStatus !== "ALL"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            }`}
            title="Toggle Filters"
          >
            <Filter size={15} />
          </button>
        </div>
      </div>

      {/* ── Expandable Filter Bar ────────────────────────────────────────── */}
      {showFilterBar && (
        <div className="flex flex-wrap items-center gap-3 px-6 py-2.5 bg-card border-b border-border text-xs animate-in slide-in-from-top-2 duration-150">
          <div className="relative flex-1 min-w-[160px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, code, remarks..."
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">User:</span>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="rounded border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground cursor-pointer"
            >
              <option value="ALL">All Users</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">Project:</span>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="rounded border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground cursor-pointer"
            >
              <option value="ALL">All Projects</option>
              {uniqueProjects.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">Billing:</span>
            <select
              value={filterBilling}
              onChange={(e) => setFilterBilling(e.target.value)}
              className="rounded border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="BILLABLE">BILLABLE</option>
              <option value="NON BILLABLE">NON BILLABLE</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {(filterUser !== "ALL" || filterProject !== "ALL" || filterBilling !== "ALL" || filterStatus !== "ALL" || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setFilterUser("ALL");
                setFilterProject("ALL");
                setFilterBilling("ALL");
                setFilterStatus("ALL");
                setSearchQuery("");
              }}
              className="text-xs text-destructive hover:underline font-semibold cursor-pointer ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* ── Main Data Table (Group By Date View) ─────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
        {groupBy === "Group By Date" ? (
          <table className="w-full text-left text-xs border-collapse rounded-lg overflow-hidden border border-border bg-card shadow-2xs">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-muted-foreground font-semibold">
                <th className="py-2.5 px-3 border-r border-border w-10 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <ChevronDown size={13} className="text-muted-foreground" />
                    <input
                      type="checkbox"
                      className="rounded border-input bg-background text-primary h-3.5 w-3.5"
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap text-foreground font-bold">
                  ID
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap min-w-[170px] text-foreground font-bold">
                  Log Title
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap min-w-[140px] text-foreground font-bold">
                  <div className="flex items-center gap-1.5">
                    <Folder size={13} className="text-muted-foreground" />
                    <span>Project</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap text-foreground font-bold">
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-muted-foreground" />
                    <span>Daily Log Hours</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap text-foreground font-bold">
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-muted-foreground" />
                    <span>Time Period</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap min-w-[140px] text-foreground font-bold">
                  <div className="flex items-center gap-1.5">
                    <UserIcon size={13} className="text-muted-foreground" />
                    <span>User</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap text-foreground font-bold">
                  Billing Type
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap text-foreground font-bold">
                  Approval Status
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap text-foreground font-bold text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {dateGroupsData.map((group) => {
                const isCollapsed = collapsedDates[group.date];

                return (
                  <React.Fragment key={group.date}>
                    {/* Date Header Row - Adaptive Theme Styling */}
                    <tr className="bg-muted/80 font-bold border-b border-border text-foreground hover:bg-muted transition-colors">
                      <td className="py-2.5 px-3 border-r border-border text-center">
                        <button
                          type="button"
                          onClick={() => toggleDateCollapse(group.date)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isCollapsed ? (
                            <ChevronRight size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                      </td>
                      <td colSpan={3} className="py-2.5 px-4 border-r border-border font-bold text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CalendarIcon size={14} className="text-muted-foreground" />
                          <span className="text-foreground font-bold">{group.date}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 border-r border-border font-mono font-bold whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-foreground font-bold">{group.totalHours}</span>
                          <span className="text-info font-bold">{group.billableHours}</span>
                          <span className="text-warning font-bold">{group.nonBillableHours}</span>
                        </div>
                      </td>
                      <td colSpan={5} className="py-2.5 px-4" />
                    </tr>

                    {!isCollapsed && (
                      <>
                        {/* Quick Add Time Log Row Under Date */}
                        <tr className="border-b border-border bg-muted/20 hover:bg-accent/40 transition-colors">
                          <td className="py-2 px-3 border-r border-border text-center" />
                          <td
                            colSpan={9}
                            onClick={() => handleOpenAddModalForDate(group.date)}
                            className="py-2 px-4 text-muted-foreground text-[11px] font-medium cursor-pointer hover:text-primary transition-colors flex items-center justify-between"
                          >
                            <span>Add Time Log</span>
                            <Plus size={14} className="text-primary" />
                          </td>
                        </tr>

                        {/* Log Rows */}
                        {group.logs.map((log) => (
                          <tr
                            key={log.id}
                            className="hover:bg-accent/20 transition-colors border-b border-border bg-card text-foreground"
                          >
                            <td className="py-2.5 px-3 border-r border-border text-center">
                              <input
                                type="checkbox"
                                checked={selectedLogIds.includes(log.id)}
                                onChange={() => handleToggleSelectLog(log.id)}
                                className="rounded border-input bg-background text-primary h-3.5 w-3.5"
                              />
                            </td>

                            <td className="py-2.5 px-4 border-r border-border font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                              {log.code}
                            </td>

                            <td className="py-2.5 px-4 border-r border-border font-semibold text-foreground whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <ClipboardList size={14} className="text-muted-foreground shrink-0" />
                                <span>{log.title}</span>
                              </div>
                            </td>

                            <td className="py-2.5 px-4 border-r border-border text-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Folder size={14} className="text-muted-foreground shrink-0" />
                                <span>{log.project}</span>
                              </div>
                            </td>

                            <td className="py-2.5 px-4 border-r border-border font-mono font-bold text-foreground whitespace-nowrap">
                              {log.duration}
                            </td>

                            <td className="py-2.5 px-4 border-r border-border font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                              {log.timePeriod}
                            </td>

                            {/* User Column */}
                            <td className="py-2.5 px-4 border-r border-border whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground text-[11px]">↑</span>
                                <span className="font-semibold text-foreground">
                                  {log.userName}
                                </span>
                              </div>
                            </td>

                            {/* Billing Type Column */}
                            <td className="py-2.5 px-4 border-r border-border whitespace-nowrap">
                              <span
                                className={`font-semibold ${log.billingType === "BILLABLE"
                                    ? "text-info"
                                    : "text-warning"
                                  }`}
                              >
                                {log.billingType}
                              </span>
                            </td>

                            {/* Approval Status Column */}
                            <td className="py-2.5 px-4 border-r border-border whitespace-nowrap">
                              {log.approvalStatus === "Approved" ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold">
                                  <CheckCircle2 size={12} /> Approved
                                </span>
                              ) : log.approvalStatus === "Rejected" ? (
                                <span
                                  title={log.rejectionReason ? `Reason: ${log.rejectionReason}` : "Rejected"}
                                  className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2.5 py-0.5 text-[11px] font-bold cursor-help"
                                >
                                  <XCircle size={12} /> Rejected
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold">
                                  <Clock size={12} /> Pending Approval
                                </span>
                              )}
                            </td>

                            {/* Actions Column */}
                            <td className="py-2.5 px-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingLog(log);
                                    setIsEditModalOpen(true);
                                  }}
                                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                  title="Edit Time Log"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSingleLog(log.id)}
                                  className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Delete Time Log"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* Mode: Group By User */
          <table className="w-full text-left text-xs border-collapse rounded-lg overflow-hidden border border-border bg-card shadow-2xs">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-muted-foreground font-semibold">
                <th className="py-3 px-3 border-r border-border w-10 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-input text-primary h-3.5 w-3.5 cursor-pointer"
                    onChange={(e) => handleSelectAllLogs(filteredAllLogs)}
                  />
                </th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap">ID</th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap min-w-[160px]">
                  LOG TITLE
                </th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap min-w-[140px]">
                  PROJECT
                </th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap">
                  DAILY LOG HOURS
                </th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap">
                  TIME PERIOD
                </th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap">DATE</th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap">
                  BILLING TYPE
                </th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap min-w-[140px]">
                  APPROVAL STATUS
                </th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[160px]">REMARKS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {userGroups.map((group) => {
                const [totalStr, billableStr, nonBillableStr] = group.dailyLogHours.split(" | ");
                return (
                <React.Fragment key={group.userId}>
                  <tr className="bg-muted/80 hover:bg-muted transition-colors font-medium">
                    <td className="py-3 px-3 border-r border-border text-center">
                      <button
                        type="button"
                        onClick={() => toggleDateCollapse(group.userId)}
                        className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                      >
                        {collapsedDates[group.userId] ? (
                          <ChevronRight size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </td>

                    <td colSpan={3} className="py-3 px-4 border-r border-border font-bold text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <UserIcon size={14} className="text-muted-foreground" />
                        <span className="text-foreground font-bold">{group.userName}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 border-r border-border font-mono font-bold whitespace-nowrap">
                      <span className="text-foreground">{totalStr}</span> |{" "}
                      <span className="text-info">{billableStr}</span> |{" "}
                      <span className="text-warning">{nonBillableStr}</span>
                    </td>

                    <td colSpan={5} className="py-3 px-4" />
                  </tr>

                  {!collapsedDates[group.userId] && (
                    <>
                      {group.timeLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-accent/30 transition-colors border-b border-border text-foreground"
                        >
                          <td className="py-3 px-3 border-r border-border text-center">
                            <input
                              type="checkbox"
                              checked={selectedLogIds.includes(log.id)}
                              onChange={() => handleToggleSelectLog(log.id)}
                              className="rounded border-input text-primary h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>

                          <td className="py-3 px-4 border-r border-border font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                            {log.code}
                          </td>

                          <td className="py-3 px-4 border-r border-border font-semibold text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <ClipboardList size={14} className="text-muted-foreground" />
                              <span>{log.title}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 border-r border-border text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Folder size={14} className="text-muted-foreground" />
                              <span>{log.project}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 border-r border-border font-mono font-bold text-foreground whitespace-nowrap">
                            {log.duration}
                          </td>

                          <td className="py-3 px-4 border-r border-border font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {log.timePeriod}
                          </td>

                          <td className="py-3 px-4 border-r border-border font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {log.date}
                          </td>

                          <td className="py-3 px-4 border-r border-border whitespace-nowrap">
                            <span className={`font-semibold ${log.billingType === "BILLABLE" ? "text-info" : "text-warning"}`}>
                              {log.billingType}
                            </span>
                          </td>

                          <td className="py-3 px-4 border-r border-border whitespace-nowrap">
                            {log.approvalStatus === "Approved" ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold">
                                <CheckCircle2 size={12} /> Approved
                              </span>
                            ) : log.approvalStatus === "Rejected" ? (
                              <span
                                title={log.rejectionReason ? `Reason: ${log.rejectionReason}` : "Rejected"}
                                className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2.5 py-0.5 text-[11px] font-bold cursor-help"
                              >
                                <XCircle size={12} /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold">
                                <Clock size={12} /> Pending Approval
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap max-w-[220px] truncate" title={log.remarks}>
                            {log.remarks || "—"}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Bottom Summary Footer Bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-border px-6 py-2.5 bg-muted/40 text-xs font-semibold shrink-0 text-foreground">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-muted-foreground font-normal">Billable</span>{" "}
            <strong className="text-info ml-1 font-bold">{formatMinutes(billableMinutes)}</strong>
          </div>

          <div className="h-4 w-px bg-border" />

          <div>
            <span className="text-muted-foreground font-normal">Non Billable</span>{" "}
            <strong className="text-warning ml-1 font-bold">{formatMinutes(nonBillableMinutes)}</strong>
          </div>

          <div className="h-4 w-px bg-border" />

          <div>
            <span className="text-muted-foreground font-normal">Total</span>{" "}
            <strong className="text-foreground ml-1 font-bold">{formatMinutes(billableMinutes + nonBillableMinutes)}</strong>
          </div>
        </div>

        <div className="text-muted-foreground font-normal">
          Total Count: <strong className="text-foreground font-semibold">{filteredAllLogs.length}</strong>
        </div>
      </div>

      {/* Add Time Log Modal Dialog */}
      <NewTimeLogModal
        isOpen={showAddLogModal}
        onClose={() => setShowAddLogModal(false)}
        initialProject={modalTargetProject}
        projectId={projectId}
        projectName={projectName}
        assignedUsers={assignedUsers}
        onLogAdded={(newLog) => {
          console.log("New Log Added:", newLog);
        }}
      />

      {/* Generate Time Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 font-sans text-xs">
            <div className="flex items-center justify-between border-b pb-3 border-border">
              <div className="flex items-center gap-2">
                <BarChart3 size={20} className="text-primary" />
                <h3 className="text-base font-bold text-foreground">Time Tracking Productivity & Billing Report</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-muted/30 border border-border">
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Total Logged Time</span>
                <span className="text-sm font-bold text-foreground font-mono">{formatMinutes(totalMinutesAll)}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Billable Ratio</span>
                <span className="text-sm font-bold text-info font-mono">{billablePercentage}% ({formatMinutes(billableMinutes)})</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Non-Billable Time</span>
                <span className="text-sm font-bold text-warning font-mono">{formatMinutes(nonBillableMinutes)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-foreground">Project Time Distribution</h4>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {uniqueProjects.map((p) => {
                  const pLogs = filteredAllLogs.filter((l) => l.project === p);
                  const pMinutes = pLogs.reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);
                  const pBillable = pLogs.filter((l) => l.billingType === "BILLABLE").reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);
                  return (
                    <div key={p} className="flex items-center justify-between p-2.5">
                      <span className="font-semibold text-foreground">{p}</span>
                      <div className="flex items-center gap-3 font-mono font-bold">
                        <span className="text-foreground">{formatMinutes(pMinutes)}</span>
                        <span className="text-info text-[11px]">({formatMinutes(pBillable)} Billable)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-accent font-semibold text-foreground cursor-pointer"
              >
                <Printer size={14} />
                <span>Print Report</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Input Modal */}
      {showRejectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4 font-sans text-xs">
            <div className="flex items-center justify-between border-b pb-2 border-border">
              <h3 className="text-sm font-bold text-foreground">Reject Selected Timesheets</h3>
              <button
                type="button"
                onClick={() => setShowRejectionModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">Rejection Reason</label>
              <textarea
                rows={3}
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                placeholder="Provide a reason for rejecting the timesheet..."
                className="w-full rounded-lg border border-input bg-background p-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectionModal(false)}
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSelected}
                className="px-4 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Time Log Modal */}
      <EditTimeLogModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingLog(null);
        }}
        log={editingLog}
        isAdmin={roleMode === "ADMIN"}
        onLogUpdated={() => {
          if (editingLog) {
            setUserGroups((prevGroups) =>
              prevGroups.map((g) => ({
                ...g,
                timeLogs: g.timeLogs.map((l) =>
                  l.id === editingLog.id ? { ...l, ...editingLog } : l
                ),
              }))
            );
          }
        }}
      />
    </div>
  );
}
