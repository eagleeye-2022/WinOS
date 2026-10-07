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
  Share2,
} from "lucide-react";
import { UserTimeGroup, TimeLogEntry } from "../../types";
import { TimerWidget } from "../timer-widget";
import { ActiveTeamTimersCard } from "../active-team-timers-card";
import { NewTimeLogModal } from "../modals/new-time-log-modal";
import { ShareTimesheetModal } from "../modals/share-timesheet-modal";
import {
  parseDurationMinutes,
  formatDurationDisplay,
  formatTimePeriodRange,
  calculateMinutesFromTimeRange,
  formatTime12h,
  compareTimeLogsLatestFirst,
} from "../../utils/time-helpers";
import {
  updateTimeLogAction,
  deleteTimeLogAction,
  approveTimeLogsAction,
  rejectTimeLogsAction,
  createTimeLogAction,
  getTimeLogsAction,
  getCurrentUserRoleAction,
} from "../../actions/project-actions";
import { toast } from "@/components/shared/toast";
import { useConfirm } from "@/components/shared/confirm-dialog";

interface TimeTrackerViewProps {
  initialGroups: UserTimeGroup[];
  projectId?: string;
  projectName?: string;
  assignedUsers?: string[];
}

function InlineTextCell({
  value,
  onSave,
  className = "",
  placeholder = "",
  mono = false,
  title = "Click to edit inline",
}: {
  value: string;
  onSave: (val: string) => void;
  className?: string;
  placeholder?: string;
  mono?: boolean;
  title?: string;
}) {
  const [val, setVal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setVal(value);
  }

  return (
    <input
      type="text"
      value={val}
      placeholder={placeholder}
      title={title}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val !== value) {
          onSave(val);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setVal(value);
          e.currentTarget.blur();
        }
      }}
      className={`w-full bg-transparent hover:bg-muted/40 focus:bg-background focus:ring-1 focus:ring-primary rounded px-1.5 py-0.5 border border-transparent focus:border-input outline-hidden transition-all ${
        mono ? "font-mono" : ""
      } ${className}`}
    />
  );
}

