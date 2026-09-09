"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Columns,
  RotateCw,
  Plus,
  CheckSquare,
  AlertCircle,
  Layers,
  AlertTriangle,
  Sparkles,
  FileText,
  User as UserIcon,
  CheckCircle2,
  Edit3,
  Check,
  ChevronRight,
  ChevronDown,
  ArrowRightLeft,
  ArrowLeftToLine,
  ArrowRightToLine,
  MoreVertical,
  Trash2,
  Eye,
  X,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { TaskItem, TaskStatus, TaskSubtask, UserTimeGroup, WorkspaceRole } from "../../types";
import { TaskDetailDrawer } from "../modals/task-detail-drawer";
import { TaskMultiOwnerSelect } from "../task-multi-owner-select";
import { AddTaskDrawer } from "../modals/add-task-drawer";
import { ChecklistWorkspaceView } from "./checklist-workspace-view";
import { PhasesTableView } from "./phases-table-view";
import { TimeTrackerView } from "./time-tracker-view";
import { TimerWidget } from "../timer-widget";
import { ActiveTimerProvider } from "../../context/active-timer-context";
import { NewTimeLogModal } from "../modals/new-time-log-modal";
import { analyzeTaskStaleness } from "../../manager/ai-project-assistant";
import {
  getTimeLogsAction,
  getCurrentUserContextAction,
  updateTaskAction,
  deleteTaskAction,
  getProjectMembersAction,
  reorderProjectTasksAction,
} from "../../actions/project-actions";
import { getAllUserOptionsAction } from "@/features/users/actions/user-actions";

interface TasksBoardViewProps {
  tasks: TaskItem[];
  onAddTask: (newTask: TaskItem) => void;
  onUpdateTask: (updatedTask: TaskItem) => void;
  assignedToMeCount?: number;
  projectCode?: string;
  projectName?: string;
  /** When true, an empty `tasks` list renders a genuine empty state instead of demo filler
   * cards — use this wherever `tasks` already reflects a real, meaningful query result (e.g.
   * the cross-project "My Tasks" page), so a real user is never shown fabricated tasks as theirs. */
  disableDemoFallback?: boolean;
}

// Fallback initial tasks for rich rendering matching reference design
const FALLBACK_PROJECT_TASKS: TaskItem[] = [
  {
    id: "WI1-T02",
    code: "WI1-T02",
    title: "Market analysis for Q4 expansion strategy",
    phaseCode: "3.1",
    phaseName: "UI/UX DESIGNING",
    status: "Open",
    authorName: "Dhruv Patidar",
    associatedTeam: "Design",
    departmentAlias: "design@",
    owner: "Dhruv Patidar",
    workHours: "04:00",
    startDate: "20/08/2026",
    dueDate: "25/08/2026",
    duration: "5 days",
    completionPercentage: 35,
    priority: "High",
    tags: ["UI/UX", "Design"],
    billingType: "Hourly Rate",
    description: "Design UI/UX screens for WinOS in Figma.",
  },
  {
    id: "WI1-T25",
    code: "WI1-T25",
    title: "Initial wireframes for the new customer dashboard",
    phaseCode: "3.1",
    phaseName: "UI/UX DESIGNING",
    status: "In Progress",
    authorName: "M Thakre",
    associatedTeam: "Design",
    departmentAlias: "design@",
    owner: "Dhruv Patidar",
    workHours: "06:30",
    startDate: "18/08/2026",
    dueDate: "24/08/2026",
    duration: "6 days",
    completionPercentage: 60,
    priority: "Medium",
    tags: ["Research", "Design"],
    billingType: "Hourly Rate",
    description: "Conduct component audit for design system.",
  },
  {
    id: "WI1-T22",
    code: "WI1-T22",
    title: "Dark mode color system refinement and accessibility check",
    phaseCode: "3.1",
    phaseName: "UI/UX DESIGNING",
    status: "In Progress",
    authorName: "System",
    associatedTeam: "Design",
    departmentAlias: "design@",
    owner: "Dhruv Patidar",
    workHours: "02:00",
    startDate: "19/08/2026",
    dueDate: "22/08/2026",
    duration: "3 days",
    completionPercentage: 20,
    priority: "Low",
    tags: ["UX"],
    billingType: "Non Billable",
    description: "Refine dark mode color tokens.",
  },
  {
    id: "WI1-T31",
    code: "WI1-T31",
    title: "Annual report infographics and data visualization assets",
    phaseCode: "4.1",
    phaseName: "DEVELOPMENT",
    status: "Closed",
    authorName: "Dhruv Patidar",
    associatedTeam: "Engineering",
    departmentAlias: "dev@",
    owner: "Dhruv Patidar",
    workHours: "08:00",
    startDate: "15/08/2026",
    dueDate: "28/08/2026",
    duration: "13 days",
    completionPercentage: 100,
    priority: "High",
    tags: ["Assets", "Design"],
    billingType: "Hourly Rate",
    description: "Build infographics assets.",
  },
  {
    id: "WI1-T35",
    code: "WI1-T35",
    title: "Draft technical documentation for API v2.0 release",
    phaseCode: "4.1",
    phaseName: "DEVELOPMENT",
    status: "Open",
    authorName: "Dhruv Patidar",
    associatedTeam: "Engineering",
    departmentAlias: "dev@",
    owner: "Dhruv Patidar",
    workHours: "05:00",
    startDate: "20/08/2026",
    dueDate: "26/08/2026",
    duration: "6 days",
    completionPercentage: 40,
    priority: "High",
    tags: ["API", "Docs"],
    billingType: "Hourly Rate",
    description: "Write API v2.0 documentation.",
  },
];

