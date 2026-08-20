"use client";

import React, { useState } from "react";
import { BarChart3, PieChart, Users, AlertTriangle, Clock, CheckCircle2, TrendingUp, Download } from "lucide-react";
import { INITIAL_MOCK_PROJECTS } from "../../data/mock-projects";

export function ReportsView() {
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  const totalProjects = INITIAL_MOCK_PROJECTS.length;
  const activeProjects = INITIAL_MOCK_PROJECTS.filter((p) => p.status === "ACTIVE").length;
  const avgProgress = Math.round(
    INITIAL_MOCK_PROJECTS.reduce((acc, p) => acc + p.progressPercent, 0) / totalProjects
  );

  // Department Workload Metrics
  const departmentWorkloads = [
    { department: "SEO & Growth", alias: "seo@", activeProjects: 18, totalHours: "142h", loadPct: 85, color: "bg-emerald-500" },
    { department: "UI/UX & Design", alias: "design@", activeProjects: 22, totalHours: "186h", loadPct: 92, color: "bg-indigo-500" },
    { department: "Engineering & Dev", alias: "dev@", activeProjects: 15, totalHours: "210h", loadPct: 78, color: "bg-amber-500" },
    { department: "Digital Products / PM", alias: "digitalproducts@", activeProjects: 24, totalHours: "95h", loadPct: 65, color: "bg-sky-500" },
    { department: "QA & Testing", alias: "qa@", activeProjects: 12, totalHours: "60h", loadPct: 50, color: "bg-purple-500" },
  ];

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-y-auto p-6 space-y-6">
      {/* Top Title Bar */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Executive & Workload Reports</h1>
            <p className="text-xs text-muted-foreground">
              Cross-project %complete rollups, department workload distribution, and billable hours analytics.
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
          <p className="text-[11px] text-muted-foreground">Across EagleEye Digital Portal</p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Average % Completion</span>
            <CheckCircle2 size={16} className="text-success" />
          </div>
          <div className="text-2xl font-bold text-success">{avgProgress}%</div>
          <p className="text-[11px] text-muted-foreground">Rollup progress across phases</p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Billable vs Non-Billable</span>
            <Clock size={16} className="text-info" />
          </div>
          <div className="text-2xl font-bold text-info">78% / 22%</div>
          <p className="text-[11px] text-muted-foreground">Hours tracked for billing</p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Overdue Task Alerts</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-500">4 Tasks</div>
          <p className="text-[11px] text-muted-foreground">Requires owner follow-up</p>
        </div>
      </div>

      {/* Department Workload Distribution */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users size={16} className="text-primary" /> Department Workload Distribution
          </h2>
          <span className="text-xs text-muted-foreground">Capacity benchmarked at 40h/week</span>
        </div>

        <div className="space-y-3">
          {departmentWorkloads.map((dept) => (
            <div key={dept.alias} className="space-y-1 text-xs">
              <div className="flex items-center justify-between font-medium">
                <span className="font-bold text-foreground">
                  {dept.department} <code className="text-muted-foreground font-normal">({dept.alias})</code>
                </span>
                <span className="font-mono text-muted-foreground">
                  {dept.activeProjects} active projects • <strong>{dept.totalHours}</strong> ({dept.loadPct}% load)
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${dept.color}`}
                  style={{ width: `${dept.loadPct}%` }}
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
              {INITIAL_MOCK_PROJECTS.map((p) => (
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
      </div>
    </div>
  );
}
