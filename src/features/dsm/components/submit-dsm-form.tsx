"use client";

import { useActionState, useState, useEffect, useRef, useTransition } from "react";
import { Plus, X, ChevronRight, ChevronDown, CheckCircle2, AlertCircle, ClipboardList, GraduationCap, Calendar as CalendarIcon, Clock, Loader2, Pencil, Trash2, Archive, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveDsm, type SaveDsmState } from "../actions/save-dsm";
import { parkNewTask, updateParkedTask, removeParkedTask, moveParkedTaskToToday } from "../actions/parking-lot";
import type { EntryWithDetails, TeamMember, ParkedTask } from "../queries";
import { MentionInput } from "@/components/shared/mention-input";
import type { CalendarEventView } from "@/features/calendar/queries";
import { formatTime } from "@/features/calendar/utils";
import { EventDialog } from "@/features/calendar/components/event-dialog";
import { deleteCalendarEvent, type DeleteEventState } from "@/features/calendar/actions/delete-event";
import { SupportNeededIcon } from "@/components/icons/support-needed-icon";
import { fetchUserOpenProjectTasksAction, fetchLinkedTimeLogsAction, fetchUserProjectsWithTasksAction } from "../actions/get-user-project-tasks";
import type { OpenProjectTaskOption, CascadingProjectOption } from "../queries";
import { TimerWidget } from "@/features/projects/components/timer-widget";
import { SortFilterButton } from "@/components/shared/task-table-parts";

/** Resolves the selected project-task's code/project-name by walking the cascading tree. */
function findSelectedTaskMeta(
  projects: CascadingProjectOption[],
  projectTaskId: string
): { code: string | null; projectName: string } | null {
  if (!projectTaskId) return null;
  for (const project of projects) {
    for (const task of project.tasks) {
      if (task.id === projectTaskId) {
        return { code: task.code, projectName: project.name };
      }
      for (const subtask of task.subtasks) {
        if (subtask.id === projectTaskId) {
          return { code: subtask.code, projectName: project.name };
        }
      }
    }
  }
  return null;
}

function supportEventToView(event: NonNullable<EntryWithDetails["supportNeeds"][number]["event"]>): CalendarEventView {
  return {
    id: event.id,
    etag: new Date(event.updatedAt).getTime(),
    title: event.title,
    description: event.description ?? "",
    start: new Date(event.start),
    end: new Date(event.end),
    isAllDay: event.isAllDay,
    organizerEmail: event.organizer?.email,
    attendees: event.attendees,
  };
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
type Priority = (typeof PRIORITIES)[number];

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low Priority",
  MEDIUM: "Medium Priority",
  HIGH: "High Priority",
};

// ── Shared input classes ──────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50";

// ── Task rows ─────────────────────────────────────────────────────────────────

type Task = { id: string; text: string; priority: string; carried: boolean; projectTaskId?: string; projectId?: string; dueDate?: string; createdAt?: string };

function resolveTaskTree(task: { projectTaskId?: string; projectId?: string }, cascadingProjects: CascadingProjectOption[]) {
  const pTaskId = task.projectTaskId || "";
  let resolvedPId = task.projectId || "";
  let resolvedTId = "";
  let resolvedStId = "";

  if (pTaskId) {
    for (const p of cascadingProjects) {
      for (const t of p.tasks || []) {
        if (t.id === pTaskId) {
          resolvedPId = p.id;
          resolvedTId = t.id;
          resolvedStId = "";
          break;
        }
        if (t.subtasks) {
          for (const st of t.subtasks) {
            if (st.id === pTaskId) {
              resolvedPId = p.id;
              resolvedTId = t.id;
              resolvedStId = st.id;
              break;
            }
          }
        }
      }
    }
  }

  const currentProject = cascadingProjects.find((p) => p.id === resolvedPId);
  const currentTask = currentProject?.tasks?.find((t) => t.id === resolvedTId);
  const currentSubtask = currentTask?.subtasks?.find((st) => st.id === resolvedStId);
  const activeTargetTask = currentSubtask || currentTask;

  return {
    projectId: resolvedPId,
    taskId: resolvedTId,
    subtaskId: resolvedStId,
    currentProject,
    currentTask,
    currentSubtask,
    activeTargetTask,
  };
}