// Standard Kanban Phase Columns
const DEFAULT_KANBAN_PHASES = [
  { code: "1.1", name: "1.1 CLIENT ON BOARDING" },
  { code: "1.2", name: "1.2 REQUIREMENT COLLECTION & DOCUMENTATION" },
  { code: "2.1", name: "2.1 UX RESEARCH & DISCOVERY" },
  { code: "2.2", name: "2.2 IDEATION & CONCEPTUALIZATION" },
  { code: "3.1", name: "3.1 UI/UX DESIGNING" },
  { code: "3.2", name: "3.2 GRAPHIC DESIGNING" },
  { code: "3.3", name: "3.3 CONTENT WRITING" },
  { code: "4.1", name: "4.1 DEVELOPMENT" },
  { code: "5.1", name: "5.1 TESTING" },
  { code: "6.1", name: "6.1 DEPLOYMENT AND SEO" },
  { code: "7.1", name: "7.1 MAINTENANCE & SUPPORT" },
  { code: "7.2", name: "7.2 MSO ON-PAGE & TECHNICAL SEO" },
  { code: "7.3", name: "7.3 MSO OFF-PAGE" },
  { code: "7.4", name: "7.4 MSO CONTENT MARKETING" },
  { code: "7.5", name: "7.5 MSO MAIN" },
  { code: "7.6", name: "7.6 MSO LOCAL SEO" },
  { code: "7.7", name: "7.7 MSO PERFORMANCE MARKETING" },
];

