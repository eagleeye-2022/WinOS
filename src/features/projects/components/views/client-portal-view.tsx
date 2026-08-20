"use client";

import React, { useState } from "react";
import { ShieldCheck, Eye, Lock, CheckCircle2, FileText, ExternalLink, Sparkles } from "lucide-react";
import { VERBATIM_T2T_7_PHASE_TEMPLATE } from "../../data/sop-templates";

export function ClientPortalView() {
  const [selectedProject, setSelectedProject] = useState("EagleEye Client Website (EEDP-87)");

  // Filter ONLY external client-visible task lists from the T2T SOP
  const clientVisiblePhases = VERBATIM_T2T_7_PHASE_TEMPLATE.phases.map((phase) => ({
    code: phase.code,
    name: phase.name,
    taskLists: phase.taskLists.filter((tl) => tl.flag === "external"),
  })).filter((phase) => phase.taskLists.length > 0);

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
              Showing strictly client-visible task lists (<code>flag: external</code>). Internal engineering task lists are automatically filtered out.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Viewing Project:</span>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="rounded border border-input bg-background px-3 py-1.5 text-xs font-bold text-foreground outline-none"
          >
            <option value="EagleEye Client Website (EEDP-87)">EagleEye Client Website (EEDP-87)</option>
            <option value="Super Kids Academy (EEDP-82)">Super Kids Academy (EEDP-82)</option>
          </select>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {phase.taskLists.map((tl) => (
                  <div key={tl.name} className="rounded-md border bg-background p-3.5 space-y-2">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-bold text-xs text-foreground">{tl.name}</span>
                      <span className="rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-[10px] font-bold">
                        Client Visible
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {tl.defaultTasks.map((t, tIdx) => (
                        <div key={tIdx} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-none">
                          <span className="text-foreground font-medium">• {t.title}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{t.duration}</span>
                        </div>
                      ))}
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
