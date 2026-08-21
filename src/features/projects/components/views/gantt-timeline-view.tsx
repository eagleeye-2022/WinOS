"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Clock, Layers, ChevronRight, Filter, Plus, ChevronDown, Loader2 } from "lucide-react";
import { getProjectsAction } from "../../actions/project-actions";
import { Project } from "../../types";

export function GanttTimelineView() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<"MONTHS" | "WEEKS">("WEEKS");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      setIsLoading(true);
      try {
        const fetchedProjects = await getProjectsAction();
        setProjects(fetchedProjects);
      } catch (err) {
        console.error("Failed to load timeline projects:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProjects();
  }, []);

  const weeks = Array.from({ length: 14 }, (_, i) => `W${i + 1}`);

  // Build dynamic timeline items from database projects
  const timelinePhases = projects.map((p, idx) => ({
    code: p.id,
    name: p.name,
    departmentAlias: p.departmentAlias || "digitalproducts@",
    startWeek: ((idx * 2) % 10) + 1,
    durationWeeks: Math.max(2, Math.min(8, Math.round((p.totalTasksCount || 4) / 2))),
    progress: p.progressPercent || 0,
    taskListsCount: p.totalPhasesCount || p.phases?.length || 1,
  }));

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Timeline Controls Header */}
      <div className="flex items-center justify-between border-b px-6 py-3 bg-muted/20">
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-primary" />
          <h2 className="text-sm font-bold">Gantt & Phase Timeline</h2>
          <span className="text-xs text-muted-foreground font-mono">
            • 7 Phases & 17 Task Lists
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5 bg-background text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedTimeframe("WEEKS")}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedTimeframe === "WEEKS"
                  ? "bg-primary text-primary-foreground font-bold"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Weeks View
            </button>
            <button
              type="button"
              onClick={() => setSelectedTimeframe("MONTHS")}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedTimeframe === "MONTHS"
                  ? "bg-primary text-primary-foreground font-bold"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Months View
            </button>
          </div>
        </div>
      </div>

      {/* Main Gantt Grid Chart */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-6 space-y-4">
        <div className="min-w-[900px] border rounded-lg bg-card overflow-hidden">
          {/* Timeline Calendar Header */}
          <div className="grid grid-cols-16 border-b bg-muted/40 text-xs font-bold text-muted-foreground text-center py-2.5">
            <div className="col-span-5 px-4 text-left border-r font-bold text-foreground">
              Phase / Milestone
            </div>
            {weeks.map((w) => (
              <div key={w} className="col-span-1 border-r text-[11px]">
                {w}
              </div>
            ))}
          </div>

          {/* Timeline Phase Rows */}
          <div className="divide-y text-xs">
            {timelinePhases.map((phase) => (
              <div
                key={phase.code}
                className="grid grid-cols-16 items-center py-3 hover:bg-accent/20 transition-colors"
              >
                {/* Phase Info Header Column */}
                <div className="col-span-5 px-4 border-r space-y-0.5">
                  <div className="flex items-center justify-between font-bold text-foreground truncate">
                    <span className="truncate pr-2">{phase.name}</span>
                    <span className="text-[10px] font-mono text-primary shrink-0">
                      {phase.progress}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono">{phase.departmentAlias}</span>
                    <span>• {phase.taskListsCount} Task Lists</span>
                  </div>
                </div>

                {/* Duration Bar Column Grid */}
                <div className="col-span-11 grid grid-cols-11 px-2 relative items-center h-8">
                  <div
                    className="absolute h-6 rounded-md bg-gradient-to-r from-primary/80 to-primary text-primary-foreground text-[10px] font-bold px-2 flex items-center justify-between shadow-xs transition-all cursor-pointer hover:opacity-90"
                    style={{
                      left: `${((phase.startWeek - 1) / 14) * 100}%`,
                      width: `${(phase.durationWeeks / 14) * 100}%`,
                    }}
                  >
                    <span className="truncate">{phase.code}</span>
                    <span className="text-[9px] opacity-90">{phase.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
