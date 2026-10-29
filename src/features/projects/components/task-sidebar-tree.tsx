"use client";

import React, { useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Eye,
  ListTree,
  Loader2,
  MoreVertical,
  Trash2,
  User,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AvatarStack } from "@/components/shared/avatar-stack";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import { showChecklistGate } from "@/features/sop-checklists/components/checklist-gate";
import { TimerWidget } from "./timer-widget";
import { taskOwnerPeople } from "../utils/task-owner-people";
import { canUserActOnTask } from "../utils/task-authorization";
import { deleteTaskAction, duplicateTaskAction, updateTaskAction } from "../actions/project-actions";
import { PROJECT_TASK_STATUSES, getTaskStatusPillClasses, isTaskDone, type TaskItem, type TaskStatus } from "../types";

type SidebarUser = { id: string; name: string; email: string; role: "ADMIN" | "TEAM_MEMBER" } | null;
type CardChanges = { status?: TaskStatus; phaseCode?: string; phaseName?: string };

/**
 * Task page sidebar: the open task's card — the project board's card (code, status select,
 * 👁 / ⋮ / ⇄, title, timer, subtask count, due date, owners), all working — with its subtasks
 * (any depth) always expanded underneath on the board's tree line. The open task / subtask is
 * highlighted.
 *
 * Changes to the open task go through the page's own handlers (`onOpenTask*`) so the details on
 * the right stay in step; changes to the other cards are saved here, the same way the board does.
 */
