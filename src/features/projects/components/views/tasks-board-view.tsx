"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  List,
  Kanban,
  Columns,
  Filter,
  Download,
  RotateCw,
  Plus,
  Clock,
  CheckSquare,
  AlertCircle,
  MoreHorizontal,
  ExternalLink,
  Bell,
  HelpCircle,
  Layers,
  X,
  AlertTriangle,
  Sparkles,
  FileText,
  User as UserIcon,
  CheckCircle2,
  Edit3,
} from "lucide-react";
import { TaskItem, UserTimeGroup, WorkspaceRole } from "../../types";
import { TaskDetailDrawer } from "../modals/task-detail-drawer";
import { AddTaskDrawer } from "../modals/add-task-drawer";
import { ChecklistWorkspaceView } from "./checklist-workspace-view";
import { PhasesTableView } from "./phases-table-view";
import { TimeTrackerView } from "./time-tracker-view";
import { TimerWidget } from "../timer-widget";
import { NewTimeLogModal } from "../modals/new-time-log-modal";
import { analyzeTaskStaleness } from "../../manager/ai-project-assistant";
import { getTimeLogsAction, getCurrentUserContextAction } from "../../actions/project-actions";

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

  // View Mode: Board / Kanban vs List / Status Columns
  const [viewMode, setViewMode] = useState<"KANBAN" | "STATUS_COLUMNS" | "PHASE_COLUMNS">("KANBAN");

  // Task Scope Filter: Default to MY_TASKS (tasks owned by me) for BOTH Admin and Team Member
  const [taskScope, setTaskScope] = useState<"MY_TASKS" | "ALL_TASKS">("MY_TASKS");

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
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState("ALL");

  const router = useRouter();
  const params = useParams();
  const realProjectId = params?.projectId as string | undefined;
  const currentProjectId = realProjectId || "Project Tasks";

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
    if (!disableDemoFallback && (!tasks || tasks.length === 0)) return FALLBACK_PROJECT_TASKS;
    return (tasks || []).filter((t) => !t.parentTaskId);
  }, [tasks, disableDemoFallback]);

  // Tasks owned by the current user — same rule for Admin and Team Member alike. No fallback
  // to "all tasks" or demo data when this comes up empty: an honest empty state is correct here,
  // not silently showing tasks that aren't actually yours.
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

  // Effective Task List depending on scope selection
  const scopedTasks = taskScope === "MY_TASKS" ? myOwnedTasks : displayTasks;

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
    router.push(`/projects/${currentProjectId}/tasks/${taskId}`);
  };

  const handleExportTasksCSV = () => {
    const headers = "Code,Title,Phase,Status,Owner,Duration\n";
    const rows = scopedTasks
      .map(
        (t) =>
          `"${t.code}","${t.title}","${t.phaseName}","${t.status}","${t.owner || "Unassigned"}","${t.duration || ""}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tasks-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

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
    const code = t.phaseCode || "1.1";
    const name = t.phaseName || "GENERAL";
    if (!phaseMap[code]) {
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

  // Reference-Matched 5 Kanban Status Columns (Open, In Progress, In Review, On Hold, Closed)
  const kanbanStatusColumns = [
    {
      code: "OPEN",
      title: "OPEN",
      badgeColor: "bg-emerald-500 text-white dark:bg-emerald-600",
      pillStyle: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      tasks: filteredTasks.filter((t) => t.status.toLowerCase() === "open"),
    },
    {
      code: "IN_PROGRESS",
      title: "IN PROGRESS",
      badgeColor: "bg-amber-500 text-white dark:bg-amber-600",
      pillStyle: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
      tasks: filteredTasks.filter(
        (t) => t.status.toLowerCase() === "in progress" || t.status.toLowerCase() === "in_progress"
      ),
    },
    {
      code: "IN_REVIEW",
      title: "IN REVIEW",
      badgeColor: "bg-sky-500 text-white dark:bg-sky-600",
      pillStyle: "bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30",
      tasks: filteredTasks.filter(
        (t) => t.status.toLowerCase() === "in review" || t.status.toLowerCase() === "in_review"
      ),
    },
    {
      code: "ON_HOLD",
      title: "ON HOLD",
      badgeColor: "bg-slate-400 text-white dark:bg-slate-500",
      pillStyle: "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30",
      tasks: filteredTasks.filter((t) => t.status.toLowerCase() === "on hold"),
    },
    {
      code: "CLOSED",
      title: "CLOSED",
      badgeColor: "bg-slate-700 text-white dark:bg-slate-800",
      pillStyle: "bg-slate-500/20 text-slate-500 dark:text-slate-400 border-slate-500/30",
      tasks: filteredTasks.filter(
        (t) => t.status.toLowerCase() === "closed" || t.status.toLowerCase() === "done"
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden relative">
      {/* ── Top Header Navigation & Breadcrumb ────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-2.5 bg-card text-card-foreground shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-muted-foreground">Task List</span>
          <span className="text-muted-foreground">›</span>
          <span className="text-foreground font-bold">
            {taskScope === "MY_TASKS" ? "Assigned to Me" : "All Tasks"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Notifications"
          >
            <Bell size={15} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Help & Support"
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </div>

      {/* ── Subtabs Navigator (Only Tasks active by default) ────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-2 bg-muted/30">
        <div className="flex items-center gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveSubTab("TASKS")}
            className={`pb-0.5 transition-all ${
              activeSubTab === "TASKS"
                ? "text-primary border-b-2 border-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tasks
          </button>
          {/* <button
            type="button"
            onClick={() => setActiveSubTab("PHASES")}
            className={`pb-0.5 transition-all ${
              activeSubTab === "PHASES"
                ? "text-primary border-b-2 border-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Phases
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("CHECKLIST")}
            className={`pb-0.5 transition-all ${
              activeSubTab === "CHECKLIST"
                ? "text-primary border-b-2 border-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Checklist
          </button> */}
        </div>
      </div>

      {activeSubTab === "CHECKLIST" ? (
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

          {/* ── Action Toolbar (View Switches & Add Task) ────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between border-b border-border px-6 py-2.5 bg-card relative gap-3">
            <div className="flex items-center gap-3">
              {/* View Switch Buttons (List ||| vs Board/Kanban) */}
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewMode("STATUS_COLUMNS")}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    viewMode === "STATUS_COLUMNS"
                      ? "bg-background text-foreground font-bold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="List View"
                >
                  <List size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("KANBAN")}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    viewMode === "KANBAN"
                      ? "bg-background text-primary font-bold shadow-2xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Board / Kanban View"
                >
                  <Kanban size={15} />
                </button>
              </div>

              {/* Task Scope Toggle Pill (Assigned to Me vs All Tasks) */}
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTaskScope("MY_TASKS")}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    taskScope === "MY_TASKS"
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Assigned to Me ({assignedToMeCount})
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
                  All Tasks ({realTaskCount})
                </button>
              </div>
            </div>

            {/* Right Action Icons & Primary Add Task Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className={`p-2 rounded-md border border-border transition-colors cursor-pointer ${
                  showFilterPanel || selectedStatusFilter !== "ALL"
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                title="Filter Tasks"
              >
                <Filter size={15} />
              </button>

              <button
                type="button"
                onClick={handleExportTasksCSV}
                className="p-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                title="Download CSV"
              >
                <Download size={15} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedStatusFilter("ALL");
                  setSelectedDepartmentFilter("ALL");
                }}
                className="p-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                title="Refresh View"
              >
                <RotateCw size={15} />
              </button>

              {/* Primary Add Task Blue Button matching reference screenshot */}
              <button
                type="button"
                onClick={() => setIsAddTaskDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#0088ff] hover:bg-[#0077ee] text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer ml-1"
              >
                <Plus size={16} />
                <span>Add Task</span>
              </button>

              {/* Filter Popover */}
              {showFilterPanel && (
                <div className="absolute right-24 top-12 z-40 w-56 rounded-lg border border-border bg-popover p-3 shadow-lg text-xs space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center font-bold border-b border-border pb-1.5">
                    <span>Filter Tasks</span>
                    <button type="button" onClick={() => setShowFilterPanel(false)} className="text-muted-foreground hover:text-foreground">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Status</label>
                    <select
                      value={selectedStatusFilter}
                      onChange={(e) => setSelectedStatusFilter(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-hidden cursor-pointer"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Kanban Board Layout matching reference image ────────────────────── */}
          {viewMode === "KANBAN" && (
            <div className="flex-1 overflow-x-auto p-6 bg-slate-50/50 dark:bg-background/40">
              <div className="flex gap-5 h-full items-start">
                {kanbanStatusColumns.map((col) => {
                  const countFormatted = String(col.tasks.length).padStart(2, "0");
                  return (
                    <div
                      key={col.code}
                      className="w-80 shrink-0 rounded-2xl border border-border/80 bg-slate-100/60 dark:bg-neutral-900/40 p-3.5 flex flex-col max-h-full shadow-2xs"
                    >
                      {/* Column Header matching reference screenshot */}
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full ${col.badgeColor} px-3 py-1 text-[11px] font-extrabold tracking-wider uppercase shadow-2xs`}>
                            {col.title}
                          </span>
                          <span className="rounded-full bg-background border border-border px-2 py-0.5 text-[11px] font-bold text-muted-foreground font-mono">
                            {countFormatted}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-background/80 transition-colors"
                            title="Edit Column"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-background/80 transition-colors"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Task Cards Column Body */}
                      <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-[240px]">
                        {col.tasks.length === 0 ? (
                          <div className="flex flex-col items-center justify-center p-6 border border-dashed border-border/60 rounded-xl text-center text-muted-foreground/60 space-y-2 h-36">
                            <span className="text-[11px] font-medium">No tasks in this status</span>
                            <button
                              type="button"
                              onClick={() => setIsAddTaskDrawerOpen(true)}
                              className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus size={12} /> Add Task
                            </button>
                          </div>
                        ) : (
                          col.tasks.map((task) => {
                            const ownerInitials = task.owner
                              ? task.owner
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .substring(0, 2)
                                  .toUpperCase()
                              : "DP";

                            return (
                              <div
                                key={task.id}
                                onClick={() => handleOpenTask(task)}
                                className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs hover:border-primary/60 hover:shadow-md transition-all cursor-pointer space-y-2.5 group"
                              >
                                {/* Top Row: Task Code & Status Badge */}
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[11px] font-bold text-muted-foreground">
                                    {task.code}
                                  </span>
                                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    task.status === "Open"
                                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                      : task.status === "In Progress"
                                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                      : "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
                                  }`}>
                                    {task.status}
                                  </span>
                                </div>

                                {/* Task Title */}
                                <h4 className="text-xs font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                                  {task.title}
                                </h4>

                                {/* Card Footer: Icons & Owner Avatar */}
                                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-muted-foreground text-[11px]">
                                  <div className="flex items-center gap-2 text-muted-foreground/70">
                                    <span title="Tracked Hours"><Clock size={13} /></span>
                                    <span title="Subtasks / Checklist"><CheckSquare size={13} /></span>
                                    {task.description && <span title="Has Description"><FileText size={13} /></span>}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white text-[10px] font-bold ring-2 ring-background shadow-2xs">
                                      {ownerInitials}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Status Columns View Mode ────────────────────────────────────────── */}
          {viewMode === "STATUS_COLUMNS" && (
            <div className="flex-1 overflow-x-auto p-6 bg-background">
              <div className="flex gap-4 h-full items-start">
                {kanbanStatusColumns.map((col) => (
                  <div
                    key={col.code}
                    className="w-14 hover:w-72 transition-all duration-300 shrink-0 rounded-2xl border border-border bg-card p-2 flex flex-col h-full max-h-full items-center shadow-2xs group"
                  >
                    <button
                      type="button"
                      className="mb-3 p-1 rounded-md border bg-background text-info hover:bg-accent transition-colors shadow-2xs"
                      title={`Open ${col.title} tasks`}
                    >
                      <ExternalLink size={13} />
                    </button>

                    <div
                      className={`rounded-full ${col.badgeColor} px-2 py-3.5 text-[11px] font-extrabold tracking-wider uppercase shadow-xs select-none transition-transform duration-200`}
                      style={{
                        writingMode: "vertical-rl",
                        textOrientation: "mixed",
                        transform: "rotate(180deg)",
                      }}
                    >
                      {col.title} ({col.tasks.length})
                    </div>

                    <div className="w-full mt-4 space-y-2 overflow-y-auto hidden group-hover:block pr-1 flex-1">
                      {col.tasks.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground text-center py-4 italic">
                          No tasks
                        </div>
                      ) : (
                        col.tasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={() => handleOpenTask(task)}
                            className="rounded-lg border border-border bg-background p-2.5 shadow-2xs hover:border-primary/60 hover:shadow-xs transition-all cursor-pointer space-y-1.5"
                          >
                            <span className="font-mono text-[10px] font-bold text-muted-foreground block">
                              {task.code}
                            </span>
                            <h4 className="text-xs font-bold text-foreground leading-tight">
                              {task.title}
                            </h4>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Bottom Sprint Footer Bar matching reference image ────────────────── */}
          <div className="flex items-center justify-between border-t border-border px-6 py-2.5 bg-card text-xs text-muted-foreground font-semibold shrink-0">
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
    </div>
  );
}
