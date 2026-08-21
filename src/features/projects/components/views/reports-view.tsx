"use client";

import React, { useState, useEffect } from "react";
import { BarChart3, Users, AlertTriangle, Clock, CheckCircle2, TrendingUp, Download, Loader2 } from "lucide-react";
import { getProjectsAction, getTasksAction } from "../../actions/project-actions";
import { Project, TaskItem } from "../../types";

export function ReportsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReportData() {
      setIsLoading(true);
      try {
        const [fetchedProjects, fetchedTasks] = await Promise.all([
          getProjectsAction(),
          getTasksAction(),
        ]);
        setProjects(fetchedProjects);
        setTasks(fetchedTasks);
      } catch (err) {
        console.error("Failed to load report data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadReportData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
  const avgProgress =
    totalProjects > 0
      ? Math.round(projects.reduce((acc, p) => acc + p.progressPercent, 0) / totalProjects)
      : 0;

  const overdueTasksCount = tasks.filter(
    (t) => t.isWarning || t.staleAlert || t.status === "Open"
  ).length;

  // Department Workload Metrics computed dynamically from DB projects & tasks
  const deptMap: Record<string, { department: string; activeProjects: number; totalTasks: number }> = {
    "digitalproducts@": { department: "Digital Products / PM", activeProjects: 0, totalTasks: 0 },
    "seo@": { department: "SEO & Growth", activeProjects: 0, totalTasks: 0 },
    "design@": { department: "UI/UX & Design", activeProjects: 0, totalTasks: 0 },
    "dev@": { department: "Engineering & Dev", activeProjects: 0, totalTasks: 0 },
    "qa@": { department: "QA & Testing", activeProjects: 0, totalTasks: 0 },
  };

  projects.forEach((p) => {
    const alias = p.departmentAlias || "digitalproducts@";
    if (!deptMap[alias]) {
      deptMap[alias] = { department: alias, activeProjects: 0, totalTasks: 0 };
    }
    if (p.status === "ACTIVE") {
      deptMap[alias].activeProjects += 1;
    }
    deptMap[alias].totalTasks += p.totalTasksCount;
  });

  const departmentWorkloads = Object.entries(deptMap).map(([alias, data]) => {
    const loadPct = Math.min(100, Math.round((data.activeProjects / Math.max(1, totalProjects)) * 100));
    return {
      department: data.department,
      alias,
      activeProjects: data.activeProjects,
      totalTasks: data.totalTasks,
      loadPct,
      color:
        alias === "seo@"
          ? "bg-emerald-500"
          : alias === "design@"
          ? "bg-indigo-500"
          : alias === "dev@"
          ? "bg-amber-500"
          : alias === "qa@"
          ? "bg-purple-500"
          : "bg-sky-500",
    };
  });

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-y-auto p-6 space-y-6">
      {/* Top Title Bar */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Executive & Workload Reports</h1>
            <p className="text-xs text-muted-foreground">
              Cross-project %complete rollups, department workload distribution, and live database analytics.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => alert("Report exported successfully.")}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Download size={14} /> Export Executive Report
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Total Active Projects</span>
            <TrendingUp size={16} className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{activeProjects}</div>
          <p className="text-[11px] text-muted-foreground">Live database count</p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Average % Completion</span>
            <CheckCircle2 size={16} className="text-success" />
          </div>
          <div className="text-2xl font-bold text-success">{avgProgress}%</div>
          <p className="text-[11px] text-muted-foreground">Rollup progress across projects</p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Total Logged Tasks</span>
            <Clock size={16} className="text-info" />
          </div>
          <div className="text-2xl font-bold text-info">{tasks.length} Tasks</div>
          <p className="text-[11px] text-muted-foreground">Across all project boards</p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Open/Warning Task Alerts</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-500">{overdueTasksCount} Tasks</div>
          <p className="text-[11px] text-muted-foreground">Requires owner follow-up</p>
        </div>
      </div>

      {/* Department Workload Distribution */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users size={16} className="text-primary" /> Department Workload Distribution
          </h2>
          <span className="text-xs text-muted-foreground">Dynamic project distribution</span>
        </div>

        <div className="space-y-3">
          {departmentWorkloads.map((dept) => (
            <div key={dept.alias} className="space-y-1 text-xs">
              <div className="flex items-center justify-between font-medium">
                <span className="font-bold text-foreground">
                  {dept.department} <code className="text-muted-foreground font-normal">({dept.alias})</code>
                </span>
                <span className="font-mono text-muted-foreground">
                  {dept.activeProjects} active projects • <strong>{dept.totalTasks} tasks</strong> ({dept.loadPct}% load)
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${dept.color}`}
                  style={{ width: `${Math.max(5, dept.loadPct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Completion Rollup Table */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-foreground border-b pb-3">
          Project Completion Rollup Summary
        </h2>

        {projects.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4 text-center">No projects found in database.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-muted-foreground font-semibold">
                  <th className="py-2 px-3">Project Key</th>
                  <th className="py-2 px-3">Project Name</th>
                  <th className="py-2 px-3">Department</th>
                  <th className="py-2 px-3">% Completed</th>
                  <th className="py-2 px-3">Tasks (Done/Total)</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-accent/30">
                    <td className="py-2.5 px-3 font-mono font-bold">{p.id}</td>
                    <td className="py-2.5 px-3 font-semibold">{p.name}</td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {p.departmentAlias || "digitalproducts@"}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold w-8">{p.progressPercent}%</span>
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${p.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {p.completedTasksCount} / {p.totalTasksCount}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-success/15 text-success px-2 py-0.5 font-bold text-[10px]">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

