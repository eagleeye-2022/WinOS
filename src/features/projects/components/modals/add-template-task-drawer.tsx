"use client";

import { usePageDraft, useClearPageDraft } from "@/lib/navigation/use-url-state";
import React, { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { ProjectPriority, SOPTaskSeed, TaskStatus } from "../../types";
import { TEMPLATE_STATUSES } from "../../template-utils";
import { TaskMultiOwnerSelect, type OwnerUserOption } from "../task-multi-owner-select";
import { RichDescriptionEditor, isEmptyDescription } from "@/components/shared/rich-description";

const PRIORITIES: ProjectPriority[] = ["None", "Low", "Medium", "High", "Urgent"];

const FIELD =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer";

/** What the drawer fills in; the board adds the template's defaults (duration, department). */
export type TemplateTaskFields = Pick<SOPTaskSeed, "title" | "priority" | "status" | "description" | "defaultOwners">;

interface AddTemplateTaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** The template's task lists, by position. */
  lists: string[];
  initialListIndex?: number;
  ownerOptions: OwnerUserOption[];
  onAddTask: (listIndex: number, task: TemplateTaskFields) => void;
}

/** The project board's "Add New Task" drawer, for a template: pick the list and the task's starting values. */
export function AddTemplateTaskDrawer({
  isOpen,
  onClose,
  lists,
  initialListIndex = 0,
  ownerOptions,
  onAddTask,
}: AddTemplateTaskDrawerProps) {
  // What's typed is kept as a draft (survives leaving the page and a refresh) until it's saved or the
  // form is closed.
  const draft = "add-template-task";
  const clearDraft = useClearPageDraft(draft);
  const close = () => {
    clearDraft();
    onClose();
  };
  const [title, setTitle] = usePageDraft(draft, "title", "");
  const [listIndex, setListIndex] = usePageDraft(draft, "listIndex", initialListIndex);
  const [status, setStatus] = usePageDraft<TaskStatus>(draft, "status", "Open");
  const [priority, setPriority] = usePageDraft<ProjectPriority>(draft, "priority", "Medium");
  const [owners, setOwners] = usePageDraft<string[]>(draft, "owners", []);
  const [description, setDescription] = usePageDraft(draft, "description", "");

  // Fresh form each time it opens, on the list it was opened for.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setTitle("");
      setListIndex(Math.min(Math.max(initialListIndex, 0), Math.max(lists.length - 1, 0)));
      setStatus("Open");
      setPriority("Medium");
      setOwners([]);
      setDescription("");
    }
  }

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name || lists.length === 0) return;
    const defaultOwners = owners
      .map((ownerName) => ownerOptions.find((o) => o.name === ownerName))
      .filter((o): o is OwnerUserOption => !!o)
      .map((o) => ({ id: o.id, name: o.name }));
    onAddTask(listIndex, {
      title: name,
      priority,
      // A template task with no status starts Open.
      status: status === "Open" ? undefined : status,
      description: isEmptyDescription(description) ? undefined : description.trim(),
      defaultOwners: defaultOwners.length > 0 ? defaultOwners : undefined,
    });
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-xs transition-opacity duration-200">
      <div className="relative flex h-full w-full max-w-xl flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-foreground">Add New Task</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground">
              Task Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design wireframes for dashboard"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Task list */}
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground">
              Task List <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <select
                value={listIndex}
                onChange={(e) => setListIndex(Number(e.target.value))}
                className={`${FIELD} appearance-none`}
              >
                {lists.map((name, index) => (
                  <option key={index} value={index}>
                    {name || "Untitled list"}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={FIELD}>
                {TEMPLATE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ProjectPriority)}
                className={FIELD}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Default owners */}
          <TaskMultiOwnerSelect
            label="Owner"
            selectedOwners={owners}
            onChangeOwners={(next) => setOwners(next.filter((o) => o && o.trim().toLowerCase() !== "unassigned"))}
            ownersList={ownerOptions}
          />

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground">Description</label>
            <RichDescriptionEditor value={description} onChange={setDescription} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-start gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={!title.trim() || lists.length === 0}
              className="flex items-center gap-1.5 rounded-md bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              Create Task
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-input bg-background px-6 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
