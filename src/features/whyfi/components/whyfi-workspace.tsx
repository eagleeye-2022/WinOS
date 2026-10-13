"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  GraduationCap,
  Layers,
  ListTodo,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/shared/toast";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { TimerWidget } from "@/features/projects/components/timer-widget";
import { ActiveTimerProvider } from "@/features/projects/context/active-timer-context";
import { getAvatarColor } from "@/features/projects/components/assignee-picker-popover";
import {
  createWhyfiListAction,
  createWhyfiTaskAction,
  deleteWhyfiListAction,
  deleteWhyfiTaskAction,
  getWhyfiTimelineAction,
  getWhyfiWorkspaceAction,
  setWhyfiListMembersAction,
  updateWhyfiListAction,
  updateWhyfiTaskAction,
  type WhyfiList,
  type WhyfiTask,
  type WhyfiTimelineEntry,
  type WhyfiUser,
  type WhyfiWorkspace as WhyfiWorkspaceData,
} from "../actions";
import { LEARNING_TASK_STATUSES } from "../constants";
import { isTaskDone } from "@/features/projects/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

type Result = { success: boolean; error?: string };

function formatMinutes(minutes: number): string {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

/** Same pill colours as the project board's status select. */
function statusPillClass(status: string): string {
  if (isTaskDone(status)) return "bg-emerald-500 hover:bg-emerald-600";
  switch (status) {
    case "In Progress":
      return "bg-amber-500 hover:bg-amber-600";
    case "In Review":
    case "Under Review":
      return "bg-purple-500 hover:bg-purple-600";
    case "Follow Up 1":
      return "bg-cyan-500 hover:bg-cyan-600";
    case "Follow Up 2":
      return "bg-blue-600 hover:bg-blue-700";
    case "Pending from Client":
      return "bg-orange-500 hover:bg-orange-600";
    case "On Hold":
      return "bg-slate-500 hover:bg-slate-600";
    case "Delayed":
      return "bg-rose-500 hover:bg-rose-600";
    default:
      return "bg-[#0088ff] hover:bg-[#0077ee]";
  }
}

function statusBadgeClass(status: string): string {
  if (isTaskDone(status)) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300";
  if (status === "In Progress") return "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300";
  return "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300";
}

/** A task and all its nested subtasks, flattened. */
function flattenTasks(tasks: WhyfiTask[]): WhyfiTask[] {
  return tasks.flatMap((t) => [t, ...flattenTasks(t.subtasks)]);
}

const TAB_CLASS = (active: boolean) =>
  cn(
    "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all",
    active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
  );

const ICON_BTN =
  "p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer";

function Avatar({ user, className }: { user: WhyfiUser; className?: string }) {
  return (
    <span
      title={user.name}
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-background",
        getAvatarColor(user.name),
        className
      )}
    >
      {initials(user.name)}
    </span>
  );
}

