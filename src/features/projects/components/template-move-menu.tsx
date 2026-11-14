"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, FolderInput, Loader2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { toast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import type { SOPTaskSeed } from "../types";
import {
  addTemplateTaskToProjectAction,
  getMoveTaskTargetsAction,
  type MoveTaskTarget,
} from "../actions/project-actions";

export interface TemplateMoveTarget {
  id: string;
  name: string;
  lists: string[];
}

const SELECT_TRIGGER =
  "flex w-full justify-between rounded-md border bg-background px-3 py-2 text-xs font-normal hover:bg-accent/40 focus-visible:ring-1 focus-visible:ring-primary";
// The list portals to <body>: lift it above the dialog's z-[70] overlay and match the trigger's width.
const SELECT_CONTENT = "z-[80] w-[var(--radix-popover-trigger-width)]";

/**
 * "Move to another template": pick a template, then one of its task lists — the same dialog as
 * moving a project task to another project. `onMove` adds the task there.
 */
export function MoveTaskToTemplateDialog({
  taskLabel,
  otherTemplates,
  onMove,
  onClose,
}: {
  taskLabel: string;
  otherTemplates: TemplateMoveTarget[];
  onMove: (target: { id: string; name: string }, listIndex: number) => void | Promise<void>;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState("");
  const [listIndex, setListIndex] = useState("");
  const [isMoving, setIsMoving] = useState(false);

  const template = otherTemplates.find((t) => t.id === templateId);
  const templateOptions = otherTemplates.map((t) => ({ value: t.id, label: t.name }));
  const listOptions = (template?.lists ?? []).map((name, i) => ({ value: String(i), label: name || "Untitled list" }));

  const move = async () => {
    if (!template || listIndex === "" || isMoving) return;
    setIsMoving(true);
    try {
      await onMove({ id: template.id, name: template.name }, Number(listIndex));
    } finally {
      setIsMoving(false);
      onClose();
    }
  };

  return createPortal(
    // Stop clicks here reaching the task card this menu sits in (React events bubble through portals).
    <div onClick={(e) => e.stopPropagation()}>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
        onClick={isMoving ? undefined : onClose}
      >
        <div
          className="w-full max-w-md rounded-2xl border bg-card shadow-2xl dark:border-zinc-800 dark:bg-[#121215]"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Move task to another template"
        >
          <div className="flex items-center justify-between border-b px-5 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm font-bold">
              <ArrowRightLeft size={16} className="text-primary" /> Move to another template
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isMoving}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4 text-xs">
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">{taskLabel}</span>
            </p>

            <label className="block space-y-1 font-semibold">
              Template
              <SearchableSelect
                value={templateId}
                onChange={(v) => {
                  setTemplateId(v);
                  setListIndex("");
                }}
                options={templateOptions}
                placeholder="Select template"
                searchPlaceholder="Search templates..."
                className={SELECT_TRIGGER}
                contentClassName={SELECT_CONTENT}
              />
            </label>

            <label className="block space-y-1 font-semibold">
              Task list
              <SearchableSelect
                value={listIndex}
                onChange={setListIndex}
                options={listOptions}
                placeholder={templateId ? "Select task list" : "Select a template first"}
                searchPlaceholder="Search task lists..."
                disabled={!templateId}
                className={SELECT_TRIGGER}
                contentClassName={SELECT_CONTENT}
              />
            </label>

            <p className="rounded-md bg-muted/60 p-2.5 text-muted-foreground">
              The task moves with its subtasks, checklists and owners, to the end of that list. Projects already
              created from a template aren&apos;t affected.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t px-5 py-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isMoving}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={move}
              disabled={!template || listIndex === "" || isMoving}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isMoving && <Loader2 size={13} className="animate-spin" />} Move task
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * "Move to Project": pick any existing project, then one of its task lists — the template task (with
 * its subtasks, owners and SOP checklists) is created there, like when a project is made from the
 * template. The template keeps the task.
 */
