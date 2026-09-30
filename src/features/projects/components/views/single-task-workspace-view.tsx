"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { canUserActOnTask } from "../../utils/task-authorization";
import {
  ArrowLeft,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
  MoreHorizontal,
  UserPlus,
  Maximize2,
  Minimize2,
  AlertCircle,
  Info,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  Table as TableIcon,
  Quote,
  Send,
  Mail,
  FileText,
  Layers,
  Bug,
  Activity,
  Folder,
  CheckCircle2,
  Clock,
  MessageSquare,
  Paperclip,
  Share2,
  SlidersHorizontal,
  Timer,
  CheckSquare,
  User,
  Sparkles,
  Calendar,
  Trash2,
  Play,
  Pause,
  Square,
  Check,
  Edit2,
  Copy,
  CopyCheck,
} from "lucide-react";
import { TaskItem, TaskStatus, TaskActivityLog, TaskSubtask, TimeLogEntry, PROJECT_TASK_STATUSES, isTaskDone, getTaskStatusBadgeClasses, getTaskStatusSelectClasses } from "../../types";
import { parseDurationMinutes, formatTimePeriodRange } from "../../utils/time-helpers";
import { cn } from "@/lib/utils";
import { TimerWidget } from "../timer-widget";
import { ActiveTimerProvider } from "../../context/active-timer-context";
import { NewTimeLogModal } from "../modals/new-time-log-modal";
import { AddSubtaskDrawer } from "../modals/add-subtask-drawer";
import { TimerStoppedModal } from "../modals/timer-stopped-modal";
import { useProjectWorkspace } from "../../context/project-workspace-context";
import {
  updateTaskAction,
  createTaskAction,
  deleteTaskAction,
  getTaskActivitiesAction,
  getTaskTimeLogsAction,
  createTimeLogAction,
  updateTimeLogAction,
  deleteTimeLogAction,
  createSubtaskAction,
  updateSubtaskAction,
  deleteSubtaskAction,
  createTaskRemarkAction,
  getTaskRemarksAction,
} from "../../actions/project-actions";
import {
  createActiveTimerAction,
  endActiveTimerAction,
  getActiveTimerAction,
} from "../../actions/active-timer-actions";
import { TaskMultiOwnerSelect } from "../task-multi-owner-select";
import { LinkifyEditableTextarea } from "../linkify-editable-textarea";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { TaskDocumentsTab } from "../task-documents-tab";
import { TaskStatusTimelineTab } from "../task-status-timeline-tab";
import { ProjectStandupRollup } from "../project-standup-rollup";
import { toast } from "@/components/shared/toast";

interface SingleTaskWorkspaceViewProps {
  projectId: string;
  taskId: string;
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** Splits free-text on bare URLs and renders each URL as a clickable link, keeping
 *  everything else as plain text — used for descriptions/notes that mix prose with links. */
function linkifyText(text: string): React.ReactNode[] {
  // Splitting on a capturing-group regex interleaves the matches back into the
  // result, alternating [text, url, text, url, ...] — odd indices are always URLs.
  const parts = text.split(URL_PATTERN);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      // Trim trailing punctuation (commas, periods) that's more likely sentence
      // punctuation than part of the URL, without eating a real path segment.
      (() => {
        const trailingMatch = part.match(/[.,;:!?)]+$/);
        const trailing = trailingMatch ? trailingMatch[0] : "";
        const url = trailing ? part.slice(0, -trailing.length) : part;
        return (
          <React.Fragment key={i}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-info underline hover:text-info/80 dark:text-sky-400 dark:hover:text-sky-300 break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {url}
            </a>
            {trailing}
          </React.Fragment>
        );
      })()
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

export function SingleTaskWorkspaceView({
  projectId,
  taskId,
}: SingleTaskWorkspaceViewProps) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();

  // Project, task list, owners and viewer are loaded once per project by the [projectId]
  // layout — clicking between tasks/subtasks reuses them instead of re-fetching everything.
  const {
    project,
    tasks,
    setTasks,
    owners: ownersOptions,
    currentUser: workspaceUser,
    isLoading,
  } = useProjectWorkspace();
  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<TimeLogEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const currentUser = workspaceUser as {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "TEAM_MEMBER";
  } | null;

  // Selected phase filter for left sidebar task list
  const [selectedPhase, setSelectedPhase] = useState("ALL");

