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
} from "lucide-react";
import { TaskItem, UserTimeGroup } from "../../types";
import { TaskDetailDrawer } from "../modals/task-detail-drawer";
import { AddTaskDrawer } from "../modals/add-task-drawer";
import { ChecklistWorkspaceView } from "./checklist-workspace-view";
import { PhasesTableView } from "./phases-table-view";
import { TimeTrackerView } from "./time-tracker-view";
import { TimerWidget } from "../timer-widget";
import { NewTimeLogModal } from "../modals/new-time-log-modal";
import { analyzeTaskStaleness } from "../../manager/ai-project-assistant";
import { getTimeLogsAction } from "../../actions/project-actions";

interface TasksBoardViewProps {
  tasks: TaskItem[];
  onAddTask: (newTask: TaskItem) => void;
  onUpdateTask: (updatedTask: TaskItem) => void;
  assignedToMeCount?: number;
  projectCode?: string;
  projectName?: string;
}

// Fallback initial tasks for rich rendering across all departments
const FALLBACK_PROJECT_TASKS: TaskItem[] = [
  {
    id: "WI1-T11",
    code: "WI1-T11",
    title: "V1 Keyword Research & Figma Layout",
    phaseCode: "3.1",
    phaseName: "UI/UX DESIGNING",
    status: "Open",
    authorName: "Dhruv Patidar",
    associatedTeam: "Design",
    departmentAlias: "design@",
    owner: "Vaishnavi Shivhare",
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
    id: "WI1-T12",
    code: "WI1-T12",
    title: "Competitor UI & Component Audit",
    phaseCode: "3.1",
    phaseName: "UI/UX DESIGNING",
    status: "In Progress",
    authorName: "M Thakre",
    associatedTeam: "Design",
    departmentAlias: "design@",
    owner: "M Thakre",
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
    id: "WI1-T13",
    code: "WI1-T13",
    title: "Stakeholder Design Interviews",
    phaseCode: "2.1",
    phaseName: "UX RESEARCH & DISCOVERY",
    status: "Open",
    authorName: "System",
    associatedTeam: "Design",
    departmentAlias: "design@",
    owner: "Ishita Vishwakarma",
    workHours: "02:00",
    startDate: "19/08/2026",
    dueDate: "22/08/2026",
    duration: "3 days",
    completionPercentage: 20,
    priority: "Low",
    tags: ["UX"],
    billingType: "Non Billable",
    description: "Gather feedback from stakeholders.",
  },
  {
    id: "EC2-T33",
    code: "EC2-T33",
    title: "Database Schema Optimization",
    phaseCode: "4.1",
    phaseName: "DEVELOPMENT",
    status: "In Progress",
    authorName: "Dhruv Patidar",
    associatedTeam: "Engineering",
    departmentAlias: "dev@",
    owner: "Dhruv Patidar",
    workHours: "08:00",
    startDate: "15/08/2026",
    dueDate: "28/08/2026",
    duration: "13 days",
    completionPercentage: 75,
    priority: "High",
    tags: ["Database", "Backend"],
    billingType: "Hourly Rate",
    description: "Optimize PostgreSQL queries.",
  },
  {
    id: "EC2-T34",
    code: "EC2-T34",
    title: "SEO Technical Audit & Meta Tags",
    phaseCode: "6.1",
    phaseName: "DEPLOYMENT & SEO",
    status: "Open",
    authorName: "System",
    associatedTeam: "Marketing",
    departmentAlias: "seo@",
    owner: "Ananya Verma",
    workHours: "03:00",
    startDate: "21/08/2026",
    dueDate: "27/08/2026",
    duration: "6 days",
    completionPercentage: 10,
    priority: "Medium",
    tags: ["SEO"],
    billingType: "Hourly Rate",
    description: "Inspect on-page SEO meta tags.",
  },
  {
    id: "EC2-T35",
    code: "EC2-T35",
    title: "QA Automated Cypress Tests",
    phaseCode: "5.1",
    phaseName: "TESTING",
    status: "Open",
    authorName: "System",
    associatedTeam: "QA",
    departmentAlias: "qa@",
    owner: "Rahul Sharma",
    workHours: "05:00",
    startDate: "20/08/2026",
    dueDate: "26/08/2026",
    duration: "6 days",
    completionPercentage: 40,
    priority: "High",
    tags: ["QA", "Testing"],
    billingType: "Hourly Rate",
    description: "Write end-to-end Cypress test suites.",
  },
];