export function AddTemplateTaskToProjectDialog({
  taskLabel,
  seed,
  templateName,
  onClose,
}: {
  taskLabel: string;
  seed: SOPTaskSeed;
  templateName?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [targets, setTargets] = useState<MoveTaskTarget[] | null>(null);
  const [projectId, setProjectId] = useState("");
  const [listCode, setListCode] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMoveTaskTargetsAction()
      .then((rows) => !cancelled && setTargets(rows))
      .catch(() => !cancelled && setTargets([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const project = targets?.find((p) => p.id === projectId);
  const projectOptions = (targets ?? []).map((p) => ({ value: p.id, label: p.code ? `${p.name} (${p.code})` : p.name }));
  const listOptions = (project?.lists ?? []).map((l) => ({ value: l.code, label: l.name }));

  const add = async () => {
    if (!project || !listCode || isAdding) return;
    setIsAdding(true);
    try {
      const res = await addTemplateTaskToProjectAction(seed, project.id, listCode, templateName);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Added to ${project.name} as ${res.code}`);
      onClose();
      router.refresh();
    } catch (err) {
      console.error("Failed to add template task to project:", err);
      toast.error("Couldn't add the task to the project. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  return createPortal(
    // Stop clicks here reaching the task card this menu sits in (React events bubble through portals).
    <div onClick={(e) => e.stopPropagation()}>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={isAdding ? undefined : onClose}>
        <div
          className="w-full max-w-md rounded-2xl border bg-card shadow-2xl dark:border-zinc-800 dark:bg-[#121215]"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Move template task to a project"
        >
          <div className="flex items-center justify-between border-b px-5 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm font-bold">
              <FolderInput size={16} className="text-primary" /> Move to Project
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isAdding}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4 text-xs">
            <p className="font-semibold text-foreground">{taskLabel}</p>

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
                  className={SELECT_TRIGGER}
                  contentClassName={SELECT_CONTENT}
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
                className={SELECT_TRIGGER}
                contentClassName={SELECT_CONTENT}
              />
            </label>

            <p className="rounded-md bg-muted/60 p-2.5 text-muted-foreground">
              The task is created in that project with its subtasks, default owners and SOP checklists, and gets
              the project&apos;s next task code. The template keeps the task.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t px-5 py-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isAdding}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={add}
              disabled={!project || !listCode || isAdding}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isAdding && <Loader2 size={13} className="animate-spin" />} Move to Project
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * The move menu of a template task: its own lists, "Move to Another Template…" (pick the template
 * and its list, like moving a task to another project) and, when `taskSeed` is given, "Move to
 * Project…" (create the task in an existing project).
 */
export function TemplateMoveMenu({
  open,
  onOpenChange,
  trigger,
  taskLabel,
  lists,
  currentListIndex,
  otherTemplates,
  onMoveToList,
  onMoveToTemplate,
  taskSeed,
  templateName,
  align = "end",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  /** Shown in the dialog so it's clear which task is moving. */
  taskLabel: string;
  lists: string[];
  currentListIndex: number;
  otherTemplates: TemplateMoveTarget[];
  onMoveToList: (listIndex: number) => void;
  onMoveToTemplate: (target: { id: string; name: string }, listIndex: number) => void | Promise<void>;
  /** The task as it is now (unsaved edits included) — enables "Move to Project…". */
  taskSeed?: SOPTaskSeed;
  templateName?: string;
  align?: "start" | "center" | "end";
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const heading = "px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground";

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          side="bottom"
          align={align}
          collisionPadding={12}
          onClick={(e) => e.stopPropagation()}
          // The lists scroll; the "another template" button stays pinned under them, always in view.
          className="z-50 flex w-64 max-h-[min(26rem,var(--radix-popover-content-available-height))] flex-col overflow-hidden border border-border bg-popover p-2 text-xs text-popover-foreground shadow-lg"
        >
          <p className={cn(heading, "border-b mb-1 shrink-0")}>Move to List</p>
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
            {lists.map((name, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  if (index !== currentListIndex) onMoveToList(index);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-accent",
                  index === currentListIndex ? "bg-primary/10 font-bold text-primary" : "text-foreground"
                )}
              >
                <span className="truncate">{name || "Untitled list"}</span>
                {index === currentListIndex && <Check size={12} className="shrink-0 text-primary" />}
              </button>
            ))}
          </div>

          {otherTemplates.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setIsDialogOpen(true);
              }}
              className="mt-1.5 flex w-full shrink-0 cursor-pointer items-center gap-2 rounded-md border-t px-2 pb-2 pt-2.5 text-left text-xs font-semibold text-foreground hover:bg-accent"
            >
              <ArrowRightLeft size={13} className="text-primary" />
              <span>Move to Another Template…</span>
            </button>
          )}

          {taskSeed && (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setIsProjectDialogOpen(true);
              }}
              className={cn(
                "flex w-full shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-semibold text-foreground hover:bg-accent",
                otherTemplates.length === 0 && "mt-1.5 border-t pt-2.5"
              )}
            >
              <FolderInput size={13} className="text-primary" />
              <span>Move to Project…</span>
            </button>
          )}
        </PopoverContent>
      </Popover>

      {isDialogOpen && (
        <MoveTaskToTemplateDialog
          taskLabel={taskLabel}
          otherTemplates={otherTemplates}
          onMove={onMoveToTemplate}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
      {isProjectDialogOpen && taskSeed && (
        <AddTemplateTaskToProjectDialog
          taskLabel={taskLabel}
          seed={taskSeed}
          templateName={templateName}
          onClose={() => setIsProjectDialogOpen(false)}
        />
      )}
    </>
  );
}
