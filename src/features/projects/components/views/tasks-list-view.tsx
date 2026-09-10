"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ListChecks, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TaskItem, TaskStatus, WorkspaceRole } from "../../types";
import { TimerWidget } from "../timer-widget";
import { TaskMultiOwnerSelect } from "../task-multi-owner-select";
import { ActiveTimerProvider } from "../../context/active-timer-context";
import {
  getCurrentUserContextAction,
  updateTaskAction,
  deleteTaskAction,
} from "../../actions/project-actions";
import { getAllUserOptionsAction } from "@/features/users/actions/user-actions";
import { parseDurationMinutes, formatMinutesToHHMM } from "../../utils/time-helpers";
import { useConfirm } from "@/components/shared/confirm-dialog";

interface TasksListViewProps {
  tasks: TaskItem[];
  onAddTask: (newTask: TaskItem) => void;
  onUpdateTask: (updatedTask: TaskItem) => void;
  assignedToMeCount?: number;
  /** Accepted for interface parity with TasksBoardView; this view never shows demo filler rows. */
  disableDemoFallback?: boolean;
}

type GroupMode = "PROJECT" | "TASK_LIST" | "STATUS" | "PRIORITY" | "NONE";

export function TasksListView({ tasks, onUpdateTask }: TasksListViewProps) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();

  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: WorkspaceRole;
  } | null>(null);

  useEffect(() => {
    getCurrentUserContextAction().then((u) => {
      if (u) setCurrentUser(u);
    });
  }, []);

  const [userOptions, setUserOptions] = useState<{ id: string; name: string; email: string }[]>([]);
  useEffect(() => {
    getAllUserOptionsAction().then((opts) => {
      if (opts && opts.length > 0) setUserOptions(opts.map((o) => ({ ...o, email: "" })));
    });
  }, []);

  const displayTasks = useMemo(() => (tasks || []).filter((t) => !t.parentTaskId), [tasks]);

  const isTaskOwner = useCallback(
    (task: TaskItem): boolean => {
      if (!currentUser) return false;

      const uId = currentUser.id.toLowerCase();
      const uName = currentUser.name.trim().toLowerCase();
      const uEmail = currentUser.email.trim().toLowerCase();

      if (task.ownerIds && task.ownerIds.length > 0 && task.ownerIds.includes(currentUser.id)) {
        return true;
      }
      if (task.ownerId && task.ownerId.toLowerCase() === uId) {
        return true;
      }

      const ownerNames =
        task.owners && task.owners.length > 0
          ? task.owners
          : task.owner && task.owner !== "Unassigned"
          ? task.owner.split(",").map((s) => s.trim()).filter(Boolean)
          : [];

      if (ownerNames.length === 0) {
        return false;
      }

      return ownerNames.some((raw) => {
        const o = raw.trim().toLowerCase();
        if (!o || o === "unassigned") return false;
        return (
          o === uId ||
          o === uName ||
          o === uEmail ||
          (uName.length > 2 && o.includes(uName)) ||
          (o.length > 2 && uName.includes(o))
        );
      });
    },
    [currentUser]
  );

  const handleOpenTask = (task: TaskItem) => {
    const taskId = task.code || task.id;
    if (!task.projectId) return;
    router.push(`/projects/${task.projectId}/tasks/${taskId}`);
  };

  // Inline title editing
  const [editingTitleTaskId, setEditingTitleTaskId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");

  const handleStartEditTitle = (e: React.MouseEvent, task: TaskItem) => {
    e.stopPropagation();
    if (!isTaskOwner(task)) return;
    setEditingTitleTaskId(task.id);
    setTitleDraft(task.title);
  };

  const commitTitleEdit = async (task: TaskItem) => {
    const trimmed = titleDraft.trim();
    setEditingTitleTaskId(null);
    if (!trimmed || trimmed === task.title) return;
    onUpdateTask({ ...task, title: trimmed });
    try {
      await updateTaskAction(task.id, { title: trimmed });
      router.refresh();
    } catch (err) {
      console.error("[TasksListView] Error renaming task:", err);
    }
  };

  const handleChangeTaskStatus = async (task: TaskItem, newStatus: TaskStatus) => {
    if (newStatus === task.status) return;
    onUpdateTask({ ...task, status: newStatus });
    try {
      await updateTaskAction(task.id, { status: newStatus });
      router.refresh();
    } catch (err) {
      console.error("[TasksListView] Error changing task status:", err);
    }
  };

  const handleChangeTaskOwners = async (task: TaskItem, nextOwners: string[]) => {
    const cleanOwners = nextOwners.filter((o) => o && o.trim().toLowerCase() !== "unassigned");
    const displayNames = cleanOwners.map((raw) => {
      const match = userOptions.find(
        (u) =>
          u.id === raw ||
          u.name.toLowerCase() === raw.toLowerCase() ||
          u.email.toLowerCase() === raw.toLowerCase()
      );
      return match ? match.name : raw;
    });

    const primaryOwner = displayNames.length > 0 ? displayNames.join(", ") : "Unassigned";
    onUpdateTask({ ...task, owner: primaryOwner, owners: displayNames });
    try {
      await updateTaskAction(task.id, { owners: cleanOwners, owner: primaryOwner });
      router.refresh();
    } catch (err) {
      console.error("[TasksListView] Error assigning owner:", err);
    }
  };

  const handleDeleteTask = async (e: React.MouseEvent, task: TaskItem) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete task?",
      description: `Delete task "${task.title}" (${task.code})? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      const success = await deleteTaskAction(task.id);
      if (success) router.refresh();
    } catch (err) {
      console.error("[TasksListView] Error deleting task:", err);
    }
  };

  // Grouping, Zoho "Group by: Task List" style.
  const [groupMode, setGroupMode] = useState<GroupMode>("PROJECT");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groups = useMemo(() => {
    if (groupMode === "NONE") {
      return [{ key: "ALL", label: "All Tasks", tasks: displayTasks }];
    }
    const map = new Map<string, TaskItem[]>();
    for (const t of displayTasks) {
      const key =
        groupMode === "PROJECT"
          ? t.projectName || "Unknown Project"
          : groupMode === "TASK_LIST"
          ? t.taskListName || t.phaseName || "Ungrouped"
          : groupMode === "STATUS"
          ? t.status || "Open"
          : t.priority || "None";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).map(([key, groupTasks]) => ({ key, label: key, tasks: groupTasks }));
  }, [displayTasks, groupMode]);

  const columnCount = 7;

  const renderTaskRow = (task: TaskItem) => {
    const isOwner = isTaskOwner(task);
    const statusUpper = (task.status || "OPEN").toUpperCase();
    const isClosed = statusUpper === "CLOSED" || statusUpper === "DONE";
    const isInProgress = statusUpper === "IN PROGRESS" || statusUpper === "IN_PROGRESS";
    const firstOwner =
      task.owners && task.owners.length > 0 && task.owners[0] !== "Unassigned"
        ? task.owners[0]
        : task.owner;

    const resolveOwnerName = (ownerKey?: string): string => {
      if (!ownerKey || ownerKey === "Unassigned") return "";
      const match = userOptions.find(
        (u) =>
          u.id === ownerKey ||
          u.name.toLowerCase() === ownerKey.toLowerCase() ||
          u.email.toLowerCase() === ownerKey.toLowerCase()
      );
      if (match) return match.name;
      if (ownerKey.length > 15 && !ownerKey.includes(" ")) return "";
      return ownerKey;
    };

    const resolvedName = resolveOwnerName(firstOwner);
    const isUnassigned = !resolvedName || resolvedName === "Unassigned";

    const ownerInitials = isUnassigned
      ? ""
      : resolvedName
          .split(" ")
          .map((n) => n[0])
          .filter(Boolean)
          .join("")
          .substring(0, 2)
          .toUpperCase();

    return (
      <tr
        key={task.id}
        onClick={() => handleOpenTask(task)}
        className="cursor-pointer transition-colors hover:bg-accent/30"
      >
        <td className="py-3.5 px-4 border-r align-middle font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
          {task.code}
        </td>

        <td className="py-3.5 px-4 border-r align-middle w-[420px] max-w-[420px]">
          {editingTitleTaskId === task.id ? (
            <input
              type="text"
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => commitTitleEdit(task)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditingTitleTaskId(null);
              }}
              className="w-full rounded-md border border-primary/50 bg-transparent px-1 -mx-1 py-0.5 text-xs font-medium text-foreground outline-none ring-1 ring-primary/30 focus:ring-primary transition-all"
            />
          ) : (
            <div
              onClick={(e) => {
                if (isOwner) {
                  handleStartEditTitle(e, task);
                }
              }}
              title={isOwner ? "Click to rename" : task.title}
              className={cn(
                "rounded-md px-1 -mx-1 text-xs font-medium leading-snug transition-colors truncate",
                isOwner ? "hover:bg-slate-100 dark:hover:bg-neutral-800/60 cursor-text" : "cursor-pointer",
                isClosed ? "line-through text-muted-foreground" : "text-foreground"
              )}
            >
              {task.title}
            </div>
          )}
          {(task.taskListName || task.phaseName) && (
            <div className="mt-1">
              <span className="inline-block rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-semibold">
                {task.taskListName || task.phaseName}
              </span>
            </div>
          )}
        </td>

        <td className="py-3.5 px-4 border-r align-middle whitespace-nowrap text-muted-foreground max-w-[140px] truncate">
          {task.projectName || "—"}
        </td>

        <td className="py-3.5 px-4 border-r align-middle" onClick={(e) => e.stopPropagation()}>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 rounded-full pr-1.5 hover:bg-accent transition-colors cursor-pointer"
                title={`Owner: ${task.owner || "Unassigned"} (Click to assign owner)`}
              >
                <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-bold shrink-0">
                  {ownerInitials}
                  {task.owners && task.owners.length > 1 && (
                    <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[8px] font-bold ring-2 ring-background">
                      +{task.owners.length - 1}
                    </span>
                  )}
                </span>
                <span className="text-xs font-medium text-foreground whitespace-nowrap max-w-[100px] truncate">
                  {task.owners && task.owners.length > 1 ? task.owners.join(", ") : task.owner || "Unassigned"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              className="w-64 p-2.5 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              {currentUser && (!task.owner || task.owner === "Unassigned") && (
                <button
                  type="button"
                  onClick={() =>
                    handleChangeTaskOwners(task, [currentUser.name])
                  }
                  className="w-full text-left px-2 py-1.5 mb-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold cursor-pointer"
                >
                  Assign to me
                </button>
              )}
              <TaskMultiOwnerSelect
                selectedOwners={
                  (task.owners && task.owners.length > 0
                    ? task.owners
                    : task.owner && task.owner !== "Unassigned"
                    ? [task.owner]
                    : []
                  ).filter((o) => o && o.trim().toLowerCase() !== "unassigned")
                }
                disabled={!isOwner && Boolean(task.owner && task.owner !== "Unassigned")}
                disabledReason={!isOwner && Boolean(task.owner && task.owner !== "Unassigned") ? `Only the task owner (${task.owner}) can change ownership` : undefined}
                onChangeOwners={(nextOwners) => handleChangeTaskOwners(task, nextOwners)}
                ownersList={userOptions}
                listLabel="Project Users"
              />
            </PopoverContent>
          </Popover>
        </td>

        <td className="py-3.5 px-4 border-r align-middle" onClick={(e) => e.stopPropagation()}>
          <div
            className={cn(
              "relative inline-flex items-center rounded-md text-xs font-bold transition-colors",
              isClosed
                ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400"
                : isInProgress
                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
            )}
          >
            <select
              value={task.status}
              onChange={(e) => handleChangeTaskStatus(task, e.target.value as TaskStatus)}
              disabled={!isOwner}
              title={
                isOwner
                  ? "Change status"
                  : `Only the task owner (${task.owner || "Unassigned"}) can change the status`
              }
              className="appearance-none rounded-md bg-transparent py-1.5 pl-3 pr-6 outline-none cursor-pointer hover:brightness-95 dark:hover:brightness-125 transition-all disabled:cursor-not-allowed disabled:opacity-70"
            >
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Closed">Closed</option>
            </select>
            <ChevronDown
              size={11}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
            />
          </div>
        </td>

        <td className="py-3.5 px-4 border-r align-middle whitespace-nowrap text-foreground font-mono text-xs">
          {task.workHours || "0:00"} h
        </td>

        <td className="py-3.5 px-4 align-middle text-right" onClick={(e) => e.stopPropagation()}>
          <div className="inline-flex items-center gap-2">
            <TimerWidget
              taskTitle={task.title}
              taskCode={task.code}
              taskId={task.id}
              projectId={task.projectId}
              canStart={isOwner}
              disabledReason={`Only the task owner (${task.owner || "Unassigned"}) can start this timer`}
              onSaveLog={() => router.refresh()}
            />
            <button
              type="button"
              onClick={(e) => handleDeleteTask(e, task)}
              disabled={!isOwner}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              title={
                isOwner
                  ? "Delete task"
                  : `Only the task owner (${task.owner || "Unassigned"}) can delete this task`
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <ActiveTimerProvider>
      <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
        {/* Group-by control
        <div className="flex items-center gap-2 border-b border-border px-6 py-2 bg-card text-xs shrink-0">
          <ListChecks size={14} className="text-muted-foreground" />
          <span className="font-semibold text-muted-foreground">Group by:</span>
          <div className="relative inline-flex items-center">
            <select
              value={groupMode}
              onChange={(e) => setGroupMode(e.target.value as GroupMode)}
              className="appearance-none rounded-md border border-border bg-card pl-2 pr-6 py-1 text-xs font-bold text-primary outline-none cursor-pointer hover:bg-accent transition-colors dark:bg-[#1c1e24]"
            >
              <option value="PROJECT">Projects</option>
              <option value="TASK_LIST">Task List</option>
              <option value="STATUS">Status</option>
              <option value="PRIORITY">Priority</option>
              <option value="NONE">None</option>
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-1.5 text-muted-foreground" />
          </div>
        </div>
        */}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {displayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2 p-10">
              <ListChecks size={32} className="opacity-40" />
              <p className="text-sm font-semibold">No tasks assigned to you yet</p>
            </div>
          ) : (
            <table className="w-full min-w-[1000px] text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted dark:bg-neutral-950 text-foreground font-bold backdrop-blur-sm">
                  <th className="py-3.5 px-4 border-r whitespace-nowrap">ID</th>
                  <th className="py-3.5 px-4 border-r whitespace-nowrap w-[420px]">Task Name</th>
                  <th className="py-3.5 px-4 border-r whitespace-nowrap">Project</th>
                  <th className="py-3.5 px-4 border-r whitespace-nowrap">Owner</th>
                  <th className="py-3.5 px-4 border-r whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      Status
                      <ChevronDown size={11} className="opacity-60" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 border-r whitespace-nowrap">Total Hours</th>
                  <th className="py-3.5 px-4 w-24 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {groups.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.key);
                  const count = group.tasks.length;
                  const totalMinutes = group.tasks.reduce(
                    (sum, t) => sum + parseDurationMinutes(t.workHours),
                    0
                  );
                  const groupProjectName =
                    groupMode !== "PROJECT" &&
                    group.tasks.length > 0 &&
                    group.tasks.every((t) => t.projectName === group.tasks[0].projectName)
                      ? group.tasks[0].projectName
                      : undefined;

                  return (
                    <React.Fragment key={group.key}>
                      {groupMode !== "NONE" && (
                        <tr className="bg-muted/40 dark:bg-neutral-900/40 font-semibold">
                          <td className="py-2 px-4 border-r" colSpan={2}>
                            <button
                              type="button"
                              onClick={() => toggleGroupCollapse(group.key)}
                              className="flex items-center gap-1.5 text-xs font-extrabold text-foreground cursor-pointer whitespace-nowrap"
                            >
                              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                              <span>{group.label}</span>
                              <span className="text-muted-foreground font-semibold">({count})</span>
                            </button>
                          </td>
                          <td className="py-2 px-4 border-r text-muted-foreground font-normal">{groupProjectName || ""}</td>
                          {/* Owner, Status — left blank on group rows */}
                          <td className="py-2 px-4 border-r" />
                          <td className="py-2 px-4 border-r" />
                          <td className="py-2 px-4 border-r font-mono text-[11px] text-muted-foreground font-normal">
                            {formatMinutesToHHMM(totalMinutes)}
                          </td>
                          <td className="py-2 px-4" />
                        </tr>
                      )}

                      {!isCollapsed && group.tasks.map(renderTaskRow)}

                      {!isCollapsed && groupMode !== "NONE" && (
                        <tr>
                          <td colSpan={columnCount} className="py-1.5 px-4">
                            <button
                              type="button"
                              onClick={() => {
                                const firstProjectId = group.tasks[0]?.projectId;
                                if (firstProjectId) router.push(`/projects/${firstProjectId}`);
                              }}
                              className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                            >
                              <Plus size={12} />
                              <span>Add Task</span>
                            </button>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {ConfirmDialog}
      </div>
    </ActiveTimerProvider>
  );
}
