"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { TaskItem } from "../../types";
import { TaskDetailDrawer } from "../modals/task-detail-drawer";
import { AddTaskDrawer } from "../modals/add-task-drawer";
import { ChecklistWorkspaceView } from "./checklist-workspace-view";
import { PhasesTableView } from "./phases-table-view";
import { TimeTrackerView } from "./time-tracker-view";
import { INITIAL_MOCK_TIME_GROUPS } from "../../data/mock-time-logs";

interface TasksBoardViewProps {
  tasks: TaskItem[];
  onAddTask: (newTask: TaskItem) => void;
  onUpdateTask: (updatedTask: TaskItem) => void;
}

export function TasksBoardView({
  tasks,
  onAddTask,
  onUpdateTask,
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

  // Filter & Options Popover States
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");

  const handleOpenTask = (task: TaskItem) => {
    setSelectedTask(task);
    setIsDetailDrawerOpen(true);
  };

  const handleExportTasksCSV = () => {
    const headers = "Code,Title,Phase,Status,Owner,Duration\n";
    const rows = tasks
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

  const filteredTasks = tasks.filter((t) => {
    if (selectedStatusFilter === "ALL") return true;
    return t.status.toLowerCase() === selectedStatusFilter.toLowerCase();
  });

  // 10 Status Columns (matching Image 1)
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
      tasks: [],
    },
    {
      code: "ON_HOLD",
      title: "ON HOLD",
      badgeColor: "bg-slate-400 text-white",
      borderColor: "border",
      tasks: [],
    },
    {
      code: "DELAYED",
      title: "DELAYED",
      badgeColor: "bg-cyan-500 text-white",
      borderColor: "border-info/30",
      tasks: [],
    },
    {
      code: "DONE",
      title: "DONE",
      badgeColor: "bg-success text-success-foreground",
      borderColor: "border-success/30",
      tasks: [],
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
      code: "CLOSED",
      title: "CLOSED",
      badgeColor: "bg-slate-700 text-white",
      borderColor: "border",
      tasks: filteredTasks.filter(
        (t) => t.status.toLowerCase() === "closed"
      ),
    },
    {
      code: "READY_TO_ONBOARD",
      title: "READY TO ONBOARD",
      badgeColor: "bg-yellow-700 text-white",
      borderColor: "border-warning/30",
      tasks: [],
    },
  ];

  // 17 Phase Vertical Columns (matching Image 3)
  const verticalPhasesList = [
    { code: "1.1", name: "1.1 Client On Boarding", count: 5 },
    { code: "1.2", name: "1.2 Requirement Collection & Documentation", count: 5 },
    { code: "2.1", name: "2.1 UX Research & Discovery", count: 7 },
    { code: "2.2", name: "2.2 Ideation & Conceptualization", count: 5 },
    { code: "3.1", name: "3.1 UI/UX Designing", count: 9 },
    { code: "3.2", name: "3.2 Graphic Designing", count: 2 },
    { code: "3.3", name: "3.3 Content Writing", count: 1 },
    { code: "4.1", name: "4.1 Development", count: 8 },
    { code: "5.1", name: "5.1 Testing", count: 10 },
    { code: "6.1", name: "6.1 Deployment and SEO", count: 1 },
    { code: "7.1", name: "7.1 Maintenance & Support", count: 1 },
    { code: "7.2", name: "7.2 MSO On-Page & Technical SEO", count: 0 },
    { code: "7.3", name: "7.3 MSO Off-Page", count: 0 },
    { code: "7.4", name: "7.4 MSO Content Marketing", count: 0 },
    { code: "7.5", name: "7.5 MSO Main", count: 0 },
    { code: "7.6", name: "7.6 MSO Local SEO", count: 0 },
    { code: "7.7", name: "7.7 MSO Performance Marketing", count: 0 },
  ];

  // Group tasks by phase name for Kanban view (matching Image 4)
  const phaseColumns = [
    {
      code: "2.2",
      name: "IDEATION & CONCEPTUALIZATION",
      count: "03",
      tasks: [
        {
          id: "t-mock-1",
          code: "WI1-T02",
          title: "Market analysis for Q4 expansion strategy",
          phaseCode: "2.2",
          phaseName: "IDEATION & CONCEPTUALIZATION",
          status: "Open" as const,
          authorName: "Dhruv Patidar",
        },
        {
          id: "t-mock-2",
          code: "WI1-T25",
          title: "Initial wireframes for the new customer dashboard",
          phaseCode: "2.2",
          phaseName: "IDEATION & CONCEPTUALIZATION",
          status: "In Progress" as const,
          authorName: "Dhruv Patidar",
        },
      ],
    },
    {
      code: "3.1",
      name: "UI/UX DESIGNING",
      count: "02",
      tasks: [
        {
          id: "t-mock-3",
          code: "WI1-T22",
          title: "Dark mode color system refinement and accessibility check",
          phaseCode: "3.1",
          phaseName: "UI/UX DESIGNING",
          status: "In Progress" as const,
          authorName: "Dhruv Patidar",
        },
      ],
    },
    {
      code: "3.2",
      name: "GRAPHIC DESIGNING",
      count: "04",
      tasks: [
        {
          id: "t-mock-4",
          code: "WI1-T31",
          title: "Annual report infographics and data visualization assets",
          phaseCode: "3.2",
          phaseName: "GRAPHIC DESIGNING",
          status: "Closed" as const,
          authorName: "Dhruv Patidar",
        },
      ],
    },
    {
      code: "3.3",
      name: "CONTENT WRITING",
      count: "01",
      tasks: [
        {
          id: "t-mock-5",
          code: "WI1-T35",
          title: "Draft technical documentation API v2.0 release",
          phaseCode: "3.3",
          phaseName: "CONTENT WRITING",
          status: "Open" as const,
          authorName: "Dhruv Patidar",
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden relative">
      {/* Top Header Breadcrumb & Icons */}
      <div className="flex items-center justify-between border-b px-6 py-3 bg-background">
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="text-muted-foreground">EEDP-200 <strong className="text-foreground">Project ABCDEF GHIJKL</strong></span>
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

        <div className="flex items-center gap-3 text-muted-foreground">
          <button
            type="button"
            className="p-1 hover:bg-accent rounded hover:text-foreground transition-colors"
            title="Notifications"
          >
            <Bell size={16} />
          </button>
          <button
            type="button"
            className="p-1 hover:bg-accent rounded hover:text-foreground transition-colors"
            title="Help"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {activeSubTab === "CHECKLIST" ? (
        <ChecklistWorkspaceView />
      ) : activeSubTab === "PHASES" ? (
        <PhasesTableView onOpenAddModal={() => setIsAddTaskDrawerOpen(true)} />
      ) : activeSubTab === "TIME_LOGS" ? (
        <TimeTrackerView initialGroups={INITIAL_MOCK_TIME_GROUPS} />
      ) : (
        <>
          {/* Action Toolbar */}
          <div className="flex items-center justify-between border-b px-6 py-2.5 bg-muted/20 relative">
            <div className="flex items-center gap-2">
              {/* View Mode Switches */}
              <div className="inline-flex rounded-md border p-0.5 bg-background shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewMode("STATUS_COLUMNS")}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === "STATUS_COLUMNS"
                      ? "bg-info/10 text-info font-bold"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                  title="Vertical Status Columns"
                >
                  <Columns size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("PHASE_COLUMNS")}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === "PHASE_COLUMNS"
                      ? "bg-info/10 text-info font-bold"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                  title="17 Phase Vertical Columns"
                >
                  <Layers size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("KANBAN")}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === "KANBAN"
                      ? "bg-info/10 text-info font-bold"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                  title="Kanban Board View"
                >
                  <Kanban size={15} />
                </button>
              </div>
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
                onClick={() => setSelectedStatusFilter("ALL")}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Reset Filters"
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
                      {col.title}
                    </div>

                    <div className="w-full mt-4 space-y-2 overflow-y-auto hidden group-hover:block pr-1 flex-1">
                      {col.tasks.map((task) => (
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
                      ))}
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
                {verticalPhasesList.map((phase) => (
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

          {/* View Mode 3: Kanban Board Columns */}
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
                        <h3 className="text-xs font-bold text-foreground tracking-wide">
                          {col.name}
                        </h3>
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {col.count}
                        </span>
                      </div>
                      <MoreHorizontal size={14} className="text-muted-foreground cursor-pointer" />
                    </div>

                    <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                      {col.tasks.map((task) => (
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
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white text-[9px] font-bold ring-2 ring-background">
                                DP
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Sprint Footer */}
          <div className="flex items-center justify-between border-t px-6 py-2.5 bg-background text-xs text-muted-foreground font-medium shrink-0">
            <div className="inline-flex items-center rounded-full bg-info/10 px-3 py-1 text-info font-semibold">
              • ACTIVE SPRINT: 68% COMPLETE
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>TOTAL COUNT: <strong className="text-foreground">124 TASKS</strong></span>
              <span>ASSIGNED TO ME: <strong className="text-foreground">12</strong></span>
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
      />
    </div>
  );
}