export function TasksBoardView({
  tasks,
  onAddTask,
  onUpdateTask,
  assignedToMeCount: propAssignedToMeCount = 0,
  projectCode,
  projectName,
  disableDemoFallback = false,
}: TasksBoardViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "TASKS" | "DASHBOARD" | "PHASES" | "TIME_LOGS" | "CHECKLIST"
  >("TASKS");

  // Local mutable copy of `tasks` so a drag-reorder can render immediately (and persist via
  // reorderProjectTasksAction) without waiting on a full page revalidation.
  const [localTasks, setLocalTasks] = useState<TaskItem[]>(tasks);
  const [prevTasksProp, setPrevTasksProp] = useState(tasks);
  if (tasks !== prevTasksProp) {
    setPrevTasksProp(tasks);
    setLocalTasks(tasks);
  }

  // Kanban card drag state — id of the card currently being dragged, if any.
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // View Mode: Board / Kanban vs List / Status Columns
  const [viewMode] = useState<"KANBAN">("KANBAN");

  // Task Scope Filter: Default to ALL_TASKS so all project template phase tasks are displayed
  const [taskScope, setTaskScope] = useState<"MY_TASKS" | "ALL_TASKS">("ALL_TASKS");

  // Current authenticated user context
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: WorkspaceRole;
  } | null>(null);

  useEffect(() => {
    getCurrentUserContextAction().then((u) => {
      if (u) setCurrentUser(u);
    });
  }, []);

  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isAddTaskDrawerOpen, setIsAddTaskDrawerOpen] = useState(false);
  const [selectedAddTaskPhase, setSelectedAddTaskPhase] = useState<string | undefined>(undefined);
  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);

  const handleOpenAddTaskForPhase = (phaseCode?: string) => {
    setSelectedAddTaskPhase(phaseCode);
    setIsAddTaskDrawerOpen(true);
  };

  // Filter & Options Popover States
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState("ALL");

  // Owner Assignment State
  const [userOptions, setUserOptions] = useState<{ id: string; name: string; email: string }[]>([]);
  const [expandedSubtaskCardIds, setExpandedSubtaskCardIds] = useState<Set<string>>(new Set());
  const [collapsedPhaseCodes, setCollapsedPhaseCodes] = useState<Set<string>>(new Set());

  const handleTogglePhaseCollapse = (phaseCode: string) => {
    setCollapsedPhaseCodes((prev) => {
      const next = new Set(prev);
      if (next.has(phaseCode)) {
        next.delete(phaseCode);
      } else {
        next.add(phaseCode);
      }
      return next;
    });
  };

  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const params = useParams();
  const realProjectId = params?.projectId as string | undefined;

  // Only members actually on this project can be assigned as a task owner — cross-project
  // views (e.g. "My Tasks", no :projectId in the route) fall back to the full user directory
  // since there's no single project to scope the list to.
  useEffect(() => {
    if (realProjectId) {
      getProjectMembersAction(realProjectId).then((members) => {
        if (members && members.length > 0) {
          setUserOptions(members.map((m) => ({ id: m.id, name: m.name, email: m.email })));
        }
      });
    } else {
      getAllUserOptionsAction().then((opts) => {
        if (opts && opts.length > 0) {
          setUserOptions(opts.map((o) => ({ ...o, email: "" })));
        }
      });
    }
  }, [realProjectId]);

  const isTaskOwner = useCallback(
    (task: TaskItem): boolean => {
      if (!currentUser) return false;
      const uName = currentUser.name.trim().toLowerCase();
      const uEmail = currentUser.email.trim().toLowerCase();

      if (task.ownerIds && task.ownerIds.length > 0) {
        if (task.ownerIds.includes(currentUser.id)) return true;
      }
      const ownerName = (task.owner || "").trim().toLowerCase();
      const ownersList = (task.owners || []).map((o) => o.trim().toLowerCase());

      return (
        ownerName === uName ||
        ownerName === uEmail ||
        ownersList.includes(uName) ||
        ownersList.includes(uEmail)
      );
    },
    [currentUser]
  );

  const handleChangeTaskOwners = async (task: TaskItem, nextOwners: string[]) => {
    const updatedTask = {
      ...task,
      owner: nextOwners[0] || "Unassigned",
      owners: nextOwners,
    };
    onUpdateTask(updatedTask);
    try {
      await updateTaskAction(task.id, { owners: nextOwners });
      router.refresh();
    } catch (err) {
      console.error("[TasksBoardView] Error assigning owner:", err);
    }
  };

  const handleMoveTaskToPhase = async (
    e: React.MouseEvent,
    task: TaskItem,
    phaseCode: string,
    phaseName: string
  ) => {
    e.stopPropagation();
    if (phaseCode === task.phaseCode) return;
    const updatedTask = { ...task, phaseCode, phaseName };
    onUpdateTask(updatedTask);
    try {
      await updateTaskAction(task.id, { phaseCode, phaseName });
      router.refresh();
    } catch (err) {
      console.error("[TasksBoardView] Error moving task to phase:", err);
    }
  };

  // Inline task-title editing, click-to-edit directly on the card.
  const [editingTitleTaskId, setEditingTitleTaskId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");

  const handleStartEditTitle = (e: React.MouseEvent, task: TaskItem) => {
    e.stopPropagation();
    setEditingTitleTaskId(task.id);
    setTitleDraft(task.title);
  };

  const commitTitleEdit = async (task: TaskItem) => {
    const trimmed = titleDraft.trim();
    setEditingTitleTaskId(null);
    if (!trimmed || trimmed === task.title) return;
    const updatedTask = { ...task, title: trimmed };
    onUpdateTask(updatedTask);
    try {
      await updateTaskAction(task.id, { title: trimmed });
      router.refresh();
    } catch (err) {
      console.error("[TasksBoardView] Error renaming task:", err);
    }
  };

  const handleChangeTaskStatus = async (task: TaskItem, newStatus: TaskStatus) => {
    if (newStatus === task.status) return;
    const updatedTask = { ...task, status: newStatus };
    onUpdateTask(updatedTask);
    try {
      await updateTaskAction(task.id, { status: newStatus });
      router.refresh();
    } catch (err) {
      console.error("[TasksBoardView] Error changing task status:", err);
    }
  };

  const handleDeleteTask = async (e: React.MouseEvent, task: TaskItem) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete task?",
      description: `Delete task "${task.title}" (${task.code})? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      const success = await deleteTaskAction(task.id);
      if (success) {
        router.refresh();
      }
    } catch (err) {
      console.error("[TasksBoardView] Error deleting task:", err);
    }
  };


  // Real project-scoped time logs for the in-board "Time Logs" subtab.
  const [projectTimeGroups, setProjectTimeGroups] = useState<UserTimeGroup[]>([]);
  useEffect(() => {
    if (activeSubTab !== "TIME_LOGS" || !realProjectId) return;
    let cancelled = false;
    getTimeLogsAction(realProjectId).then((groups) => {
      if (!cancelled) setProjectTimeGroups(groups);
    });
    return () => {
      cancelled = true;
    };
  }, [activeSubTab, realProjectId]);

  // Combine user tasks with fallback tasks
  const displayTasks = React.useMemo(() => {
    if (!disableDemoFallback && (!localTasks || localTasks.length === 0)) return FALLBACK_PROJECT_TASKS;
    return (localTasks || []).filter((t) => !t.parentTaskId);
  }, [localTasks, disableDemoFallback]);

  // Tasks owned by the current user
  const myOwnedTasks = React.useMemo(() => {
    if (!currentUser) return [];
    const uName = currentUser.name.trim().toLowerCase();

    return displayTasks.filter((t) => {
      if (t.ownerIds && t.ownerIds.length > 0) return t.ownerIds.includes(currentUser.id);
      const ownerName = (t.owner || "").trim().toLowerCase();
      const ownersList = (t.owners || []).map((o) => o.trim().toLowerCase());
      return ownerName === uName || ownersList.includes(uName);
    });
  }, [displayTasks, currentUser]);

  // Effective Task List depending on scope selection (falls back to displayTasks if myOwnedTasks has no tasks yet)
  const scopedTasks = React.useMemo(() => {
    if (taskScope === "MY_TASKS") {
      return myOwnedTasks.length > 0 ? myOwnedTasks : displayTasks;
    }
    return displayTasks;
  }, [taskScope, myOwnedTasks, displayTasks]);

  // Calculate Assignees / Owners
  const projectAssignees = React.useMemo(() => {
    const set = new Set<string>();
    displayTasks.forEach((t) => {
      if (t.owner && t.owner.trim() && t.owner !== "Unassigned") {
        set.add(t.owner.trim());
      }
    });
    return Array.from(set);
  }, [displayTasks]);

  // Multi-select & bulk actions, Zoho-style.
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const handleToggleTaskSelection = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedTaskIds(new Set());

  const handleBulkDelete = async () => {
    const selected = displayTasks.filter((t) => selectedTaskIds.has(t.id));
    if (selected.length === 0) return;
    const ok = await confirm({
      title: "Delete tasks?",
      description: `Delete ${selected.length} selected task(s)? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      await Promise.all(selected.map((t) => deleteTaskAction(t.id)));
      clearSelection();
      router.refresh();
    } catch (err) {
      console.error("[TasksBoardView] Error bulk deleting tasks:", err);
    }
  };

  const handleBulkStatusChange = async (newStatus: TaskStatus) => {
    const selected = displayTasks.filter((t) => selectedTaskIds.has(t.id));
    if (selected.length === 0) return;
    selected.forEach((t) => onUpdateTask({ ...t, status: newStatus }));
    try {
      await Promise.all(selected.map((t) => updateTaskAction(t.id, { status: newStatus })));
      clearSelection();
      router.refresh();
    } catch (err) {
      console.error("[TasksBoardView] Error bulk changing status:", err);
    }
  };

  const handleBulkAssignOwner = async (ownerName: string) => {
    const selected = displayTasks.filter((t) => selectedTaskIds.has(t.id));
    if (selected.length === 0) return;
    const nextOwnersByTask = new Map(
      selected.map((t) => {
        const current = t.owners && t.owners.length > 0 ? t.owners : t.owner ? [t.owner] : [];
        const nextOwners = current.includes(ownerName) ? current : [...current, ownerName];
        return [t.id, nextOwners];
      })
    );
    selected.forEach((t) => {
      const nextOwners = nextOwnersByTask.get(t.id)!;
      onUpdateTask({ ...t, owner: nextOwners[0] || "Unassigned", owners: nextOwners });
    });
    try {
      await Promise.all(
        selected.map((t) => updateTaskAction(t.id, { owners: nextOwnersByTask.get(t.id)! }))
      );
      clearSelection();
      router.refresh();
    } catch (err) {
      console.error("[TasksBoardView] Error bulk assigning owner:", err);
    }
  };

  const handleBulkMoveToPhase = async (phaseCode: string, phaseName: string) => {
    const selected = displayTasks.filter((t) => selectedTaskIds.has(t.id));
    if (selected.length === 0) return;
    selected.forEach((t) => onUpdateTask({ ...t, phaseCode, phaseName }));
    try {
      await Promise.all(selected.map((t) => updateTaskAction(t.id, { phaseCode, phaseName })));
      clearSelection();
      router.refresh();
    } catch (err) {
      console.error("[TasksBoardView] Error bulk moving tasks:", err);
    }
  };

  // Stale Task Analysis
  const stalenessAnalysis = analyzeTaskStaleness(scopedTasks);

  // Dynamic counts for footer
  const realTaskCount = displayTasks.length;
  const assignedToMeCount = myOwnedTasks.length;
  const realCompletedCount = displayTasks.filter((t) => t.status === "Closed").length;
  const realCompletionPercent =
    realTaskCount > 0 ? Math.round((realCompletedCount / realTaskCount) * 100) : 68;

  const handleOpenTask = (task: TaskItem) => {
    const taskId = task.code || task.id;
    const taskProjectId = task.projectId || realProjectId;
    if (!taskProjectId) return;
    router.push(`/projects/${taskProjectId}/tasks/${taskId}`);
  };

  const handleToggleSubtasksPanel = (e: React.MouseEvent, task: TaskItem) => {
    e.stopPropagation();
    setExpandedSubtaskCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) {
        next.delete(task.id);
      } else {
        next.add(task.id);
      }
      return next;
    });
  };

  // A subtask is a real ProjectTask row under the hood (parentTaskId set), so it supports the
  // exact same actions as a top-level task — this just reshapes the lightweight TaskSubtask
  // projection into a TaskItem so it can be rendered through the same renderTaskCard.
  const convertSubtaskToTaskItem = (subtask: TaskSubtask, parentTask: TaskItem): TaskItem => ({
    id: subtask.id,
    code: subtask.code,
    title: subtask.title,
    status: subtask.status,
    owner: subtask.ownerName,
    owners: subtask.ownerName ? [subtask.ownerName] : [],
    authorName: parentTask.authorName,
    phaseCode: parentTask.phaseCode,
    phaseName: parentTask.phaseName,
    projectId: parentTask.projectId,
    parentTaskId: parentTask.id,
    startDate: subtask.startDate,
    dueDate: subtask.dueDate,
  });

  // Applied Filtering
  const filteredTasks = scopedTasks.filter((t) => {
    const matchesStatus =
      selectedStatusFilter === "ALL" ||
      t.status.toLowerCase() === selectedStatusFilter.toLowerCase();

    const matchesDept =
      selectedDepartmentFilter === "ALL" ||
      t.departmentAlias === selectedDepartmentFilter;

    return matchesStatus && matchesDept;
  });

  // Group tasks by phase
  const phaseMap: Record<string, { code: string; name: string; tasks: TaskItem[] }> = {};
  DEFAULT_KANBAN_PHASES.forEach((p) => {
    phaseMap[p.code] = { code: p.code, name: p.name, tasks: [] };
  });

  filteredTasks.forEach((t) => {
    let code = (t.phaseCode || "").trim();
    if (!code && t.phaseName) {
      const match = t.phaseName.match(/^(\d+\.\d+)/);
      if (match) code = match[1];
    }

    if (!code || !phaseMap[code]) {
      const matchedKey = Object.keys(phaseMap).find(
        (key) =>
          (code && code.startsWith(key)) ||
          (t.phaseName && t.phaseName.toLowerCase().includes(phaseMap[key].name.toLowerCase()))
      );
      if (matchedKey) {
        code = matchedKey;
      }
    }

    if (!code) code = "1.1";

    if (!phaseMap[code]) {
      const name = t.phaseName || "GENERAL";
      phaseMap[code] = { code, name: `${code} ${name.toUpperCase()}`, tasks: [] };
    }
    phaseMap[code].tasks.push(t);
  });

  const phaseColumns = Object.values(phaseMap).map((col) => ({
    code: col.code,
    name: col.name.toUpperCase(),
    count: String(col.tasks.length).padStart(2, "0"),
    tasks: col.tasks,
  }));

  // Kanban card drag handlers — dragging reorders cards within a phase column, and dragging a
  // card over a *different* column's cards (or empty body) moves it into that phase. Both the
  // reorder and the phase move apply live to localTasks as the drag passes over targets (so the
  // board reflects the move immediately), then persist together on drop.
  const handleCardDragStart = (e: React.DragEvent, task: TaskItem) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedTaskId(task.id);
  };

  const moveDraggedTaskIntoColumn = (targetColumnCode: string, beforeTaskId?: string) => {
    setLocalTasks((prev) => {
      const dragIdx = prev.findIndex((t) => t.id === draggedTaskId);
      if (dragIdx === -1) return prev;
      const next = [...prev];
      const [dragged] = next.splice(dragIdx, 1);

      const targetColumn = phaseColumns.find((c) => c.code === targetColumnCode);
      const movedTask =
        dragged.phaseCode === targetColumnCode
          ? dragged
          : { ...dragged, phaseCode: targetColumnCode, phaseName: targetColumn?.name || dragged.phaseName };

      const insertIdx = beforeTaskId ? next.findIndex((t) => t.id === beforeTaskId) : -1;
      if (insertIdx === -1) {
        next.push(movedTask);
      } else {
        next.splice(insertIdx, 0, movedTask);
      }
      return next;
    });
  };

  const handleCardDragOver = (e: React.DragEvent, overTask: TaskItem, columnCode: string) => {
    e.preventDefault();
    // Stop the dragover from bubbling to the column body's own handler, which would otherwise
    // immediately override this card's precise "insert before me" position with "append to end".
    e.stopPropagation();
    if (!draggedTaskId || draggedTaskId === overTask.id) return;
    moveDraggedTaskIntoColumn(columnCode, overTask.id);
  };

  /** Drop target for the column body itself — lets a card be dropped into empty space (an
   *  empty column, or below the last card of a populated one), not just directly on a card. */
  const handleColumnDragOver = (e: React.DragEvent, columnCode: string) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    moveDraggedTaskIntoColumn(columnCode);
  };

  const handleCardDrop = async (e: React.DragEvent, columnCode: string) => {
    e.preventDefault();
    const taskId = draggedTaskId;
    setDraggedTaskId(null);
    if (!taskId) return;
    const column = phaseColumns.find((c) => c.code === columnCode);
    if (!column) return;
    try {
      await reorderProjectTasksAction(
        column.tasks.map((t) => t.id),
        { taskId, phaseCode: column.code, phaseName: column.name }
      );
    } catch (err) {
      console.error("[TasksBoardView] Failed to persist task move/reorder:", err);
    }
  };

  const handleCardDragEnd = () => {
    setDraggedTaskId(null);
  };

  // Shared card renderer — used for both top-level tasks and subtasks (subtasks are real
  // ProjectTask rows under a parentTaskId, so they get identical UI and functionality: the
  // checkbox, status select, inline title edit, timer, owner/move/delete controls, all wired
  // to the same handlers/actions).
  const renderTaskCard = (task: TaskItem, isSubtask: boolean = false, columnCode?: string) => {
    const isOwner = isTaskOwner(task);

    const ownerInitials = task.owner
      ? task.owner
          .split(" ")
          .map((n) => n[0])
          .join("")
          .substring(0, 2)
          .toUpperCase()
      : "DP";

    const statusUpper = (task.status || "OPEN").toUpperCase();
    const isClosed = statusUpper === "CLOSED" || statusUpper === "DONE";
    const isInProgress = statusUpper === "IN PROGRESS" || statusUpper === "IN_PROGRESS";

    const isSelected = selectedTaskIds.has(task.id);
    const isDraggable = !isSubtask && Boolean(columnCode);
    const isBeingDragged = draggedTaskId === task.id;

    return (
      <div
        key={task.id}
        onClick={() => handleOpenTask(task)}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => handleCardDragStart(e, task) : undefined}
        onDragOver={isDraggable ? (e) => handleCardDragOver(e, task, columnCode!) : undefined}
        onDragEnd={isDraggable ? handleCardDragEnd : undefined}
        className={cn(
          "relative overflow-hidden rounded-xl border p-3.5 shadow-2xs transition-all cursor-pointer space-y-2.5 group",
          isDraggable && "cursor-grab active:cursor-grabbing",
          isBeingDragged && "opacity-40",
          isSelected
            ? "border-primary/70 bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/40 shadow-md"
            : "border-slate-200/90 dark:border-neutral-800 bg-white dark:bg-card hover:border-primary/60 hover:shadow-md"
        )}
      >
        {/* Top Row: Select checkbox, Task Code & Status Select matching reference screenshot */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              onClick={(e) => handleToggleTaskSelection(e, task.id)}
              title="Select task"
              className="h-3.5 w-3.5 rounded border-slate-300 dark:border-neutral-700 accent-primary cursor-pointer shrink-0"
            />
            <span className="font-mono text-[11px] font-bold text-slate-400 dark:text-neutral-500 whitespace-nowrap">
              {task.code}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div
            className={cn(
              "relative inline-flex items-center rounded-full text-[9px] font-extrabold uppercase tracking-wider transition-colors",
              isClosed
                ? "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400"
                : isInProgress
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
            )}
          >
            <select
              value={task.status}
              onChange={(e) => handleChangeTaskStatus(task, e.target.value as TaskStatus)}
              disabled={!isOwner}
              title={isOwner ? "Change status" : `Only the task owner (${task.owner || "Unassigned"}) can change the status`}
              className="appearance-none rounded-full bg-transparent py-0.5 pl-2.5 pr-5 outline-none cursor-pointer hover:brightness-95 dark:hover:brightness-125 transition-all disabled:cursor-not-allowed disabled:opacity-70"
            >
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Closed">Closed</option>
            </select>
            <ChevronDown
              size={10}
              className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2"
            />
          </div>

          {!isSubtask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenTask(task);
              }}
              className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-800 transition-all duration-150 cursor-pointer"
              title="View Details"
            >
              <Eye size={13} />
            </button>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                disabled={!isOwner}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-800 transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                title={isOwner ? "More options" : `Only the task owner (${task.owner || "Unassigned"}) can delete this task`}
              >
                <MoreVertical size={13} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              className="w-36 p-1.5 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => handleDeleteTask(e, task)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            </PopoverContent>
          </Popover>

          {!isSubtask && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  disabled={!isOwner}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-800 transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  title={
                    isOwner
                      ? `Move to another phase (currently: ${task.phaseName || task.phaseCode || "Unassigned"})`
                      : `Only the task owner (${task.owner || "Unassigned"}) can move this task`
                  }
                >
                  <ArrowRightLeft size={13} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="end"
                className="w-52 p-2 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b mb-1">
                  Move to Phase
                </p>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {phaseColumns.map((col) => (
                    <button
                      key={col.code}
                      type="button"
                      onClick={(e) => handleMoveTaskToPhase(e, task, col.code, col.name)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs font-medium flex items-center justify-between cursor-pointer",
                        task.phaseCode === col.code ? "bg-primary/10 text-primary font-bold" : "text-foreground"
                      )}
                    >
                      <span className="truncate">{col.name}</span>
                      {task.phaseCode === col.code && <Check size={12} className="shrink-0 text-primary" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          </div>
        </div>

        {/* Task Title matching reference screenshot — click to rename inline */}
        {editingTitleTaskId === task.id ? (
          <input
            type="text"
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => commitTitleEdit(task)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditingTitleTaskId(null);
            }}
            className="w-full rounded-md border border-primary/50 bg-transparent px-1 -mx-1 py-0.5 text-xs font-bold text-slate-800 dark:text-neutral-200 outline-none ring-1 ring-primary/30 focus:ring-primary transition-all"
          />
        ) : (
          <h4
            onClick={(e) => handleStartEditTitle(e, task)}
            title="Click to rename"
            className="rounded-md px-1 -mx-1 text-xs font-bold text-slate-800 dark:text-neutral-200 leading-snug transition-colors group-hover:text-primary hover:bg-slate-100 dark:hover:bg-neutral-800/60 cursor-text"
          >
            {task.title}
          </h4>
        )}

        {/* Card Footer: Icons & Owner Avatar matching reference screenshot */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-neutral-800/80 text-slate-400 text-[11px]">
          <div className="flex items-center gap-2 text-slate-400" onClick={(e) => e.stopPropagation()}>
            <TimerWidget
              taskTitle={task.title}
              taskCode={task.code}
              taskId={task.id}
              projectId={task.projectId || realProjectId}
              canStart={isOwner}
              disabledReason={`Only the task owner (${task.owner || "Unassigned"}) can start this timer`}
              onSaveLog={() => router.refresh()}
            />
            {isSubtask && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenTask(task);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-slate-400 hover:text-foreground hover:bg-muted transition-all duration-150 cursor-pointer dark:bg-[#121316] dark:border-white/10"
                title="View Details"
              >
                <Eye size={13} />
              </button>
            )}
            {isSubtask && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    disabled={!isOwner}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-slate-400 hover:text-foreground hover:bg-muted transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#121316] dark:border-white/10"
                    title={
                      isOwner
                        ? `Move to another phase (currently: ${task.phaseName || task.phaseCode || "Unassigned"})`
                        : `Only the task owner (${task.owner || "Unassigned"}) can move this task`
                    }
                  >
                    <ArrowRightLeft size={13} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="start"
                  className="w-52 p-2 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b mb-1">
                    Move to Phase
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {phaseColumns.map((col) => (
                      <button
                        key={col.code}
                        type="button"
                        onClick={(e) => handleMoveTaskToPhase(e, task, col.code, col.name)}
                        className={cn(
                          "w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs font-medium flex items-center justify-between cursor-pointer",
                          task.phaseCode === col.code ? "bg-primary/10 text-primary font-bold" : "text-foreground"
                        )}
                      >
                        <span className="truncate">{col.name}</span>
                        {task.phaseCode === col.code && <Check size={12} className="shrink-0 text-primary" />}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {task.subtasks && task.subtasks.length > 0 && (
              <button
                type="button"
                onClick={(e) => handleToggleSubtasksPanel(e, task)}
                className="flex items-center gap-1 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-foreground transition-all cursor-pointer"
                title={`${task.subtasks.length} Subtask${task.subtasks.length > 1 ? "s" : ""} (Click to ${
                  expandedSubtaskCardIds.has(task.id) ? "hide" : "view"
                })`}
              >
                <CheckSquare size={13} />
                <span className="text-[10px] font-bold">{task.subtasks.length}</span>
                {expandedSubtaskCardIds.has(task.id) ? (
                  <ChevronDown size={11} />
                ) : (
                  <ChevronRight size={11} />
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="relative flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white text-[10px] font-bold ring-2 ring-background shadow-2xs hover:scale-105 transition-transform cursor-pointer"
                  title={`Owners: ${(task.owners && task.owners.length > 0 ? task.owners : [task.owner || "Unassigned"]).join(", ")} (Click to assign owners)`}
                >
                  {ownerInitials}
                  {task.owners && task.owners.length > 1 && (
                    <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[8px] font-bold ring-2 ring-background">
                      +{task.owners.length - 1}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                className="w-64 p-2.5 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
                onClick={(e) => e.stopPropagation()}
              >
                {currentUser && !isOwner && (
                  <button
                    type="button"
                    onClick={() =>
                      handleChangeTaskOwners(task, [
                        ...(task.owners && task.owners.length > 0 ? task.owners : task.owner ? [task.owner] : []),
                        currentUser.name,
                      ])
                    }
                    className="w-full text-left px-2 py-1.5 mb-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold cursor-pointer"
                  >
                    Assign to me
                  </button>
                )}
                <TaskMultiOwnerSelect
                  selectedOwners={task.owners && task.owners.length > 0 ? task.owners : task.owner && task.owner !== "Unassigned" ? [task.owner] : []}
                  onChangeOwners={(nextOwners) => handleChangeTaskOwners(task, nextOwners)}
                  ownersList={userOptions}
                  listLabel="Project Users"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {task.subtasks && task.subtasks.length > 0 && expandedSubtaskCardIds.has(task.id) && (
          <div
            className="relative ml-2.5 mt-1 space-y-2 border-l-2 border-cyan-400/70 dark:border-cyan-500/50 pl-3"
            onClick={(e) => e.stopPropagation()}
          >
            {task.subtasks.map((subtask) => (
              <div key={subtask.id} className="relative">
                <span className="absolute -left-3 top-4 w-3 border-t-2 border-cyan-400/70 dark:border-cyan-500/50" />
                {renderTaskCard(convertSubtaskToTaskItem(subtask, task), true)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <ActiveTimerProvider>
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden relative">
      {/* ── Subtabs Navigator matching reference image ────────────────────── */}
      {/* <div className="flex items-center justify-between border-b border-border px-6 py-2.5 bg-card text-card-foreground shadow-2xs">
        <div className="flex items-center gap-6 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-semibold">
            <span>Task List</span>
            <span>›</span>
            <span className="text-foreground font-bold">
              {taskScope === "MY_TASKS" ? "Assigned to Me" : "All Tasks"}
            </span>
          </div>

          <div className="h-4 w-px bg-border/80 mx-1" />

          <button
            type="button"
            onClick={() => setActiveSubTab("DASHBOARD")}
            className={`pb-1 transition-all cursor-pointer ${
              activeSubTab === "DASHBOARD"
                ? "text-primary border-b-2 border-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("TASKS")}
            className={`pb-1 transition-all cursor-pointer ${
              activeSubTab === "TASKS"
                ? "text-primary border-b-2 border-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("PHASES")}
            className={`pb-1 transition-all cursor-pointer ${
              activeSubTab === "PHASES"
                ? "text-primary border-b-2 border-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Phases
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("TIME_LOGS")}
            className={`pb-1 transition-all cursor-pointer ${
              activeSubTab === "TIME_LOGS"
                ? "text-primary border-b-2 border-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Time Logs
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("CHECKLIST")}
            className={`pb-1 transition-all cursor-pointer ${
              activeSubTab === "CHECKLIST"
                ? "text-primary border-b-2 border-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Checklist
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell size={15} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Help & Support"
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </div> */}

      {activeSubTab === "DASHBOARD" ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-2xs">
              <span className="text-xs text-muted-foreground font-semibold">Total Tasks</span>
              <div className="text-2xl font-extrabold text-foreground">{realTaskCount}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-2xs">
              <span className="text-xs text-muted-foreground font-semibold">Assigned to Me</span>
              <div className="text-2xl font-extrabold text-primary">{assignedToMeCount}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-2xs">
              <span className="text-xs text-muted-foreground font-semibold">Completed Tasks</span>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{realCompletedCount}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-2xs">
              <span className="text-xs text-muted-foreground font-semibold">Overall Progress</span>
              <div className="text-2xl font-extrabold text-foreground">{realCompletionPercent}%</div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-2xs">
            <h3 className="text-sm font-bold text-foreground">Project Completion Progress</h3>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${realCompletionPercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : activeSubTab === "CHECKLIST" ? (
        <ChecklistWorkspaceView />
      ) : activeSubTab === "PHASES" ? (
        <PhasesTableView onOpenAddModal={() => setIsAddTaskDrawerOpen(true)} />
      ) : activeSubTab === "TIME_LOGS" ? (
        <TimeTrackerView
          initialGroups={projectTimeGroups}
          projectId={realProjectId}
          projectName={projectName}
          assignedUsers={projectAssignees}
        />
      ) : (
        <>
          {/* ── Bulk Selection Toolbar (Zoho-style) — shown only while cards are selected ──── */}
          {selectedTaskIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-primary/30 bg-primary/10 dark:bg-primary/15 px-6 py-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <label className="flex items-center gap-2 cursor-pointer select-none pr-1">
                <input
                  type="checkbox"
                  checked={filteredTasks.length > 0 && filteredTasks.every((t) => selectedTaskIds.has(t.id))}
                  onChange={() =>
                    setSelectedTaskIds((prev) =>
                      filteredTasks.length > 0 && filteredTasks.every((t) => prev.has(t.id))
                        ? new Set()
                        : new Set(filteredTasks.map((t) => t.id))
                    )
                  }
                  className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                  title="Select all"
                />
                <span className="text-xs font-bold text-primary whitespace-nowrap">
                  {selectedTaskIds.size} selected
                </span>
              </label>

              <div className="h-4 w-px bg-primary/30 mx-1" />

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-primary/15 transition-colors cursor-pointer"
                  >
                    <ArrowRightLeft size={13} />
                    <span>Move</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="start"
                  className="w-52 p-2 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
                >
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b mb-1">
                    Move to Phase
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {phaseColumns.map((col) => (
                      <button
                        key={col.code}
                        type="button"
                        onClick={() => handleBulkMoveToPhase(col.code, col.name)}
                        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs font-medium text-foreground cursor-pointer truncate"
                      >
                        {col.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-primary/15 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 size={13} />
                    <span>Status</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="start"
                  className="w-40 p-1.5 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
                >
                  {(["Open", "In Progress", "Closed"] as TaskStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleBulkStatusChange(s)}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-accent text-xs font-medium text-foreground cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-primary/15 transition-colors cursor-pointer"
                  >
                    <UserIcon size={13} />
                    <span>Add Owner</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="start"
                  className="w-48 p-2 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
                >
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b mb-1">
                    Assign Owner
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {userOptions.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleBulkAssignOwner(u.name)}
                        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs font-medium text-foreground cursor-pointer truncate"
                      >
                        {u.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>

              <div className="flex-1" />

              <button
                type="button"
                onClick={clearSelection}
                className="p-1.5 rounded-full text-primary hover:bg-primary/15 transition-colors cursor-pointer"
                title="Clear selection"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Stale Task Alert Banner */}
          {stalenessAnalysis.staleCount > 0 && (
            <div className="flex items-center justify-between bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 text-xs text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                <span>{stalenessAnalysis.recommendation}</span>
              </div>
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold">
                {stalenessAnalysis.staleCount} Stale Task(s) Detected
              </span>
            </div>
          )}

          {/* ── Action Toolbar (View Switches & Add Task matching reference image) ────────────────── */}
          <div className="flex flex-wrap items-center justify-between border-b border-border px-6 py-2.5 bg-card relative gap-3">
            <div className="flex items-center gap-3">
              {/* Collapse / Expand All Phase Columns */}
              <button
                type="button"
                onClick={() =>
                  setCollapsedPhaseCodes(
                    phaseColumns.every((col) => collapsedPhaseCodes.has(col.code))
                      ? new Set()
                      : new Set(phaseColumns.map((col) => col.code))
                  )
                }
                className="p-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                title={
                  phaseColumns.every((col) => collapsedPhaseCodes.has(col.code))
                    ? "Expand All Phases"
                    : "Collapse All Phases"
                }
              >
                {phaseColumns.length > 0 && phaseColumns.every((col) => collapsedPhaseCodes.has(col.code)) ? (
                  <ArrowRightToLine size={15} />
                ) : (
                  <ArrowLeftToLine size={15} />
                )}
              </button>

              {/* Task Scope Toggle Pill (Assigned to Me vs All Tasks) */}
              {/* <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTaskScope("MY_TASKS")}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    taskScope === "MY_TASKS"
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Assigned to Me
                </button>
                <button
                  type="button"
                  onClick={() => setTaskScope("ALL_TASKS")}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    taskScope === "ALL_TASKS"
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Tasks
                </button>
              </div> */}
            </div>

            {/* Right Action Icons & Primary Add Task Button matching reference screenshot */}
            <div className="flex items-center gap-2">
              {/* <button
                type="button"
                onClick={() => {
                  setSelectedStatusFilter("ALL");
                  setSelectedDepartmentFilter("ALL");
                }}
                className="p-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                title="Refresh View"
              >
                <RotateCw size={15} />
              </button> */}

              {/* Primary Add Task Blue Button matching reference screenshot */}
              <button
                type="button"
                onClick={() => setIsAddTaskDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#0088ff] hover:bg-[#0077ee] text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer ml-1"
              >
                <Plus size={16} />
                <span>Add Task</span>
              </button>
            </div>
          </div>

          {/* ── Kanban Board Layout (Phase Columns matching reference image) ────────────────────── */}
          {viewMode === "KANBAN" && (
            <div className="dsm-columns-scrollbar flex-1 min-h-0 overflow-x-auto p-6 bg-slate-50/50 dark:bg-background/40">
              <div className="flex gap-5 h-full items-stretch">
                {phaseColumns.map((col) => {
                  const isCollapsed = collapsedPhaseCodes.has(col.code);

                  if (isCollapsed) {
                    return (
                      <div
                        key={col.code}
                        className="w-12 shrink-0 rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-slate-100/70 dark:bg-neutral-900/40 p-2 flex flex-col items-center h-full shadow-2xs transition-all duration-200"
                      >
                        <button
                          type="button"
                          onClick={() => handleTogglePhaseCollapse(col.code)}
                          className="mb-2 p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title={`Expand ${col.name}`}
                        >
                          <ArrowRightToLine size={14} />
                        </button>
                        <span className="rounded-full bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 font-mono mb-3">
                          {col.count}
                        </span>
                        <div className="flex-1 flex items-start justify-center">
                          <span
                            className="font-extrabold text-[11px] text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap"
                            style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
                          >
                            {col.name}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={col.code}
                      className="w-80 shrink-0 rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-slate-100/70 dark:bg-neutral-900/40 p-3.5 flex flex-col h-full overflow-hidden shadow-2xs transition-all duration-200"
                    >
                      {/* Column Header matching reference screenshot */}
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/60 dark:border-neutral-800">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="font-extrabold text-[11px] text-slate-600 dark:text-slate-300 uppercase tracking-wider truncate max-w-[180px]">
                            {col.name}
                          </span>
                          <span className="rounded-full bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 font-mono">
                            {col.count}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenAddTaskForPhase(col.code)}
                            className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Add Task to Phase"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTogglePhaseCollapse(col.code)}
                            className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title={`Collapse ${col.name}`}
                          >
                            <ArrowLeftToLine size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Task Cards Column Body matching reference screenshot */}
                      <div
                        className={cn(
                          "space-y-3 overflow-y-auto pr-1 flex-1 min-h-0 rounded-xl transition-colors",
                          draggedTaskId && "ring-1 ring-transparent hover:ring-primary/30"
                        )}
                        onDragOver={(e) => handleColumnDragOver(e, col.code)}
                        onDrop={(e) => handleCardDrop(e, col.code)}
                      >
                        {col.tasks.length === 0 ? (
                          <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-300/70 dark:border-neutral-800 rounded-xl text-center text-muted-foreground/60 space-y-2 h-36">
                            <span className="text-[11px] font-medium">No tasks in this phase</span>
                            <button
                              type="button"
                              onClick={() => handleOpenAddTaskForPhase(col.code)}
                              className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus size={12} /> Add Task
                            </button>
                          </div>
                        ) : (
                          col.tasks.map((task) => renderTaskCard(task, false, col.code))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Bottom Sprint Footer Bar matching reference image ────────────────── */}
          <div className="shrink-0 flex items-center justify-between border-t border-border px-6 py-2.5 bg-card text-xs text-muted-foreground font-semibold shadow-2xs">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-3.5 py-1 text-sky-600 dark:text-sky-400 font-bold">
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
              <span>ACTIVE SPRINT: {realCompletionPercent}% COMPLETE</span>
            </div>

            <div className="flex items-center gap-5 text-[11px]">
              <span>TOTAL COUNT: <strong className="text-foreground">{realTaskCount} TASKS</strong></span>
              <span>ASSIGNED TO ME: <strong className="text-foreground">{assignedToMeCount}</strong></span>
            </div>
          </div>
        </>
      )}

      {/* Task Detail Slide Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        onUpdateTask={onUpdateTask}
      />

      {/* Add Task Drawer */}
      <AddTaskDrawer
        isOpen={isAddTaskDrawerOpen}
        onClose={() => {
          setIsAddTaskDrawerOpen(false);
          setSelectedAddTaskPhase(undefined);
        }}
        onAddTask={(newTask) => {
          onAddTask(newTask);
          setIsAddTaskDrawerOpen(false);
          setSelectedAddTaskPhase(undefined);
        }}
        availablePhases={phaseColumns.map(({ code, name }) => ({ code, name }))}
        initialPhaseCode={selectedAddTaskPhase}
        projectCode={projectCode || realProjectId}
      />

      {/* New Time Log Modal */}
      <NewTimeLogModal
        isOpen={isTimeLogModalOpen}
        onClose={() => setIsTimeLogModalOpen(false)}
        projectId={realProjectId}
        projectName={projectName}
        assignedUsers={projectAssignees}
      />

      {ConfirmDialog}
    </div>
    </ActiveTimerProvider>
  );
}
