"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, Loader2, X } from "lucide-react";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { toast } from "@/components/shared/toast";
import {
  getMoveTaskTargetsAction,
  moveTaskToProjectAction,
  type MoveTaskTarget,
} from "../../actions/project-actions";

/**
 * "Move to another project" (managers): pick a project and one of its task lists. The task moves
 * there with all its subtasks, time logs and DSM links (see moveTaskToProjectAction).
 */
export function MoveTaskToProjectDialog({
  open,
  onClose,
  taskId,
  taskCode,
  taskTitle,
  currentProjectId,
  onMoved,
}: {
  open: boolean;
  onClose: () => void;
  taskId: string;
  taskCode: string;
  taskTitle: string;
  currentProjectId?: string;
  onMoved: (result: { projectId: string; code: string }) => void;
}) {
  const [targets, setTargets] = useState<MoveTaskTarget[] | null>(null);
  const [projectId, setProjectId] = useState("");
  const [listCode, setListCode] = useState("");
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    if (!open || targets) return;
    let cancelled = false;
    getMoveTaskTargetsAction()
      .then((rows) => {
        if (!cancelled) setTargets(rows);
      })
      .catch(() => {
        if (!cancelled) setTargets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, targets]);

  const projectOptions = useMemo(
    () =>
      (targets ?? [])
        .filter((p) => p.id !== currentProjectId && p.code !== currentProjectId)
        .map((p) => ({ value: p.id, label: p.code ? `${p.name} (${p.code})` : p.name })),
    [targets, currentProjectId]
  );
  const project = targets?.find((p) => p.id === projectId);
  const listOptions = (project?.lists ?? []).map((l) => ({ value: l.code, label: l.name }));

  if (!open) return null;

  const move = async () => {
    if (!projectId || !listCode || isMoving) return;
    setIsMoving(true);
    try {
      const res = await moveTaskToProjectAction(taskId, projectId, listCode);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Moved to ${project?.name ?? "the project"} as ${res.code}`);
      onMoved({ projectId: res.projectId, code: res.code });
    } catch (err) {
      console.error("Failed to move task:", err);
      toast.error("Couldn't move the task. Please try again.");
    } finally {
      setIsMoving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={isMoving ? undefined : onClose}>
      <div
        className="w-full max-w-md rounded-2xl border bg-card shadow-2xl dark:border-zinc-800 dark:bg-[#121215]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Move task to another project"
      >
        <div className="flex items-center justify-between border-b px-5 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm font-bold">
            <ArrowRightLeft size={16} className="text-primary" /> Move to another project
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isMoving}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-xs">
          <p className="text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{taskCode}</span> {taskTitle}
          </p>

          <label className="block space-y-1 font-semibold">
            Project
            {targets === null ? (
              <div className="flex items-center gap-2 py-2 font-normal text-muted-foreground">
                <Loader2 size={13} className="animate-spin" /> Loading projects…
              </div>
            ) : (
              <SearchableSelect
                value={projectId}
                onChange={(v) => {
                  setProjectId(v);
                  setListCode("");
                }}
                options={projectOptions}
                placeholder="Select project"
                searchPlaceholder="Search projects..."
                className="w-full rounded-md border bg-background px-3 py-2 font-normal"
              />
            )}
          </label>

          <label className="block space-y-1 font-semibold">
            Task list
            <SearchableSelect
              value={listCode}
              onChange={setListCode}
              options={listOptions}
              placeholder={projectId ? "Select task list" : "Select a project first"}
              searchPlaceholder="Search task lists..."
              disabled={!projectId}
              className="w-full rounded-md border bg-background px-3 py-2 font-normal"
            />
          </label>

          <p className="rounded-md bg-muted/60 p-2.5 text-muted-foreground">
            Its subtasks, time logs and DSM links move with it, and it gets the new project&apos;s next task code.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isMoving}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={move}
            disabled={!projectId || !listCode || isMoving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {isMoving && <Loader2 size={13} className="animate-spin" />} Move task
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
