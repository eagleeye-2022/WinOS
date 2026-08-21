"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Eye, Lock, CheckCircle2, FileText, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import { getProjectsAction, getTasksAction } from "../../actions/project-actions";
import { Project, TaskItem } from "../../types";

export function ClientPortalView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadClientData() {
      setIsLoading(true);
      try {
        const [fetchedProjects, fetchedTasks] = await Promise.all([
          getProjectsAction(),
          getTasksAction(),
        ]);
        const clientProjects = fetchedProjects.filter((p) => p.isClientVisible);
        setProjects(clientProjects);
        setTasks(fetchedTasks.filter((t) => t.isExternal));
        if (clientProjects.length > 0) {
          setSelectedProjectId(clientProjects[0].id);
        }
      } catch (err) {
        console.error("Failed to load client portal data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadClientData();
  }, []);

  const currentProject = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const clientVisibleTasks = tasks.filter((t) => t.isExternal);

  // Group tasks by phase for current project
  const phaseMap: Record<string, { code: string; name: string; tasks: TaskItem[] }> = {};
  clientVisibleTasks.forEach((t) => {
    const code = t.phaseCode || "1.1";
    const name = t.phaseName || "Client Deliverables";
    if (!phaseMap[code]) {
      phaseMap[code] = { code, name, tasks: [] };
    }
    phaseMap[code].tasks.push(t);
  });

  const clientVisiblePhases = Object.values(phaseMap);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-y-auto p-6 space-y-6">
      {/* Top Banner Notice */}
      <div className="flex items-center justify-between border-b pb-4 bg-primary/5 p-4 rounded-lg border border-primary/20">
        <div className="flex items-center gap-3">
          <ShieldCheck size={26} className="text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">Restricted Client Portal View</h1>
              <span className="rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-[10px] font-bold">
                Client Mode Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Showing strictly client-visible task lists (<code>isExternal: true</code>). Internal engineering task lists are automatically filtered out.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Viewing Project:</span>
          {projects.length === 0 ? (
            <span className="text-xs text-muted-foreground">No client projects available</span>
          ) : (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rounded border border-input bg-background px-3 py-1.5 text-xs font-bold text-foreground outline-none"
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

      {/* Security Privacy Notice */}
      <div className="flex items-center justify-between rounded-md bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-emerald-500 shrink-0" />
          <span>
            Access Control Enforced: Internal developer notes, technical specification documents, and internal QA task lists are hidden.
          </span>
        </div>
        <span className="font-mono text-[11px]">is_client_visible = true</span>
      </div>

      {/* Client Visible Phases & Task Lists */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Client Milestone Deliverables ({clientVisiblePhases.length} Phases Visible)
        </h2>

        <div className="space-y-4">
          {clientVisiblePhases.map((phase) => (
            <div key={phase.code} className="rounded-lg border bg-card p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-success" />
                  {phase.name}
                </h3>
                <span className="rounded bg-success/15 text-success px-2.5 py-0.5 text-[10px] font-bold">
                  Verified Client Milestone
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                {phase.tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-none">
                    <span className="text-foreground font-medium">• {t.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono">{t.duration || "1 day"}</span>
                      <span className="rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-[10px] font-bold">
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
