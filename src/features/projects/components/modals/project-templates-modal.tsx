"use client";

import React, { useState } from "react";
import { X, Layers, Plus, Check, Edit3, Trash2, FileText, ChevronRight, Lock } from "lucide-react";
import { ProjectTemplate } from "../../types";
import { DEFAULT_PROJECT_TEMPLATES } from "../../data/sop-templates";

interface ProjectTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate?: (template: ProjectTemplate) => void;
}

export function ProjectTemplatesModal({
  isOpen,
  onClose,
  onSelectTemplate,
}: ProjectTemplatesModalProps) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>(DEFAULT_PROJECT_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    DEFAULT_PROJECT_TEMPLATES[0].id
  );

  if (!isOpen) return null;

  const activeTemplate =
    templates.find((t) => t.id === selectedTemplateId) || templates[0];

  const totalTaskListsCount = activeTemplate.phases.reduce(
    (acc, p) => acc + (p.taskLists?.length || 0),
    0
  );

  const totalTasksCount = activeTemplate.phases.reduce(
    (acc, p) =>
      acc + (p.taskLists?.reduce((tAcc, tl) => tAcc + (tl.defaultTasks?.length || 0), 0) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative flex h-[85vh] w-full max-w-4xl flex-col rounded-lg border bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-2 text-foreground">
            <Layers className="text-primary" size={20} />
            <h2 className="text-base font-bold">Project Template Library</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Grid */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Template List Sidebar */}
          <div className="w-72 border-r bg-muted/10 p-4 space-y-3 overflow-y-auto">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Available Templates ({templates.length})
            </div>

            <div className="space-y-2">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  className={`w-full text-left p-3 rounded-md border text-xs transition-all ${
                    selectedTemplateId === tmpl.id
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                      : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate pr-1">{tmpl.name}</span>
                    {tmpl.isDefault && (
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] text-primary">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {tmpl.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Right Template Details & Task List Scaffolding View */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {activeTemplate.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeTemplate.description}
                </p>
              </div>

              {onSelectTemplate && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectTemplate(activeTemplate);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
                >
                  <Check size={14} /> Use This Template
                </button>
              )}
            </div>

            {/* Template Metrics Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 bg-card text-center">
                <div className="text-xs text-muted-foreground font-medium">Phases</div>
                <div className="text-lg font-bold text-foreground">
                  {activeTemplate.phases.length}
                </div>
              </div>
              <div className="rounded-lg border p-3 bg-card text-center">
                <div className="text-xs text-muted-foreground font-medium">Task Lists</div>
                <div className="text-lg font-bold text-primary">
                  {totalTaskListsCount}
                </div>
              </div>
              <div className="rounded-lg border p-3 bg-card text-center">
                <div className="text-xs text-muted-foreground font-medium">Starter Tasks</div>
                <div className="text-lg font-bold text-success">
                  {totalTasksCount}
                </div>
              </div>
            </div>

            {/* Phases and Task Lists Breakdown */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Scaffolded Phases & Task Lists
              </h4>

              <div className="space-y-3">
                {activeTemplate.phases.map((phase) => (
                  <div
                    key={phase.code}
                    className="rounded-md border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between font-bold text-xs text-foreground border-b pb-1.5">
                      <span>{phase.name}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {phase.departmentAlias}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {(phase.taskLists || []).map((tl) => (
                        <div
                          key={tl.name}
                          className="rounded border border-border/70 bg-background p-2 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="truncate">{tl.name}</span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                tl.flag === "external"
                                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {tl.flag === "external" ? "Client Visible" : "Internal Only"}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {tl.defaultTasks.length} starter task(s)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