export function TaskSidebarTree({
  rootTask,
  childrenOf,
  isOpenTask,
  projectId,
  phases,
  currentUser,
  isProjectMember,
  setTasks,
  onOpen,
  onOpenTaskStatusChange,
  onOpenTaskPhaseChange,
  onOpenTaskDelete,
  onOpenTaskLogSaved,
}: {
  rootTask: TaskItem;
  childrenOf: (task: TaskItem) => TaskItem[];
  isOpenTask: (task: TaskItem) => boolean;
  projectId: string;
  phases: { code: string; name: string }[];
  currentUser: SidebarUser;
  /** Project owner or a user of this project — may work on every task in it. */
  isProjectMember: boolean;
  setTasks: Dispatch<SetStateAction<TaskItem[]>>;
  onOpen: (code: string) => void;
  onOpenTaskStatusChange: (status: TaskStatus) => void;
  onOpenTaskPhaseChange: (phaseCode: string, phaseName: string) => void;
  onOpenTaskDelete: () => void;
  onOpenTaskLogSaved: () => void;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Same rule as the board's cards (isTaskOwner there): managers, users of the project, and the
  // task's own owners can work on it.
  const canActOn = (task: TaskItem): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === "ADMIN" || isProjectMember) return true;
    const ownerNames =
      task.owners && task.owners.length > 0
        ? task.owners
        : task.owner && task.owner !== "Unassigned"
        ? task.owner.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    return canUserActOnTask({ ownerId: task.ownerId, ownerIds: task.ownerIds, ownerNames }, currentUser);
  };

  /** Shown at once, saved, rolled back if the server refuses (e.g. its SOP checklist isn't done). */
  const saveCard = async (item: TaskItem, changes: CardChanges) => {
    if (!canActOn(item)) {
      toast.warning("Only users of this project can edit this task.");
      return;
    }
    const apply = (vals: CardChanges) => (prev: TaskItem[]) =>
      prev.map((t) => {
        if (t.id === item.id) {
          return {
            ...t,
            ...vals,
            ...(vals.status && { completionPercentage: isTaskDone(vals.status) ? 100 : 0 }),
          };
        }
        // Also its entry in the parent's subtask list (what the Subtasks table shows).
        if (vals.status && (t.subtasks || []).some((s) => s.id === item.id || s.code === item.code)) {
          return {
            ...t,
            subtasks: (t.subtasks || []).map((s) =>
              s.id === item.id || s.code === item.code ? { ...s, status: vals.status!, completed: isTaskDone(vals.status) } : s
            ),
          };
        }
        return t;
      });
    const previous: CardChanges = {
      ...(changes.status && { status: item.status }),
      ...(changes.phaseCode && { phaseCode: item.phaseCode, phaseName: item.phaseName }),
    };
    setTasks(apply(changes));
    try {
      const result = await updateTaskAction(item.id, changes);
      if (result.success) {
        toast.success("Task updated");
        return;
      }
      setTasks(apply(previous));
      if (result.checklistBlock && changes.status) {
        showChecklistGate({ ...result.checklistBlock, status: changes.status, onForced: () => router.refresh() });
      } else {
        toast.error(result.error || "You do not have permission to edit this task.");
      }
    } catch (err) {
      console.error("[TaskSidebarTree] Failed to save task:", err);
      setTasks(apply(previous));
      toast.error("Failed to save changes — please try again.");
    }
  };

  const changeStatus = (item: TaskItem, current: TaskStatus, next: TaskStatus) => {
    if (next === current) return;
    if (isOpenTask(item)) onOpenTaskStatusChange(next);
    else saveCard(item, { status: next });
  };

  const moveToPhase = (item: TaskItem, phaseCode: string, phaseName: string) => {
    if (phaseCode === item.phaseCode) return;
    if (isOpenTask(item)) onOpenTaskPhaseChange(phaseCode, phaseName);
    else saveCard(item, { phaseCode, phaseName });
  };

  /** ⋮ → Duplicate: the board's server copy (task + subtasks, owners, description…; no time logs). */
  const duplicate = async (item: TaskItem) => {
    if (duplicatingId) return;
    setDuplicatingId(item.id);
    try {
      const res = await duplicateTaskAction(item.id);
      if (res.success) {
        toast.success(`Duplicated ${item.code} as ${res.code}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      console.error("[TaskSidebarTree] Failed to duplicate task:", err);
      toast.error("Failed to duplicate task");
    }
    setDuplicatingId(null);
  };

  const remove = async (item: TaskItem) => {
    if (isOpenTask(item)) {
      onOpenTaskDelete();
      return;
    }
    const ok = await confirm({
      title: "Delete task?",
      description: `Delete task "${item.title}" (${item.code})? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      if (await deleteTaskAction(item.id)) {
        setTasks((prev) => prev.filter((t) => t.id !== item.id));
        router.refresh();
      } else {
        toast.error("Couldn't delete the task.");
      }
    } catch (err) {
      console.error("[TaskSidebarTree] Failed to delete task:", err);
      toast.error("Couldn't delete the task.");
    }
  };

  const phaseMenu = (item: TaskItem) => (
    <>
      <p className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b mb-1">
        Move to Phase
      </p>
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {phases.map((p) => (
          <button
            key={p.code}
            type="button"
            onClick={() => moveToPhase(item, p.code, p.name)}
            className={cn(
              "w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs font-medium flex items-center justify-between cursor-pointer",
              item.phaseCode === p.code ? "bg-primary/10 text-primary font-bold" : "text-foreground"
            )}
          >
            <span className="truncate">{p.name}</span>
            {item.phaseCode === p.code && <Check size={12} className="shrink-0 text-primary" />}
          </button>
        ))}
      </div>
    </>
  );

  const iconBtn =
    "shrink-0 p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-foreground dark:hover:bg-neutral-800 transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
  const footerBtn =
    "flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-slate-400 hover:text-foreground hover:bg-muted transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#121316] dark:border-white/10";

  const renderCard = (item: TaskItem, parent: TaskItem | null, seen: Set<string>): React.ReactNode => {
    if (seen.has(item.id)) return null; // guards against a loop in bad data
    seen.add(item.id);
    const isSubtask = parent !== null;
    const isSelected = isOpenTask(item);
    const children = childrenOf(item);
    // A subtask's status as the parent's Subtasks table has it — kept current when it's ticked there.
    const parentEntry = parent?.subtasks?.find((s) => s.id === item.id || s.code === item.code);
    const status = (parentEntry?.status ?? item.status) as TaskStatus;
    // A done task is locked: only its status can still be changed to reopen it (board rule).
    const isLocked = isTaskDone(status, parentEntry?.completed, parentEntry ? undefined : item.completionPercentage);
    const canAct = canActOn(item);
    const canEdit = canAct && !isLocked;
    const lockedReason = isLocked
      ? "This task is done — reopen it by changing the status to edit"
      : "Only users of this project can edit this task";
    const owners = taskOwnerPeople(item);

    return (
      <div key={item.id} className="space-y-2">
        <div
          onClick={() => onOpen(item.code)}
          aria-current={isSelected ? "page" : undefined}
          className={cn(
            "relative overflow-hidden rounded-xl border p-3.5 shadow-2xs transition-all cursor-pointer space-y-2.5 group",
            "bg-white dark:bg-[#111214]",
            isSelected
              ? "border-primary/70 ring-1 ring-primary/40 shadow-md"
              : "border-slate-200/90 dark:border-neutral-800 hover:border-primary/60 hover:shadow-md"
          )}
        >
          {/* Top Row: Task Code, Status select, 👁 / ⋮ / ⇄ */}
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs font-bold text-slate-400 dark:text-neutral-500 whitespace-nowrap">
              {item.code}
            </span>
            <div className="flex min-w-0 items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
              <div
                className={cn(
                  "relative inline-flex min-w-0 max-w-[150px] shrink items-center rounded-md pl-2 pr-1 py-0.5 text-xs font-medium text-white transition-all shadow-2xs",
                  getTaskStatusPillClasses(status)
                )}
              >
                <select
                  value={status}
                  onChange={(e) => changeStatus(item, status, e.target.value as TaskStatus)}
                  disabled={!canAct}
                  title={canAct ? `Status: ${status} — click to change` : "Only users of this project can change the status"}
                  className="appearance-none [field-sizing:content] min-w-0 max-w-full truncate bg-transparent pr-3.5 outline-none cursor-pointer font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-70 text-xs"
                >
                  {PROJECT_TASK_STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-card text-foreground">{s}</option>
                  ))}
                  {!(PROJECT_TASK_STATUSES as readonly string[]).includes(status) && (
                    <option value={status} className="bg-card text-foreground">{status}</option>
                  )}
                </select>
                <ChevronDown size={11} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-white/90" />
              </div>

              {!isSubtask && (
                <button type="button" onClick={() => onOpen(item.code)} className={iconBtn} title="Open task">
                  <Eye size={13} />
                </button>
              )}

              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" disabled={!canEdit} className={iconBtn} title={canEdit ? "More options" : lockedReason}>
                    <MoreVertical size={13} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="end"
                  className="w-40 p-1.5 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => duplicate(item)}
                    disabled={duplicatingId === item.id}
                    title="Copy this task with its description, owners, dates and subtasks (not time logs)"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"
                  >
                    {duplicatingId === item.id ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                    <span>Duplicate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </PopoverContent>
              </Popover>

              {!isSubtask && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={!canEdit}
                      className={iconBtn}
                      title={canEdit ? `Move to another phase (currently: ${item.phaseName || item.phaseCode || "Unassigned"})` : lockedReason}
                    >
                      <ArrowRightLeft size={13} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="end"
                    className="w-52 p-2 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {phaseMenu(item)}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {/* Title */}
          <h4
            className={cn(
              "rounded-md px-1 -mx-1 text-xs font-semibold leading-snug transition-colors group-hover:text-primary",
              isLocked
                ? "line-through text-slate-400 dark:text-neutral-500 decoration-slate-400/80 dark:decoration-neutral-500/80"
                : "text-slate-800 dark:text-neutral-200"
            )}
          >
            {item.title}
          </h4>

          {/* Card Footer: timer, subtask count on the left; due date and owners on the right */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-neutral-800/80 text-slate-400 text-xs">
            <div className="flex items-center gap-2 text-slate-400" onClick={(e) => e.stopPropagation()}>
              <TimerWidget
                taskTitle={item.title}
                taskCode={item.code}
                taskId={item.id}
                projectId={item.projectId || projectId}
                canStart={canEdit}
                disabledReason={isLocked ? lockedReason : "You're not a user of this project, so you can't start this timer"}
                onSaveLog={() => {
                  if (isSelected) onOpenTaskLogSaved();
                  router.refresh();
                }}
              />
              {isSubtask && (
                <button type="button" onClick={() => onOpen(item.code)} className={footerBtn} title="Open subtask">
                  <Eye size={13} />
                </button>
              )}
              {isSubtask && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={!canEdit}
                      className={footerBtn}
                      title={canEdit ? `Move to another phase (currently: ${item.phaseName || item.phaseCode || "Unassigned"})` : lockedReason}
                    >
                      <ArrowRightLeft size={13} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    className="w-52 p-2 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {phaseMenu(item)}
                  </PopoverContent>
                </Popover>
              )}
              {children.length > 0 && (
                <span
                  className="flex items-center gap-1 p-1 text-slate-400"
                  title={`${children.length} Subtask${children.length > 1 ? "s" : ""} (shown below)`}
                >
                  <ListTree size={13} />
                  <span className="text-xs font-bold">{children.length}</span>
                  <ChevronDown size={11} />
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {item.dueDate && item.dueDate !== "--" && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-muted-foreground" title={`Due ${item.dueDate}`}>
                  <CalendarDays size={12} /> {item.dueDate}
                </span>
              )}
              <span
                className="flex shrink-0 items-center rounded-full"
                title={`Owners: ${(item.owners && item.owners.length > 0 ? item.owners : [item.owner || "Unassigned"]).join(", ")}`}
              >
                {owners.length === 0 ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-slate-200/80 ring-2 ring-background shadow-2xs dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700">
                    <User size={12} className="text-slate-400 dark:text-neutral-500" />
                  </span>
                ) : (
                  <AvatarStack people={owners} />
                )}
              </span>
            </div>
          </div>
        </div>

        {children.length > 0 && (
          <div className={cn("relative ml-2.5 space-y-2 border-l-2 border-cyan-400/70 dark:border-cyan-500/50 pl-3", !isSubtask && "mt-1")}>
            {children.map((child) => (
              <div key={child.id} className="relative">
                <span className="absolute -left-3 top-4 w-3 border-t-2 border-cyan-400/70 dark:border-cyan-500/50" />
                {renderCard(child, item, seen)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {renderCard(rootTask, null, new Set())}
      {ConfirmDialog}
    </>
  );
}