  // Header Actions States & Handlers
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isExpandedView, setIsExpandedView] = useState(false);
  const showToast = (msg: string) => {
    if (msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("error")) {
      toast.error(msg);
    } else {
      toast.success(msg);
    }
  };

  const handleCopyTaskLink = () => {
    setIsMoreMenuOpen(false);
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      showToast("Task link copied to clipboard!");
    }
  };

  const handleDuplicateTask = async () => {
    setIsMoreMenuOpen(false);
    try {
      const created = await createTaskAction(
        {
          title: `${activeTask.title} (Copy)`,
          status: "Open",
          priority: activeTask.priority,
          description: activeTask.description,
          startDate: activeTask.startDate,
          dueDate: activeTask.dueDate,
          phaseCode: activeTask.phaseCode,
          phaseName: activeTask.phaseName,
        },
        projectId
      );
      if (created) {
        showToast(`Task duplicated as ${created.code || created.id}`);
        router.push(`/projects/${projectId}/tasks/${created.code || created.id}`);
      }
    } catch (err) {
      console.error("Failed to duplicate task:", err);
    }
  };

  const handleDeleteTask = async () => {
    setIsMoreMenuOpen(false);
    const ok = await confirm({
      title: "Delete task?",
      description: `Are you sure you want to delete task ${activeTask.code}? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      const success = await deleteTaskAction(activeTask.id);
      if (success) {
        router.push(`/projects/${projectId}`);
      }
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const handleToggleFullscreen = () => {
    setIsExpandedView((prev) => !prev);
  };

  const leftTaskItems = React.useMemo(() => {
    return tasks || [];
  }, [tasks]);

  // Current active task matching route taskId parameter
  const foundTask = React.useMemo(
    () =>
      leftTaskItems.find(
        (t) =>
          t.code.toLowerCase() === taskId.toLowerCase() ||
          t.id.toLowerCase() === taskId.toLowerCase()
      ),
    [leftTaskItems, taskId]
  );

  const activeTask: TaskItem = foundTask || {
    id: taskId,
    code: taskId,
    title: "Task " + taskId,
    phaseCode: "1.1",
    phaseName: "General",
    status: "Open" as TaskStatus,
    authorName: project?.owner.name || "System",
    owner: project?.owner.name || "Unassigned",
    description: "",
    completionPercentage: 0,
    subtasks: [],
    remarks: [],
    activities: [],
  };

  const taskNotFound = !isLoading && !foundTask;

  // Only the task's own owner may start the live timer on it or edit it — everyone else can
  // still view read-only data (subject to the admin/team-member visibility scoping server-side).
  // Shared with the server-side check in project-actions.ts and the DSM-side timer entry points
  // via canUserActOnTask.
  const taskOwnerNames =
    activeTask.owners && activeTask.owners.length > 0
      ? activeTask.owners
      : activeTask.owner && activeTask.owner !== "Unassigned"
      ? activeTask.owner.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const isTaskOwner = Boolean(
    currentUser &&
      (currentUser.role === "ADMIN" ||
        canUserActOnTask(
          { ownerId: activeTask.ownerId, ownerIds: activeTask.ownerIds, ownerNames: taskOwnerNames },
          currentUser
        ))
  );
  // The owner of the project has full control over every task inside it, not just tasks they
  // personally own — mirrors the same rule enforced server-side in updateTaskAction.
  const isProjectOwner = Boolean(currentUser && project && project.owner.id === currentUser.id);
  const canStartTimer = isTaskOwner || isProjectOwner;
  const notOwnerMessage = `Only the task owner (${
    taskOwnerNames.length > 0 ? taskOwnerNames.join(", ") : "Unassigned"
  }) can start a timer on ${activeTask.code}.`;
  const canEditTask = Boolean(
    currentUser &&
      (isTaskOwner ||
        isProjectOwner ||
        (taskOwnerNames.length === 0 && activeTask.authorId === currentUser.id))
  );

  // Active Task Form & Section States
  const [taskStatus, setTaskStatus] = useState<TaskStatus>(
    activeTask.status || "Open"
  );

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(activeTask.title || "");

  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(activeTask.description || "");

  // Synchronize local form states when activeTask loads or changes
  useEffect(() => {
    if (activeTask) {
      if (activeTask.status) setTaskStatus(activeTask.status);
      setTitleDraft(activeTask.title || "");
      setDescriptionDraft(activeTask.description || "");
    }
  }, [activeTask?.id, activeTask?.status, activeTask?.title, activeTask?.description]);

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!canEditTask) {
      alert("Only the task owner can edit this task.");
      return;
    }
    const previousStatus = taskStatus;
    setTaskStatus(newStatus);
    if (activeTask && activeTask.id) {
      const updatedTask = { ...activeTask, status: newStatus };
      setTasks((prev) =>
        prev.map((t) => (t.id === activeTask.id ? updatedTask : t))
      );
      try {
        const result = await updateTaskAction(activeTask.id, { status: newStatus });
        if (!result.success) {
          setTaskStatus(previousStatus);
          setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? activeTask : t)));
          toast.error(result.error || "You do not have permission to edit this task.");
        } else {
          toast.success(`Task status changed to ${newStatus}`);
        }
      } catch (err) {
        console.error("Failed to update task status in DB:", err);
        toast.error("Failed to update task status");
      }
    }
  };

  const startEditingDescription = () => {
    if (!canEditTask) return;
    setDescriptionDraft(activeTask.description || "");
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    if (!canEditTask) {
      alert("Only the task owner can edit this task.");
      setIsEditingDescription(false);
      return;
    }
    const trimmed = descriptionDraft.trim();
    setIsEditingDescription(false);
    const updatedTask = { ...activeTask, description: trimmed };
    setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? updatedTask : t)));
    try {
      const result = await updateTaskAction(activeTask.id, { description: trimmed });
      if (!result.success) {
        setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? activeTask : t)));
        toast.error(result.error || "You do not have permission to edit this task.");
      } else {
        toast.success("Task description updated");
      }
    } catch (err) {
      console.error("Failed to update task description in DB:", err);
      toast.error("Failed to update description");
    }
  };

  // Shared save path for the owner-editable Task Information fields (start date, due date,
  // priority) — same permission check and rollback-on-denial behavior as status/description.
  const handleUpdateTaskField = async (updates: Partial<TaskItem>): Promise<boolean> => {
    if (!canEditTask) {
      alert("Only the task owner can edit this task.");
      return false;
    }
    const taskId = activeTask.id;
    const changedKeys = Object.keys(updates) as (keyof TaskItem)[];
    const previousValues: Partial<TaskItem> = {};
    for (const key of changedKeys) {
      (previousValues as Record<string, unknown>)[key] = activeTask[key];
    }

    // Apply to the UI immediately; the DB write happens in the background.
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));

    // Roll back only fields that still hold the value this call wrote — if the user already
    // picked something newer (e.g. changed priority twice quickly), the newer choice wins.
    const rollback = () =>
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const reverted = { ...t };
          for (const key of changedKeys) {
            if (t[key] === updates[key]) {
              (reverted as Record<string, unknown>)[key] = previousValues[key];
            }
          }
          return reverted;
        })
      );

    try {
      const result = await updateTaskAction(taskId, updates);
      if (!result.success) {
        rollback();
        toast.error(result.error || "You do not have permission to edit this task.");
        return false;
      }
      toast.success("Task updated");
      return true;
    } catch (err) {
      console.error("Failed to update task in DB:", err);
      rollback();
      toast.error("Failed to save changes — please try again.");
      return false;
    }
  };

  const handleSaveTitle = async () => {
    const trimmed = titleDraft.trim();
    setIsEditingTitle(false);
    if (!trimmed || trimmed === activeTask.title) {
      setTitleDraft(activeTask.title);
      return;
    }
    await handleUpdateTaskField({ title: trimmed });
  };

  const [taskInfoOpen, setTaskInfoOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "COMMENTS"
    | "SUBTASKS"
    | "LOG_HOURS"
    | "DOCUMENTS"
    | "DEPENDENCY"
    | "STATUS_TIMELINE"
    | "BUGS"
    | "ACTIVITY"
    | "DRIVE"
    | "CHECKLIST"
    | "STANDUP_ACTIVITY"
  >("COMMENTS");

  const [commentText, setCommentText] = useState("");
  const [commentsList, setCommentsList] = useState<
    { id: string; author: string; text: string; time: string }[]
  >([]);
  const [isSavingComment, setIsSavingComment] = useState(false);

  // Subtasks State & Handlers matching reference design
  const formatSubtaskCode = (st: TaskSubtask, index: number) => {
    return `${activeTask.code}.${index + 1}`;
  };

  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddSubtaskDrawerOpen, setIsAddSubtaskDrawerOpen] = useState(false);

  const subtasks = React.useMemo(() => {
    return (activeTask.subtasks || []).map((st, i) => ({
      ...st,
      code: st.code || `${activeTask.code}.${i + 1}`,
    }));
  }, [activeTask.subtasks, activeTask.code]);

  const handleAddSubtaskSubmit = async (customTitle?: string) => {
    const titleToUse = (customTitle || newSubtaskTitle).trim();
    if (!titleToUse) return;

    setNewSubtaskTitle("");

    try {
      const created = await createSubtaskAction(activeTask.id, {
        title: titleToUse,
        status: "Open",
        ownerName: activeTask.owner || "Unassigned",
        startDate: new Date().toLocaleDateString("en-GB"),
        dueDate: activeTask.dueDate || "01/01/2027",
        completed: false,
      });
      if (created) {
        const updatedSubtasks = [...subtasks, created];
        const updatedTask = { ...activeTask, subtasks: updatedSubtasks };
        setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? updatedTask : t)));
      }
    } catch (err) {
      console.error("Failed to save subtask:", err);
    }
  };

  const handleToggleSubtask = (id: string) => {
    const target = subtasks.find((st) => st.id === id);
    if (!target) return;
    const isCurrentlyDone = isTaskDone(target.status, target.completed);
    const newCompleted = !isCurrentlyDone;
    const newStatus: TaskStatus = newCompleted ? "Done" : "Open";

    const updatedSubtasks = subtasks.map((st) =>
      st.id === id ? { ...st, completed: newCompleted, status: newStatus } : st
    );
    const updatedTask = { ...activeTask, subtasks: updatedSubtasks };
    setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? updatedTask : t)));

    updateSubtaskAction(id, { completed: newCompleted, status: newStatus }).catch((err) =>
      console.error("Failed to update subtask in DB:", err)
    );
  };

  const handleSubtaskStatusChange = (id: string, newStatus: TaskStatus) => {
    const isDone = isTaskDone(newStatus);
    const updatedSubtasks = subtasks.map((st) =>
      st.id === id
        ? {
            ...st,
            status: newStatus,
            completed: isDone,
          }
        : st
    );
    const updatedTask = { ...activeTask, subtasks: updatedSubtasks };
    setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? updatedTask : t)));

    updateSubtaskAction(id, { status: newStatus, completed: isDone }).catch(
      (err) => console.error("Failed to update subtask status in DB:", err)
    );
  };

  const handleDeleteSubtask = async (id: string) => {
    const ok = await confirm({
      title: "Delete subtask?",
      description: "Delete this subtask? This cannot be undone.",
    });
    if (!ok) return;

    const updatedSubtasks = subtasks.filter((st) => st.id !== id);
    const updatedTask = { ...activeTask, subtasks: updatedSubtasks };
    setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? updatedTask : t)));

    deleteSubtaskAction(id).catch((err) => console.error("Failed to delete subtask in DB:", err));
  };

  const refreshComments = useCallback(async () => {
    try {
      const dbRemarks = await getTaskRemarksAction(activeTask.id);
      if (dbRemarks && dbRemarks.length > 0) {
        setCommentsList(
          dbRemarks.map((r, idx) => ({
            id: r.id || `c-${idx}`,
            author: r.authorName || activeTask.owner || project?.owner.name || "Team Member",
            text: r.content,
            time: r.createdAt
              ? new Date(r.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "Recently",
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch task remarks from DB:", err);
    }
  }, [activeTask.id, activeTask.owner, project?.owner.name]);

  useEffect(() => {
    let cancelled = false;
    getTaskRemarksAction(activeTask.id)
      .then((dbRemarks) => {
        if (cancelled) return;
        if (dbRemarks && dbRemarks.length > 0) {
          setCommentsList(
            dbRemarks.map((r, idx) => ({
              id: r.id || `c-${idx}`,
              author: r.authorName || activeTask.owner || project?.owner.name || "Team Member",
              text: r.content,
              time: r.createdAt
                ? new Date(r.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "Recently",
            }))
          );
        } else if (activeTask?.remarks?.length) {
          setCommentsList(
            activeTask.remarks.map((r, idx) => ({
              id: r.id || `c-${idx}`,
              author: r.authorName || activeTask.owner || project?.owner.name || "Team Member",
              text: r.content,
              time: r.createdAt || "Recently",
            }))
          );
        } else {
          setCommentsList([]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to fetch task remarks from DB:", err);
        if (activeTask?.remarks?.length) {
          setCommentsList(
            activeTask.remarks.map((r, idx) => ({
              id: r.id || `c-${idx}`,
              author: r.authorName || activeTask.owner || project?.owner.name || "Team Member",
              text: r.content,
              time: r.createdAt || "Recently",
            }))
          );
        } else {
          setCommentsList([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTask.id, activeTask.remarks, activeTask.owner, project?.owner.name]);

  // Activity log is no longer part of the project-wide task payload — fetch it for this task only.
  // Keyed on status too, so a status change made here shows up in the Activity tab.
  const [taskActivities, setTaskActivities] = useState<TaskActivityLog[]>([]);
  const foundTaskId = foundTask?.id;
  const foundTaskStatus = foundTask?.status;
  useEffect(() => {
    if (!foundTaskId) return;
    let cancelled = false;
    getTaskActivitiesAction(foundTaskId)
      .then((acts) => {
        if (!cancelled) setTaskActivities(acts);
      })
      .catch((err) => console.error("Failed to load task activity:", err));
    return () => {
      cancelled = true;
    };
  }, [foundTaskId, foundTaskStatus]);

  // Dynamic Time Logs State & Calculations for this specific task — loaded from the DB
  const [taskTimeLogs, setTaskTimeLogs] = useState<TimeLogEntry[]>([]);
  const [savingLogId, setSavingLogId] = useState<string | null>(null);

  const handleAutoSaveField = async (logId: string, updates: Partial<TimeLogEntry>) => {
    // Immediate local update for zero-latency UI feedback
    setTaskTimeLogs((prev) =>
      prev.map((log) => (log.id === logId ? { ...log, ...updates } : log))
    );

    setSavingLogId(logId);
    try {
      await updateTimeLogAction(logId, updates);
    } catch (err) {
      console.error("Failed to auto-save time log field:", err);
    } finally {
      setTimeout(() => {
        setSavingLogId((current) => (current === logId ? null : current));
      }, 1500);
    }
  };

  const refreshTaskTimeLogs = React.useCallback(() => {
    if (!activeTask.code) return;
    getTaskTimeLogsAction(activeTask.code)
      .then(setTaskTimeLogs)
      .catch((err) => console.error("Failed to load task time logs:", err));
  }, [activeTask.code]);

  useEffect(() => {
    refreshTaskTimeLogs();
  }, [refreshTaskTimeLogs]);

  const handleTimerWidgetLogSaved = () => {
    showToast("Effort log saved & timer stopped in DB");
    setActiveTimerStatus("IDLE");
    setActiveTimerSeconds(0);
    setActiveTimerStartTime(undefined);
    refreshTaskTimeLogs();
  };

  const handleTimerLogSaved = async (logData: {
    duration: string;
    startTime: string;
    endTime: string;
    isBillable: boolean;
    notes: string;
  }) => {
    const ctx = stoppedTimerContextRef.current;
    const targetProjectId = ctx?.projectId || activeTask.projectId || projectId;
    try {
      // The ActiveTimer row is already gone (deleted in handleStopTimer) —
      // create the actual ProjectTimeLog now with the details the user confirmed.
      const payload: Partial<TimeLogEntry> = {
        taskCode: activeTask.code || ctx?.taskId || activeTask.id,
        projectId: targetProjectId,
        duration: logData.duration,
        billingType: logData.isBillable ? "BILLABLE" : "NON BILLABLE",
        remarks: logData.notes || `Logged from task ${activeTask.code}`,
        timePeriod: formatTimePeriodRange(logData.startTime, logData.endTime),
        date: (ctx?.startedAt ? new Date(ctx.startedAt) : new Date())
          .toISOString()
          .split("T")[0],
      };
      await createTimeLogAction(payload, targetProjectId);

      showToast("Effort log saved & timer stopped in DB");
      setActiveTimerStatus("IDLE");
      setActiveTimerSeconds(0);
      setActiveTimerStartTime(undefined);
      refreshTaskTimeLogs();
    } catch (err) {
      console.error("Failed to save timer time log to DB:", err);
      showToast("Failed to save timer log");
    } finally {
      stoppedTimerContextRef.current = null;
    }
  };

  const handleTimerLogDiscarded = () => {
    // Nothing left to delete server-side — the ActiveTimer was already removed
    // when Stop was clicked. Discarding here just means "don't log this time".
    stoppedTimerContextRef.current = null;
    setActiveTimerStatus("IDLE");
    setActiveTimerSeconds(0);
    setActiveTimerStartTime(undefined);
    showToast("Active timer discarded");
  };

  const totalTaskMinutes = taskTimeLogs.reduce((sum, log) => {
    return sum + parseDurationMinutes(log.duration);
  }, 0);

  const formatTaskMinutesShort = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const formattedTotalTaskHours = formatTaskMinutesShort(totalTaskMinutes);

  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const toggleDateCollapse = (dateKey: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  const totalTaskBillableMinutes = React.useMemo(() => {
    return taskTimeLogs
      .filter((l) => l.billingType === "BILLABLE")
      .reduce((sum, l) => {
        const match = l.duration.match(/(\d+):(\d+)/);
        return sum + (match ? parseInt(match[1], 10) * 60 + parseInt(match[2], 10) : 0);
      }, 0);
  }, [taskTimeLogs]);

  const totalTaskNonBillableMinutes = Math.max(0, totalTaskMinutes - totalTaskBillableMinutes);
  const formattedTaskBillableHours = formatTaskMinutesShort(totalTaskBillableMinutes);
  const formattedTaskNonBillableHours = formatTaskMinutesShort(totalTaskNonBillableMinutes);

  const dateGroupsData = React.useMemo(() => {
    const map = new Map<string, TimeLogEntry[]>();
    for (const log of taskTimeLogs) {
      const d = log.date || "Today";
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(log);
    }

    return Array.from(map.entries())
      .sort(([d1], [d2]) => (d1 < d2 ? 1 : -1))
      .map(([date, logs]) => {
        const dateTotalMins = logs.reduce((sum, l) => {
          const match = l.duration.match(/(\d+):(\d+)/);
          return sum + (match ? parseInt(match[1], 10) * 60 + parseInt(match[2], 10) : 0);
        }, 0);

        const dateBillableMins = logs
          .filter((l) => l.billingType === "BILLABLE")
          .reduce((sum, l) => {
            const match = l.duration.match(/(\d+):(\d+)/);
            return sum + (match ? parseInt(match[1], 10) * 60 + parseInt(match[2], 10) : 0);
          }, 0);

        const dateNonBillableMins = Math.max(0, dateTotalMins - dateBillableMins);

        return {
          date,
          logs,
          totalHours: formatTaskMinutesShort(dateTotalMins),
          billableHours: formatTaskMinutesShort(dateBillableMins),
          nonBillableHours: formatTaskMinutesShort(dateNonBillableMins),
        };
      });
  }, [taskTimeLogs]);

  // Active Timer state shared across workspace header and Log Hours tab
  const [activeTimerSeconds, setActiveTimerSeconds] = useState<number>(0);
  const [activeTimerStatus, setActiveTimerStatus] = useState<"IDLE" | "RUNNING" | "PAUSED">("IDLE");
  const [activeTimerStartTime, setActiveTimerStartTime] = useState<Date | undefined>(undefined);
  const [isStoppedModalOpen, setIsStoppedModalOpen] = useState(false);
  const [stoppedSeconds, setStoppedSeconds] = useState<number>(0);
  // Context captured from the DB ActiveTimer row at the moment Stop is clicked
  // (it's deleted immediately at that point) — used to create the real time log
  // once the user confirms details in the stopped-timer modal.
  const stoppedTimerContextRef = React.useRef<{
    projectId?: string;
    phaseId?: string;
    taskId?: string;
    startedAt?: string;
    elapsedSeconds?: number;
  } | null>(null);

  // Sync active timer from DB on load
  useEffect(() => {
    async function syncDbActiveTimer() {
      try {
        const res = await getActiveTimerAction();
        if (res?.success && res?.data) {
          const dbTimer = res.data;
          if (dbTimer.taskId === activeTask.id || dbTimer.task?.code === activeTask.code) {
            const startedAt = new Date(dbTimer.startedAt);
            const elapsed = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
            setActiveTimerStartTime(startedAt);
            setActiveTimerSeconds(elapsed);
            setActiveTimerStatus("RUNNING");
          }
        }
      } catch (err) {
        console.error("Failed to fetch active timer from DB:", err);
      }
    }
    syncDbActiveTimer();
  }, [activeTask.id, activeTask.code]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeTimerStatus === "RUNNING") {
      interval = setInterval(() => {
        setActiveTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimerStatus]);

  const showTimerNotice = (title: string, description: string) => {
    void confirm({ title, description, confirmLabel: "OK", danger: false, hideCancel: true });
  };

  const handleStartTimer = async () => {
    // Ownership check first, before anything starts.
    if (!canStartTimer) {
      showTimerNotice("You're not the owner of this task", notOwnerMessage);
      return;
    }
    const previousStatus = activeTimerStatus;
    const previousStartTime = activeTimerStartTime;
    const now = new Date();
    if (activeTimerStatus === "IDLE") {
      setActiveTimerStartTime(now);
    }
    setActiveTimerStatus("RUNNING");
    try {
      const res = await createActiveTimerAction({
        taskId: activeTask.id,
        taskCode: activeTask.code,
        projectId: activeTask.projectId || projectId,
        description: `Working on task ${activeTask.code}: ${activeTask.title}`,
        billingType: "BILLABLE",
      });
      if (!res.success) {
        // Server refused (it re-checks ownership) — undo the optimistic start.
        setActiveTimerStatus(previousStatus);
        setActiveTimerStartTime(previousStartTime);
        showTimerNotice(
          "code" in res && res.code === "NOT_TASK_OWNER" ? "You're not the owner of this task" : "Couldn't start the timer",
          res.error || "Something went wrong starting the timer. Please try again."
        );
      }
    } catch (err) {
      console.error("Failed to create active timer in DB:", err);
      setActiveTimerStatus(previousStatus);
      setActiveTimerStartTime(previousStartTime);
      showTimerNotice("Couldn't start the timer", "Something went wrong starting the timer. Please try again.");
    }
  };

  const handlePauseTimer = () => {
    setActiveTimerStatus("PAUSED");
  };

  const handleStopTimer = async () => {
    const elapsed = activeTimerSeconds;
    setActiveTimerStatus("IDLE");
    setActiveTimerSeconds(0);
    stoppedTimerContextRef.current = null;

    // Stop the timer everywhere the instant Stop is clicked: delete the DB
    // ActiveTimer row right now rather than waiting on the follow-up modal.
    try {
      const res = await endActiveTimerAction();
      if (res.success && res.data) {
        stoppedTimerContextRef.current = res.data;
      }
    } catch (err) {
      console.error("Failed to end active timer in DB:", err);
    }

    const finalElapsed = stoppedTimerContextRef.current?.elapsedSeconds ?? elapsed;
    setStoppedSeconds(finalElapsed > 0 ? finalElapsed : 8400);
    setIsStoppedModalOpen(true);
  };

  const formatHMS = (totalSecs: number): string => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  // Helper to format phase label cleanly without duplicate code prefix
  const formatPhaseLabel = (phaseCode?: string, phaseName?: string): string => {
    const code = (phaseCode || "").trim();
    const name = (phaseName || "").trim();
    if (!code && !name) return "General";
    if (!code) return name;
    if (!name) return code;
    // Avoid duplicate prefixes like "1.2 1.2 Requirement..."
    if (name.toLowerCase().startsWith(code.toLowerCase())) return name;
    if (/^\d+(\.\d+)*\s+/.test(name)) return name;
    return `${code} ${name}`;
  };

  // Convert DD/MM/YYYY, ISO, or other string into YYYY-MM-DD for <input type="date">
  const parseDateForInput = (dateStr?: string): string => {
    if (!dateStr || dateStr === "--" || dateStr.startsWith("-") || !/\d/.test(dateStr)) return "";
    const trimmed = dateStr.trim();
    const slashParts = trimmed.split(/[/.-]/);
    if (slashParts.length === 3) {
      if (slashParts[0].length === 4) {
        return `${slashParts[0]}-${slashParts[1].padStart(2, "0")}-${slashParts[2].padStart(2, "0")}`;
      }
      if (slashParts[2].length === 4) {
        return `${slashParts[2]}-${slashParts[1].padStart(2, "0")}-${slashParts[0].padStart(2, "0")}`;
      }
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
    return "";
  };

  // Convert YYYY-MM-DD back to DD/MM/YYYY for display / persistence
  const formatInputToDisplayDate = (isoDate: string): string => {
    if (!isoDate) return "--";
    const parts = isoDate.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  };

  // Safe display for date string, returning "--" if invalid (e.g. "-asdfasdf-")
  const formatSafeDisplayDate = (dateStr?: string): string => {
    if (!dateStr || dateStr === "--" || dateStr.includes("asdf") || !/\d/.test(dateStr)) {
      return "--";
    }
    const iso = parseDateForInput(dateStr);
    if (!iso) return "--";
    return formatInputToDisplayDate(iso);
  };

  // Compute duration dynamically from start date and due date
  const computeDuration = (startDateStr?: string, dueDateStr?: string, fallbackDuration?: string): string => {
    const startIso = parseDateForInput(startDateStr);
    const dueIso = parseDateForInput(dueDateStr);
    if (startIso && dueIso) {
      const s = new Date(startIso);
      const d = new Date(dueIso);
      const diff = d.getTime() - s.getTime();
      if (!isNaN(diff)) {
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
        if (days > 1) return `${days} days`;
        if (days === 1) return "1 day";
        if (days <= 0) return "0 days";
      }
    }
    if (
      fallbackDuration &&
      fallbackDuration !== "2 days/hrs" &&
      !fallbackDuration.includes("asdf") &&
      /\d/.test(fallbackDuration)
    ) {
      return fallbackDuration;
    }
    return "--";
  };

  // Dynamically compute list of unique phases from all available tasks and project phases
  const availablePhases = React.useMemo(() => {
    const phaseMap = new Map<string, string>();
    (project?.phases || []).forEach((p) => {
      const label = formatPhaseLabel(p.code, p.name);
      if (label && !phaseMap.has(label)) {
        phaseMap.set(label, label);
      }
    });
    leftTaskItems.forEach((t) => {
      const label = formatPhaseLabel(t.phaseCode, t.phaseName);
      if (label && !phaseMap.has(label)) {
        phaseMap.set(label, label);
      }
    });
    return Array.from(phaseMap.values());
  }, [leftTaskItems, project?.phases]);

  // Auto-sync status to match the active task when navigating to a new taskId
  const [prevTaskId, setPrevTaskId] = useState(taskId);
  if (taskId !== prevTaskId) {
    setPrevTaskId(taskId);
    setTaskStatus(activeTask.status || "Open");
    setIsEditingDescription(false);
    setDescriptionDraft(activeTask.description || "");
    setIsEditingTitle(false);
    setTitleDraft(activeTask.title);
  }

  const handleSelectTaskCard = (code: string) => {
    router.push(`/projects/${projectId}/tasks/${code}`);
  };

  const handleAddComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentText("");
    setIsSavingComment(true);

    try {
      const created = await createTaskRemarkAction(activeTask.id, text);
      if (created) {
        setCommentsList((prev) => [
          {
            id: created.id,
            author: created.authorName,
            text: created.content,
            time: "Just now",
          },
          ...prev,
        ]);
        showToast("Comment saved");
        await refreshComments();
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to save comment:", err);
      showToast("Failed to save comment");
    } finally {
      setIsSavingComment(false);
    }
  };

  // Filter sidebar task cards by selected phase — subtasks live under their parent's Subtasks
  // tab, not as their own card in this list (leftTaskItems still includes them so a subtask's
  // own URL resolves to real data via `foundTask` above).
  const filteredLeftTasks = leftTaskItems.filter((item) => {
    if (item.parentTaskId) return false;
    if (selectedPhase === "ALL") return true;
    const formattedItemPhase = formatPhaseLabel(item.phaseCode, item.phaseName).toLowerCase();
    const targetPhase = selectedPhase.toLowerCase();
    return (
      formattedItemPhase === targetPhase ||
      item.phaseName?.toLowerCase() === targetPhase ||
      item.phaseCode?.toLowerCase() === targetPhase ||
      `${item.phaseCode || ""} ${item.phaseName || ""}`.trim().toLowerCase() === targetPhase
    );
  });

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background text-foreground dark:bg-[#09090b]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading task workspace...</p>
        </div>
      </div>
    );
  }

  if (taskNotFound) {
    return (
      <div className="flex h-full w-full bg-background text-foreground overflow-hidden font-sans dark:bg-[#09090b] min-h-0">
        {/* Left Sidebar Task List */}
        <aside className="w-80 border-r border-border bg-card flex flex-col shrink-0 select-none dark:border-zinc-800 dark:bg-[#0c0d10] p-4 h-full min-h-0">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-3 dark:border-zinc-800">
            <h3 className="text-xs font-bold text-foreground">Project Tasks ({leftTaskItems.length})</h3>
            <Link href={`/projects/${projectId}`} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              <ArrowLeft size={12} /> Project
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {leftTaskItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No tasks exist in this project yet.
              </div>
            ) : (
              leftTaskItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectTaskCard(item.code)}
                  className="rounded-xl border border-border bg-card p-3 cursor-pointer hover:border-primary/50 hover:bg-accent/40 transition-colors"
                >
                  <div className="text-[11px] font-mono text-muted-foreground">{item.code}</div>
                  <h4 className="text-xs font-semibold text-foreground line-clamp-2">{item.title}</h4>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Task Not Found Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background dark:bg-[#09090b]">
          <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 shadow-sm dark:border-zinc-800 dark:bg-[#121215]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <AlertCircle size={28} />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Task Not Found</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Task <span className="font-mono font-semibold text-foreground">{taskId}</span> could not be found in project <span className="font-semibold text-foreground">{project?.name || projectId}</span>.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors shadow-2xs dark:border-zinc-800 dark:bg-zinc-900"
              >
                <ArrowLeft size={14} /> Back to Project
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <ActiveTimerProvider>
    <div className="flex h-full w-full bg-background text-foreground overflow-hidden font-sans dark:bg-[#09090b] dark:text-zinc-100 min-h-0">
      {/* ── Left Sidebar Task List Column (hidden when Maximize2 is active) ────── */}
      {!isExpandedView && (
        <aside className="w-80 border-r border-border bg-card flex flex-col shrink-0 select-none dark:border-zinc-800 dark:bg-[#0c0d10] h-full min-h-0">
          {/* Phase Header Selector */}
          <div className="flex items-center justify-between border-b border-border p-3.5 dark:border-zinc-800">
            <div className="relative flex-1 mr-2">
              <select
                value={selectedPhase}
                onChange={(e) => setSelectedPhase(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border bg-card px-3 py-1.5 pr-8 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer dark:border-zinc-700 dark:bg-[#141519] dark:text-zinc-200"
              >
                {availablePhases.map((phaseLabel) => (
                  <option key={phaseLabel} value={phaseLabel}>
                    {phaseLabel}
                  </option>
                ))}
                <option value="ALL">All Phases</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none dark:text-zinc-400"
              />
            </div>
          </div>

          {/* Task Cards Stack */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredLeftTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground dark:text-zinc-400">
                No tasks found in this phase.
              </div>
            ) : (
              filteredLeftTasks.map((item) => {
                const isSelected =
                  item.code.toLowerCase() === taskId.toLowerCase() ||
                  item.id.toLowerCase() === taskId.toLowerCase();

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectTaskCard(item.code)}
                    className={`rounded-xl border p-3 cursor-pointer transition-all duration-150 relative ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-2xs dark:border-zinc-600 dark:bg-zinc-800/90 dark:ring-zinc-600/30"
                        : "border-border bg-card hover:border-border/80 hover:bg-accent/40 dark:border-zinc-800/80 dark:bg-[#131418] dark:hover:border-zinc-700 dark:hover:bg-[#191a20]"
                    }`}
                  >
                    {/* Top Badge Row */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-mono text-muted-foreground dark:text-zinc-400">
                        {item.code}
                      </span>
                      <span
                        className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", getTaskStatusBadgeClasses(item.status))}
                      >
                        {item.status}
                      </span>
                    </div>

                    {/* Title */}
                    <h4
                      className={`text-xs font-semibold leading-snug line-clamp-2 ${
                        isTaskDone(item.status)
                          ? "line-through text-muted-foreground dark:text-zinc-400"
                          : "text-foreground dark:text-zinc-100"
                      }`}
                    >
                      {item.title}
                    </h4>

                    {/* Footer Owner & Badges */}
                    <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground dark:border-zinc-800/80 dark:text-zinc-400">
                      <span className="truncate max-w-[170px]">
                        {item.owner || "Unassigned"}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSelected && (
                          <Timer size={12} className="text-primary animate-pulse dark:text-zinc-300" />
                        )}
                        <AlertCircle size={12} className="text-muted-foreground/60 dark:text-zinc-500" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* ── Main Right Task Workspace Area ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col bg-background text-foreground overflow-hidden min-h-0 min-w-0 dark:bg-[#09090b] dark:text-zinc-100">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3.5 bg-card shrink-0 dark:border-zinc-800 dark:bg-[#0c0d10]">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-bold text-foreground border border-border dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700">
                <CheckSquare size={12} /> Task
              </span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-foreground font-semibold dark:bg-zinc-800 dark:text-zinc-300">
                {activeTask.code}
              </span>
              {/* <span className="flex items-center gap-1.5 rounded bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300">
                <Clock size={12} /> Logged: {formattedTotalTaskHours} h
              </span> */}
            </div>
            {isEditingTitle ? (
              <input
                type="text"
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") {
                    setTitleDraft(activeTask.title);
                    setIsEditingTitle(false);
                  }
                }}
                className="text-lg font-bold text-foreground tracking-tight bg-transparent outline-none border-b border-primary w-full dark:text-neutral-100"
              />
            ) : (
              <h2
                onClick={() => canEditTask && setIsEditingTitle(true)}
                title={canEditTask ? "Click to edit title" : undefined}
                className={`text-lg font-bold text-foreground tracking-tight truncate dark:text-neutral-100 ${
                  canEditTask ? "cursor-text hover:underline decoration-dashed underline-offset-4" : ""
                }`}
              >
                {activeTask.title}
              </h2>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5 dark:text-neutral-400">
              <span>By {activeTask.authorName || activeTask.owner || project?.owner.name || "System"}</span>
              <span>|</span>
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}`)}
                title="Go to project"
                className="flex items-center gap-1 text-foreground font-medium dark:text-zinc-300 hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer"
              >
                <Folder size={12} className="text-muted-foreground dark:text-zinc-400" /> {project?.name || projectId}
              </button>
              {/* <span>💬 📎</span> */}
              <span>|</span>

              {/* Embedded Live Timer Widget */}
              <TimerWidget
                taskTitle={activeTask.title}
                taskCode={activeTask.code}
                taskId={activeTask.id}
                projectId={activeTask.projectId || projectId}
                onSaveLog={handleTimerWidgetLogSaved}
                canStart={canStartTimer}
                disabledReason={notOwnerMessage}
                defaultExpanded
              />
            </div>
          </div>

          {/* Right Header Action Icons */}
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => setIsTimeLogModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-[#0088ff] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0077ee] transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Effort Log</span>
            </button>

            {/* Button 1: More Actions (...) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(!isMoreMenuOpen);
                  setIsAssignModalOpen(false);
                }}
                className={`p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer dark:border-zinc-800 dark:bg-[#141519] dark:hover:bg-zinc-800 dark:text-zinc-300 ${
                  isMoreMenuOpen ? "ring-2 ring-primary bg-accent" : ""
                }`}
                title="More Actions"
              >
                <MoreHorizontal size={16} />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl z-50 animate-in fade-in-0 zoom-in-95 font-sans dark:border-zinc-800 dark:bg-[#121215]">
                  <button
                    type="button"
                    onClick={handleCopyTaskLink}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer dark:text-zinc-200"
                  >
                    <Copy size={14} className="text-primary" />
                    <span>Copy Task Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicateTask}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer dark:text-zinc-200"
                  >
                    <CopyCheck size={14} className="text-info" />
                    <span>Duplicate Task</span>
                  </button>
                  <div className="my-1 border-t border-border dark:border-zinc-800" />
                  <button
                    type="button"
                    onClick={handleDeleteTask}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Delete Task</span>
                  </button>
                </div>
              )}
            </div>

            {/* Button 2: Assign User (UserPlus) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsAssignModalOpen(!isAssignModalOpen);
                  setIsMoreMenuOpen(false);
                }}
                className={`p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer dark:border-zinc-800 dark:bg-[#141519] dark:hover:bg-zinc-800 dark:text-zinc-300 ${
                  isAssignModalOpen ? "ring-2 ring-primary bg-accent" : ""
                }`}
                title="Assign User"
              >
                <UserPlus size={16} />
              </button>

              {isAssignModalOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-popover text-popover-foreground p-3 shadow-xl z-50 animate-in fade-in-0 zoom-in-95 font-sans dark:border-zinc-800 dark:bg-[#121215]">
                  <TaskMultiOwnerSelect
                    label="Assign Task Members"
                    selectedOwners={
                      (activeTask.owners && activeTask.owners.length > 0
                        ? activeTask.owners
                        : activeTask.owner && activeTask.owner !== "Unassigned"
                        ? activeTask.owner.split(",").map((s) => s.trim()).filter(Boolean)
                        : []
                      ).filter((o) => o && o.trim().toLowerCase() !== "unassigned")
                    }
                    disabled={!canEditTask}
                    disabledReason={!canEditTask ? `Only the task owner (${activeTask.owner || "Unassigned"}) can change ownership` : undefined}
                    onChangeOwners={(newOwners) => {
                      if (!canEditTask) return;
                      const cleanOwners = newOwners.filter((o) => o && o.trim().toLowerCase() !== "unassigned");
                      const primaryOwner = cleanOwners.length > 0 ? cleanOwners.join(", ") : "Unassigned";
                      handleUpdateTaskField({ owners: cleanOwners, owner: primaryOwner }).then((ok) => {
                        if (ok) showToast("Task assigned members updated");
                      });
                    }}
                    ownersList={ownersOptions}
                  />
                </div>
              )}
            </div>

            {/* Button 3: Expand View (Maximize2 / Minimize2) */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className={`p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer dark:border-zinc-800 dark:bg-[#141519] dark:hover:bg-zinc-800 dark:text-zinc-300 ${
                isExpandedView ? "bg-primary/20 text-primary border-primary" : ""
              }`}
              title={isExpandedView ? "Restore Sidebar View" : "Full Width Maximize View"}
            >
              {isExpandedView ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Button 4: Close (X) */}
            <Link
              href={`/projects/${projectId}`}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground hover:text-destructive transition-colors ml-1 cursor-pointer dark:border-zinc-800 dark:bg-[#141519] dark:hover:bg-zinc-800 dark:text-zinc-300 dark:hover:text-rose-400"
              title="Close Task Detail"
            >
              <X size={16} />
            </Link>
          </div>
        </div>

        {/* Workspace Body Content Scroll Area */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5 pb-20">
          {taskNotFound && (
            <div className="flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
              <AlertCircle size={16} className="shrink-0" />
              <span>
                Task &quot;{taskId}&quot; was not found in this project — it may belong to a
                different project or no longer exist. The fields below are placeholders, not
                real task data.
              </span>
            </div>
          )}

          {/* Status Field */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-zinc-400">
              STATUS
            </span>
            <div className="relative inline-block">
              <select
                value={taskStatus}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                disabled={!canEditTask}
                title={canEditTask ? undefined : "Only the task owner can change the status"}
                className={cn(
                  "appearance-none rounded-lg border bg-card px-3 py-1.5 pr-8 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary dark:bg-[#141519] dark:border-zinc-700 dark:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
                  getTaskStatusSelectClasses(taskStatus)
                )}
              >
                {PROJECT_TASK_STATUSES.map((s) => (
                  <option key={s} value={s} className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100">● {s}</option>
                ))}
                {!PROJECT_TASK_STATUSES.includes(taskStatus as any) && (
                  <option value={taskStatus} className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100">● {taskStatus}</option>
                )}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none dark:text-zinc-400"
              />
            </div>
          </div>

          {/* Description Collapsible Section */}
          <div className="border border-border rounded-xl bg-card overflow-hidden dark:border-zinc-800 dark:bg-[#121215]">
            <button
              type="button"
              onClick={() => setDescriptionOpen(!descriptionOpen)}
              className="flex w-full items-center justify-between p-3.5 hover:bg-accent/40 text-xs font-bold text-foreground transition-colors dark:hover:bg-zinc-800/40 dark:text-zinc-200"
            >
              <span className="flex items-center gap-2">
                {descriptionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Description
              </span>
            </button>
            {descriptionOpen && (
              <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground border-t border-border/60 dark:text-zinc-400 dark:border-zinc-800/60">
                {isEditingDescription ? (
                  <div className="space-y-2 pt-2">
                    <LinkifyEditableTextarea
                      autoFocus
                      rows={4}
                      value={descriptionDraft}
                      onChange={setDescriptionDraft}
                      placeholder="Add a description..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:bg-[#09090b] dark:border-zinc-800 dark:text-zinc-100"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveDescription}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDescriptionDraft(activeTask.description || "");
                          setIsEditingDescription(false);
                        }}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : activeTask.description ? (
                  /^https?:\/\//i.test(activeTask.description.trim()) ? (
                    <a
                      href={activeTask.description}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline break-all hover:text-primary/80 font-mono"
                    >
                      {activeTask.description}
                    </a>
                  ) : (
                    <p
                      onClick={() => startEditingDescription()}
                      className="whitespace-pre-wrap break-words cursor-text hover:text-foreground transition-colors dark:hover:text-zinc-100"
                    >
                      {linkifyText(activeTask.description)}
                    </p>
                  )
                ) : (
                  <span
                    onClick={() => setIsEditingDescription(true)}
                    className="cursor-text hover:text-foreground transition-colors font-mono dark:hover:text-zinc-100"
                  >
                    NO DESCRIPTION AVAILABLE
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Task Information Collapsible Section */}
          <div className="border border-border rounded-xl bg-card dark:border-zinc-800 dark:bg-[#121215]">
            <button
              type="button"
              onClick={() => setTaskInfoOpen(!taskInfoOpen)}
              className="flex w-full items-center justify-between p-3.5 hover:bg-accent/40 text-xs font-bold text-foreground transition-colors dark:hover:bg-zinc-800/40 dark:text-zinc-200"
            >
              <span className="flex items-center gap-2">
                {taskInfoOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Task Information
              </span>
            </button>
            {taskInfoOpen && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 text-xs border-t border-border/60 bg-muted/30 dark:border-zinc-800/60 dark:bg-[#141519]">
                <div className="col-span-2 md:col-span-4 border-b border-border/40 pb-3 mb-1 dark:border-zinc-800/60">
                  <TaskMultiOwnerSelect
                    label="Owner"
                    selectedOwners={
                      (activeTask.owners && activeTask.owners.length > 0
                        ? activeTask.owners
                        : activeTask.owner && activeTask.owner !== "Unassigned"
                        ? activeTask.owner.split(",").map((s) => s.trim()).filter(Boolean)
                        : []
                      ).filter((o) => o && o.trim().toLowerCase() !== "unassigned")
                    }
                    onChangeOwners={(newOwners) => {
                      if (!canEditTask) {
                        alert("Only the task owner can change the owner.");
                        return;
                      }
                      const cleanOwners = newOwners.filter((o) => o && o.trim().toLowerCase() !== "unassigned");
                      const primaryOwnerStr = cleanOwners.length > 0 ? cleanOwners.join(", ") : "Unassigned";
                      const updatedTask = {
                        ...activeTask,
                        owners: cleanOwners,
                        owner: primaryOwnerStr,
                      };
                      setTasks((prev) =>
                        prev.map((t) => (t.id === activeTask.id ? updatedTask : t))
                      );
                      updateTaskAction(activeTask.id, {
                        owners: cleanOwners,
                        owner: primaryOwnerStr,
                      })
                        .then((result) => {
                          if (result.success) {
                            console.log("[DB SAVE SUCCESS] Task owners saved in DB:", {
                              taskId: activeTask.id,
                              owners: newOwners,
                              primaryOwner: primaryOwnerStr,
                            });
                          } else {
                            setTasks((prev) =>
                              prev.map((t) => (t.id === activeTask.id ? activeTask : t))
                            );
                            alert(result.error || "You do not have permission to edit this task.");
                          }
                        })
                        .catch((err) => console.error("Failed to update task owner in DB:", err));
                    }}
                    ownersList={ownersOptions}
                    disabled={!canEditTask}
                  />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs font-medium mb-1 dark:text-zinc-400">Start Date</span>
                  {canEditTask ? (
                    <input
                      type="date"
                      value={parseDateForInput(activeTask.startDate)}
                      onChange={(e) => {
                        const newIso = e.target.value;
                        const newDisplay = newIso ? formatInputToDisplayDate(newIso) : "--";
                        handleUpdateTaskField({
                          startDate: newDisplay,
                          duration: computeDuration(newDisplay, activeTask.dueDate, activeTask.duration),
                        });
                      }}
                      className="w-auto max-w-[140px] bg-transparent font-semibold text-foreground outline-none text-sm cursor-pointer dark:text-zinc-100 dark:[color-scheme:dark]"
                    />
                  ) : (
                    <span className="font-semibold text-foreground text-sm dark:text-zinc-100">
                      {formatSafeDisplayDate(activeTask.startDate)}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs font-medium mb-1 dark:text-zinc-400">Due Date</span>
                  {canEditTask ? (
                    <input
                      type="date"
                      value={parseDateForInput(activeTask.dueDate)}
                      onChange={(e) => {
                        const newIso = e.target.value;
                        const newDisplay = newIso ? formatInputToDisplayDate(newIso) : "--";
                        handleUpdateTaskField({
                          dueDate: newDisplay,
                          duration: computeDuration(activeTask.startDate, newDisplay, activeTask.duration),
                        });
                      }}
                      className="w-auto max-w-[140px] bg-transparent font-semibold text-foreground outline-none text-sm cursor-pointer dark:text-zinc-100 dark:[color-scheme:dark]"
                    />
                  ) : (
                    <span className="font-semibold text-foreground text-sm dark:text-zinc-100">
                      {formatSafeDisplayDate(activeTask.dueDate)}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs font-medium mb-1 dark:text-zinc-400">Priority</span>
                  {canEditTask ? (
                    <select
                      value={activeTask.priority || "None"}
                      onChange={(e) => handleUpdateTaskField({ priority: e.target.value as TaskItem["priority"] })}
                      className="w-auto max-w-fit pr-1 bg-transparent font-semibold text-foreground outline-none cursor-pointer dark:text-zinc-100 text-sm"
                    >
                      <option value="None" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100">None</option>
                      <option value="Low" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100">Low</option>
                      <option value="Medium" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100">Medium</option>
                      <option value="High" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100">High</option>
                      <option value="Urgent" className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100">Urgent</option>
                    </select>
                  ) : (
                    <span className="font-semibold text-foreground text-sm dark:text-zinc-100">{activeTask.priority || "None"}</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs font-medium mb-1 dark:text-zinc-400">Duration</span>
                  <span className="font-semibold text-foreground text-sm dark:text-zinc-100">
                    {computeDuration(activeTask.startDate, activeTask.dueDate, activeTask.duration)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs font-medium mb-1 dark:text-zinc-400">Total Logged Hours</span>
                  <span className="font-bold text-foreground font-mono text-sm dark:text-zinc-100">{formattedTotalTaskHours} h</span>
                </div>
              </div>
            )}
          </div>

          {/* Tabs Bar & Content */}
          <div className="border border-border rounded-xl bg-card overflow-hidden dark:border-zinc-800 dark:bg-[#121215]">
            {/* Tabs Header Scrollbar */}
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs font-semibold dark:border-zinc-800">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {[
                  { key: "COMMENTS", label: "Comments" },
                  { key: "SUBTASKS", label: "Subtasks" },
                  { key: "LOG_HOURS", label: `Log Hours (${formattedTotalTaskHours})` },
                  { key: "DOCUMENTS", label: "Documents" },
                  { key: "STATUS_TIMELINE", label: "Status Timeline" },
                  { key: "STANDUP_ACTIVITY", label: "Standup Activity" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                      activeTab === tab.key
                        ? "bg-primary/10 text-primary font-bold border border-primary/20 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Add Time Log button placed in tabs header bar */}
              {activeTab === "LOG_HOURS" && (
                <button
                  type="button"
                  onClick={() => setIsTimeLogModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-md bg-[#0088ff] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0077ee] transition-colors cursor-pointer shrink-0 ml-auto"
                >
                  <Plus size={14} />
                  <span>Add Effort Log</span>
                </button>
              )}
            </div>

            {/* Tab Body Content */}
            <div className="p-4 space-y-4">
              {activeTab === "COMMENTS" && (
                <div className="space-y-4">
                  {/* Clean Comment Input Box with explicit Save button */}
                  <div className="space-y-3 rounded-xl border border-border bg-card p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-[#141519]">
                    <textarea
                      rows={3}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment or update on this task..."
                      className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none resize-y font-sans dark:text-zinc-100 dark:placeholder-zinc-500"
                    />

                    <div className="flex items-center justify-end pt-2.5 border-t border-border/60 dark:border-zinc-800/60">
                      <button
                        type="button"
                        onClick={handleAddComment}
                        disabled={!commentText.trim() || isSavingComment}
                        className="flex items-center gap-1.5 rounded-md bg-[#0088ff] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#0077ee] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isSavingComment ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        <span>Save Comment</span>
                      </button>
                    </div>
                  </div>

                  {/* Comments Feed */}
                  <div className="space-y-3 pt-1">
                    {commentsList.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground italic dark:text-zinc-400">
                        No comments yet. Post a comment above to start the discussion!
                      </div>
                    ) : (
                      commentsList.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-border/80 bg-card p-3.5 space-y-1 text-xs shadow-2xs dark:border-zinc-800/80 dark:bg-[#141519]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground dark:text-zinc-200">{c.author}</span>
                            <span className="text-[10px] text-muted-foreground dark:text-zinc-400">{c.time}</span>
                          </div>
                          <p className="text-foreground/90 leading-relaxed dark:text-zinc-300">{c.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === "SUBTASKS" && (
                <div className="space-y-4 text-xs font-sans">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between pb-2 border-b border-border dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setIsAddSubtaskDrawerOpen(true)}
                      className="flex items-center gap-1.5 rounded-md bg-[#0088ff] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0077ee] transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Add Subtask</span>
                    </button>
                  </div>

                  {/* Table View */}
                  <div className="overflow-x-auto rounded-lg border border-border bg-card dark:border-zinc-800 dark:bg-[#121215]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-400">
                          <th className="py-2.5 px-3 border-r border-border w-24 dark:border-zinc-800">ID</th>
                          <th className="py-2.5 px-4 border-r border-border min-w-[240px] dark:border-zinc-800">Task Name</th>
                          <th className="py-2.5 px-3 border-r border-border w-32 dark:border-zinc-800">
                            <span className="inline-flex items-center gap-1">
                              <CheckSquare size={12} /> Status
                            </span>
                          </th>
                          <th className="py-2.5 px-3 border-r border-border w-32 dark:border-zinc-800">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} /> Start Date
                            </span>
                          </th>
                          <th className="py-2.5 px-3 border-r border-border w-32 dark:border-zinc-800">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} /> Due Date
                            </span>
                          </th>
                          <th className="py-2.5 px-2 text-center w-10">
                            <Layers size={13} />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 dark:divide-zinc-800/60">
                        {subtasks.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-muted-foreground italic dark:text-zinc-400">
                              No subtasks added yet. Click &quot;Add Subtask&quot; below to create one.
                            </td>
                          </tr>
                        ) : (
                          subtasks.map((st) => (
                            <tr
                              key={st.id}
                              onClick={() => router.push(`/projects/${projectId}/tasks/${st.code}`)}
                              className="hover:bg-accent/30 transition-colors group cursor-pointer dark:hover:bg-zinc-800/30"
                              title="Open this subtask"
                            >
                              <td className="py-2 px-3 border-r border-border font-mono text-[11px] text-muted-foreground font-semibold dark:border-zinc-800 dark:text-zinc-400">
                                {st.code}
                              </td>
                              <td className="py-2 px-4 border-r border-border font-medium text-foreground dark:border-zinc-800 dark:text-zinc-200">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isTaskDone(st.status, st.completed)}
                                    onChange={() => handleToggleSubtask(st.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded border-input text-primary h-3.5 w-3.5 cursor-pointer"
                                  />
                                  <span className={isTaskDone(st.status, st.completed) ? "line-through text-muted-foreground dark:text-zinc-500" : "hover:underline"}>
                                    {st.title}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3 border-r border-border dark:border-zinc-800">
                                <select
                                  value={st.status}
                                  onChange={(e) => handleSubtaskStatusChange(st.id, e.target.value as TaskStatus)}
                                  onClick={(e) => e.stopPropagation()}
                                  className={cn(
                                    "rounded px-2 py-0.5 text-xs font-semibold outline-none cursor-pointer border transition-colors",
                                    getTaskStatusBadgeClasses(st.status)
                                  )}
                                >
                                  {PROJECT_TASK_STATUSES.map((s) => (
                                    <option key={s} value={s} className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100">{s}</option>
                                  ))}
                                  {!PROJECT_TASK_STATUSES.includes(st.status as any) && (
                                    <option value={st.status} className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100">{st.status}</option>
                                  )}
                                </select>
                              </td>
                              <td className="py-2 px-3 border-r border-border text-muted-foreground dark:border-zinc-800 dark:text-zinc-400">
                                {st.startDate || "--"}
                              </td>
                              <td className="py-2 px-3 border-r border-border text-muted-foreground dark:border-zinc-800 dark:text-zinc-400">
                                {st.dueDate || "--"}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSubtask(st.id);
                                  }}
                                  className="text-muted-foreground hover:text-destructive p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                  title="Delete subtask"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}

                        {/* Inline Add Row */}
                        <tr className="bg-muted/20 dark:bg-[#141519]/60">
                          <td className="py-2.5 px-3 border-r border-border text-muted-foreground font-mono text-[11px] dark:border-zinc-800 dark:text-zinc-400">
                            {activeTask.code}.{subtasks.length + 1}
                          </td>
                          <td colSpan={5} className="py-2 px-4">
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleAddSubtaskSubmit();
                              }}
                              className="flex items-center gap-3 w-full"
                            >
                              <input
                                type="text"
                                value={newSubtaskTitle}
                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                placeholder="Add Subtask"
                                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none font-medium dark:text-zinc-100 dark:placeholder-zinc-500"
                              />

                              {newSubtaskTitle.trim() && (
                                <button
                                  type="submit"
                                  className="rounded bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 cursor-pointer"
                                >
                                  Add
                                </button>
                              )}
                            </form>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "LOG_HOURS" && (
                <div className="space-y-4 text-xs font-sans">
                  {/* Live Active Running Timer Banner */}
                  {activeTimerStatus !== "IDLE" && (
                    <div className="flex flex-wrap items-center justify-between p-3.5 rounded-xl border border-primary/30 bg-primary/5 text-foreground dark:border-zinc-700 dark:bg-zinc-900/90 animate-in fade-in-0 duration-200 gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3 items-center justify-center">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground dark:text-zinc-100">
                              {activeTimerStatus === "RUNNING" ? "Active Timer Running..." : "Timer Paused"}
                            </span>
                            <span className="text-[11px] font-mono font-semibold text-muted-foreground dark:text-zinc-400">
                              ({activeTask.code} - {activeTask.title})
                            </span>
                          </div>
                          <div className="font-mono text-lg font-extrabold text-foreground dark:text-zinc-100 mt-0.5">
                            {formatHMS(activeTimerSeconds)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {activeTimerStatus === "RUNNING" ? (
                          <button
                            type="button"
                            onClick={handlePauseTimer}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                          >
                            <Pause size={13} fill="currentColor" />
                            <span>Pause Timer</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleStartTimer}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                          >
                            <Play size={13} fill="currentColor" />
                            <span>Resume Timer</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleStopTimer}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                        >
                          <Square size={13} fill="currentColor" />
                          <span>Stop & Log Effort</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Date-Grouped Time Logs Table */}
                  <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-2xs dark:border-zinc-800 dark:bg-[#121215]">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                      <thead>
                        <tr className="border-b border-border bg-muted/60 text-muted-foreground font-semibold dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-400">
                          <th className="py-2.5 px-3 border-r border-border w-10 text-center dark:border-zinc-800">
                            <ChevronDown size={13} className="text-muted-foreground mx-auto" />
                          </th>
                          <th className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-zinc-800">
                            <div className="flex items-center gap-1.5">
                              <User size={13} className="text-muted-foreground" />
                              <span>User</span>
                            </div>
                          </th>
                          <th className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-zinc-800">
                            <div className="flex items-center gap-1.5">
                              <Clock size={13} className="text-muted-foreground" />
                              <span>Daily Log Hours</span>
                            </div>
                          </th>
                          <th className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-zinc-800">
                            <div className="flex items-center gap-1.5">
                              <Clock size={13} className="text-muted-foreground" />
                              <span>Time Period</span>
                            </div>
                          </th>
                          <th className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-zinc-800">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={13} className="text-muted-foreground" />
                              <span>Date</span>
                            </div>
                          </th>
                          <th className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-zinc-800">
                            Billing Type
                          </th>
                          <th className="py-2.5 px-4 border-r border-border whitespace-nowrap dark:border-zinc-800">
                            Approval Status
                          </th>
                          <th className="py-2.5 px-4 border-r border-border min-w-[180px] dark:border-zinc-800">
                            Notes
                          </th>
                          <th className="py-2.5 px-4 whitespace-nowrap text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 dark:divide-zinc-800/60">
                        {dateGroupsData.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-muted-foreground italic dark:text-zinc-400">
                              No effort logs recorded for this task yet. Click &quot;Add Effort Log&quot; to log work hours.
                            </td>
                          </tr>
                        ) : (
                          dateGroupsData.map((group) => {
                            const isCollapsed = collapsedDates[group.date];
                            return (
                              <React.Fragment key={group.date}>
                                {/* Date Group Header Row */}
                                <tr className="bg-muted/80 font-bold border-b border-border text-foreground hover:bg-muted transition-colors dark:bg-[#141519] dark:border-zinc-800">
                                  <td className="py-2 px-3 border-r border-border text-center dark:border-zinc-800">
                                    <button
                                      type="button"
                                      onClick={() => toggleDateCollapse(group.date)}
                                      className="text-muted-foreground hover:text-foreground p-0.5"
                                    >
                                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                  </td>
                                  <td colSpan={1} className="py-2 px-4 border-r border-border font-bold text-foreground whitespace-nowrap dark:border-zinc-800">
                                    <div className="flex items-center gap-2">
                                      <Calendar size={14} className="text-muted-foreground" />
                                      <span className="font-bold text-foreground dark:text-zinc-100">{group.date}</span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-4 border-r border-border font-mono font-bold whitespace-nowrap dark:border-zinc-800">
                                    <div className="flex items-center gap-2 text-xs font-mono font-bold">
                                      <span className="text-foreground dark:text-zinc-100">{group.totalHours}</span>
                                      <span className="text-primary dark:text-zinc-200">{group.billableHours}</span>
                                      <span className="text-warning dark:text-amber-400">{group.nonBillableHours}</span>
                                    </div>
                                  </td>
                                  <td colSpan={6} className="py-2 px-4" />
                                </tr>

                                {!isCollapsed &&
                                  group.logs.map((log) => (
                                    <tr
                                      key={log.id}
                                      className="border-b border-border/60 hover:bg-accent/30 transition-colors dark:border-zinc-800/60 dark:hover:bg-zinc-800/30 group"
                                    >
                                      <td className="py-2 px-3 border-r border-border text-center dark:border-zinc-800">
                                        <div className="flex items-center justify-center gap-1">
                                          <input
                                            type="checkbox"
                                            className="rounded border-input text-primary h-3.5 w-3.5 cursor-pointer"
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <FileText size={13} className="text-muted-foreground/70" />
                                        </div>
                                      </td>

                                      {/* User Name (Read-Only User Attribution) */}
                                      <td className="py-2 px-4 border-r border-border font-semibold text-foreground whitespace-nowrap dark:border-zinc-800 dark:text-zinc-200">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-muted-foreground text-[11px]">↑</span>
                                          <span>{log.userName && log.userName !== "User" ? log.userName : (currentUser?.name && currentUser.name !== "User" ? currentUser.name : "System User")}</span>
                                        </div>
                                      </td>

                                      {/* Duration Auto-Save Input */}
                                      <td className="py-1.5 px-3 border-r border-border whitespace-nowrap dark:border-zinc-800">
                                        <input
                                          type="text"
                                          defaultValue={log.duration}
                                          key={`duration-${log.id}-${log.duration}`}
                                          onBlur={(e) => {
                                            if (e.target.value !== log.duration) {
                                              handleAutoSaveField(log.id, { duration: e.target.value });
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              (e.target as HTMLInputElement).blur();
                                            }
                                          }}
                                          className="w-20 px-2 py-1 text-xs border border-transparent hover:border-border focus:border-primary rounded bg-transparent text-foreground font-mono font-bold focus:bg-background focus:outline-hidden transition-colors dark:text-zinc-100"
                                          onClick={(e) => e.stopPropagation()}
                                          title="Click to edit duration. Auto-saves on Enter or blur."
                                        />
                                      </td>

                                      {/* Time Period Auto-Save Input */}
                                      <td className="py-1.5 px-3 border-r border-border whitespace-nowrap dark:border-zinc-800">
                                        <input
                                          type="text"
                                          defaultValue={log.timePeriod}
                                          key={`timePeriod-${log.id}-${log.timePeriod}`}
                                          onBlur={(e) => {
                                            if (e.target.value !== log.timePeriod) {
                                              handleAutoSaveField(log.id, { timePeriod: e.target.value });
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              (e.target as HTMLInputElement).blur();
                                            }
                                          }}
                                          className="w-48 min-w-[175px] px-2 py-1 text-xs border border-transparent hover:border-border focus:border-primary rounded bg-transparent text-muted-foreground font-mono focus:bg-background focus:text-foreground focus:outline-hidden transition-colors dark:text-zinc-400"
                                          onClick={(e) => e.stopPropagation()}
                                          title="Click to edit time period. Auto-saves on Enter or blur."
                                        />
                                      </td>

                                      {/* Date Auto-Save Input */}
                                      <td className="py-1.5 px-3 border-r border-border whitespace-nowrap dark:border-zinc-800">
                                        <input
                                          type="text"
                                          defaultValue={log.date}
                                          key={`date-${log.id}-${log.date}`}
                                          onBlur={(e) => {
                                            if (e.target.value !== log.date) {
                                              handleAutoSaveField(log.id, { date: e.target.value });
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              (e.target as HTMLInputElement).blur();
                                            }
                                          }}
                                          className="w-28 px-2 py-1 text-xs border border-transparent hover:border-border focus:border-primary rounded bg-transparent text-foreground font-mono font-medium focus:bg-background focus:outline-hidden transition-colors dark:text-zinc-200"
                                          onClick={(e) => e.stopPropagation()}
                                          title="Click to edit date. Auto-saves on Enter or blur."
                                        />
                                      </td>

                                      {/* Billing Type Auto-Save Select */}
                                      <td className="py-1.5 px-3 border-r border-border whitespace-nowrap dark:border-zinc-800">
                                        <select
                                          value={log.billingType}
                                          onChange={(e) => handleAutoSaveField(log.id, { billingType: e.target.value as "BILLABLE" | "NON BILLABLE" })}
                                          className={`px-2 py-1 text-xs border border-transparent hover:border-border focus:border-primary rounded bg-transparent font-semibold focus:bg-background focus:outline-hidden cursor-pointer transition-colors ${
                                            log.billingType === "BILLABLE" ? "text-primary dark:text-zinc-200" : "text-warning dark:text-amber-400"
                                          }`}
                                          onClick={(e) => e.stopPropagation()}
                                          title="Click to change billing type. Auto-saves automatically."
                                        >
                                          <option value="BILLABLE" className="text-primary dark:bg-zinc-900 dark:text-zinc-100">Billable</option>
                                          <option value="NON BILLABLE" className="text-warning dark:bg-zinc-900 dark:text-zinc-100">Non Billable</option>
                                        </select>
                                      </td>

                                      {/* Approval Status Auto-Save Select */}
                                      <td className="py-1.5 px-3 border-r border-border whitespace-nowrap dark:border-zinc-800">
                                        <select
                                          value={log.approvalStatus || "Pending"}
                                          onChange={(e) => handleAutoSaveField(log.id, { approvalStatus: e.target.value as "Pending" | "Approved" | "Rejected" })}
                                          className="px-2 py-1 text-xs border border-transparent hover:border-border focus:border-primary rounded bg-transparent font-semibold focus:bg-background focus:outline-hidden cursor-pointer transition-colors dark:bg-transparent disabled:cursor-not-allowed disabled:opacity-60"
                                          onClick={(e) => e.stopPropagation()}
                                          disabled={!isProjectOwner}
                                          title={isProjectOwner ? "Click to change approval status. Auto-saves automatically." : "Only the project owner can change the approval status"}
                                        >
                                          <option value="Pending" className="dark:bg-zinc-900 dark:text-zinc-100">Pending</option>
                                          <option value="Approved" className="dark:bg-zinc-900 dark:text-zinc-100">Approved</option>
                                          <option value="Rejected" className="dark:bg-zinc-900 dark:text-zinc-100">Rejected</option>
                                        </select>
                                      </td>

                                      {/* Notes Auto-Save Input */}
                                      <td className="py-1.5 px-3 border-r border-border dark:border-zinc-800">
                                        <input
                                          type="text"
                                          defaultValue={log.remarks || log.title || ""}
                                          key={`remarks-${log.id}-${log.remarks}`}
                                          onBlur={(e) => {
                                            const currentText = log.remarks || log.title || "";
                                            if (e.target.value !== currentText) {
                                              handleAutoSaveField(log.id, { remarks: e.target.value });
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              (e.target as HTMLInputElement).blur();
                                            }
                                          }}
                                          className="w-full px-2 py-1 text-xs border border-transparent hover:border-border focus:border-primary rounded bg-transparent text-muted-foreground focus:bg-background focus:text-foreground focus:outline-hidden transition-colors dark:text-zinc-300"
                                          onClick={(e) => e.stopPropagation()}
                                          placeholder="Notes / Remarks"
                                          title="Click to edit notes. Auto-saves on Enter or blur."
                                        />
                                      </td>

                                      {/* Actions & Auto-Save Indicator */}
                                      <td className="py-2 px-4 text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-2">
                                          {savingLogId === log.id && (
                                            <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1 animate-in fade-in-0 duration-150">
                                              <Check size={12} /> Saved
                                            </span>
                                          )}
                                          <button
                                            type="button"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              const ok = await confirm({
                                                title: "Delete effort log?",
                                                description: "Are you sure you want to delete this effort log?",
                                              });
                                              if (ok) {
                                                await deleteTimeLogAction(log.id);
                                                refreshTaskTimeLogs();
                                              }
                                            }}
                                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                            title="Delete Effort Log"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>

                    {/* Table Footer Bar */}
                    <div className="flex items-center justify-between px-4 py-3 bg-card border-t border-border font-sans text-xs dark:border-zinc-800 dark:bg-[#141519]">
                      <div className="flex items-center gap-5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground font-semibold">Billable</span>
                          <span className="text-primary font-mono font-extrabold dark:text-zinc-200">{formattedTaskBillableHours} h</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground font-semibold">Non Billable</span>
                          <span className="text-warning font-mono font-extrabold dark:text-amber-400">{formattedTaskNonBillableHours} h</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground font-semibold">Total</span>
                          <span className="text-foreground font-mono font-extrabold dark:text-zinc-100">{formattedTotalTaskHours} h</span>
                        </div>
                      </div>

                      <div className="text-muted-foreground font-semibold dark:text-zinc-400 font-mono">
                        Total Count: {taskTimeLogs.length}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "ACTIVITY" && (
                <div className="space-y-3 text-xs">
                  {taskActivities.length === 0 ? (
                    <div className="text-muted-foreground py-4 text-center dark:text-zinc-400">
                      No activity recorded yet for this task.
                    </div>
                  ) : (
                    taskActivities
                      .slice()
                      .reverse()
                      .map((act) => (
                        <div key={act.id} className="flex items-start gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                            {act.userInitials || act.userName.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-foreground dark:text-zinc-200">
                              <span className="font-semibold">{act.userName}</span>{" "}
                              {act.actionText}
                            </p>
                            <span className="text-[10px] text-muted-foreground dark:text-zinc-500">
                              {act.date} at {act.time}
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}

              {activeTab === "DOCUMENTS" && (
                <TaskDocumentsTab taskId={activeTask.id} projectId={projectId} />
              )}

              {activeTab === "STATUS_TIMELINE" && (
                <TaskStatusTimelineTab taskId={activeTask.id} />
              )}

              {activeTab === "STANDUP_ACTIVITY" && projectId && (
                <div className="p-4">
                  <ProjectStandupRollup projectId={projectId} />
                </div>
              )}

              {activeTab === "CHECKLIST" && (
                <div className="text-xs text-muted-foreground py-4 text-center dark:text-zinc-400">
                  Checklist items for {activeTask.code}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* New Time Log Modal */}
      <NewTimeLogModal
        isOpen={isTimeLogModalOpen}
        onClose={() => setIsTimeLogModalOpen(false)}
        initialProject={project?.name || projectId}
        projectId={projectId}
        projectName={project?.name}
        initialTaskCode={activeTask.code}
        assignedUsers={activeTask.owner ? [activeTask.owner] : undefined}
        onLogAdded={refreshTaskTimeLogs}
      />

      {/* Add Subtask Drawer */}
      <AddSubtaskDrawer
        isOpen={isAddSubtaskDrawerOpen}
        onClose={() => setIsAddSubtaskDrawerOpen(false)}
        parentTaskCode={activeTask.code}
        nextSubtaskNumber={subtasks.length + 1}
        onAddSubtask={(newSubtask) => {
          createSubtaskAction(activeTask.id, {
            title: newSubtask.title,
            status: newSubtask.status,
            ownerName: newSubtask.ownerName,
            startDate: newSubtask.startDate,
            dueDate: newSubtask.dueDate,
            completed: newSubtask.completed,
          })
            .then((created) => {
              if (!created) return;
              const updatedSubtasks = [...subtasks, created];
              const updatedTask = { ...activeTask, subtasks: updatedSubtasks };
              setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? updatedTask : t)));
            })
            .catch((err) => console.error("Failed to save subtask:", err));
        }}
      />

      {/* Timer Stopped Modal */}
      <TimerStoppedModal
        isOpen={isStoppedModalOpen}
        onClose={() => setIsStoppedModalOpen(false)}
        elapsedSeconds={stoppedSeconds}
        taskTitle={activeTask.title}
        taskCode={activeTask.code}
        initialStartTime={activeTimerStartTime}
        onSaveLog={handleTimerLogSaved}
        onDiscardLog={handleTimerLogDiscarded}
      />

      {ConfirmDialog}
    </div>
    </ActiveTimerProvider>
  );
}