export function TimeTrackerView({ initialGroups, projectId, projectName, assignedUsers }: TimeTrackerViewProps) {
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();
  const [userGroups, setUserGroups] = useState<UserTimeGroup[]>(initialGroups);
  const [prevInitialGroups, setPrevInitialGroups] = useState(initialGroups);

  if (initialGroups !== prevInitialGroups) {
    setPrevInitialGroups(initialGroups);
    setUserGroups(initialGroups);
  }

  // Role Perspective Switcher — derived from the signed-in user's real workspace role.
  const [roleMode, setRoleMode] = useState<"ADMIN" | "USER">("USER");
  const [groupBy, setGroupBy] = useState<"Group By Date" | "Group By User" | "Group By Project">("Group By User");
  const [timeSheetView, setTimeSheetView] = useState<"My Effort Logs" | "All Effort Logs" | "Team Effort Logs">("All Effort Logs");
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  useEffect(() => {
    getCurrentUserRoleAction().then((role) => {
      setRoleMode(role === "ADMIN" ? "ADMIN" : "USER");
    });
  }, []);

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

  // Share Timesheet Modal State
  const [showShareModal, setShowShareModal] = useState(false);

  // Date navigator — defaults to today; Prev/Next step one day at a time,
  // and a date picker lets the user jump straight to any day.
  const getToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(getToday);

  const formatDDMMYYYY = (date: Date): string => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${date.getFullYear()}`;
  };

  const formatYYYYMMDD = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  // Both filter bounds are the same day — kept as a pair for a minimal diff
  // against the filtering logic below.
  const currentWeekStart = selectedDate;
  const currentWeekEnd = selectedDate;

  const isToday = formatYYYYMMDD(selectedDate) === formatYYYYMMDD(getToday());

  const dateRangeStr = isToday ? `${formatDDMMYYYY(selectedDate)} (Today)` : formatDDMMYYYY(selectedDate);

  const shiftSelectedDate = (deltaDays: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + deltaDays);
      return next;
    });
  };

  const parseDDMMYYYYToDate = (dateStr: string): Date | null => {
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, dd, mm, yyyy] = match;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  };

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

  const removeLogsLocally = (ids: string[]) =>
    setUserGroups((prevGroups) =>
      prevGroups.map((g) => ({
        ...g,
        timeLogs: g.timeLogs.filter((l) => !ids.includes(l.id)),
      }))
    );

  const handleDeleteSelected = async () => {
    if (selectedLogIds.length === 0) return;
    const count = selectedLogIds.length;
    const ok = await confirmDialog({
      title: `Delete ${count} effort log${count === 1 ? "" : "s"}?`,
      description: "This can't be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;

    const deleted: string[] = [];
    const errors = new Set<string>();
    for (const logId of selectedLogIds) {
      try {
        const res = await deleteTimeLogAction(logId);
        if (res.success) deleted.push(logId);
        else errors.add(res.error || "Couldn't delete the effort log.");
      } catch (err) {
        console.error("Failed to delete time logs:", err);
        errors.add("Couldn't delete the effort log. Please try again.");
      }
    }

    removeLogsLocally(deleted);
    setSelectedLogIds((prev) => prev.filter((id) => !deleted.includes(id)));
    if (deleted.length > 0) {
      toast.success(`Deleted ${deleted.length} effort log${deleted.length === 1 ? "" : "s"}.`);
    }
    if (errors.size > 0) {
      const failed = count - deleted.length;
      toast.error(`${failed} effort log${failed === 1 ? "" : "s"} not deleted: ${[...errors].join(" ")}`);
    }
  };

  const handleInlineApprovalChange = async (logId: string, approvalStatus: "Pending" | "Approved" | "Rejected") => {
    const previousGroups = userGroups;
    setUserGroups((prevGroups) =>
      prevGroups.map((g) => ({
        ...g,
        timeLogs: g.timeLogs.map((l) => (l.id === logId ? { ...l, approvalStatus } : l)),
      }))
    );
    try {
      await updateTimeLogAction(logId, { approvalStatus });
    } catch (err) {
      console.error("Failed to update approval status:", err);
      setUserGroups(previousGroups);
    }
  };

  const isValidTimeFormat = (val: string): boolean => {
    if (!val || !val.trim()) return false;
    const trimmed = val.trim();
    const regex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s*(am|pm|AM|PM)$|^(0?[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(trimmed);
  };

  const parseTimeToMinutes = (val: string): number | null => {
    const trimmed = val.trim();
    const match12 = trimmed.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(am|pm)$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = parseInt(match12[2], 10);
      const period = match12[3].toLowerCase();
      if (period === "pm" && h !== 12) h += 12;
      if (period === "am" && h === 12) h = 0;
      return h * 60 + m;
    }
    const match24 = trimmed.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);
    if (match24) {
      return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
    }
    return null;
  };

  const isValidDurationFormat = (val: string): boolean => {
    if (!val || !val.trim()) return false;
    const trimmed = val.trim();
    const regex = /^(\d+):([0-5][0-9])$|^(\d+(\.\d+)?)$/;
    return regex.test(trimmed);
  };

  const handleInlineFieldChange = async (
    logId: string,
    field: keyof TimeLogEntry,
    value: string
  ) => {
    const previousGroups = userGroups;
    const updatePayload: Partial<TimeLogEntry> = { [field]: value };

    if (field === "duration") {
      const trimmed = value.trim();
      if (!isValidDurationFormat(trimmed)) {
        toast.error("Invalid duration format (e.g. 00:30 or 1.5)");
        setUserGroups([...userGroups]);
        return;
      }
      const mins = parseDurationMinutes(trimmed);
      if (mins <= 0) {
        toast.error("Duration must be greater than 0.");
        setUserGroups([...userGroups]);
        return;
      }
      if (mins > 720) {
        toast.error("Time duration cannot exceed 12 hours (720 minutes).");
        setUserGroups([...userGroups]);
        return;
      }
      const formattedDur = formatDurationDisplay(mins);
      updatePayload.duration = formattedDur;
    } else if (field === "timePeriod") {
      const trimmed = value.trim();
      if (!trimmed) {
        updatePayload.timePeriod = "";
      } else if (trimmed.includes("-") || trimmed.includes("–")) {
        const parts = trimmed.split(/[-–]/).map((p) => p.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
          const startValid = isValidTimeFormat(parts[0]);
          const endValid = isValidTimeFormat(parts[1]);

          if (!startValid || !endValid) {
            toast.error("Invalid start/end time format (e.g. 10:10 AM - 10:30 AM or 10:10 - 10:30)");
            setUserGroups([...userGroups]);
            return;
          }

          const startMin = parseTimeToMinutes(parts[0]);
          const endMin = parseTimeToMinutes(parts[1]);

          if (startMin === null || endMin === null) {
            toast.error("Invalid time format (e.g. 10:10 AM - 10:30 AM)");
            setUserGroups([...userGroups]);
            return;
          }

          // Check future time if log belongs to today's date
          const targetLog = rawAllLogs.find((l) => l.id === logId);
          const logDateStr = targetLog?.date || "";
          const parsedLogDate = parseDDMMYYYYToDate(normalizeDateStr(logDateStr));
          const today = new Date();
          const isTodayLog =
            parsedLogDate &&
            parsedLogDate.getFullYear() === today.getFullYear() &&
            parsedLogDate.getMonth() === today.getMonth() &&
            parsedLogDate.getDate() === today.getDate();

          if (isTodayLog) {
            const currentMin = today.getHours() * 60 + today.getMinutes();
            if (startMin > currentMin || endMin > currentMin) {
              toast.error("Effort logging is not allowed for future dates and times.");
              setUserGroups([...userGroups]);
              return;
            }
          }

          if (endMin <= startMin) {
            toast.error("End time must be after Start time.");
            setUserGroups([...userGroups]);
            return;
          }

          const diffMinutes = endMin - startMin;
          if (diffMinutes > 720) {
            toast.error("Time duration cannot exceed 12 hours (720 minutes).");
            setUserGroups([...userGroups]);
            return;
          }

          const rangeStr = formatTimePeriodRange(parts[0], parts[1]);
          if (rangeStr) updatePayload.timePeriod = rangeStr;
          updatePayload.duration = formatDurationDisplay(diffMinutes);
        } else {
          toast.error("Please enter a valid time range (e.g. 10:10 AM - 10:30 AM)");
          setUserGroups([...userGroups]);
          return;
        }
      } else {
        toast.error("Please separate start and end time with a hyphen (e.g. 10:10 AM - 10:30 AM)");
        setUserGroups([...userGroups]);
        return;
      }
    }

    setUserGroups((prevGroups) =>
      prevGroups.map((g) => ({
        ...g,
        timeLogs: g.timeLogs.map((l) => (l.id === logId ? { ...l, ...updatePayload } : l)),
      }))
    );
    try {
      await updateTimeLogAction(logId, updatePayload);
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
      toast.error(`Failed to update ${field}.`);
      setUserGroups(previousGroups);
    }
  };

  const handleAddInlineTimeLog = async (dateStr?: string) => {
    const targetDate = dateStr || new Date().toISOString().split("T")[0];
    const now = new Date();
    const oneMinAgo = new Date(now.getTime() - 60000);
    const timePeriodStr = `${formatTime12h(oneMinAgo)} – ${formatTime12h(now)}`;
    try {
      const createdLog = await createTimeLogAction(
        {
          title: "Logged Work",
          project: projectName || "Project",
          duration: "00:01",
          timePeriod: timePeriodStr,
          date: targetDate,
          billingType: "BILLABLE",
          approvalStatus: "Pending",
          remarks: "",
        },
        projectId
      );

      setUserGroups((prev) => {
        const next = [...prev];
        if (next.length > 0) {
          next[0] = {
            ...next[0],
            timeLogs: [createdLog, ...next[0].timeLogs],
          };
        } else {
          next.push({
            userId: createdLog.userId || "user-1",
            userName: createdLog.userName || "User",
            userInitials: createdLog.userInitials || "US",
            avatarColor: "bg-primary text-primary-foreground",
            dailyLogHours: "00:01 | 00:01 | 00:00",
            timeLogs: [createdLog],
          });
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to add inline time log:", err);
    }
  };

  const handleDeleteSingleLog = async (logId: string) => {
    const ok = await confirmDialog({
      title: "Delete effort log?",
      description: "This can't be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      const res = await deleteTimeLogAction(logId);
      if (!res.success) {
        toast.error(res.error || "Couldn't delete the effort log.");
        return;
      }
      removeLogsLocally([logId]);
      setSelectedLogIds((prev) => prev.filter((id) => id !== logId));
      toast.success("Effort log deleted.");
    } catch (err) {
      console.error("Failed to delete time log:", err);
      toast.error("Couldn't delete the effort log. Please try again.");
    }
  };

  const handleOpenAddModalForDate = (dateStr: string) => {
    setModalTargetDate(dateStr);
    setShowAddLogModal(true);
  };

  const handleLogAdded = async (newLog: TimeLogEntry) => {
    setShowAddLogModal(false);
    setModalTargetDate("");

    // 1. Optimistic update: instantly insert the new log into the state
    setUserGroups((prevGroups) => {
      const nextGroups = prevGroups.map((g) => ({
        ...g,
        timeLogs: [...g.timeLogs],
      }));
      const userTargetName = newLog.userName || "User";
      const userGroupIndex = nextGroups.findIndex(
        (g) =>
          (newLog.userId && g.userId === newLog.userId) ||
          (g.userName && g.userName.toLowerCase() === userTargetName.toLowerCase())
      );

      if (userGroupIndex >= 0) {
        nextGroups[userGroupIndex].timeLogs = [
          newLog,
          ...nextGroups[userGroupIndex].timeLogs.filter((l) => l.id !== newLog.id),
        ];
      } else if (nextGroups.length > 0) {
        nextGroups[0].timeLogs = [
          newLog,
          ...nextGroups[0].timeLogs.filter((l) => l.id !== newLog.id),
        ];
      } else {
        nextGroups.push({
          userId: newLog.userId || `u-${Date.now()}`,
          userName: userTargetName,
          userInitials:
            newLog.userInitials ||
            userTargetName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase(),
          avatarColor: "bg-primary text-primary-foreground",
          dailyLogHours: "00:00 | 00:00 | 00:00",
          timeLogs: [newLog],
        });
      }
      return nextGroups;
    });

    // 2. If the user created a log for a different date, switch the calendar day so it is immediately visible
    if (newLog.date) {
      const parsedDate = parseDDMMYYYYToDate(normalizeDateStr(newLog.date));
      if (parsedDate) {
        setSelectedDate(parsedDate);
      }
    }

    // 3. Re-fetch the full canonical time logs from the server in background to ensure 100% sync
    try {
      const freshGroups = await getTimeLogsAction(projectId);
      if (freshGroups && Array.isArray(freshGroups)) {
        setUserGroups(freshGroups);
      }
    } catch (err) {
      console.error("Failed to re-fetch time logs after adding:", err);
    }
  };

  const handleLogUpdated = async (updatedLog: TimeLogEntry) => {
    setShowAddLogModal(false);
    setEditingLog(null);

    // 1. Instant optimistic state update
    setUserGroups((prevGroups) =>
      prevGroups.map((g) => ({
        ...g,
        timeLogs: g.timeLogs.map((l) => (l.id === updatedLog.id ? { ...l, ...updatedLog } : l)),
      }))
    );

    // 2. Refresh canonical from server in background
    try {
      const freshGroups = await getTimeLogsAction(projectId);
      if (freshGroups && Array.isArray(freshGroups)) {
        setUserGroups(freshGroups);
      }
    } catch (err) {
      console.error("Failed to re-fetch time logs after update:", err);
    }
  };

  // Duration helpers
  const parseDurationMinutesLocal = (duration: string): number => {
    return parseDurationMinutes(duration);
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
    const normalizedLogDate = parseDDMMYYYYToDate(normalizeDateStr(l.date));
    if (normalizedLogDate && (normalizedLogDate < currentWeekStart || normalizedLogDate > currentWeekEnd)) return false;
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
  }).sort(compareTimeLogsLatestFirst);

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
      .sort(compareTimeLogsLatestFirst)
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

  // Real "Group By User" / "Group By Project" data — respects the week range
  // and the active filters, unlike rendering raw `userGroups` directly.
  const filteredUserGroupsData = React.useMemo(() => {
    const byUser = new Map<string, UserTimeGroup>();
    for (const log of filteredAllLogs) {
      const key = log.userId || log.userName;
      if (!byUser.has(key)) {
        byUser.set(key, {
          userId: key,
          userName: log.userName,
          userInitials:
            log.userInitials ||
            log.userName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase(),
          avatarColor: "bg-primary text-primary-foreground",
          dailyLogHours: "00:00 | 00:00 | 00:00",
          timeLogs: [],
        });
      }
      byUser.get(key)!.timeLogs.push(log);
    }
    for (const group of byUser.values()) {
      const billable = group.timeLogs
        .filter((l) => l.billingType === "BILLABLE")
        .reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);
      const nonBillable = group.timeLogs
        .filter((l) => l.billingType !== "BILLABLE")
        .reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);
      group.dailyLogHours = `${formatMinutes(billable + nonBillable)} | ${formatMinutes(billable)} | ${formatMinutes(nonBillable)}`;
    }
    return Array.from(byUser.values());
  }, [filteredAllLogs]);

  // Real "Group By Project" data — same week range / filters, grouped by project
  const filteredProjectGroupsData = React.useMemo(() => {
    const byProject = new Map<
      string,
      { projectKey: string; projectName: string; timeLogs: (TimeLogEntry & { userName: string })[] }
    >();
    for (const log of filteredAllLogs) {
      const key = log.projectId || log.project;
      if (!byProject.has(key)) {
        byProject.set(key, { projectKey: key, projectName: log.project, timeLogs: [] });
      }
      byProject.get(key)!.timeLogs.push(log);
    }
    return Array.from(byProject.values())
      .sort((a, b) => a.projectName.localeCompare(b.projectName))
      .map((group) => {
        const billable = group.timeLogs
          .filter((l) => l.billingType === "BILLABLE")
          .reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);
        const nonBillable = group.timeLogs
          .filter((l) => l.billingType !== "BILLABLE")
          .reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);
        return {
          ...group,
          dailyLogHours: `${formatMinutes(billable + nonBillable)} | ${formatMinutes(billable)} | ${formatMinutes(nonBillable)}`,
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
    <div className="flex flex-col h-full min-h-0 bg-background text-foreground overflow-hidden relative text-xs">
      {/* ── Top App Title Bar with Role Switcher (Commented out per user request) ────────────────
      <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-card text-card-foreground shadow-2xs">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold tracking-wide text-foreground">
            Effort Logs
          </h1>
          <span className="text-muted-foreground">•</span>
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/50 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setRoleMode("ADMIN");
                setTimeSheetView("All Effort Logs");
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
                setTimeSheetView("My Effort Logs");
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

      {/* ── Real-Time Active Team Timers Live Monitoring Card ──────────────── */}
      {/* {roleMode === "ADMIN" && (
        <div className="px-6 py-3 border-b border-border bg-muted/10">
          <ActiveTeamTimersCard projectId={projectId} />
        </div>
      )} */}

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

          {/* <span className="text-muted-foreground font-bold">&gt;</span> */}

          {/* Time Sheet View Select */}
          {/* <div className="relative inline-flex items-center gap-1 text-primary font-semibold cursor-pointer hover:underline">
            <select
              value={timeSheetView}
              onChange={(e) => setTimeSheetView(e.target.value as typeof timeSheetView)}
              className="bg-transparent text-primary font-semibold outline-none cursor-pointer appearance-none pr-4"
            >
              <option value="My Effort Logs" className="bg-card text-foreground">My Effort Logs</option>
              <option value="All Effort Logs" className="bg-card text-foreground">All Effort Logs</option>
              <option value="Team Effort Logs" className="bg-card text-foreground">Team Effort Logs</option>
            </select>
            <ChevronDown size={14} className="text-primary pointer-events-none -ml-3" />
          </div> */}
        </div>

        {/* Center Date Navigator — day view, defaults to today */}
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground bg-card border border-border px-3 py-1 rounded-md shadow-2xs">
          <button
            type="button"
            onClick={() => shiftSelectedDate(-1)}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft size={14} />
          </button>
          <label className="relative flex items-center gap-1.5 cursor-pointer">
            <CalendarIcon size={13} className="text-primary pointer-events-none" />
            <span>{dateRangeStr}</span>
            <input
              type="date"
              value={formatYYYYMMDD(selectedDate)}
              onChange={(e) => {
                if (!e.target.value) return;
                const [y, m, d] = e.target.value.split("-").map(Number);
                setSelectedDate(new Date(y, m - 1, d));
              }}
              className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
              title="Pick a date"
            />
          </label>
          <button
            type="button"
            onClick={() => shiftSelectedDate(1)}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Next Day"
          >
            <ChevronRight size={14} />
          </button>
          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(getToday())}
              className="ml-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
              title="Jump to today"
            >
              Today
            </button>
          )}
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

          {/* Share the selected day's own time logs via a public link */}
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 rounded border border-border bg-card hover:bg-accent px-3 py-1 text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-2xs"
            title="Share your effort logs for this day via a link"
          >
            <Share2 size={13} className="text-primary" />
            <span>Share</span>
          </button>

          {/* Add Time Log Split Button */}
          <div className="inline-flex rounded bg-primary text-primary-foreground shadow-xs font-semibold overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAddLogModal(true)}
              className="px-3.5 py-1 text-xs hover:bg-primary/90 transition-colors border-r border-primary-foreground/20 cursor-pointer"
            >
              Add Effort Log
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
      <div className="dsm-columns-scrollbar flex-1 overflow-x-auto overflow-y-auto p-4">
        {groupBy === "Group By Date" ? (
          <table className="w-full min-w-[1300px] text-left text-xs border-collapse rounded-lg overflow-hidden border border-border bg-card shadow-2xs">
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
                  Task ID
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
                            onClick={() => handleAddInlineTimeLog(group.date)}
                            className="py-2 px-4 text-muted-foreground text-[11px] font-medium cursor-pointer hover:text-primary transition-colors flex items-center justify-between"
                          >
                            <div className="flex items-center gap-1.5 text-primary font-semibold">
                              <Plus size={14} />
                              <span>Add Effort Log</span>
                            </div>
                            {/* <span className="text-[10px] text-muted-foreground font-normal">Click to add new inline editable row</span> */}
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
                                className="rounded border-input bg-background text-primary h-3.5 w-3.5 cursor-pointer"
                              />
                            </td>

                            <td className="py-2.5 px-4 border-r border-border font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                              {log.taskCode || log.code}
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

                            {/* Daily Log Hours Column — INLINE EDITABLE */}
                            <td className="py-2 px-3 border-r border-border whitespace-nowrap">
                              <InlineTextCell
                                value={log.duration}
                                onSave={(newVal) => handleInlineFieldChange(log.id, "duration", newVal)}
                                mono
                                placeholder="00:00"
                                className="font-mono font-bold text-foreground min-w-[70px]"
                                title="Click to edit Daily Log Hours inline"
                              />
                            </td>

                            {/* Time Period Column — INLINE EDITABLE */}
                            <td className="py-2 px-3 border-r border-border whitespace-nowrap">
                              <InlineTextCell
                                value={log.timePeriod}
                                onSave={(newVal) => handleInlineFieldChange(log.id, "timePeriod", newVal)}
                                mono
                                placeholder="00:00 - 00:00"
                                className="text-[11px] text-muted-foreground min-w-[110px]"
                                title="Click to edit Time Period inline"
                              />
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

                            {/* Billing Type Column — INLINE EDITABLE */}
                            <td className="py-2 px-3 border-r border-border whitespace-nowrap">
                              <select
                                value={log.billingType}
                                onChange={(e) =>
                                  handleInlineFieldChange(
                                    log.id,
                                    "billingType",
                                    e.target.value as "BILLABLE" | "NON BILLABLE"
                                  )
                                }
                                className={`rounded border border-transparent hover:border-input bg-transparent px-2 py-0.5 text-xs font-semibold cursor-pointer outline-hidden transition-all ${
                                  log.billingType === "BILLABLE" ? "text-info font-bold" : "text-warning font-bold"
                                }`}
                                title="Click to edit Billing Type inline"
                              >
                                <option value="BILLABLE" className="bg-card text-info font-bold">
                                  BILLABLE
                                </option>
                                <option value="NON BILLABLE" className="bg-card text-warning font-bold">
                                  NON BILLABLE
                                </option>
                              </select>
                            </td>

                            {/* Approval Status Column — INLINE EDITABLE */}
                            <td className="py-2 px-3 border-r border-border whitespace-nowrap">
                              <select
                                value={log.approvalStatus || "Pending"}
                                onChange={(e) =>
                                  handleInlineFieldChange(
                                    log.id,
                                    "approvalStatus",
                                    e.target.value as "Pending" | "Approved" | "Rejected"
                                  )
                                }
                                disabled={roleMode !== "ADMIN"}
                                title={
                                  roleMode !== "ADMIN"
                                    ? "Only a manager can change approval status"
                                    : "Click to change approval status inline"
                                }
                                className={`rounded-md border px-2.5 py-0.5 text-[11px] font-bold outline-hidden transition-all ${
                                  roleMode !== "ADMIN" ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                                } ${
                                  log.approvalStatus === "Approved"
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                    : log.approvalStatus === "Rejected"
                                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                }`}
                              >
                                <option value="Pending" className="bg-card text-amber-600 font-bold">
                                  Pending Approval
                                </option>
                                <option value="Approved" className="bg-card text-emerald-600 font-bold">
                                  Approved
                                </option>
                                <option value="Rejected" className="bg-card text-rose-600 font-bold">
                                  Rejected
                                </option>
                              </select>
                            </td>

                            {/* Actions Column */}
                            <td className="py-2.5 px-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingLog(log);
                                    setShowAddLogModal(true);
                                  }}
                                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                                  title="Edit Effort Log"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSingleLog(log.id)}
                                  className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Delete Effort Log"
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
        ) : groupBy === "Group By Project" ? (
          /* Mode: Group By Project */
          <table className="w-full min-w-[1300px] text-left text-xs border-collapse rounded-lg overflow-hidden border border-border bg-card shadow-2xs">
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
                  USER
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
              {filteredProjectGroupsData.map((group) => {
                const [totalStr, billableStr, nonBillableStr] = group.dailyLogHours.split(" | ");
                const groupKey = `project:${group.projectKey}`;
                return (
                <React.Fragment key={groupKey}>
                  <tr
                    onClick={() => toggleDateCollapse(groupKey)}
                    className="bg-muted/80 hover:bg-muted transition-colors font-medium cursor-pointer select-none border-b border-border"
                  >
                    <td className="py-3 px-3 border-r border-border text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDateCollapse(groupKey);
                        }}
                        className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                      >
                        {collapsedDates[groupKey] ? (
                          <ChevronRight size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </td>

                    <td colSpan={3} className="py-3 px-4 border-r border-border font-bold text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                          <Folder size={13} />
                        </div>
                        <span className="text-foreground font-bold text-xs">{group.projectName}</span>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {group.timeLogs.length} log{group.timeLogs.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 border-r border-border font-mono font-bold whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-foreground font-bold" title="Total Logged Hours">{totalStr}</span>
                        <span className="text-info font-bold" title="Billable Hours">{billableStr}</span>
                        <span className="text-warning font-bold" title="Non-Billable Hours">{nonBillableStr}</span>
                      </div>
                    </td>

                    <td colSpan={5} className="py-3 px-4" />
                  </tr>

                  {!collapsedDates[groupKey] && (
                    <>
                      {group.timeLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-accent/30 transition-colors border-b border-border text-foreground"
                        >
                          <td className="py-2.5 px-3 border-r border-border text-center">
                            <input
                              type="checkbox"
                              checked={selectedLogIds.includes(log.id)}
                              onChange={() => handleToggleSelectLog(log.id)}
                              className="rounded border-input text-primary h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>

                          <td className="py-2.5 px-4 border-r border-border font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                            {log.taskCode || log.code}
                          </td>

                          <td className="py-2.5 px-4 border-r border-border font-semibold text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <ClipboardList size={14} className="text-muted-foreground shrink-0" />
                              <span>{log.title}</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-4 border-r border-border text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <UserIcon size={14} className="text-muted-foreground shrink-0" />
                              <span>{log.userName}</span>
                            </div>
                          </td>

                          {/* Daily Log Hours Column — INLINE EDITABLE */}
                          <td className="py-2 px-3 border-r border-border whitespace-nowrap">
                            <InlineTextCell
                              value={log.duration}
                              onSave={(newVal) => handleInlineFieldChange(log.id, "duration", newVal)}
                              mono
                              placeholder="00:00"
                              className="font-mono font-bold text-foreground min-w-[70px]"
                              title="Click to edit Daily Log Hours inline"
                            />
                          </td>

                          {/* Time Period Column — INLINE EDITABLE */}
                          <td className="py-2 px-3 border-r border-border whitespace-nowrap">
                            <InlineTextCell
                              value={log.timePeriod}
                              onSave={(newVal) => handleInlineFieldChange(log.id, "timePeriod", newVal)}
                              mono
                              placeholder="00:00 - 00:00"
                              className="text-[11px] text-muted-foreground min-w-[175px]"
                              title="Click to edit Time Period inline"
                            />
                          </td>

                          <td className="py-2.5 px-4 border-r border-border font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {log.date}
                          </td>

                          {/* Billing Type Column — INLINE EDITABLE */}
                          <td className="py-2 px-3 border-r border-border whitespace-nowrap">
                            <select
                              value={log.billingType}
                              onChange={(e) =>
                                handleInlineFieldChange(
                                  log.id,
                                  "billingType",
                                  e.target.value as "BILLABLE" | "NON BILLABLE"
                                )
                              }
                              className={`rounded border border-transparent hover:border-input bg-transparent px-2 py-0.5 text-xs font-semibold cursor-pointer outline-hidden transition-all ${
                                log.billingType === "BILLABLE" ? "text-info font-bold" : "text-warning font-bold"
                              }`}
                              title="Click to edit Billing Type inline"
                            >
                              <option value="BILLABLE" className="bg-card text-info font-bold">
                                BILLABLE
                              </option>
                              <option value="NON BILLABLE" className="bg-card text-warning font-bold">
                                NON BILLABLE
                              </option>
                            </select>
                          </td>

                          {/* Approval Status Column — INLINE EDITABLE */}
                          <td className="py-2 px-3 border-r border-border whitespace-nowrap">
                            <select
                              value={log.approvalStatus || "Pending"}
                              onChange={(e) =>
                                handleInlineFieldChange(
                                  log.id,
                                  "approvalStatus",
                                  e.target.value as "Pending" | "Approved" | "Rejected"
                                )
                              }
                              disabled={roleMode !== "ADMIN"}
                              title={
                                roleMode !== "ADMIN"
                                  ? "Only a manager can change approval status"
                                  : "Click to change approval status inline"
                              }
                              className={`rounded-md border px-2.5 py-0.5 text-[11px] font-bold outline-hidden transition-all ${
                                roleMode !== "ADMIN" ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                              } ${
                                log.approvalStatus === "Approved"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                  : log.approvalStatus === "Rejected"
                                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              }`}
                            >
                              <option value="Pending" className="bg-card text-amber-600 font-bold">
                                Pending Approval
                              </option>
                              <option value="Approved" className="bg-card text-emerald-600 font-bold">
                                Approved
                              </option>
                              <option value="Rejected" className="bg-card text-rose-600 font-bold">
                                Rejected
                              </option>
                            </select>
                          </td>

                          {/* Remarks Column — INLINE EDITABLE */}
                          <td className="py-2 px-3 whitespace-nowrap max-w-[260px]">
                            <InlineTextCell
                              value={log.remarks || ""}
                              onSave={(newVal) => handleInlineFieldChange(log.id, "remarks", newVal)}
                              placeholder="Add remarks"
                              className="text-muted-foreground min-w-[160px] truncate"
                              title={log.remarks ? `${log.remarks}\n\nClick to edit remarks inline` : "Click to add remarks"}
                            />
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
          <table className="w-full min-w-[1300px] text-left text-xs border-collapse rounded-lg overflow-hidden border border-border bg-card shadow-2xs">
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
              {filteredUserGroupsData.map((group) => {
                const [totalStr, billableStr, nonBillableStr] = group.dailyLogHours.split(" | ");
                return (
                <React.Fragment key={group.userId}>
                  <tr
                    onClick={() => toggleDateCollapse(group.userId)}
                    className="bg-muted/80 hover:bg-muted transition-colors font-medium cursor-pointer select-none border-b border-border"
                  >
                    <td className="py-3 px-3 border-r border-border text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDateCollapse(group.userId);
                        }}
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
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                          {group.userInitials || "US"}
                        </div>
                        <span className="text-foreground font-bold text-xs">{group.userName}</span>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {group.timeLogs.length} log{group.timeLogs.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 border-r border-border font-mono font-bold whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-foreground font-bold" title="Total Logged Hours">{totalStr}</span>
                        <span className="text-info font-bold" title="Billable Hours">{billableStr}</span>
                        <span className="text-warning font-bold" title="Non-Billable Hours">{nonBillableStr}</span>
                      </div>
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
                          <td className="py-2.5 px-3 border-r border-border text-center">
                            <input
                              type="checkbox"
                              checked={selectedLogIds.includes(log.id)}
                              onChange={() => handleToggleSelectLog(log.id)}
                              className="rounded border-input text-primary h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>

                          <td className="py-2.5 px-4 border-r border-border font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                            {log.taskCode || log.code}
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

                          {/* Daily Log Hours Column — INLINE EDITABLE */}
                          <td className="py-2 px-3 border-r border-border whitespace-nowrap">
                            <InlineTextCell
                              value={log.duration}
                              onSave={(newVal) => handleInlineFieldChange(log.id, "duration", newVal)}
                              mono
                              placeholder="00:00"
                              className="font-mono font-bold text-foreground min-w-[70px]"
                              title="Click to edit Daily Log Hours inline"
                            />
                          </td>

                          {/* Time Period Column — INLINE EDITABLE */}
                          <td className="py-2 px-3 border-r border-border whitespace-nowrap">
                            <InlineTextCell
                              value={log.timePeriod}
                              onSave={(newVal) => handleInlineFieldChange(log.id, "timePeriod", newVal)}
                              mono
                              placeholder="00:00 - 00:00"
                              className="text-[11px] text-muted-foreground min-w-[175px]"
                              title="Click to edit Time Period inline"
                            />
                          </td>

                          <td className="py-2.5 px-4 border-r border-border font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {log.date}
                          </td>

                          {/* Billing Type Column — INLINE EDITABLE */}
                          <td className="py-2 px-3 border-r border-border whitespace-nowrap">
                            <select
                              value={log.billingType}
                              onChange={(e) =>
                                handleInlineFieldChange(
                                  log.id,
                                  "billingType",
                                  e.target.value as "BILLABLE" | "NON BILLABLE"
                                )
                              }
                              className={`rounded border border-transparent hover:border-input bg-transparent px-2 py-0.5 text-xs font-semibold cursor-pointer outline-hidden transition-all ${
                                log.billingType === "BILLABLE" ? "text-info font-bold" : "text-warning font-bold"
                              }`}
                              title="Click to edit Billing Type inline"
                            >
                              <option value="BILLABLE" className="bg-card text-info font-bold">
                                BILLABLE
                              </option>
                              <option value="NON BILLABLE" className="bg-card text-warning font-bold">
                                NON BILLABLE
                              </option>
                            </select>
                          </td>

                          {/* Approval Status Column — INLINE EDITABLE */}
                          <td className="py-2 px-3 border-r border-border whitespace-nowrap">
                            <select
                              value={log.approvalStatus || "Pending"}
                              onChange={(e) =>
                                handleInlineFieldChange(
                                  log.id,
                                  "approvalStatus",
                                  e.target.value as "Pending" | "Approved" | "Rejected"
                                )
                              }
                              disabled={roleMode !== "ADMIN"}
                              title={
                                roleMode !== "ADMIN"
                                  ? "Only a manager can change approval status"
                                  : "Click to change approval status inline"
                              }
                              className={`rounded-md border px-2.5 py-0.5 text-[11px] font-bold outline-hidden transition-all ${
                                roleMode !== "ADMIN" ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                              } ${
                                log.approvalStatus === "Approved"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                  : log.approvalStatus === "Rejected"
                                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              }`}
                            >
                              <option value="Pending" className="bg-card text-amber-600 font-bold">
                                Pending Approval
                              </option>
                              <option value="Approved" className="bg-card text-emerald-600 font-bold">
                                Approved
                              </option>
                              <option value="Rejected" className="bg-card text-rose-600 font-bold">
                                Rejected
                              </option>
                            </select>
                          </td>

                          {/* Remarks Column — INLINE EDITABLE */}
                          <td className="py-2 px-3 whitespace-nowrap max-w-[260px]">
                            <InlineTextCell
                              value={log.remarks || ""}
                              onSave={(newVal) => handleInlineFieldChange(log.id, "remarks", newVal)}
                              placeholder="Add remarks"
                              className="text-muted-foreground min-w-[160px] truncate"
                              title={log.remarks ? `${log.remarks}\n\nClick to edit remarks inline` : "Click to add remarks"}
                            />
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
      <div className="flex items-center justify-between border-t border-border px-6 py-2.5 bg-muted/40 text-xs font-semibold shrink-0 text-foreground overflow-x-auto dsm-columns-scrollbar">
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

      {/* Share Timesheet Modal */}
      <ShareTimesheetModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        date={formatYYYYMMDD(selectedDate)}
        dateLabel={formatDDMMYYYY(selectedDate)}
      />

      {/* Add / Edit Time Log Modal Dialog */}
      <NewTimeLogModal
        isOpen={showAddLogModal}
        onClose={() => {
          setShowAddLogModal(false);
          setModalTargetDate("");
          setEditingLog(null);
        }}
        editingLog={editingLog}
        initialDate={modalTargetDate || formatDDMMYYYY(selectedDate)}
        initialProject={modalTargetProject}
        projectId={projectId}
        projectName={projectName}
        assignedUsers={assignedUsers}
        onLogAdded={handleLogAdded}
        onLogUpdated={handleLogUpdated}
      />

      {/* Generate Time Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 font-sans text-xs">
            <div className="flex items-center justify-between border-b pb-3 border-border">
              <div className="flex items-center gap-2">
                <BarChart3 size={20} className="text-primary" />
                <h3 className="text-base font-bold text-foreground">Effort Log Productivity & Billing Report</h3>
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

      {ConfirmDialog}
    </div>
  );
}