/** Checkbox list of users with a search box — shares a list or assigns a card. */
function UserMultiSelect({
  users,
  selectedIds,
  onSave,
  saving,
  trigger,
  title,
  saveLabel = "Save",
  side = "bottom",
}: {
  users: WhyfiUser[];
  selectedIds: string[];
  onSave: (ids: string[]) => void;
  saving?: boolean;
  trigger: React.ReactNode;
  title: string;
  saveLabel?: string;
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string[]>(selectedIds);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users;
  }, [users, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraft(selectedIds);
          setQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side={side}
        align="end"
        className="z-50 w-72 border border-border bg-popover p-0 text-popover-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="flex items-center gap-2 border-b px-2.5 py-2">
          <Search size={13} className="shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people..."
            className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul className="max-h-64 overflow-y-auto p-1">
          {filtered.map((u) => {
            const checked = draft.includes(u.id);
            return (
              <li key={u.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setDraft((prev) => (checked ? prev.filter((id) => id !== u.id) : [...prev, u.id]))
                    }
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <Avatar user={u} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{u.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{u.email}</span>
                  </span>
                </label>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</li>}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <span className="text-[11px] text-muted-foreground">{draft.length} selected</span>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              onSave(draft);
              setOpen(false);
            }}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-[#0088ff] px-3 py-1 text-xs font-bold text-white hover:bg-[#0077ee] disabled:opacity-50"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {saveLabel}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Card (styled like the project board's task card) ─────────────────────────

function LearningCard({
  task,
  list,
  workspace,
  run,
}: {
  task: WhyfiTask;
  list: WhyfiList;
  workspace: WhyfiWorkspaceData;
  run: (fn: () => Promise<Result>, okMessage?: string, after?: () => void) => void;
}) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [subTitle, setSubTitle] = useState("");

  const me = workspace.currentUserId;
  const ownerIds = task.owners.map((o) => o.id);
  const isListMember = list.members.some((m) => m.id === me);
  const canChangeStatus = workspace.isManager || ownerIds.length === 0 || ownerIds.includes(me);
  const canEdit = workspace.isManager || task.authorId === me;
  const canAddSubtask = workspace.isManager || isListMember;
  // The server lets anyone the list is shared with time its cards (see createActiveTimerAction).
  const canTime = workspace.isManager || isListMember;
  const isDone = isTaskDone(task.status);
  const allSubtasks = flattenTasks(task.subtasks);
  const doneSubtasks = allSubtasks.filter((s) => isTaskDone(s.status)).length;

  const addSubtask = () => {
    const t = subTitle.trim();
    if (!t) return;
    run(() => createWhyfiTaskAction(list.id, { title: t, parentTaskId: task.id }), "Subtask added", () => {
      setSubTitle("");
      setAddingSub(false);
      setShowSubtasks(true);
    });
  };

  const startEdit = () => {
    setTitle(task.title);
    setDescription(task.description);
    setDueDate(task.dueDate);
    setEditing(true);
    setExpanded(true);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${task.code}?`,
      description: `"${task.title}" will be removed from ${list.name}.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) run(() => deleteWhyfiTaskAction(task.id), "Card deleted");
  };

  const firstOwner = task.owners[0];

  return (
    <div className="group relative space-y-2.5 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs transition-all hover:border-primary/60 hover:shadow-md dark:border-neutral-800 dark:bg-card">
      {ConfirmDialog}

      {/* Top row: code, status, details, more */}
      <div className="flex items-center justify-between gap-3">
        <span className="whitespace-nowrap font-mono text-[11px] font-bold text-slate-400 dark:text-neutral-500">
          {task.code}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div
            className={cn(
              "relative inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-tight text-white shadow-2xs transition-all",
              statusPillClass(task.status)
            )}
          >
            <select
              value={task.status}
              disabled={!canChangeStatus}
              onChange={(e) => run(() => updateWhyfiTaskAction(task.id, { status: e.target.value }))}
              title={canChangeStatus ? "Change status" : "Only the people this card is assigned to can change its status"}
              className="cursor-pointer appearance-none bg-transparent pr-4 text-[10px] font-bold text-white outline-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              {LEARNING_TASK_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-card text-foreground">
                  {s}
                </option>
              ))}
              {!LEARNING_TASK_STATUSES.includes(task.status) && (
                <option value={task.status} className="bg-card text-foreground">
                  {task.status}
                </option>
              )}
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-white/90" />
          </div>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="cursor-pointer rounded-full p-1 text-slate-400 transition-all duration-150 hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-800"
            title={expanded ? "Hide details" : "View details"}
          >
            <Eye size={13} />
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={!canEdit && !canAddSubtask}
                className="cursor-pointer rounded-full p-1 text-slate-400 transition-all duration-150 hover:bg-slate-200 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-slate-800"
                title={canEdit || canAddSubtask ? "More options" : "This learning task list hasn't been shared with you"}
              >
                <MoreVertical size={13} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              className="z-50 w-40 border border-border bg-popover p-1.5 text-xs text-popover-foreground shadow-lg"
            >
              {canAddSubtask && (
                <button
                  type="button"
                  onClick={() => {
                    setAddingSub(true);
                    setShowSubtasks(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
                >
                  <Plus size={13} /> Add subtask
                </button>
              )}
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={startEdit}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Title / edit form */}
      {editing ? (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-primary/50 bg-transparent px-1.5 py-1 text-xs font-bold text-foreground outline-none ring-1 ring-primary/30 focus:ring-primary"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What should be learned, links, resources..."
            className="w-full resize-none rounded-md border border-input bg-background px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="ml-auto cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!title.trim()}
              onClick={() =>
                run(() => updateWhyfiTaskAction(task.id, { title, description, dueDate }), "Card updated", () =>
                  setEditing(false)
                )
              }
              className="flex cursor-pointer items-center gap-1 rounded bg-[#0088ff] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#0077ee] disabled:opacity-50"
            >
              <Check size={12} /> Save
            </button>
          </div>
        </div>
      ) : (
        <h4
          onClick={() => setExpanded((v) => !v)}
          title={task.title}
          className={cn(
            "-mx-1 cursor-pointer rounded-md px-1 text-xs font-semibold leading-snug transition-colors group-hover:text-primary",
            isDone
              ? "text-slate-400 line-through decoration-slate-400/80 dark:text-neutral-500"
              : "text-slate-800 dark:text-neutral-200"
          )}
        >
          {task.title}
        </h4>
      )}

      {/* Details (eye) */}
      {expanded && !editing && (
        <div className="space-y-1.5 rounded-lg bg-muted/50 px-2.5 py-2 text-[11px] text-muted-foreground">
          {task.description ? (
            <p className="whitespace-pre-line leading-relaxed text-foreground/80">{task.description}</p>
          ) : (
            <p className="italic">No description.</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {task.dueDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={11} /> Due {task.dueDate}
              </span>
            )}
            <span className="inline-flex items-center gap-1" title="Your time / everyone's time on this card">
              <Clock size={11} /> You {formatMinutes(task.myLoggedMinutes)} · All {formatMinutes(task.loggedMinutes)}
            </span>
            {task.authorName && <span>Added by {task.authorName}</span>}
          </div>
        </div>
      )}

      {/* Footer: timer + owner avatar */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400 dark:border-neutral-800/80">
        <div className="flex items-center gap-2 text-slate-400">
          <TimerWidget
            instanceId={`whyfi-card-${task.id}`}
            taskId={task.id}
            taskCode={task.code}
            taskTitle={task.title}
            projectId={list.id}
            canStart={canTime}
            disabledReason="This learning task list hasn't been shared with you."
            disabledTitle="Not shared with you"
            onSaveLog={() => run(async () => ({ success: true }))}
          />
          {task.myLoggedMinutes > 0 && (
            <span className="font-mono text-[10px] font-semibold" title="Your logged time on this card">
              {formatMinutes(task.myLoggedMinutes)}
            </span>
          )}
          {task.subtasks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSubtasks((v) => !v)}
              className="flex cursor-pointer items-center gap-1 rounded-full p-1 text-slate-400 transition-all hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-800"
              title={`${task.subtasks.length} subtask${task.subtasks.length > 1 ? "s" : ""} — ${doneSubtasks}/${allSubtasks.length} done incl. nested (click to ${showSubtasks ? "hide" : "view"})`}
            >
              <CheckSquare size={13} />
              <span className="text-[10px] font-bold">
                {doneSubtasks}/{allSubtasks.length}
              </span>
              {showSubtasks ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          )}
        </div>

        {(() => {
          const avatar = (
            <span
              className={cn(
                "relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shadow-2xs ring-2 ring-background transition-transform",
                workspace.isManager && "cursor-pointer hover:scale-105",
                firstOwner
                  ? getAvatarColor(firstOwner.name)
                  : "border border-slate-200/80 bg-slate-100 text-slate-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-500"
              )}
              title={
                task.owners.length > 0
                  ? `Assigned: ${task.owners.map((o) => o.name).join(", ")}`
                  : "Open to everyone on this list"
              }
            >
              {firstOwner ? initials(firstOwner.name) : <UserIcon size={12} />}
              {task.owners.length > 1 && (
                <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground ring-2 ring-background">
                  +{task.owners.length - 1}
                </span>
              )}
            </span>
          );
          return workspace.isManager ? (
            <UserMultiSelect
              side="top"
              users={list.members.length > 0 ? list.members : workspace.users}
              selectedIds={ownerIds}
              title={list.members.length > 0 ? "Assign to people on this list" : "Assign card"}
              onSave={(ids) => run(() => updateWhyfiTaskAction(task.id, { ownerIds: ids }), "Assignees updated")}
              trigger={
                <button type="button" className="rounded-full">
                  {avatar}
                </button>
              }
            />
          ) : (
            avatar
          );
        })()}
      </div>

      {/* Nested subtasks — same card, indented like the project board */}
      {(addingSub || (showSubtasks && task.subtasks.length > 0)) && (
        <div className="relative ml-2.5 mt-1 space-y-2 border-l-2 border-cyan-400/70 pl-3 dark:border-cyan-500/50">
          {addingSub && (
            <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-background p-1.5">
              <input
                autoFocus
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtask();
                  } else if (e.key === "Escape") {
                    setAddingSub(false);
                    setSubTitle("");
                  }
                }}
                placeholder="Subtask name..."
                className="min-w-0 flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={addSubtask}
                disabled={!subTitle.trim()}
                className="flex cursor-pointer items-center gap-1 rounded bg-[#0088ff] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#0077ee] disabled:opacity-50"
              >
                <Plus size={11} /> Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingSub(false);
                  setSubTitle("");
                }}
                className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent"
              >
                <X size={12} />
              </button>
            </div>
          )}
          {showSubtasks &&
            task.subtasks.map((sub) => (
              <div key={sub.id} className="relative">
                <span className="absolute -left-3 top-4 w-3 border-t-2 border-cyan-400/70 dark:border-cyan-500/50" />
                <LearningCard task={sub} list={list} workspace={workspace} run={run} />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Column (one shareable learning task list) ────────────────────────────────

function ListColumn({
  list,
  workspace,
  collapsed,
  onToggleCollapse,
  adding,
  onToggleAdding,
  run,
}: {
  list: WhyfiList;
  workspace: WhyfiWorkspaceData;
  collapsed: boolean;
  onToggleCollapse: () => void;
  adding: boolean;
  onToggleAdding: (open: boolean) => void;
  run: (fn: () => Promise<Result>, okMessage?: string, after?: () => void) => void;
}) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [newTitle, setNewTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(list.name);

  const isMember = list.members.some((m) => m.id === workspace.currentUserId);
  const canAddCards = workspace.isManager || isMember;

  const addCard = () => {
    const title = newTitle.trim();
    if (!title) return;
    run(() => createWhyfiTaskAction(list.id, { title }), "Card added", () => setNewTitle(""));
  };

  const commitRename = () => {
    setRenaming(false);
    const name = nameDraft.trim();
    if (!name || name === list.name) return;
    run(() => updateWhyfiListAction(list.id, { name }), "Task list renamed");
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete "${list.name}"?`,
      description: "The task list and all its cards will be deleted. This can't be undone.",
      confirmLabel: "Delete list",
      danger: true,
    });
    if (ok) run(() => deleteWhyfiListAction(list.id), "Task list deleted");
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-12 shrink-0 flex-col items-center rounded-2xl border border-slate-200/80 bg-slate-100/70 p-2 shadow-2xs transition-all duration-200 dark:border-neutral-800 dark:bg-neutral-900/40">
        <button type="button" onClick={onToggleCollapse} className={cn(ICON_BTN, "mb-2")} title={`Expand ${list.name}`}>
          <ArrowRightToLine size={14} />
        </button>
        <div className="flex flex-1 items-start justify-center">
          <span
            className="whitespace-nowrap text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
          >
            {list.name}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100/70 p-3.5 shadow-2xs transition-all duration-200 dark:border-neutral-800 dark:bg-neutral-900/40">
      {ConfirmDialog}
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-neutral-800">
        <div className="flex items-center gap-2 overflow-hidden">
          {renaming ? (
            <input
              type="text"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="-mx-1 w-[220px] rounded-md border border-primary/50 bg-transparent px-1 py-0.5 text-xs font-extrabold uppercase tracking-wide text-foreground outline-none ring-1 ring-primary/30 transition-all focus:ring-primary"
            />
          ) : (
            <span
              onClick={() => {
                if (!workspace.isManager) return;
                setNameDraft(list.name);
                setRenaming(true);
              }}
              title={workspace.isManager ? "Click to rename task list" : list.name}
              className={cn(
                "-mx-1 max-w-[200px] truncate rounded-md px-1 text-xs font-extrabold uppercase tracking-wide text-foreground transition-colors",
                workspace.isManager && "cursor-text hover:bg-slate-200/60 dark:hover:bg-neutral-800/60"
              )}
            >
              {list.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={onToggleCollapse} className={ICON_BTN} title={`Collapse ${list.name}`}>
            <ArrowLeftToLine size={14} />
          </button>
          {canAddCards && (
            <button
              type="button"
              onClick={() => {
                onToggleAdding(!adding);
                setNewTitle("");
              }}
              className={cn(
                "cursor-pointer rounded p-1 transition-colors",
                adding
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
              )}
              title="Add Task"
            >
              <Plus size={14} />
            </button>
          )}
          {workspace.isManager && (
            <>
              <UserMultiSelect
                users={workspace.users}
                selectedIds={list.members.map((m) => m.id)}
                title={`Share "${list.name}" with`}
                saveLabel="Share"
                onSave={(ids) => run(() => setWhyfiListMembersAction(list.id, ids), "Sharing updated")}
                trigger={
                  <button type="button" className={ICON_BTN} title="Share task list">
                    <Share2 size={14} />
                  </button>
                }
              />
              <button
                type="button"
                onClick={handleDelete}
                className="cursor-pointer rounded p-1 text-slate-500 transition-colors hover:bg-destructive/10 hover:text-destructive"
                title={`Delete ${list.name}`}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Shared-with strip */}
      <div className="-mt-1 mb-3 flex items-center justify-between gap-2 px-0.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users size={11} />
          {list.members.length > 0 ? `Shared with ${list.members.length}` : "Not shared yet"}
        </span>
        <div className="flex -space-x-1.5">
          {list.members.slice(0, 6).map((m) => (
            <Avatar key={m.id} user={m} className="h-5 w-5 text-[9px]" />
          ))}
          {list.members.length > 6 && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold ring-2 ring-background">
              +{list.members.length - 6}
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl pr-1">
        {adding && (
          <div className="animate-in fade-in zoom-in-95 space-y-2.5 rounded-xl border border-slate-700/80 bg-[#16181d] p-3 shadow-md duration-150">
            <textarea
              autoFocus
              rows={3}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addCard();
                } else if (e.key === "Escape") {
                  onToggleAdding(false);
                  setNewTitle("");
                }
              }}
              placeholder="Enter learning task name..."
              className="min-h-[70px] w-full resize-y rounded-lg border border-neutral-700/80 bg-[#111216] p-2.5 text-xs font-medium text-white outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center justify-between gap-2 border-t border-neutral-800 pt-1">
              <span className="font-mono text-[10px] text-neutral-400">↵ Enter to create</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onToggleAdding(false);
                    setNewTitle("");
                  }}
                  className="cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newTitle.trim()}
                  onClick={addCard}
                  className="flex cursor-pointer items-center gap-1 rounded bg-[#0088ff] px-3 py-1 text-[11px] font-bold text-white shadow-xs transition-colors hover:bg-[#0077ee] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={12} />
                  <span>Add Task</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {list.tasks.length === 0 && !adding ? (
          <div className="flex h-36 flex-col items-center justify-center space-y-2 rounded-xl border border-dashed border-slate-300/70 p-6 text-center text-muted-foreground/60 dark:border-neutral-800">
            <span className="text-[11px] font-medium">No learning tasks in this list</span>
            {canAddCards && (
              <button
                type="button"
                onClick={() => onToggleAdding(true)}
                className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <Plus size={12} /> Add Task
              </button>
            )}
          </div>
        ) : (
          list.tasks.map((task) => (
            <LearningCard key={task.id} task={task} list={list} workspace={workspace} run={run} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Learners tab ─────────────────────────────────────────────────────────────

function LearnersView({
  workspace,
  run,
}: {
  workspace: WhyfiWorkspaceData;
  run: (fn: () => Promise<Result>, okMessage?: string, after?: () => void) => void;
}) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-xs">
          <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Task list</th>
              <th className="px-4 py-2.5 font-semibold">Shared with</th>
              <th className="px-4 py-2.5 font-semibold">Cards</th>
              <th className="px-4 py-2.5 font-semibold">Done</th>
              <th className="px-4 py-2.5 font-semibold">Time logged</th>
              {workspace.isManager && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {workspace.lists.map((l) => (
              <tr key={l.id} className="border-b align-top last:border-0">
                <td className="px-4 py-3">
                  <span className="font-semibold text-foreground">{l.name}</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">{l.code}</span>
                </td>
                <td className="px-4 py-3">
                  {l.members.length === 0 ? (
                    <span className="text-muted-foreground">Not shared yet</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {l.members.map((m) => (
                        <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full border bg-background py-0.5 pl-0.5 pr-2">
                          <Avatar user={m} className="h-5 w-5 text-[9px] ring-0" />
                          <span className="text-foreground">{m.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{flattenTasks(l.tasks).length}</td>
                <td className="px-4 py-3 tabular-nums">{flattenTasks(l.tasks).filter((t) => isTaskDone(t.status)).length}</td>
                <td className="px-4 py-3 tabular-nums">
                  {formatMinutes(flattenTasks(l.tasks).reduce((s, t) => s + t.loggedMinutes, 0))}
                </td>
                {workspace.isManager && (
                  <td className="px-4 py-3 text-right">
                    <UserMultiSelect
                      users={workspace.users}
                      selectedIds={l.members.map((m) => m.id)}
                      title={`Share "${l.name}" with`}
                      saveLabel="Share"
                      onSave={(ids) => run(() => setWhyfiListMembersAction(l.id, ids), "Sharing updated")}
                      trigger={
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold hover:bg-accent"
                        >
                          <Share2 size={12} /> Share
                        </button>
                      }
                    />
                  </td>
                )}
              </tr>
            ))}
            {workspace.lists.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No learning task lists yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Effort Logs tab (learning timeline) ──────────────────────────────────────

const RANGE_OPTIONS = [
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
  { days: 30, label: "Last 30 days" },
];

function LearningTimeline({ workspace }: { workspace: WhyfiWorkspaceData }) {
  const [days, setDays] = useState(7);
  const [memberId, setMemberId] = useState("");
  const [entries, setEntries] = useState<WhyfiTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // People who can appear on the timeline: everyone any list is shared with.
  const memberOptions = useMemo(() => {
    const map = new Map<string, WhyfiUser>();
    for (const l of workspace.lists) for (const m of l.members) map.set(m.id, m);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [workspace.lists]);

  useEffect(() => {
    let cancelled = false;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    setLoading(true);
    getWhyfiTimelineAction({ from: isoDay(from), to: isoDay(to), userId: memberId || undefined })
      .then((res) => {
        if (!cancelled) setEntries(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, memberId]);

  const byDay = useMemo(() => {
    const groups = new Map<string, WhyfiTimelineEntry[]>();
    for (const e of entries) {
      const key = isoDay(new Date(e.date));
      groups.set(key, [...(groups.get(key) || []), e]);
    }
    return [...groups.entries()];
  }, [entries]);

  const byMember = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; cards: Set<string>; lastDate: string }>();
    for (const e of entries) {
      const cur = map.get(e.userId) || { name: e.userName, minutes: 0, cards: new Set<string>(), lastDate: e.date };
      cur.minutes += e.minutes;
      cur.cards.add(e.taskId);
      if (e.date > cur.lastDate) cur.lastDate = e.date;
      map.set(e.userId, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].minutes - a[1].minutes);
  }, [entries]);

  const total = entries.reduce((s, e) => s + e.minutes, 0);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
        >
          {RANGE_OPTIONS.map((o) => (
            <option key={o.days} value={o.days}>
              {o.label}
            </option>
          ))}
        </select>
        {workspace.isManager && (
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All team members</option>
            {memberOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          Total learning time: <span className="font-semibold text-foreground">{formatMinutes(total)}</span>
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          No learning time logged in this period.
        </div>
      ) : (
        <>
          {workspace.isManager && !memberId && byMember.length > 0 && (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Member</th>
                    <th className="px-3 py-2 font-semibold">Time</th>
                    <th className="px-3 py-2 font-semibold">Cards worked on</th>
                    <th className="px-3 py-2 font-semibold">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {byMember.map(([id, m]) => (
                    <tr
                      key={id}
                      onClick={() => setMemberId(id)}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2 font-medium text-foreground">{m.name}</td>
                      <td className="px-3 py-2 tabular-nums">{formatMinutes(m.minutes)}</td>
                      <td className="px-3 py-2 tabular-nums">{m.cards.size}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDay(m.lastDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ol className="relative ml-2 space-y-5 border-l pl-5">
            {byDay.map(([day, items]) => (
              <li key={day} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-foreground">{formatDay(`${day}T12:00:00`)}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatMinutes(items.reduce((s, e) => s + e.minutes, 0))}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {items.map((e) => (
                    <li
                      key={e.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-3 py-2 text-xs"
                    >
                      {workspace.isManager && !memberId && (
                        <span className="font-semibold text-foreground">{e.userName}</span>
                      )}
                      <span className="font-mono text-[11px] text-muted-foreground">{e.taskCode}</span>
                      <span className="min-w-0 flex-1 truncate text-foreground">{e.taskTitle}</span>
                      <span className="text-muted-foreground">{e.listName}</span>
                      <span
                        className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-bold", statusBadgeClass(e.taskStatus))}
                      >
                        {e.taskStatus}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">{formatMinutes(e.minutes)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

// ── Workspace ─────────────────────────────────────────────────────────────────

type Tab = "TASKS" | "LEARNERS" | "EFFORT";

export function WhyfiWorkspace({ initial }: { initial: WhyfiWorkspaceData }) {
  const [workspace, setWorkspace] = useState(initial);
  const [tab, setTab] = useState<Tab>("TASKS");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [addingListId, setAddingListId] = useState<string | null>(null);
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const next = await getWhyfiWorkspaceAction();
    if (next) setWorkspace(next);
  }, []);

  /** Runs a mutation, toasts the outcome, and reloads the board. */
  const run = useCallback(
    (fn: () => Promise<Result>, okMessage?: string, after?: () => void) =>
      startTransition(async () => {
        const res = await fn();
        if (!res.success) {
          toast.error(res.error || "Something went wrong");
          return;
        }
        if (okMessage) toast.success(okMessage);
        after?.();
        await reload();
      }),
    [reload]
  );

  const createList = () => {
    const name = newListName.trim();
    if (!name) return;
    run(() => createWhyfiListAction({ name }), "Task list created — share it with your team", () => {
      setNewListName("");
      setIsAddingList(false);
    });
  };

  // Counts include subtasks at every depth, like the project board's totals.
  const allTasks = workspace.lists.flatMap((l) => flattenTasks(l.tasks));
  const doneCount = allTasks.filter((t) => isTaskDone(t.status)).length;
  const completion = allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;
  const assignedToMe = allTasks.filter((t) => t.owners.some((o) => o.id === workspace.currentUserId)).length;
  const allCollapsed = workspace.lists.length > 0 && workspace.lists.every((l) => collapsedIds.has(l.id));

  // "Add Task" in the toolbar opens the quick-add box on the first list the user can add to.
  const firstAddableList = workspace.lists.find(
    (l) => workspace.isManager || l.members.some((m) => m.id === workspace.currentUserId)
  );

  return (
    <ActiveTimerProvider>
      <div className="flex h-full w-full flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="flex flex-col justify-between gap-3 border-b bg-card px-6 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <GraduationCap size={18} />
            </span>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-muted-foreground">WL</span>
                <h1 className="text-base font-bold tracking-tight text-foreground">Whyfi School</h1>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {workspace.isManager ? "Manager view" : "Shared with you"} &bull; Lists:{" "}
                <span className="font-semibold text-foreground">{workspace.lists.length}</span> &bull;{" "}
                {doneCount}/{allTasks.length} Tasks Completed ({completion}%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 text-xs">
            <button type="button" onClick={() => setTab("TASKS")} className={TAB_CLASS(tab === "TASKS")}>
              <ListTodo size={14} />
              <span>Tasks</span>
            </button>
            <button type="button" onClick={() => setTab("LEARNERS")} className={TAB_CLASS(tab === "LEARNERS")}>
              <Users size={14} />
              <span>Learners</span>
            </button>
            <button type="button" onClick={() => setTab("EFFORT")} className={TAB_CLASS(tab === "EFFORT")}>
              <Clock size={14} />
              <span>Effort Logs</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "LEARNERS" && <LearnersView workspace={workspace} run={run} />}
          {tab === "EFFORT" && <LearningTimeline workspace={workspace} />}

          {tab === "TASKS" && (
            <div className="flex h-full flex-col">
              {/* Toolbar */}
              <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-2.5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedIds(allCollapsed ? new Set() : new Set(workspace.lists.map((l) => l.id)))
                    }
                    className="cursor-pointer rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title={allCollapsed ? "Expand All Lists" : "Collapse All Lists"}
                  >
                    {allCollapsed ? <ArrowRightToLine size={15} /> : <ArrowLeftToLine size={15} />}
                  </button>
                  {pending && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                </div>
                {firstAddableList && (
                  <button
                    type="button"
                    onClick={() => {
                      setCollapsedIds((prev) => {
                        const next = new Set(prev);
                        next.delete(firstAddableList.id);
                        return next;
                      });
                      setAddingListId(firstAddableList.id);
                    }}
                    className="ml-1 flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0088ff] px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#0077ee]"
                  >
                    <Plus size={16} />
                    <span>Add Task</span>
                  </button>
                )}
              </div>

              {/* Board */}
              <div className="dsm-columns-scrollbar min-h-0 flex-1 overflow-x-auto bg-slate-50/50 p-4.5 dark:bg-background/40">
                <div className="flex h-full items-stretch gap-3.5">
                  {workspace.lists.map((list) => (
                    <ListColumn
                      key={list.id}
                      list={list}
                      workspace={workspace}
                      collapsed={collapsedIds.has(list.id)}
                      onToggleCollapse={() =>
                        setCollapsedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(list.id)) next.delete(list.id);
                          else next.add(list.id);
                          return next;
                        })
                      }
                      adding={addingListId === list.id}
                      onToggleAdding={(open) => setAddingListId(open ? list.id : null)}
                      run={run}
                    />
                  ))}

                  {workspace.lists.length === 0 && !workspace.isManager && (
                    <div className="flex h-36 w-[360px] shrink-0 items-center justify-center rounded-2xl border border-dashed text-center text-xs text-muted-foreground">
                      No learning task lists have been shared with you yet.
                    </div>
                  )}

                  {/* Create Task List column (managers) */}
                  {workspace.isManager &&
                    (!isAddingList ? (
                      <div className="flex h-full w-[300px] shrink-0 flex-col justify-start rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-3.5 shadow-2xs transition-all duration-200 hover:border-primary/50 dark:border-neutral-800 dark:bg-neutral-900/30">
                        <button
                          type="button"
                          onClick={() => setIsAddingList(true)}
                          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-4 text-xs font-bold text-primary shadow-2xs transition-all hover:bg-primary/10 hover:shadow-xs dark:text-sky-400"
                        >
                          <span>Create Task List</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-full w-[340px] shrink-0 flex-col space-y-3 rounded-2xl border border-slate-300 bg-card p-4 shadow-md transition-all duration-200 dark:border-neutral-700 dark:bg-[#16181d]">
                        <div className="flex items-center justify-between border-b border-border pb-2.5 dark:border-neutral-800">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                            <Layers size={14} className="text-[#0088ff]" />
                            <span>Create Task List</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingList(false);
                              setNewListName("");
                            }}
                            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="text-xs">
                          <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                            Task List Name <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            autoFocus
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            placeholder="e.g. REACT BASICS, SEO FUNDAMENTALS"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newListName.trim()) {
                                e.preventDefault();
                                createList();
                              } else if (e.key === "Escape") {
                                setIsAddingList(false);
                              }
                            }}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
                          />
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            After creating it, use the share icon on the list to choose who can see it.
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-border pt-2 dark:border-neutral-800">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingList(false);
                              setNewListName("");
                            }}
                            className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!newListName.trim() || pending}
                            onClick={createList}
                            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-[#0088ff] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#0077ee] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {pending && <Loader2 size={13} className="animate-spin" />}
                            <span>Create List</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Footer bar */}
              <div className="flex shrink-0 items-center justify-between border-t border-border bg-card px-6 py-2.5 text-xs font-semibold text-muted-foreground shadow-2xs">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-3.5 py-1 font-bold text-sky-600 dark:text-sky-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
                  <span>LEARNING: {completion}% COMPLETE</span>
                </div>
                <div className="flex items-center gap-5 text-[11px]">
                  <span>
                    TOTAL COUNT: <strong className="text-foreground">{allTasks.length} TASKS</strong>
                  </span>
                  <span>
                    ASSIGNED TO ME: <strong className="text-foreground">{assignedToMe}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ActiveTimerProvider>
  );
}
