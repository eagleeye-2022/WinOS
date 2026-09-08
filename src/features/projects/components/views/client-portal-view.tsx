"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  Loader2,
  Clock,
  Flag,
  ListTodo,
  DollarSign,
  Coffee,
  PieChart,
  FolderKanban,
} from "lucide-react";
import {
  getProjectsAction,
  getMyProjectsAction,
  getTasksAction,
  getTimeLogsAction,
} from "../../actions/project-actions";
import { Project, TaskItem, UserTimeGroup } from "../../types";
import { PhasesTableView } from "./phases-table-view";
import { ProjectTimeLogsView } from "./project-time-logs-view";
import { parseDurationMinutes } from "../../utils/time-helpers";

export function ClientPortalView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [timeGroups, setTimeGroups] = useState<UserTimeGroup[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"MILESTONES" | "TIME_LOGS">("MILESTONES");

  // Load projects accessible to this client
  useEffect(() => {
    async function loadClientProjects() {
      setIsLoading(true);
      try {
        let fetchedProjects = await getProjectsAction();
        if (!fetchedProjects || fetchedProjects.length === 0) {
          fetchedProjects = await getMyProjectsAction();
        }
        const clientProjects = fetchedProjects.filter((p) => p.isClientVisible !== false);
        setProjects(clientProjects);
        if (clientProjects.length > 0) {
          setSelectedProjectId(clientProjects[0].id);
        }
      } catch (err) {
        console.error("Failed to load client portal projects:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadClientProjects();
  }, []);

  // Load tasks & time logs for selected project
  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;
    async function loadProjectDetails() {
      setIsLoadingDetails(true);
      try {
        const [fetchedTasks, fetchedTimeLogs] = await Promise.all([
          getTasksAction(selectedProjectId),
          getTimeLogsAction(selectedProjectId),
        ]);
        if (!cancelled) {
          setTasks(fetchedTasks);
          setTimeGroups(fetchedTimeLogs);
        }
      } catch (err) {
        console.error("Failed to load project details:", err);
      } finally {
        if (!cancelled) setIsLoadingDetails(false);
      }
    }
    loadProjectDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Compute Task & Phase completion status
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter(
    (t) => t.status === "Closed" || (t.completionPercentage !== undefined && t.completionPercentage >= 100)
  ).length;
  const progressPercent =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const phases = selectedProject?.phases || [];
  const totalPhasesCount = phases.length;
  const completedPhasesCount = phases.filter((p) => p.isCompleted).length;

  // Compute Billable, Non-Billable & Total Hours
  let totalMinutes = 0;
  let billableMinutes = 0;
  let nonBillableMinutes = 0;

  timeGroups.forEach((group) => {
    (group.timeLogs || []).forEach((entry) => {
      const mins = parseDurationMinutes(entry.duration || "0");
      totalMinutes += mins;
      if (entry.billingType === "BILLABLE") {
        billableMinutes += mins;
      } else {
        nonBillableMinutes += mins;
      }
    });
  });

  const totalHoursText = `${(totalMinutes / 60).toFixed(1)} h`;
  const billableHoursText = `${(billableMinutes / 60).toFixed(1)} h`;
  const nonBillableHoursText = `${(nonBillableMinutes / 60).toFixed(1)} h`;

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 bg-card p-4 rounded-xl border shadow-2xs gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">Client Portal Workspace</h1>
              <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 text-[11px] font-bold flex items-center gap-1">
                <Lock size={12} /> Read-Only Mode
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Project Status & Time Tracking Overview
            </p>
          </div>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground shrink-0">Viewing Project:</span>
          {projects.length === 0 ? (
            <span className="text-xs text-muted-foreground font-semibold">No client projects available</span>
          ) : (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rounded-lg border border-input bg-background px-3.5 py-2 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-2xs"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Associated Projects Badges Bar */}
      {projects.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mr-1">
            <FolderKanban size={15} className="text-primary" />
            <span>Associated Projects ({projects.length}):</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {projects.map((p) => {
              const isSelected = p.id === selectedProjectId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs font-bold ring-2 ring-primary/20"
                      : "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground border border-border/50"
                  }`}
                >
                  <span>{p.name}</span>
                  <span className="font-mono text-[10px] opacity-75">({p.id})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Project Progress */}
        <div className="rounded-xl border bg-card p-3.5 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Overall Progress</span>
            <PieChart size={15} className="text-primary" />
          </div>
          <div className="text-lg font-bold text-foreground">{progressPercent}%</div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Tasks Completed */}
        <div className="rounded-xl border bg-card p-3.5 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Tasks Completed</span>
            <ListTodo size={15} className="text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-foreground">
            {completedTasksCount} / {totalTasksCount}
          </div>
          <p className="text-[10px] text-muted-foreground">Tasks Closed</p>
        </div>

        {/* Phases Completed */}
        <div className="rounded-xl border bg-card p-3.5 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Phases Completed</span>
            <Flag size={15} className="text-indigo-500" />
          </div>
          <div className="text-lg font-bold text-foreground">
            {completedPhasesCount} / {totalPhasesCount}
          </div>
          <p className="text-[10px] text-muted-foreground">Phases Verified</p>
        </div>

        {/* Total Hours */}
        <div className="rounded-xl border bg-card p-3.5 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Total Hours</span>
            <Clock size={15} className="text-sky-500" />
          </div>
          <div className="text-lg font-bold text-foreground">{totalHoursText}</div>
          <p className="text-[10px] text-muted-foreground">Total Time Logged</p>
        </div>

        {/* Billable Hours */}
        <div className="rounded-xl border bg-card p-3.5 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Billable Hours</span>
            <DollarSign size={15} className="text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {billableHoursText}
          </div>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">Billable Work</p>
        </div>

        {/* Non-Billable Hours */}
        <div className="rounded-xl border bg-card p-3.5 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Non-Billable Hours</span>
            <Coffee size={15} className="text-amber-500" />
          </div>
          <div className="text-lg font-bold text-muted-foreground">{nonBillableHoursText}</div>
          <p className="text-[10px] text-muted-foreground">Internal / Standard</p>
        </div>
      </div>

      {/* Navigation Tabs (Milestones vs Time Logs) */}
      <div className="flex items-center gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("MILESTONES")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "MILESTONES"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <Flag size={14} />
          <span>Milestones & Tasks Status</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TIME_LOGS")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "TIME_LOGS"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock size={14} />
          <span>Time Logs & Hours</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-[400px]">
        {isLoadingDetails ? (
          <div className="flex h-64 w-full items-center justify-center p-8">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            {activeTab === "MILESTONES" && (
              <div className="space-y-4">
                <PhasesTableView projectId={selectedProjectId} />
              </div>
            )}

            {activeTab === "TIME_LOGS" && (
              <div className="space-y-4">
                <ProjectTimeLogsView
                  projectId={selectedProjectId}
                  projectName={selectedProject?.name || "Client Project"}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