// Standard Kanban Phase Columns (Guarantees columns ALWAYS render)
const DEFAULT_KANBAN_PHASES = [
  { code: "1.1", name: "1.1 CLIENT ONBOARDING" },
  { code: "1.2", name: "1.2 REQUIREMENT COLLECTION" },
  { code: "2.1", name: "2.1 UX RESEARCH & DISCOVERY" },
  { code: "3.1", name: "3.1 UI/UX DESIGNING" },
  { code: "4.1", name: "4.1 DEVELOPMENT" },
  { code: "5.1", name: "5.1 TESTING" },
  { code: "6.1", name: "6.1 DEPLOYMENT & SEO" },
];

export function TasksBoardView({
  tasks,
  onAddTask,
  onUpdateTask,
  assignedToMeCount = 0,
  projectCode,
  projectName,
}: TasksBoardViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "TASKS" | "DASHBOARD" | "PHASES" | "TIME_LOGS" | "CHECKLIST"
  >("TASKS");

  const [viewMode, setViewMode] = useState<
    "STATUS_COLUMNS" | "PHASE_COLUMNS" | "KANBAN"
  >("STATUS_COLUMNS");

  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isAddTaskDrawerOpen, setIsAddTaskDrawerOpen] = useState(false);
  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);

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

  // Combine user tasks with fallback tasks so added tasks show immediately alongside sample tasks
  const displayTasks = React.useMemo(() => {
    if (!tasks || tasks.length === 0) return FALLBACK_PROJECT_TASKS;
    const userCodes = new Set(tasks.map((t) => t.code || t.id));
    const uniqueFallbacks = FALLBACK_PROJECT_TASKS.filter(
      (ft) => !userCodes.has(ft.code) && !userCodes.has(ft.id)
    );
    return [...tasks, ...uniqueFallbacks];
  }, [tasks]);

  // Stale Task Analysis
  const stalenessAnalysis = analyzeTaskStaleness(displayTasks);

  // Real footer stats — computed from the actual `tasks` prop, not `displayTasks`
  // (which mixes in demo fallback rows and would inflate the count).
  const realTaskCount = tasks.length;
  const realCompletedCount = tasks.filter((t) => t.status === "Closed").length;
  const realCompletionPercent =
    realTaskCount > 0 ? Math.round((realCompletedCount / realTaskCount) * 100) : 0;

  const handleOpenTask = (task: TaskItem) => {
    const taskId = task.code || task.id;
    router.push(`/projects/${currentProjectId}/tasks/${taskId}`);
  };

  const handleExportTasksCSV = () => {
    const headers = "Code,Title,Phase,Status,Owner,Duration\n";
    const rows = displayTasks
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

  const filteredTasks = displayTasks.filter((t) => {
    const matchesStatus =
      selectedStatusFilter === "ALL" ||
      t.status.toLowerCase() === selectedStatusFilter.toLowerCase();

    const matchesDept =
      selectedDepartmentFilter === "ALL" ||
      t.departmentAlias === selectedDepartmentFilter;

    return matchesStatus && matchesDept;
  });

  // Group tasks by phase dynamically, pre-seeded with DEFAULT_KANBAN_PHASES
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

  // 10 Status Columns
  const statusColumnsList = [
    {
      code: "OPEN",
      title: "OPEN",
      badgeColor: "bg-emerald-600 text-white",
      borderColor: "border-success/30",
      tasks: filteredTasks.filter((t) => t.status.toLowerCase() === "open"),
    },
    {
      code: "IN_PROGRESS",
      title: "IN PROGRESS",
      badgeColor: "bg-amber-500 text-white",
      borderColor: "border-warning/30",
      tasks: filteredTasks.filter(
        (t) => t.status.toLowerCase() === "in progress" || t.status.toLowerCase() === "in_progress"
      ),
    },
    {
      code: "IN_REVIEW",
      title: "IN REVIEW",
      badgeColor: "bg-sky-500 text-white",
      borderColor: "border-info/30",
      tasks: filteredTasks.filter((t) => t.status.toLowerCase() === "in review"),
    },
    {
      code: "ON_HOLD",
      title: "ON HOLD",
      badgeColor: "bg-slate-400 text-white",
      borderColor: "border",
      tasks: filteredTasks.filter((t) => t.status.toLowerCase() === "on hold"),
    },
    {
      code: "DELAYED",
      title: "DELAYED",
      badgeColor: "bg-cyan-500 text-white",
      borderColor: "border-info/30",
      tasks: filteredTasks.filter((t) => t.status.toLowerCase() === "delayed"),
    },
    {
      code: "DONE",
      title: "DONE",
      badgeColor: "bg-success text-success-foreground",
      borderColor: "border-success/30",
      tasks: filteredTasks.filter((t) => t.status.toLowerCase() === "done" || t.status.toLowerCase() === "closed"),
    },
    {
      code: "FOLLOW_UP",
      title: "FOLLOW UP",
      badgeColor: "bg-purple-600 text-white",
      borderColor: "border-primary/30",
      tasks: [],
    },
    {
      code: "PENDING_FROM_CLIENT",
      title: "PENDING FROM CLIENT",
      badgeColor: "bg-rose-500 text-white",
      borderColor: "border-danger/30",
      tasks: [],
    },
    {
      code: "READY_FOR_TESTING",
      title: "READY FOR TESTING",
      badgeColor: "bg-indigo-600 text-white",
      borderColor: "border-primary/30",
      tasks: [],
    },
    {
      code: "READY_TO_ONBOARD",
      title: "READY TO ONBOARD",
      badgeColor: "bg-yellow-700 text-white",
      borderColor: "border-warning/30",
      tasks: [],
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden relative">
      {/* Top Header Breadcrumb & Subtabs */}
      <div className="flex items-center justify-between border-b px-6 py-3 bg-background">
        <div className="flex items-center gap-4 text-xs font-semibold">
          {projectName && (
            <span className="text-muted-foreground">
              {projectCode} <strong className="text-foreground">{projectName}</strong>
            </span>
          )}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSubTab("DASHBOARD")}
              className={`pb-0.5 ${activeSubTab === "DASHBOARD" ? "text-primary border-b-2 border-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("TASKS")}
              className={`pb-0.5 ${activeSubTab === "TASKS" ? "text-primary border-b-2 border-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("PHASES")}
              className={`pb-0.5 ${activeSubTab === "PHASES" ? "text-primary border-b-2 border-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Phases
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("TIME_LOGS")}
              className={`pb-0.5 ${activeSubTab === "TIME_LOGS" ? "text-primary border-b-2 border-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Time Logs
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("CHECKLIST")}
              className={`pb-0.5 ${activeSubTab === "CHECKLIST" ? "text-primary border-b-2 border-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Checklist
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* <TimerWidget
            onStopTimer={() => setIsTimeLogModalOpen(true)}
          />
          <button
            type="button"
            onClick={() => setIsTimeLogModalOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-[#0088ff] px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[#0077ee] transition-colors"
          >
            <Plus size={14} />
            <span>Time Log</span>
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

          {/* Action Toolbar */}
          <div className="flex items-center justify-between border-b px-6 py-2.5 bg-muted/20 relative">
            <div className="flex items-center gap-2">
              {/* View Mode Switches */}
              <div className="inline-flex rounded-md border p-0.5 bg-background shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewMode("STATUS_COLUMNS")}
                  className={`p-1.5 rounded transition-colors ${viewMode === "STATUS_COLUMNS"
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-muted-foreground hover:bg-accent"
                    }`}
                  title="Vertical Status Columns"
                >
                  <Columns size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("PHASE_COLUMNS")}
                  className={`p-1.5 rounded transition-colors ${viewMode === "PHASE_COLUMNS"
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-muted-foreground hover:bg-accent"
                    }`}
                  title="17 Phase Vertical Columns"
                >
                  <Layers size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("KANBAN")}
                  className={`p-1.5 rounded transition-colors ${viewMode === "KANBAN"
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-muted-foreground hover:bg-accent"
                    }`}
                  title="Kanban Board View"
                >
                  <Kanban size={15} />
                </button>
              </div>

              {/* Department Filter Select */}
              {/* <select
                value={selectedDepartmentFilter}
                onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
                className="rounded border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground outline-none cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                <option value="digitalproducts@">digitalproducts@</option>
                <option value="design@">design@</option>
                <option value="dev@">dev@</option>
                <option value="seo@">seo@</option>
                <option value="qa@">qa@</option>
              </select> */}

              {selectedDepartmentFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setSelectedDepartmentFilter("ALL")}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Reset Filter
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Filter Popover Toggle */}
              <button
                type="button"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Filter Tasks"
              >
                <Filter size={15} />
              </button>

              {/* Export CSV */}
              <button
                type="button"
                onClick={handleExportTasksCSV}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Download CSV"
              >
                <Download size={15} />
              </button>

              {/* Refresh */}
              <button
                type="button"
                onClick={() => {
                  setSelectedStatusFilter("ALL");
                  setSelectedDepartmentFilter("ALL");
                }}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Reset All Filters"
              >
                <RotateCw size={15} />
              </button>

              <div className="h-4 w-px bg-border mx-0.5" />

              {/* Add Task Button */}
              <button
                type="button"
                onClick={() => setIsAddTaskDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
              >
                <Plus size={16} /> Add Task
              </button>

              {/* Filter Popover */}
              {showFilterPanel && (
                <div className="absolute right-24 top-10 z-40 w-52 rounded-md border bg-popover p-3 shadow-lg text-xs space-y-2 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center font-bold border-b pb-1">
                    <span>Filter Tasks</span>
                    <button type="button" onClick={() => setShowFilterPanel(false)}>
                      <X size={12} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Status</label>
                    <select
                      value={selectedStatusFilter}
                      onChange={(e) => setSelectedStatusFilter(e.target.value)}
                      className="w-full rounded border px-2 py-1 bg-background text-xs outline-none cursor-pointer"
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

          {/* Active Filter Notification Banner if Filtered Tasks is empty */}
          {filteredTasks.length === 0 && (
            <div className="flex items-center justify-between bg-primary/10 border-b border-primary/20 px-6 py-2 text-xs text-foreground">
              <span>
                No tasks matching department filter <strong>&quot;{selectedDepartmentFilter}&quot;</strong>.
              </span>
              <button
                type="button"
                onClick={() => setIsAddTaskDrawerOpen(true)}
                className="font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Plus size={13} /> Add Task to {selectedDepartmentFilter}
              </button>
            </div>
          )}

          {/* View Mode 1: Vertical Status Columns */}
          {viewMode === "STATUS_COLUMNS" && (
            <div className="flex-1 overflow-x-auto p-6 bg-background">
              <div className="flex gap-4 h-full items-start">
                {statusColumnsList.map((col) => (
                  <div
                    key={col.code}
                    className="w-12 hover:w-64 transition-all duration-300 shrink-0 rounded-2xl border bg-card p-2 flex flex-col h-full max-h-full items-center shadow-2xs group"
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

          {/* View Mode 2: 17 Phase Vertical Columns */}
          {viewMode === "PHASE_COLUMNS" && (
            <div className="flex-1 overflow-x-auto p-6 bg-background">
              <div className="flex gap-3 h-full items-start">
                {phaseColumns.map((phase) => (
                  <div
                    key={phase.code}
                    className="w-12 hover:w-60 transition-all duration-300 shrink-0 rounded-2xl border bg-card p-2 flex flex-col h-full max-h-full items-center shadow-2xs group"
                  >
                    <button
                      type="button"
                      className="mb-3 p-1 rounded-md border bg-background text-info hover:bg-accent transition-colors shadow-2xs"
                    >
                      <ExternalLink size={13} />
                    </button>

                    <div
                      className="rounded-full bg-secondary text-foreground px-2 py-4 text-[11px] font-bold tracking-wide select-none transition-transform duration-200"
                      style={{
                        writingMode: "vertical-rl",
                        textOrientation: "mixed",
                        transform: "rotate(180deg)",
                      }}
                    >
                      {phase.name} ({phase.count})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View Mode 3: Kanban Board Columns (Always Populated & Functional) */}
          {viewMode === "KANBAN" && (
            <div className="flex-1 overflow-x-auto p-6 bg-background">
              <div className="flex gap-5 h-full items-start">
                {phaseColumns.map((col) => (
                  <div
                    key={col.name}
                    className="w-72 shrink-0 rounded-xl border bg-card p-3 flex flex-col max-h-full shadow-2xs"
                  >
                    <div className="flex items-center justify-between pb-3 border-b mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-foreground tracking-wide truncate max-w-[170px]">
                          {col.name}
                        </h3>
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {col.count}
                        </span>
                      </div>
                      <MoreHorizontal size={14} className="text-muted-foreground cursor-pointer" />
                    </div>

                    <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-[200px]">
                      {col.tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-6 border border-dashed border-border rounded-lg text-center text-muted-foreground/70 space-y-2 h-36">
                          <span className="text-[11px] font-medium">No tasks in this phase</span>
                          <button
                            type="button"
                            onClick={() => setIsAddTaskDrawerOpen(true)}
                            className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={12} /> Add Task
                          </button>
                        </div>
                      ) : (
                        col.tasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={() =>
                              handleOpenTask({
                                id: task.id,
                                code: task.code,
                                title: task.title,
                                phaseCode: task.phaseCode,
                                phaseName: task.phaseName,
                                status: task.status,
                                authorName: task.authorName,
                                duration: "2 days/hrs",
                                description:
                                  "https://www.figma.com/design/Vm2CJsnQueANsM8TOXAl6H/WinOS---Web-Design?node-id=1-7&t=7EKtZ6Eb1SFxcRt-1",
                              })
                            }
                            className="rounded-lg border border-border bg-background p-3.5 shadow-2xs hover:border-primary/60 hover:shadow-md transition-all cursor-pointer space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[11px] font-bold text-muted-foreground">
                                {task.code}
                              </span>
                              {task.status === "Open" ? (
                                <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-bold text-success">
                                  OPEN
                                </span>
                              ) : task.status === "In Progress" ? (
                                <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-[10px] font-bold text-warning">
                                  IN PROGRESS
                                </span>
                              ) : (
                                <span className="rounded-full bg-info/10 px-2.5 py-0.5 text-[10px] font-bold text-info">
                                  CLOSED
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs font-bold text-foreground leading-snug">
                              {task.title}
                            </h4>

                            <div className="flex items-center justify-between pt-2 border-t border-border/50 text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Clock size={13} />
                                <CheckSquare size={13} />
                              </div>

                              <div className="flex -space-x-1.5">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold ring-2 ring-background">
                                  {task.owner ? task.owner.slice(0, 2).toUpperCase() : "DP"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Sprint Footer */}
          <div className="flex items-center justify-between border-t px-6 py-2.5 bg-background text-xs text-muted-foreground font-medium shrink-0">
            <div className="inline-flex items-center rounded-full bg-info/10 px-3 py-1 text-info font-semibold">
              • {realCompletionPercent}% COMPLETE
            </div>
            <div className="flex items-center gap-4 text-[11px]">
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
        onClose={() => setIsAddTaskDrawerOpen(false)}
        onAddTask={(newTask) => {
          onAddTask(newTask);
          setIsAddTaskDrawerOpen(false);
        }}
        availablePhases={phaseColumns.map(({ code, name }) => ({ code, name }))}
      />

      {/* New Time Log Modal */}
      <NewTimeLogModal
        isOpen={isTimeLogModalOpen}
        onClose={() => setIsTimeLogModalOpen(false)}
        projectId={realProjectId}
        projectName={projectName}
      />
    </div>
  );
}