function TaskRows({
  tasks,
  teamMembers,
  openProjectTasks,
  cascadingProjects,
  linkedTimeLogs,
  onChange,
}: {
  tasks: Task[];
  teamMembers: TeamMember[];
  openProjectTasks: OpenProjectTaskOption[];
  cascadingProjects: CascadingProjectOption[];
  linkedTimeLogs: Record<string, number>;
  onChange: (t: Task[]) => void;
}) {
  const updateField = <K extends keyof Task>(i: number, field: K, v: Task[K]) => {
    const n = [...tasks];
    n[i] = { ...n[i], [field]: v };
    onChange(n);
  };
  const remove = (i: number) => onChange(tasks.filter((_, j) => j !== i));
  const add = () => onChange([...tasks, { id: crypto.randomUUID(), text: "", priority: "", carried: false, createdAt: new Date().toISOString() }]);

  const handleProjectChange = (i: number, newProjectId: string) => {
    const n = [...tasks];
    n[i] = {
      ...n[i],
      projectId: newProjectId,
      projectTaskId: "",
    };
    onChange(n);
  };

  const handleTaskChange = (i: number, newTaskId: string, currentProject?: CascadingProjectOption) => {
    const chosenTask = currentProject?.tasks.find((t) => t.id === newTaskId);
    const n = [...tasks];
    const hasSubtasks = Boolean(chosenTask && chosenTask.subtasks && chosenTask.subtasks.length > 0);
    n[i] = {
      ...n[i],
      projectTaskId: hasSubtasks ? "" : (chosenTask?.id || ""),
      text: (!n[i].text.trim() && chosenTask) ? chosenTask.title : n[i].text,
    };
    onChange(n);
  };

  const handleSubtaskChange = (i: number, newSubtaskId: string, currentTask?: CascadingProjectOption["tasks"][number]) => {
    const chosenSubtask = currentTask?.subtasks?.find((st) => st.id === newSubtaskId);
    const n = [...tasks];
    n[i] = {
      ...n[i],
      projectTaskId: newSubtaskId || (currentTask ? currentTask.id : ""),
      text: chosenSubtask && (!n[i].text.trim() || n[i].text === currentTask?.title) ? chosenSubtask.title : n[i].text,
    };
    onChange(n);
  };

  const levels = Array.from({ length: tasks.length }, (_, k) => `P${k + 1}`);

  const [filterText, setFilterText] = useState("");
  const [sortMode, setSortMode] = useState("");

  const applySort = (mode: string) => {
    setSortMode(mode);
    if (!mode) return;
    const cmpDeadline = (a: Task, b: Task) => {
      const ad = a.dueDate || "";
      const bd = b.dueDate || "";
      if (!ad && !bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;
      return ad.localeCompare(bd);
    };
    const cmpRecent = (a: Task, b: Task) => {
      const ad = a.createdAt ? new Date(a.createdAt).getTime() : null;
      const bd = b.createdAt ? new Date(b.createdAt).getTime() : null;
      if (ad === null && bd === null) return 0;
      if (ad === null) return 1;
      if (bd === null) return -1;
      return bd - ad;
    };
    const sorted = [...tasks].sort((a, b) => {
      if (mode === "text-asc") return a.text.localeCompare(b.text);
      if (mode === "text-desc") return b.text.localeCompare(a.text);
      if (mode === "deadline") return cmpDeadline(a, b);
      if (mode === "recent") return cmpRecent(a, b);
      return 0;
    });
    onChange(sorted);
  };

  const normalizedFilter = filterText.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-3">
      {tasks.length > 1 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[160px]">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter tasks..."
              className="w-full rounded-md border bg-background py-1.5 pl-3 pr-3 text-xs outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            />
          </div>
          <SortFilterButton
            options={[
              { value: "text-asc", label: "A → Z" },
              { value: "text-desc", label: "Z → A" },
              { value: "recent", label: "Recent" },
              { value: "deadline", label: "Deadline" },
            ]}
            activeValue={sortMode}
            onSelect={applySort}
          />
        </div>
      )}
      {normalizedFilter && tasks.filter((t) => t.text.toLowerCase().includes(normalizedFilter)).length === 0 && (
        <p className="text-xs text-muted-foreground/70">No tasks match &quot;{filterText.trim()}&quot;.</p>
      )}
      {tasks.map((task, i) => {
        const takenPriorities = tasks
          .filter((_, idx) => idx !== i && _.priority)
          .map((_) => _.priority);
        const availableLevels = levels.filter(
          (p) => !takenPriorities.includes(p) || p === task.priority
        );

        const tree = resolveTaskTree(task, cascadingProjects);
        const projectTaskId = task.projectTaskId || "";
        const loggedMins = projectTaskId ? linkedTimeLogs[projectTaskId] : undefined;
        const selectedMeta = findSelectedTaskMeta(cascadingProjects, projectTaskId);

        const isFilteredOut = Boolean(normalizedFilter) && !task.text.toLowerCase().includes(normalizedFilter);

        return (
          <div key={task.id} className={cn("items-center gap-3", isFilteredOut ? "hidden" : "flex")}>
            {/* Left index label: T1, T2, T3 */}
            <span className="w-6 shrink-0 text-sm font-bold text-muted-foreground">
              T{i + 1}
            </span>
            <input type="hidden" name="taskProjectTaskId" value={projectTaskId} />
            <input type="hidden" name="taskDueDate" value={task.dueDate || ""} />

            {/* Main Card */}
            <div className="flex-1 rounded-xl border border-border bg-card p-3 shadow-2xs hover:border-primary/40 focus-within:border-primary/50 transition-all">
              {/* Top Row: Task ID + Input on left, Carried Over + Divider + Project Selector + Task Selector on right */}
              <div className="flex items-center justify-between gap-2.5 flex-wrap">
                {/* Left: Code chip + Input */}
                <div className="flex flex-1 items-center gap-2 min-w-[220px]">
                  {selectedMeta?.code && (
                    <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 shrink-0">
                      {selectedMeta.code}
                    </span>
                  )}
                  <div className="flex-1">
                    <MentionInput
                      key={`${task.id}-${tree.projectId}`}
                      name="taskText"
                      defaultValue={task.text}
                      onChange={(v) => updateField(i, "text", v)}
                      onEnterSubmit={i === tasks.length - 1 && task.text.trim() ? add : undefined}
                      placeholder="Add task details..."
                      teamMembers={teamMembers}
                      className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent text-sm placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>

                {/* Right: Badges + Project & Task Selectors */}
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  {task.carried && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0">
                      Carried Over
                    </span>
                  )}

                  <div className="h-4 w-px bg-border shrink-0" />

                  {/* Project Selector Dropdown */}
                  <div className="relative flex items-center">
                    <select
                      value={tree.projectId}
                      onChange={(e) => handleProjectChange(i, e.target.value)}
                      className="cursor-pointer appearance-none bg-transparent pr-5 text-xs font-medium text-foreground outline-none hover:text-primary transition-colors max-w-[150px] truncate"
                    >
                      <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                        {cascadingProjects.length === 0 ? "Loading..." : "Select Project"}
                      </option>
                      {cascadingProjects.map((p) => (
                        <option key={p.id} value={p.id} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-0 text-muted-foreground" />
                  </div>

                  {/* Task Selector Dropdown (when project is selected) */}
                  {tree.currentProject && (
                    <>
                      <div className="h-4 w-px bg-border shrink-0" />
                      <div className="relative flex items-center">
                        <select
                          value={tree.taskId}
                          onChange={(e) => handleTaskChange(i, e.target.value, tree.currentProject)}
                          className="cursor-pointer appearance-none bg-transparent pr-5 text-xs font-medium text-foreground outline-none hover:text-primary transition-colors max-w-[170px] truncate"
                        >
                          <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                            {tree.currentProject.tasks.length === 0 ? "No tasks" : "Select Task"}
                          </option>
                          {tree.currentProject.tasks.map((t) => (
                            <option key={t.id} value={t.id} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                              {t.code ? `[${t.code}] ` : ""}{t.title}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={13} className="pointer-events-none absolute right-0 text-muted-foreground" />
                      </div>
                    </>
                  )}

                  {/* Subtask Selector Dropdown (if chosen task has subtasks) */}
                  {tree.currentTask && tree.currentTask.subtasks && tree.currentTask.subtasks.length > 0 && (
                    <>
                      <div className="h-4 w-px bg-border shrink-0" />
                      <div className="relative flex items-center">
                        <select
                          value={tree.subtaskId}
                          onChange={(e) => handleSubtaskChange(i, e.target.value, tree.currentTask)}
                          className="cursor-pointer appearance-none bg-transparent pr-5 text-xs font-medium text-foreground outline-none hover:text-primary transition-colors max-w-[150px] truncate"
                        >
                          <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                            Select Subtask
                          </option>
                          {tree.currentTask.subtasks.map((st) => (
                            <option key={st.id} value={st.id} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                              {st.code ? `[${st.code}] ` : ""}{st.title}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={13} className="pointer-events-none absolute right-0 text-muted-foreground" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Bottom Row: Priority + Due Date on left, Time Tracked / Live Timer on right */}
              <div className="mt-2.5 flex items-center justify-between gap-3 flex-wrap border-t border-border/50 pt-2">
                {/* Left: Priority & Due Date */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      PRIORITY:
                    </span>
                    <div className="relative flex items-center">
                      <select
                        name="taskPriority"
                        value={task.priority}
                        onChange={(e) => updateField(i, "priority", e.target.value)}
                        className={cn(
                          "cursor-pointer appearance-none rounded-lg border bg-background py-1 pl-2.5 pr-7 text-xs font-semibold outline-none transition-colors",
                          task.priority === "P1" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold",
                          task.priority === "P2" && "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold",
                          task.priority === "P3" && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold",
                          task.priority && !["P1", "P2", "P3"].includes(task.priority) && "border-primary/40 bg-primary/10 text-primary font-bold",
                          !task.priority && "border-border text-muted-foreground font-normal hover:border-primary/40"
                        )}
                      >
                        <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">Select priority</option>
                        {availableLevels.map((p) => (
                          <option key={p} value={p} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                            {p}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={13} className="pointer-events-none absolute right-2 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                    <CalendarIcon size={12} className="text-muted-foreground" />
                    <span className="font-bold uppercase tracking-wider text-[11px]">Due:</span>
                    <input
                      type="date"
                      value={task.dueDate || ""}
                      onChange={(e) => updateField(i, "dueDate", e.target.value)}
                      className="cursor-pointer bg-transparent text-xs text-foreground outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Right: Live Timer Widget */}
                <div className="flex items-center gap-2">
                  <TimerWidget
                    taskId={tree.activeTargetTask?.id}
                    taskCode={tree.activeTargetTask?.code ?? undefined}
                    taskTitle={task.text || tree.activeTargetTask?.title}
                    projectId={tree.currentProject?.id}
                    canStart={Boolean(tree.activeTargetTask)}
                    disabledReason="Select a task to start timer"
                    defaultExpanded={true}
                  />
                  {loggedMins !== undefined && loggedMins > 0 && (
                    <span className="flex items-center gap-1 whitespace-nowrap rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <Clock size={11} /> {Math.floor(loggedMins / 60)}h {loggedMins % 60}m logged
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Far Right: Delete button */}
            {(tasks.length > 1 || task.carried) ? (
              <button
                type="button"
                onClick={() => remove(i)}
                title="Remove task"
                className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X size={18} />
              </button>
            ) : (
              <div className="w-6 shrink-0" />
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
      >
        <Plus size={13} className="dark:text-[#93C5FD]" /> Add task
      </button>
    </div>
  );
}

// ── Learning rows ─────────────────────────────────────────────────────────────

function LearningRows({
  items,
  teamMembers,
  onChange,
}: {
  items: { id: string; text: string; carried?: boolean }[];
  teamMembers: TeamMember[];
  onChange: (items: { id: string; text: string; carried?: boolean }[]) => void;
}) {
  const updateText = (i: number, v: string) => {
    const n = [...items];
    n[i] = { ...n[i], text: v };
    onChange(n);
  };
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const add = () => onChange([...items, { id: crypto.randomUUID(), text: "" }]);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-2 rounded-md border bg-background p-2.5 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
          <span className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold",
            item.text ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            L{i + 1}
          </span>
          <MentionInput
            key={item.id}
            name="learningItemText"
            defaultValue={item.text}
            onChange={(v) => updateText(i, v)}
            onEnterSubmit={i === items.length - 1 && item.text.trim() ? add : undefined}
            placeholder="Add learning task details..."
            teamMembers={teamMembers}
          />
          {item.carried && (
            <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              Carried over
            </span>
          )}
          {(items.length > 1 || item.carried) && (
            <button type="button" onClick={() => remove(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
      >
        <Plus size={13} className="dark:text-[#93C5FD]" /> Add learning task
      </button>
    </div>
  );
}

// ── Blocker rows ──────────────────────────────────────────────────────────────

type BlockerItem = { id: string; text: string; priority: string; mentionedUserIds: string[]; carried?: boolean; projectTaskId?: string };

function BlockerRows({
  blockers,
  teamMembers,
  openProjectTasks,
  onChange,
  onScheduleMeeting,
}: {
  blockers: BlockerItem[];
  teamMembers: TeamMember[];
  openProjectTasks: OpenProjectTaskOption[];
  onChange: (b: BlockerItem[]) => void;
  onScheduleMeeting?: (title: string, participantIds: string[]) => void;
}) {
  const updateField = <K extends keyof BlockerItem>(i: number, field: K, v: BlockerItem[K]) => {
    const n = [...blockers];
    n[i] = { ...n[i], [field]: v };
    onChange(n);
  };
  const updateMentions = (i: number, text: string, mentionedUserIds: string[]) => {
    const n = [...blockers];
    n[i] = { ...n[i], text, mentionedUserIds };
    onChange(n);
  };
  const remove = (i: number) => onChange(blockers.filter((_, j) => j !== i));
  const add = () => onChange([...blockers, { id: crypto.randomUUID(), text: "", priority: "", mentionedUserIds: [] }]);

  const memberById = (id: string) => teamMembers.find((m) => m.id === id);

  return (
    <div className="flex flex-col gap-2">
      {blockers.map((b, i) => {
        const initialMentions = b.mentionedUserIds.map(memberById).filter(Boolean) as TeamMember[];
        return (
          <div key={b.id} className="flex items-start gap-2">
            {/* Emit comma-separated user IDs in a single hidden input to preserve row-index alignment */}
            <input type="hidden" name="blockerUserId" value={b.mentionedUserIds.join(",")} />
            <input type="hidden" name="blockerProjectTaskId" value={b.projectTaskId || ""} />

            {/* Main input card */}
            <div className="flex-1 rounded-md border bg-background transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="flex-1">
                  <MentionInput
                    key={b.id}
                    name="blockerText"
                    defaultValue={b.text}
                    defaultMentions={initialMentions}
                    onChange={(text, mentionedUserIds) => updateMentions(i, text, mentionedUserIds)}
                    onEnterSubmit={i === blockers.length - 1 && b.text.trim() ? add : undefined}
                    placeholder="Describe the blocker... (@ to mention people)"
                    teamMembers={teamMembers}
                    className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent text-sm"
                  />
                </div>
                {b.carried && (
                  <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    Carried over
                  </span>
                )}
              </div>

              {/* Bottom: priority picker & project task link & schedule meeting action */}
              <div className="flex flex-wrap items-center justify-between border-t px-3 py-1.5 bg-muted/20 gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Priority:
                    </span>
                    <select
                      name="blockerPriority"
                      value={b.priority}
                      onChange={(e) => updateField(i, "priority", e.target.value)}
                      className={cn(
                        "cursor-pointer bg-transparent text-xs outline-none rounded px-1",
                        b.priority === "HIGH" && "font-semibold text-destructive",
                        b.priority === "MEDIUM" && "font-semibold text-warning",
                        b.priority === "LOW" && "font-semibold text-info",
                        !b.priority && "text-muted-foreground"
                      )}
                    >
                      <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">Select priority</option>
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">{PRIORITY_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>

                  {openProjectTasks.length > 0 && (
                    <div className="flex items-center gap-1.5 border-l pl-2 border-border/60">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Project Task:
                      </span>
                      <select
                        value={b.projectTaskId || ""}
                        onChange={(e) => updateField(i, "projectTaskId", e.target.value)}
                        className="cursor-pointer bg-transparent text-xs outline-none rounded px-1 py-0.5 border border-border text-foreground hover:border-primary/40 max-w-[180px] truncate"
                      >
                        <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">None (General)</option>
                        {openProjectTasks.map((pt) => (
                          <option key={pt.id} value={pt.id} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                            [{pt.code}] {pt.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {onScheduleMeeting && (
                  <button
                    type="button"
                    onClick={() => {
                      const titleText = b.text.trim() ? `Blocker Sync: ${b.text.trim()}` : "Blocker Resolution Meeting";
                      onScheduleMeeting(titleText, b.mentionedUserIds);
                    }}
                    className="flex items-center gap-1.5 text-[11px] font-semibold rounded-lg border border-border bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground px-2.5 py-1 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <CalendarIcon size={12} className="text-muted-foreground" />
                    Schedule Meeting
                  </button>
                )}
              </div>
            </div>

            {/* Remove row button */}
            {blockers.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="mt-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-destructive/60 transition-colors hover:border-destructive/40 hover:text-destructive dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
      >
        <Plus size={13} className="dark:text-[#93C5FD]" /> Add Blocker
      </button>
    </div>
  );
}

// ── Support rows ──────────────────────────────────────────────────────────────

type SupportItem = {
  id: string;
  text: string;
  mentionedUserIds: string[];
  scheduledEvent?: CalendarEventView | null;
  carried?: boolean;
};

function ScheduledMeetingActions({
  event,
  onEdit,
  onDeleted,
}: {
  event: CalendarEventView;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = () => {
    setIsDeleting(true);
    // 1. Immediately remove from local state so UI updates
    onDeleted();

    // 2. Dispatch background delete action if event ID exists
    if (event.id) {
      import("react").then(({ startTransition }) => {
        startTransition(async () => {
          try {
            const fd = new FormData();
            fd.set("eventId", event.id);
            fd.set("etag", String(event.etag ?? 1));
            await deleteCalendarEvent({}, fd);
          } catch (err) {
            console.warn("Failed to delete calendar event:", err);
          }
        });
      });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[140px]" title={event.title}>
        {event.title}
      </span>
      <button
        type="button"
        onClick={onEdit}
        title="Edit meeting"
        className="flex items-center gap-1.5 rounded-lg border border-border bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer"
      >
        <Pencil size={11} className="text-muted-foreground" />
        Edit Meeting
      </button>
      {/* <button
        type="button"
        disabled={isDeleting}
        title="Delete meeting"
        onClick={handleDelete}
        className="flex items-center gap-1 rounded-lg border border-border bg-transparent hover:bg-destructive/10 text-muted-foreground hover:text-destructive px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
      >
        {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
        Delete
      </button> */}
    </div>
  );
}

function SupportRows({
  supports,
  teamMembers,
  onChange,
  onScheduleMeeting,
}: {
  supports: SupportItem[];
  teamMembers: TeamMember[];
  onChange: (s: SupportItem[]) => void;
  onScheduleMeeting?: (index: number) => void;
}) {
  const updateMentions = (i: number, text: string, mentionedUserIds: string[]) => {
    const n = [...supports];
    n[i] = { ...n[i], text, mentionedUserIds };
    onChange(n);
  };
  const remove = (i: number) => onChange(supports.filter((_, j) => j !== i));
  const add = () => onChange([...supports, { id: crypto.randomUUID(), text: "", mentionedUserIds: [] }]);
  const clearScheduledEvent = (i: number) => {
    const n = [...supports];
    n[i] = { ...n[i], scheduledEvent: null };
    onChange(n);
  };

  const memberById = (id: string) => teamMembers.find((m) => m.id === id);

  return (
    <div className="flex flex-col gap-2">
      {supports.map((s, i) => {
        const initialMentions = s.mentionedUserIds.map(memberById).filter(Boolean) as TeamMember[];
        return (
          <div key={s.id} className="flex items-start gap-2">
            {/* Emit comma-separated user IDs in a single hidden input to preserve row-index alignment */}
            <input type="hidden" name="supportUserId" value={s.mentionedUserIds.join(",")} />
            <input type="hidden" name="supportEventId" value={s.scheduledEvent?.id ?? ""} />

            {/* Main input card */}
            <div className="flex-1 rounded-md border bg-background transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring min-h-[38px]">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="flex-1">
                  <MentionInput
                    key={s.id}
                    name="supportText"
                    defaultValue={s.text}
                    defaultMentions={initialMentions}
                    onChange={(text, mentionedUserIds) => updateMentions(i, text, mentionedUserIds)}
                    onEnterSubmit={i === supports.length - 1 && s.text.trim() ? add : undefined}
                    placeholder="Add support details... (@ to mention people)"
                    teamMembers={teamMembers}
                    className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent text-sm"
                  />
                </div>
                {s.carried && (
                  <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    Carried over
                  </span>
                )}
              </div>

              {/* Bottom: Schedule Meeting Action */}
              <div className="flex items-center justify-between border-t px-3 py-1.5 bg-muted/20">
                {s.scheduledEvent ? (
                  <ScheduledMeetingActions
                    event={s.scheduledEvent}
                    onEdit={() => onScheduleMeeting?.(i)}
                    onDeleted={() => clearScheduledEvent(i)}
                  />
                ) : (
                  <>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {s.mentionedUserIds.length > 0 ? `${s.mentionedUserIds.length} tagged for meeting` : "Tag people (@) to invite"}
                    </span>
                    {onScheduleMeeting && (
                      <button
                        type="button"
                        onClick={() => onScheduleMeeting(i)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold rounded-lg border border-border bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground px-2.5 py-1 transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        <CalendarIcon size={12} className="text-muted-foreground" />
                        Schedule Meeting
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Remove row button */}
            {/* <button
              type="button"
              onClick={() => remove(i)}
              className="mt-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X size={14} />
            </button> */}
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
      >
        <Plus size={13} className="dark:text-[#93C5FD]" /> Add Support Needed
      </button>
    </div>
  );
}

// ── Parking lot rows ──────────────────────────────────────────────────────────

type ParkedTaskItem = {
  id: string;
  text: string;
  priority: string;
  projectTaskId: string;
  /** Client-only: tracks the chosen project before/without a specific task being picked yet. Not persisted directly — only projectTaskId is saved. */
  projectId: string;
  dueDate: string;
  persisted: boolean;
};

function parkedTaskToItem(t: ParkedTask): ParkedTaskItem {
  return {
    id: t.id,
    text: t.text,
    priority: t.priority ?? "",
    projectTaskId: t.projectTaskId ?? "",
    projectId: t.projectTask?.project?.id ?? "",
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "",
    persisted: true,
  };
}

function daysFromToday(dueDate: string): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00.000Z");
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return Math.round((due.getTime() - todayUtc.getTime()) / 86400000);
}

function ParkingLotRows({
  items,
  cascadingProjects,
  onChange,
  onMoveToToday,
}: {
  items: ParkedTaskItem[];
  cascadingProjects: CascadingProjectOption[];
  onChange: (items: ParkedTaskItem[]) => void;
  onMoveToToday: (item: ParkedTaskItem) => void;
}) {
  const [, startTransition] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);

  const updateLocal = <K extends keyof ParkedTaskItem>(i: number, field: K, v: ParkedTaskItem[K]) => {
    const n = [...items];
    n[i] = { ...n[i], [field]: v };
    onChange(n);
  };

  const handleProjectChange = (i: number, newProjectId: string) => {
    const n = [...items];
    n[i] = { ...n[i], projectId: newProjectId, projectTaskId: "" };
    onChange(n);
    persistField(i, { projectTaskId: "" });
  };

  const handleTaskChange = (i: number, newTaskId: string, currentProject?: CascadingProjectOption) => {
    const chosenTask = currentProject?.tasks.find((t) => t.id === newTaskId);
    const hasSubtasks = Boolean(chosenTask && chosenTask.subtasks && chosenTask.subtasks.length > 0);
    const resolvedProjectTaskId = hasSubtasks ? "" : (chosenTask?.id || "");
    const n = [...items];
    n[i] = {
      ...n[i],
      projectTaskId: resolvedProjectTaskId,
      text: (!n[i].text.trim() && chosenTask) ? chosenTask.title : n[i].text,
    };
    onChange(n);
    persistField(i, { projectTaskId: resolvedProjectTaskId, ...(n[i].text !== items[i].text ? { text: n[i].text } : {}) });
  };

  const handleSubtaskChange = (i: number, newSubtaskId: string, currentTask?: CascadingProjectOption["tasks"][number]) => {
    const chosenSubtask = currentTask?.subtasks?.find((st) => st.id === newSubtaskId);
    const resolvedProjectTaskId = newSubtaskId || (currentTask ? currentTask.id : "");
    const n = [...items];
    n[i] = {
      ...n[i],
      projectTaskId: resolvedProjectTaskId,
      text: chosenSubtask && (!n[i].text.trim() || n[i].text === currentTask?.title) ? chosenSubtask.title : n[i].text,
    };
    onChange(n);
    persistField(i, { projectTaskId: resolvedProjectTaskId, ...(n[i].text !== items[i].text ? { text: n[i].text } : {}) });
  };

  const persistNew = (i: number) => {
    const item = items[i];
    if (item.persisted || !item.text.trim()) return;
    startTransition(async () => {
      const res = await parkNewTask({
        text: item.text,
        priority: item.priority || undefined,
        projectTaskId: item.projectTaskId || undefined,
        dueDate: item.dueDate || undefined,
      });
      if (res.success && res.task) {
        onChange(items.map((it, idx) => (idx === i ? { ...it, id: res.task!.id, persisted: true } : it)));
      }
    });
  };

  const persistField = (i: number, patch: { priority?: string; projectTaskId?: string; dueDate?: string; text?: string }) => {
    const item = items[i];
    if (!item.persisted) return;
    startTransition(async () => {
      await updateParkedTask(item.id, patch);
    });
  };

  const add = () => onChange([...items, { id: crypto.randomUUID(), text: "", priority: "", projectTaskId: "", projectId: "", dueDate: "", persisted: false }]);

  const remove = (i: number) => {
    const item = items[i];
    onChange(items.filter((_, j) => j !== i));
    if (item.persisted) {
      startTransition(async () => {
        await removeParkedTask(item.id);
      });
    }
  };

  const moveToToday = (i: number) => {
    const item = items[i];
    if (!item.persisted) {
      onChange(items.filter((_, j) => j !== i));
      onMoveToToday(item);
      return;
    }
    setMovingId(item.id);
    startTransition(async () => {
      const res = await moveParkedTaskToToday(item.id);
      setMovingId(null);
      if (res.success) {
        onChange(items.filter((_, j) => j !== i));
        onMoveToToday(item);
      }
    });
  };

  const levels = ["P1", "P2", "P3"];

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => {
        const tree = resolveTaskTree(item, cascadingProjects);
        const selectedMeta = findSelectedTaskMeta(cascadingProjects, item.projectTaskId);
        const daysOut = daysFromToday(item.dueDate);
        return (
          <div key={item.id} className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 hover:border-primary/30 transition-colors">
            <div className="relative flex items-center shrink-0">
              <select
                value={item.priority}
                onChange={(e) => {
                  updateLocal(i, "priority", e.target.value);
                  persistField(i, { priority: e.target.value });
                }}
                className={cn(
                  "cursor-pointer appearance-none rounded-md border bg-background py-1 pl-2 pr-5 text-xs font-bold outline-none transition-colors",
                  item.priority === "P1" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  item.priority === "P2" && "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
                  item.priority === "P3" && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  !item.priority && "border-border text-muted-foreground font-normal"
                )}
              >
                <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">–</option>
                {levels.map((p) => (
                  <option key={p} value={p} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">{p}</option>
                ))}
              </select>
              <ChevronDown size={11} className="pointer-events-none absolute right-1 text-muted-foreground" />
            </div>

            {selectedMeta?.code && (
              <span className="shrink-0 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {selectedMeta.code}
              </span>
            )}

            <input
              type="text"
              value={item.text}
              onChange={(e) => updateLocal(i, "text", e.target.value)}
              onBlur={() => persistNew(i)}
              placeholder="Add task details..."
              className="min-w-0 flex-1 basis-[160px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />

            {/* Project selector */}
            <div className="relative flex items-center shrink-0">
              <select
                value={tree.projectId}
                onChange={(e) => handleProjectChange(i, e.target.value)}
                className="cursor-pointer appearance-none bg-transparent pr-5 text-xs font-medium text-foreground outline-none hover:text-primary transition-colors max-w-[110px] truncate"
              >
                <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                  {cascadingProjects.length === 0 ? "Loading..." : "Select Project"}
                </option>
                {cascadingProjects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-0 text-muted-foreground" />
            </div>

            {/* Task selector (once a project is chosen) */}
            {tree.currentProject && (
              <div className="relative flex items-center shrink-0">
                <select
                  value={tree.taskId}
                  onChange={(e) => handleTaskChange(i, e.target.value, tree.currentProject)}
                  className="cursor-pointer appearance-none bg-transparent pr-5 text-xs font-medium text-foreground outline-none hover:text-primary transition-colors max-w-[130px] truncate"
                >
                  <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                    {tree.currentProject.tasks.length === 0 ? "No tasks" : "Select Task"}
                  </option>
                  {tree.currentProject.tasks.map((t) => (
                    <option key={t.id} value={t.id} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                      {t.code ? `[${t.code}] ` : ""}{t.title}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-0 text-muted-foreground" />
              </div>
            )}

            {/* Subtask selector (when the chosen task has subtasks) */}
            {tree.currentTask && tree.currentTask.subtasks && tree.currentTask.subtasks.length > 0 && (
              <div className="relative flex items-center shrink-0">
                <select
                  value={tree.subtaskId}
                  onChange={(e) => handleSubtaskChange(i, e.target.value, tree.currentTask)}
                  className="cursor-pointer appearance-none bg-transparent pr-5 text-xs font-medium text-foreground outline-none hover:text-primary transition-colors max-w-[120px] truncate"
                >
                  <option value="" className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">Select Subtask</option>
                  {tree.currentTask.subtasks.map((st) => (
                    <option key={st.id} value={st.id} className="bg-card text-foreground dark:bg-[#1a1f26] dark:text-[#f8fafc]">
                      {st.code ? `[${st.code}] ` : ""}{st.title}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-0 text-muted-foreground" />
              </div>
            )}

            <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground shrink-0">
              <CalendarIcon size={11} />
              <input
                type="date"
                value={item.dueDate}
                onChange={(e) => {
                  updateLocal(i, "dueDate", e.target.value);
                  persistField(i, { dueDate: e.target.value });
                }}
                className="cursor-pointer bg-transparent text-xs text-foreground outline-none [color-scheme:light] dark:[color-scheme:dark]"
              />
              {daysOut !== null && daysOut >= 0 && (
                <span className="whitespace-nowrap">(In {daysOut}d)</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => moveToToday(i)}
              disabled={!item.text.trim() || movingId === item.id}
              className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline dark:text-[#3B82F6]"
            >
              {movingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpRight size={12} />}
              To Today
            </button>

            <button
              type="button"
              onClick={() => remove(i)}
              title="Remove from parking lot"
              className="shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
      >
        <Plus size={13} className="dark:text-[#93C5FD]" /> Park Task
      </button>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function Section({ icon, title, required, children }: {
  icon: React.ReactNode;
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">
          {title}
          {required && <span className="ml-1 text-destructive">*</span>}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

type SubmitDsmFormProps = {
  entry: EntryWithDetails | null;
  yesterdayTasks: string[];
  yesterdayIncompleteTasks: string[];
  yesterdayBlockers: { text: string; priority: "LOW" | "MEDIUM" | "HIGH"; mentionedUserId?: string | null }[];
  yesterdaySupportNeeds: { text: string; mentionedUserId?: string | null }[];
  yesterdayIncompleteLearningItems: string[];
  teamMembers: TeamMember[];
  todayDateStr: string; // "YYYY-MM-DD"
  todayCalendarEvents?: CalendarEventView[];
  parkedTasks?: ParkedTask[];
  onCancel?: () => void;
};

const initialState: SaveDsmState = {};

export function SubmitDsmForm({
  entry,
  yesterdayTasks,
  yesterdayIncompleteTasks,
  yesterdayBlockers,
  yesterdaySupportNeeds,
  yesterdayIncompleteLearningItems,
  teamMembers,
  todayDateStr,
  todayCalendarEvents,
  parkedTasks: parkedTasksProp,
  onCancel,
}: SubmitDsmFormProps) {
  const [state, action, pending] = useActionState(saveDsm, initialState);
  const isEditMode = entry?.status === "SUBMITTED" || entry?.status === "PENDING_REVIEW";

  const isLoadedRef = useRef(false);
  const draftKey = `winos_dsm_draft_${todayDateStr}`;

  // Read saved draft synchronously on initial render
  const savedDraft = typeof window !== "undefined" && !isEditMode ? (() => {
    try {
      const saved = localStorage.getItem(draftKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })() : null;

  const [tasks, setTasks] = useState<Task[]>(() => {
    if (savedDraft?.tasks?.length) return savedDraft.tasks;
    const existingToday = entry?.tasks.filter((t) => t.kind === "TODAY") ?? [];
    if (existingToday.length > 0) {
      return existingToday.map((t) => ({
        id: crypto.randomUUID(),
        text: t.text,
        priority: t.priority ?? "",
        carried: yesterdayIncompleteTasks.some((yt) => yt.trim().toLowerCase() === t.text.trim().toLowerCase()),
        dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "",
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : undefined,
      }));
    }
    if (yesterdayIncompleteTasks.length > 0) {
      return yesterdayIncompleteTasks.map((text) => ({ id: crypto.randomUUID(), text, priority: "", carried: true, dueDate: "" }));
    }
    return [{ id: crypto.randomUUID(), text: "", priority: "", carried: false, dueDate: "" }, { id: crypto.randomUUID(), text: "", priority: "", carried: false, dueDate: "" }];
  });

  const [blockers, setBlockers] = useState<BlockerItem[]>(() => {
    if (savedDraft?.blockers?.length) return savedDraft.blockers;
    if (entry?.blockers && entry.blockers.length > 0) {
      return entry.blockers.map((b) => ({
        id: crypto.randomUUID(),
        text: b.text,
        priority: b.priority,
        mentionedUserIds: b.mentionedUserIds
          ? b.mentionedUserIds.split(",").filter(Boolean)
          : b.mentionedUserId
            ? [b.mentionedUserId]
            : [],
        carried: yesterdayBlockers.some((yb) => yb.text.trim().toLowerCase() === b.text.trim().toLowerCase()),
      }));
    }
    if (yesterdayBlockers && yesterdayBlockers.length > 0) {
      return yesterdayBlockers.map((b) => ({
        id: crypto.randomUUID(),
        text: b.text,
        priority: b.priority,
        mentionedUserIds: b.mentionedUserId ? [b.mentionedUserId] : [],
        carried: true,
      }));
    }
    return [{ id: crypto.randomUUID(), text: "", priority: "", mentionedUserIds: [], carried: false }];
  });

  const [supports, setSupports] = useState<SupportItem[]>(() => {
    if (savedDraft?.supports?.length) {
      // Dates come back from localStorage as strings — revive them.
      return (savedDraft.supports as SupportItem[]).map((s) =>
        s.scheduledEvent
          ? { ...s, scheduledEvent: { ...s.scheduledEvent, start: new Date(s.scheduledEvent.start), end: new Date(s.scheduledEvent.end) } }
          : s,
      );
    }
    if (entry?.supportNeeds && entry.supportNeeds.length > 0) {
      return entry.supportNeeds.map((s) => ({
        id: crypto.randomUUID(),
        text: s.text,
        mentionedUserIds: s.mentionedUserIds
          ? s.mentionedUserIds.split(",").filter(Boolean)
          : s.mentionedUser?.id
            ? [s.mentionedUser.id]
            : [],
        scheduledEvent: s.event ? supportEventToView(s.event) : null,
        carried: yesterdaySupportNeeds.some((ys) => ys.text.trim().toLowerCase() === s.text.trim().toLowerCase()),
      }));
    }
    if (yesterdaySupportNeeds && yesterdaySupportNeeds.length > 0) {
      return yesterdaySupportNeeds.map((s) => ({
        id: crypto.randomUUID(),
        text: s.text,
        mentionedUserIds: s.mentionedUserId ? [s.mentionedUserId] : [],
        carried: true,
      }));
    }
    return [{ id: crypto.randomUUID(), text: "", mentionedUserIds: [], carried: false }];
  });

  const [learningItems, setLearningItems] = useState<{ id: string; text: string; carried?: boolean }[]>(() => {
    if (savedDraft?.learningItems?.length) return savedDraft.learningItems;
    if (savedDraft?.learningText) {
      const lines = savedDraft.learningText.split("\n").map((t: string) => t.trim()).filter(Boolean);
      if (lines.length > 0) return lines.map((text: string) => ({ id: crypto.randomUUID(), text, carried: yesterdayIncompleteLearningItems.some((yl) => yl.trim().toLowerCase() === text.trim().toLowerCase()) }));
    }
    if (entry?.learningText) {
      const lines = entry.learningText.split("\n").map((t) => t.trim()).filter(Boolean);
      if (lines.length > 0) return lines.map((text) => ({ id: crypto.randomUUID(), text, carried: yesterdayIncompleteLearningItems.some((yl) => yl.trim().toLowerCase() === text.trim().toLowerCase()) }));
    }
    if (yesterdayIncompleteLearningItems && yesterdayIncompleteLearningItems.length > 0) {
      return yesterdayIncompleteLearningItems.map((text) => ({ id: crypto.randomUUID(), text, carried: true }));
    }
    return [{ id: crypto.randomUUID(), text: "", carried: false }];
  });
  const [parkedTasks, setParkedTasks] = useState<ParkedTaskItem[]>(() =>
    (parkedTasksProp ?? []).map(parkedTaskToItem)
  );

  const [scheduleModal, setScheduleModal] = useState<{
    index: number;
    mode: "create" | "edit";
    title: string;
    participantIds: string[];
    event?: CalendarEventView;
  } | null>(null);

  const [openProjectTasks, setOpenProjectTasks] = useState<OpenProjectTaskOption[]>([]);
  const [cascadingProjects, setCascadingProjects] = useState<CascadingProjectOption[]>([]);
  const [linkedTimeLogs, setLinkedTimeLogs] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchUserOpenProjectTasksAction().then((res) => {
      if (res) setOpenProjectTasks(res);
    });
    fetchUserProjectsWithTasksAction().then((res) => {
      if (res) setCascadingProjects(res);
    });
  }, []);

  useEffect(() => {
    const taskIds = tasks.map((t) => t.projectTaskId).filter(Boolean) as string[];
    if (taskIds.length > 0) {
      fetchLinkedTimeLogsAction(taskIds).then((res) => {
        if (res) setLinkedTimeLogs(res);
      });
    }
  }, [tasks]);

  useEffect(() => {
    isLoadedRef.current = true;
  }, []);

  // Auto-save form draft to localStorage on every change
  useEffect(() => {
    if (!isLoadedRef.current || isEditMode) return;
    const draftData = {
      tasks,
      blockers,
      supports,
      learningItems,
      learningText: learningItems.map((l) => l.text.trim()).filter(Boolean).join("\n"),
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    } catch {
      // Ignore storage error
    }
  }, [draftKey, isEditMode, tasks, blockers, supports, learningItems]);

  // Clear draft upon successful save or submission
  useEffect(() => {
    if (state.message === "saved" || state.message === "submitted") {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // Ignore
      }
    }
  }, [state.message, draftKey]);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-base font-semibold">
          {isEditMode ? "Edit Today's Standup" : "Submit Today's Standup"}
        </h2>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>

      <form action={action} className="flex flex-col gap-6 px-5 py-5">
        <input type="hidden" name="date" value={todayDateStr} />

        {/* Yesterday — read-only completed tasks */}
        <Section icon={<CheckCircle2 size={16} className="text-primary dark:text-[#3B82F6]" />} title="What Did You Complete Yesterday?">
          {yesterdayTasks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {yesterdayTasks.map((task, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <CheckCircle2 size={18} className="shrink-0 text-primary dark:text-[#3B82F6]" />
                  <span>{task}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/60">No Entries for Yesterday.</p>
          )}
        </Section>

        {/* Today's Scheduled Zoho Calendar Meetings Widget */}
        {/* {todayCalendarEvents && todayCalendarEvents.length > 0 && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <CalendarIcon size={16} className="text-primary" />
                <span>Today&apos;s Scheduled Calendar Meetings ({todayCalendarEvents.length})</span>
              </div>
              <span className="text-[11px] font-semibold text-primary/80 bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                Zoho Calendar Integration
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {todayCalendarEvents.map((ev) => {
                const timeStr = `${formatTime(ev.start)} - ${formatTime(ev.end)}`;
                return (
                  <div key={ev.id} className="flex flex-col justify-between rounded-lg border border-border bg-card p-3 shadow-2xs space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span className="truncate max-w-[180px]">{ev.title}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                          <Clock size={10} /> {timeStr}
                        </span>
                      </div>
                      {ev.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{ev.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                      <button
                        type="button"
                        onClick={() => {
                          setTasks((prev) => [
                            ...prev.filter((t) => t.text.trim()),
                            { text: `Meeting: ${ev.title} (${timeStr})`, priority: "P1", carried: false },
                          ]);
                        }}
                        className="flex-1 rounded-md bg-primary/10 border border-primary/30 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-all text-center cursor-pointer"
                      >
                        + Add to Tasks
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSupports((prev) => [
                            ...prev.filter((s) => s.text.trim()),
                            { text: `Data/Input needed for meeting: ${ev.title} (${timeStr})`, mentionedUserIds: [] },
                          ]);
                        }}
                        className="flex-1 rounded-md bg-secondary border border-border py-1 text-[11px] font-semibold text-foreground hover:bg-accent transition-all text-center cursor-pointer"
                      >
                        + Add to Data Needed
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )} */}

        {/* Today's tasks */}
        <Section
          icon={<ClipboardList size={16} className="text-primary" />}
          title="What Will You Do Today?"
          required
        >
          <TaskRows
            tasks={tasks}
            teamMembers={teamMembers}
            openProjectTasks={openProjectTasks}
            cascadingProjects={cascadingProjects}
            linkedTimeLogs={linkedTimeLogs}
            onChange={setTasks}
          />
          {state.errors?.tasks && (
            <p className="text-xs text-destructive">{state.errors.tasks[0]}</p>
          )}
        </Section>

        {/* What will you learn today */}
        <Section
          icon={<GraduationCap size={16} className="text-primary" />}
          title="What Will You Learn Today( Whyfi School )?"
          required
        >
          <input
            type="hidden"
            name="learningText"
            value={learningItems.map((l) => l.text.trim()).filter(Boolean).join("\n")}
          />
          <LearningRows items={learningItems} teamMembers={teamMembers} onChange={setLearningItems} />
          {state.errors?.learningText && (
            <p className="text-xs text-destructive">{state.errors.learningText[0]}</p>
          )}
        </Section>

        {/* Blockers */}
        <Section icon={<AlertCircle size={16} className="text-muted-foreground" />} title="Blockers (Dependencies)?">
          <BlockerRows
            blockers={blockers}
            teamMembers={teamMembers}
            openProjectTasks={openProjectTasks}
            onChange={setBlockers}
          // onScheduleMeeting={(title, participantIds) => setScheduleModal({ title, participantIds })}
          />
        </Section>

        {/* Support needed */}
        <Section icon={<SupportNeededIcon size={16} className="text-muted-foreground" />} title="Support Needed (Meeting)?">
          <SupportRows
            supports={supports}
            teamMembers={teamMembers}
            onChange={setSupports}
            onScheduleMeeting={(index) => {
              const s = supports[index];
              if (s.scheduledEvent) {
                setScheduleModal({
                  index,
                  mode: "edit",
                  title: s.scheduledEvent.title,
                  participantIds: s.mentionedUserIds,
                  event: s.scheduledEvent,
                });
              } else {
                const titleText = s.text.trim() ? `Support Needed: ${s.text.trim()}` : "Support Needed Meeting";
                setScheduleModal({ index, mode: "create", title: titleText, participantIds: s.mentionedUserIds });
              }
            }}
          />
        </Section>

        {/* Parking lot */}
        <Section icon={<Archive size={16} className="text-muted-foreground" />} title="Parking Lot">
          <ParkingLotRows
            items={parkedTasks}
            cascadingProjects={cascadingProjects}
            onChange={setParkedTasks}
            onMoveToToday={(item) => {
              setTasks((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  text: item.text,
                  priority: item.priority,
                  carried: false,
                  projectTaskId: item.projectTaskId || undefined,
                  projectId: item.projectId || undefined,
                  dueDate: item.dueDate || undefined,
                  createdAt: new Date().toISOString(),
                },
              ]);
            }}
          />
        </Section>

        {/* Footer */}
        <div className={cn("flex items-center border-t pt-4", isEditMode ? "justify-end" : "justify-between")}>
          {!isEditMode && (
            <button
              name="action"
              value="draft"
              type="submit"
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground px-5 py-2 text-sm font-semibold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            >
              {pending && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              Save Draft
            </button>
          )}
          <div className="flex items-center gap-3">
            {state.message === "saved" && (
              <p className="text-xs text-muted-foreground">Draft Saved.</p>
            )}
            {state.message && state.message !== "saved" && (
              <p className="text-xs text-destructive">
                {state.message === "Unauthorized" ? "Session Expired. Please Sign In Again." : state.message}
              </p>
            )}
            <button
              name="action"
              value="submit"
              type="submit"
              disabled={pending}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] dark:text-[#F8FAFC]"
            >
              {pending && <Loader2 size={16} className="animate-spin" />}
              {pending ? "Saving…" : isEditMode ? "Save Changes" : "Submit DSM"}
              {!pending && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </form>

      {/* Direct Meeting Scheduler Modal */}
      {scheduleModal && (
        <EventDialog
          mode={scheduleModal.mode}
          event={scheduleModal.event}
          defaultTitle={scheduleModal.title}
          defaultStart={scheduleModal.mode === "create" ? (() => {
            const d = new Date();
            d.setHours(17, 0, 0, 0);
            return d;
          })() : undefined}
          defaultParticipantIds={scheduleModal.participantIds}
          internalUsers={teamMembers.map((m) => ({ id: m.id, name: m.name ?? null, email: m.email }))}
          currentUserId=""
          onClose={() => setScheduleModal(null)}
          onSaved={(view) => {
            const idx = scheduleModal.index;
            setSupports((prev) => prev.map((s, i) => (i === idx ? { ...s, scheduledEvent: view } : s)));
          }}
        />
      )}
    </div>
  );
}
