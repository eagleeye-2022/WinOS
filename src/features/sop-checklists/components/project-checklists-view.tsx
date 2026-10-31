"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { projectTaskHref } from "@/lib/project-task-href";
import {
  bulkAttachSopChecklistAction,
  getProjectChecklistOverviewAction,
} from "../actions/project-checklist-actions";
import { getSopTemplatesAction } from "../actions/template-actions";
import { ProjectChecklistOverview, ProjectChecklistTask, SopTemplate } from "../types";

type Filter = "WITH" | "REQUIRED_OPEN" | "OUTDATED" | "WITHOUT";

const FILTER_LABELS: Record<Filter, string> = {
  WITH: "With checklists",
  REQUIRED_OPEN: "Required open",
  OUTDATED: "SOP updated",
  WITHOUT: "No checklist",
};

/** A project's SOP checklists across all its tasks: progress, gaps, and bulk-attaching an SOP. */
export function ProjectChecklistsView({ projectId }: { projectId: string }) {
  const [overview, setOverview] = useState<ProjectChecklistOverview | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<Filter>("WITH");
  const [search, setSearch] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProjectChecklistOverviewAction(projectId)
      .then((res) => {
        if (!cancelled) setOverview(res);
      })
      .catch((err) => {
        console.error("Failed to load project checklists:", err);
        if (!cancelled) setOverview({ projectCode: null, canManage: false, tasks: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  const stats = useMemo(() => {
    const tasks = overview?.tasks || [];
    const withLists = tasks.filter((t) => t.checklists.length > 0);
    const all = withLists.flatMap((t) => t.checklists);
    return {
      tasksWith: withLists.length,
      done: all.reduce((s, c) => s + c.done, 0),
      total: all.reduce((s, c) => s + c.total, 0),
      requiredOpen: withLists.filter((t) => !t.isDone && t.checklists.some((c) => c.requiredOpen > 0)).length,
      outdated: withLists.filter((t) => t.checklists.some((c) => c.isBehind)).length,
    };
  }, [overview]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (overview?.tasks || []).filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !t.code.toLowerCase().includes(q)) return false;
      if (filter === "WITHOUT") return t.checklists.length === 0;
      if (t.checklists.length === 0) return false;
      if (filter === "REQUIRED_OPEN") return !t.isDone && t.checklists.some((c) => c.requiredOpen > 0);
      if (filter === "OUTDATED") return t.checklists.some((c) => c.isBehind);
      return true;
    });
  }, [overview, filter, search]);

  if (!overview) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 size={22} className="animate-spin text-primary" />
      </div>
    );
  }

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-background p-4 text-xs text-foreground md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <ClipboardCheck size={18} className="text-primary" /> SOP Checklists
          </h2>
          <p className="text-muted-foreground">Checklist progress on every task of this project.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded-md border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          {overview.canManage && (
            <button
              type="button"
              onClick={() => setAttachOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={14} /> Attach SOP to tasks
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tasks with checklists" value={`${stats.tasksWith} / ${overview.tasks.length}`} />
        <Stat
          label="Steps done"
          value={`${stats.done} / ${stats.total}`}
          extra={
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          }
        />
        <Stat label="Open tasks with required steps left" value={String(stats.requiredOpen)} warn={stats.requiredOpen > 0} />
        <Stat label="Tasks behind their SOP" value={String(stats.outdated)} warn={stats.outdated > 0} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 font-semibold transition-colors",
              filter === f ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
            )}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-60">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks"
            className="w-full rounded-md border bg-background py-1.5 pl-8 pr-2 outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Task table */}
      <div className="overflow-x-auto rounded-lg border dark:border-zinc-800">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground dark:border-zinc-800">
              <th className="px-3 py-2 font-semibold">Task</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Checklists</th>
              <th className="w-48 px-3 py-2 font-semibold">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-zinc-800">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                  {overview.tasks.length === 0
                    ? "This project has no tasks yet."
                    : filter === "WITH" && stats.tasksWith === 0
                    ? overview.canManage
                      ? "No task has a checklist yet — use “Attach SOP to tasks”."
                      : "No task has a checklist yet."
                    : "No tasks match."}
                </td>
              </tr>
            ) : (
              visible.map((t) => <TaskRow key={t.id} task={t} projectId={projectId} />)
            )}
          </tbody>
        </table>
      </div>

      {attachOpen && (
        <BulkAttachPanel
          projectId={projectId}
          tasks={overview.tasks}
          onClose={() => setAttachOpen(false)}
          onDone={() => {
            setAttachOpen(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, warn, extra }: { label: string; value: string; warn?: boolean; extra?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3 dark:border-zinc-800">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold tabular-nums", warn && "text-warning")}>{value}</p>
      {extra}
    </div>
  );
}

function TaskRow({ task, projectId }: { task: ProjectChecklistTask; projectId: string }) {
  const href = projectTaskHref(projectId, task.code);
  const done = task.checklists.reduce((s, c) => s + c.done, 0);
  const total = task.checklists.reduce((s, c) => s + c.total, 0);
  const requiredOpen = task.checklists.reduce((s, c) => s + c.requiredOpen, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <tr className="hover:bg-accent/30">
      <td className="px-3 py-2 align-top">
        {href ? (
          <Link href={`${href}?tab=checklist`} className="group block">
            <span className="font-mono text-[11px] text-muted-foreground">{task.code}</span>
            {task.isSubtask && <span className="ml-1 text-[10px] text-muted-foreground">(subtask)</span>}
            <span className="block font-semibold group-hover:text-primary">{task.title}</span>
          </Link>
        ) : (
          <span className="font-semibold">{task.title}</span>
        )}
      </td>
      <td className="px-3 py-2 align-top text-muted-foreground">{task.status}</td>
      <td className="px-3 py-2 align-top">
        {task.checklists.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul className="space-y-0.5">
            {task.checklists.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-1.5">
                <span>{c.name}</span>
                <span className="text-muted-foreground">
                  {c.done}/{c.total}
                </span>
                {c.isBehind && (
                  <span className="rounded bg-warning/15 px-1 text-[10px] font-semibold text-warning">SOP updated</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        {total > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", pct === 100 ? "bg-success" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-9 text-right tabular-nums text-muted-foreground">{pct}%</span>
            </div>
            {requiredOpen > 0 && !task.isDone && (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-warning">
                <AlertTriangle size={11} /> {requiredOpen} required open
              </p>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function BulkAttachPanel({
  projectId,
  tasks,
  onClose,
  onDone,
}: {
  projectId: string;
  tasks: ProjectChecklistTask[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [templates, setTemplates] = useState<SopTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [includeDone, setIncludeDone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getSopTemplatesAction()
      .then(setTemplates)
      .catch((err) => {
        console.error("Failed to load SOPs:", err);
        setTemplates([]);
      });
  }, []);

  const hasTemplate = (t: ProjectChecklistTask) => !!templateId && t.checklists.some((c) => c.templateId === templateId);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (includeDone || !t.isDone) &&
        (!q || t.title.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || (t.phaseName || "").toLowerCase().includes(q))
    );
  }, [tasks, search, includeDone]);

  const selectable = candidates.filter((t) => !hasTemplate(t));
  const allSelected = selectable.length > 0 && selectable.every((t) => selected.has(t.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAttach = async () => {
    if (!templateId) {
      toast.error("Choose an SOP");
      return;
    }
    const ids = [...selected].filter((id) => {
      const t = tasks.find((x) => x.id === id);
      return t && !hasTemplate(t);
    });
    if (ids.length === 0) {
      toast.error("Select at least one task");
      return;
    }
    setIsSaving(true);
    try {
      const res = await bulkAttachSopChecklistAction(projectId, templateId, ids);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Attached to ${res.attached} task(s)` + (res.skipped > 0 ? ` · ${res.skipped} skipped` : ""));
      onDone();
    } catch (err) {
      console.error("Failed to attach SOP:", err);
      toast.error("Failed to attach SOP");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-xs" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Attach SOP to tasks"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-bold">Attach SOP to tasks</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent" title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 border-b p-4 text-xs">
          <label className="block space-y-1 font-semibold">
            SOP
            {templates === null ? (
              <div className="h-8 animate-pulse rounded-md bg-muted/50" />
            ) : templates.length === 0 ? (
              <p className="font-normal text-muted-foreground">No SOPs yet — create one under SOP Checklists first.</p>
            ) : (
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1.5 font-normal"
              >
                <option value="">Choose an SOP…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.department} · {t.category} · {t.items.length} steps
                  </option>
                ))}
              </select>
            )}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by task, code or phase"
                className="w-full rounded-md border bg-background py-1.5 pl-8 pr-2 outline-none focus:border-primary"
              />
            </div>
            <label className="flex items-center gap-1.5 text-muted-foreground">
              <input type="checkbox" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} />
              Include closed
            </label>
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={allSelected}
              disabled={selectable.length === 0}
              onChange={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  selectable.forEach((t) => (allSelected ? next.delete(t.id) : next.add(t.id)));
                  return next;
                })
              }
            />
            Select all shown ({selectable.length})
          </label>
        </div>

        <ul className="min-h-0 flex-1 divide-y overflow-y-auto text-xs dark:divide-zinc-800">
          {candidates.map((t) => {
            const already = hasTemplate(t);
            return (
              <li key={t.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 px-4 py-2 hover:bg-accent/40",
                    already && "cursor-not-allowed opacity-50"
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    disabled={already}
                    checked={already || selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                  />
                  <span className="min-w-0">
                    <span className="font-mono text-[11px] text-muted-foreground">{t.code}</span>
                    {t.phaseName && <span className="text-[11px] text-muted-foreground"> · {t.phaseName}</span>}
                    <span className="block font-medium">{t.title}</span>
                    {already && <span className="text-[11px] text-muted-foreground">Already has this SOP</span>}
                  </span>
                </label>
              </li>
            );
          })}
          {candidates.length === 0 && <li className="px-4 py-8 text-center text-muted-foreground">No tasks match.</li>}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-xs">
          <span className="text-muted-foreground">{selected.size} selected</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 font-semibold text-muted-foreground hover:bg-accent">
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || !templateId || selected.size === 0}
              onClick={handleAttach}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 font-bold text-primary-foreground disabled:opacity-50"
            >
              {isSaving && <Loader2 size={13} className="animate-spin" />}
              Attach
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
