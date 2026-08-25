"use client";

import { useActionState, useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown,
  CheckCircle2, CheckCheck, AlertCircle, Calendar, Handshake,
  Pencil, Trash2, X, Check, Plus,
  PenIcon, GraduationCap, Loader2, Info,
} from "lucide-react";
import { cn, toTitleCase } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { SupportNeededIcon } from "@/components/icons/support-needed-icon";
import { reviewStandup, type ReviewStandupState } from "../actions/review-standup";
import { setTaskPriority, type SetTaskPriorityState } from "../actions/set-task-priority";
import { editTask, type EditTaskState } from "../actions/edit-task";
import { deleteTask, type DeleteTaskState } from "../actions/delete-task";
import { addTask, type AddTaskState } from "../actions/add-task";
import { updateLearningText, type UpdateLearningState } from "../actions/update-learning";
import { editBlocker, type EditBlockerState } from "@/features/blockers/actions/edit-blocker";
import { deleteBlocker, type DeleteBlockerState } from "@/features/blockers/actions/delete-blocker";
import { addBlocker, type AddBlockerState } from "@/features/blockers/actions/add-blocker";
import { editSupport, type EditSupportState } from "@/features/support-needed/actions/edit-support";
import { deleteSupport, type DeleteSupportState } from "@/features/support-needed/actions/delete-support";
import { addSupport, type AddSupportState } from "@/features/support-needed/actions/add-support";
import { reviewStatus, relativeDayLabel, formatShortDate, formatFullDate, formatFullDateTime, getWeekRange, formatWeekRange } from "@/features/dsm/utils";
import type { MemberReview, MemberReviewEntry } from "../queries";
import type { TeamMember } from "@/features/dsm/queries";
import { MentionInput } from "@/components/shared/mention-input";
import { renderTextWithMentions } from "@/components/shared/mention-text";
import { EventDialog } from "@/features/calendar/components/event-dialog";
import { TaskAuditHistoryPopover } from "@/features/dsm/components/task-audit-history-popover";
import { deleteCalendarEvent, type DeleteEventState } from "@/features/calendar/actions/delete-event";
import { linkSupportNeedEvent } from "@/features/support-needed/actions/link-support-event";
import type { CalendarEventView } from "@/features/calendar/queries";


function supportEventToView(event: {
  id: string;
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  isAllDay: boolean;
  updatedAt: Date;
  organizer: { email: string } | null;
  attendees: { email: string; status: string }[];
}): CalendarEventView {
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

// ── Priority helpers ──────────────────────────────────────────────────────────

/** Priority levels for a given task count — exactly one level per task, unbounded */
function priorityLevels(taskCount: number): string[] {
  const n = Math.max(taskCount, 0);
  return Array.from({ length: n }, (_, i) => `P${i + 1}`);
}

/** Priority → colour classes, cycling through a palette for any number of levels */
const PRIORITY_COLOR_CYCLE = [
  "bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800",
  "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  "bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800",
  "bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-800",
  "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  "bg-pink-50 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-800",
  "bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800",
  "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800",
  "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800",
  "bg-lime-50 dark:bg-lime-500/15 text-lime-700 dark:text-lime-300 border-lime-300 dark:border-lime-800",
];
function priorityColor(p: string): string {
  const n = parseInt(p.slice(1), 10);
  if (!Number.isFinite(n) || n < 1) return PRIORITY_COLOR_CYCLE[2];
  return PRIORITY_COLOR_CYCLE[(n - 1) % PRIORITY_COLOR_CYCLE.length];
}

/** Sort tasks by managerPriority: P1 < P2 < P3 < unset */
function sortByPriority<T extends { managerPriority?: string | null }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const an = a.managerPriority ? parseInt(a.managerPriority.slice(1)) : Infinity;
    const bn = b.managerPriority ? parseInt(b.managerPriority.slice(1)) : Infinity;
    return an - bn;
  });
}

// ── Priority dropdown ─────────────────────────────────────────────────────────

function PriorityDropdown({
  taskId,
  current,
  takenPriorities,
  totalTasks,
}: {
  taskId: string;
  current: string | null;
  takenPriorities: string[]; // priorities held by OTHER tasks
  totalTasks: number; // number of priority levels to offer (one per task)
}) {
  const [state, action, pending] = useActionState<SetTaskPriorityState, FormData>(setTaskPriority, {});
  const [, startTransition] = useTransition();

  // Available = priorityLevels(totalTasks) minus priorities taken by OTHER tasks
  // The current task's own priority is always available (it can keep or change it)
  const available = priorityLevels(totalTasks).filter((p) => !takenPriorities.includes(p) || p === current);

  return (
    <div className="flex flex-col items-end gap-0.5">
      <form action={action} className="relative flex items-center">
        <input type="hidden" name="taskId" value={taskId} />
        <select
          name="priority"
          value={current ?? ""}
          onChange={(e) => {
            const form = e.currentTarget.form;
            if (form) {
              const fd = new FormData(form);
              fd.set("priority", e.currentTarget.value);
              startTransition(() => action(fd));
            }
          }}

          disabled={pending}
          className={cn(
            "appearance-none rounded-lg border py-1.5 pl-3 pr-7 text-xs outline-none transition-colors cursor-pointer",
            current ? priorityColor(current) : "border-border bg-background text-muted-foreground"
          )}
        >
          <option value="">Set Priority</option>
          {available.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-2 text-current opacity-60" />
      </form>
      {/* Conflict / error feedback */}
      {state.message && state.message !== "updated" && (
        <p className="text-xs text-destructive leading-tight max-w-[140px] text-right">
          {state.message}
        </p>
      )}
    </div>
  );
}


// ── Manager: Edit task inline ─────────────────────────────────────────────────

function EditTaskRow({ taskId, text }: { taskId: string; text: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<EditTaskState, FormData>(editTask, {});
  const inputRef = useRef<HTMLInputElement>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Edit task"
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Pencil size={13} />
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setEditing(false);
      }}
      className="flex flex-1 items-center gap-1.5"
    >
      <input type="hidden" name="taskId" value={taskId} />
      <input
        ref={inputRef}
        name="text"
        defaultValue={text}
        autoFocus
        className="flex-1 rounded border bg-background px-2 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={pending}
        title="Save"
        className="rounded-md bg-success/10 p-1.5 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        title="Cancel"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
      >
        <X size={16} strokeWidth={2} />
      </button>
    </form>
  );
}

// ── Manager: Delete task ──────────────────────────────────────────────────────

function DeleteTaskButton({ taskId }: { taskId: string }) {
  const [, action, pending] = useActionState<DeleteTaskState, FormData>(deleteTask, {});

  return (
    <form action={action}>
      <input type="hidden" name="taskId" value={taskId} />
      <button
        type="submit"
        disabled={pending}
        title="Remove task"
        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </form>
  );
}

// ── Manager: Add task ─────────────────────────────────────────────────────────

function AddTaskRow({ entryId, kind = "TODAY" }: { entryId: string; kind?: "TODAY" | "YESTERDAY" }) {
  const [adding, setAdding] = useState(false);
  const [priority, setPriority] = useState<string>("P1");
  const [state, action, pending] = useActionState<AddTaskState, FormData>(addTask, {});
  const inputRef = useRef<HTMLInputElement>(null);

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-2.5 flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed py-2 text-xs font-medium text-primary/70 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
      >
        <Plus size={13} className="dark:text-[#93C5FD]" /> Add Task
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setAdding(false);
      }}
      className="mt-2 flex flex-col gap-1.5 rounded-lg border p-2 bg-background"
    >
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="priority" value={priority} />

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          name="text"
          placeholder="Type new task description..."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputRef.current?.value.trim()) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="flex-1 rounded border px-2.5 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-md border bg-card px-2 py-1 text-xs font-semibold text-foreground outline-none cursor-pointer"
          title="Select Priority"
        >
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Med</option>
          <option value="LOW">Low</option>
        </select>

        <button
          type="submit"
          disabled={pending}
          title="Add task"
          className="rounded-md bg-success/10 p-1.5 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
        </button>
        <button
          type="button"
          onClick={() => setAdding(false)}
          title="Cancel"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      {state.message && state.message !== "created" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
    </form>
  );
}

// ── Manager: Edit Blocker ───────────────────────────────────────────────────

function EditBlockerRow({
  blockerId,
  initialText,
  initialMentionedUserId,
  initialMentionedUser,
  editedBy,
  teamMembers = [],
}: {
  blockerId: string;
  initialText: string;
  initialMentionedUserId?: string | null;
  initialMentionedUser?: { id: string; name: string | null; email: string } | null;
  editedBy?: { id: string; name: string | null; email: string } | null;
  teamMembers?: TeamMember[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [prevInitialText, setPrevInitialText] = useState(initialText);
  const [resetToken, setResetToken] = useState(0);

  const getInitialIds = () => {
    if (initialMentionedUserId) return initialMentionedUserId.split(",").filter(Boolean);
    if (initialMentionedUser?.id) return [initialMentionedUser.id];
    return [];
  };

  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>(getInitialIds);
  const [, action, pending] = useActionState<EditBlockerState, FormData>(editBlocker, {});

  if (initialText !== prevInitialText) {
    setPrevInitialText(initialText);
    setMentionedUserIds(getInitialIds());
    setResetToken((t) => t + 1);
  }

  const mentionedMembers = mentionedUserIds
    .map((id) => teamMembers.find((m) => m.id === id) ?? (initialMentionedUser?.id === id ? initialMentionedUser : null))
    .filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined);

  if (!editing) {
    return (
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <div className="flex flex-1 items-center gap-1 min-w-0">
            <span className="text-sm leading-snug text-destructive/90 truncate">
              {renderTextWithMentions(initialText, mentionedMembers, "font-semibold text-destructive")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Edit blocker"
            className="flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:hover:bg-[#1E293B]"
          >
            <Pencil size={12} />
            Edit
          </button>
        </div>
        {editedBy && (
          <span className="text-[10px] text-muted-foreground/70">
            Edited by {editedBy.name?.split(" ")[0] ?? editedBy.email.split("@")[0]}
          </span>
        )}
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setEditing(false);
        router.refresh();
      }}
      className="flex flex-1 items-center gap-1.5"
    >
      <input type="hidden" name="blockerId" value={blockerId} />
      <input type="hidden" name="mentionedUserId" value={mentionedUserIds.join(",")} />

      <div className="flex-1 rounded-md border bg-background px-2.5 py-1">
        <MentionInput
          key={resetToken}
          name="text"
          defaultValue={initialText}
          defaultMentions={mentionedMembers}
          onChange={(text, ids) => setMentionedUserIds(ids)}
          autoFocus
          placeholder="Edit blocker... (@ to mention member)"
          teamMembers={teamMembers}
          className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent text-sm font-normal text-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        title="Save"
        className="rounded-md bg-success/10 p-1.5 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setMentionedUserIds(getInitialIds());
        }}
        title="Cancel"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
      >
        <X size={16} strokeWidth={2} />
      </button>
    </form>
  );
}

function DeleteBlockerButton({ blockerId }: { blockerId: string }) {
  const [, action, pending] = useActionState<DeleteBlockerState, FormData>(deleteBlocker, {});
  return (
    <form action={action}>
      <input type="hidden" name="blockerId" value={blockerId} />
      <button
        type="submit"
        disabled={pending}
        title="Remove blocker"
        className="rounded p-1 text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </form>
  );
}


function AddBlockerRow({ entryId, teamMembers = [] }: { entryId: string; teamMembers?: TeamMember[] }) {
  const [adding, setAdding] = useState(false);
  const [state, action, pending] = useActionState<AddBlockerState, FormData>(addBlocker, {});
  const [text, setText] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-2.5 flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed border-destructive/40 py-2 text-xs font-medium text-destructive transition-colors hover:border-destructive hover:bg-destructive/10 dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
      >
        <Plus size={13} className="dark:text-[#93C5FD]" /> Add Blocker
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setAdding(false);
        setText("");
        setMentionedUserIds([]);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget) && text.trim()) {
          e.currentTarget.requestSubmit();
        }
      }}
      className="mt-2 flex items-center gap-1.5"
    >
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="mentionedUserId" value={mentionedUserIds.join(",")} />

      <div className="flex-1 rounded-md border bg-card px-2.5 py-1.5">
        <MentionInput
          name="text"
          onChange={(v, ids) => {
            setText(v);
            setMentionedUserIds(ids);
          }}
          autoFocus
          placeholder="Describe blocker... (@ to mention team members)"
          teamMembers={teamMembers}
          className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent text-sm font-normal text-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        title="Add blocker"
        className="rounded-md bg-success/10 p-1.5 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
      </button>
      <button
        type="button"
        onClick={() => {
          setAdding(false);
          setMentionedUserIds([]);
        }}
        title="Cancel"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
      >
        <X size={16} strokeWidth={2} />
      </button>
      {state.message && state.message !== "created" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
    </form>
  );
}

// ── Manager: Edit Support Needed ─────────────────────────────────────────────

function EditSupportRow({
  supportId,
  initialText,
  initialMentionedUserId,
  initialMentionedUser,
  editedBy,
  teamMembers = [],
}: {
  supportId: string;
  initialText: string;
  initialMentionedUserId?: string | null;
  initialMentionedUser?: { id: string; name: string | null; email: string } | null;
  editedBy?: { id: string; name: string | null; email: string } | null;
  teamMembers?: TeamMember[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [prevInitialText, setPrevInitialText] = useState(initialText);
  const [resetToken, setResetToken] = useState(0);

  const getInitialIds = () => {
    if (initialMentionedUserId) return initialMentionedUserId.split(",").filter(Boolean);
    if (initialMentionedUser?.id) return [initialMentionedUser.id];
    return [];
  };

  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>(getInitialIds);
  const [, action, pending] = useActionState<EditSupportState, FormData>(editSupport, {});

  if (initialText !== prevInitialText) {
    setPrevInitialText(initialText);
    setMentionedUserIds(getInitialIds());
    setResetToken((t) => t + 1);
  }

  const mentionedMembers = mentionedUserIds
    .map((id) => teamMembers.find((m) => m.id === id) ?? (initialMentionedUser?.id === id ? initialMentionedUser : null))
    .filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined);

  if (!editing) {
    return (
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <div className="flex flex-1 items-center gap-1 min-w-0">
            <span className="text-sm leading-snug text-foreground/90 truncate">
              {renderTextWithMentions(initialText, mentionedMembers, "font-semibold text-info")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Edit support need"
            className="flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium text-info/80 hover:bg-info/10 hover:text-info transition-colors dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:hover:bg-[#1E293B]"
          >
            <Pencil size={12} />
            Edit
          </button>
        </div>
        {editedBy && (
          <span className="text-[10px] text-muted-foreground/70">
            Edited by {editedBy.name?.split(" ")[0] ?? editedBy.email.split("@")[0]}
          </span>
        )}
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setEditing(false);
        router.refresh();
      }}
      className="flex flex-1 items-center gap-1.5"
    >
      <input type="hidden" name="supportId" value={supportId} />
      <input type="hidden" name="mentionedUserId" value={mentionedUserIds.join(",")} />

      <div className="flex-1 rounded-md border bg-background px-2.5 py-1">
        <MentionInput
          key={resetToken}
          name="text"
          defaultValue={initialText}
          defaultMentions={mentionedMembers}
          onChange={(text, ids) => setMentionedUserIds(ids)}
          autoFocus
          placeholder="Edit support need... (@ to mention member)"
          teamMembers={teamMembers}
          className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent text-sm font-normal text-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        title="Save"
        className="rounded-md bg-success/10 p-1.5 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setMentionedUserIds(getInitialIds());
        }}
        title="Cancel"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
      >
        <X size={16} strokeWidth={2} />
      </button>
    </form>
  );
}

function ScheduledMeetingActions({
  event,
  supportId,
  fallbackTitle,
  onEdit,
  onDeleted,
}: {
  event?: CalendarEventView | null;
  supportId: string;
  fallbackTitle?: string;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [state, action, pending] = useActionState<DeleteEventState, FormData>(deleteCalendarEvent, {});

  useEffect(() => {
    if (state.message === "deleted") onDeleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.message]);

  const displayTitle = event?.title || fallbackTitle;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {displayTitle && (
        <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[140px]" title={displayTitle}>
          {displayTitle}
        </span>
      )}
      <button
        type="button"
        onClick={onEdit}
        title="Edit meeting"
        className="flex items-center gap-1.5 rounded-lg border border-border bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
      >
        <Pencil size={11} className="text-muted-foreground" />
        Edit Meeting
      </button>
      {/* <form action={action}>
        <input type="hidden" name="eventId" value={event?.id ?? ""} />
        <input type="hidden" name="etag" value={String(event?.etag ?? 1)} />
        <input type="hidden" name="supportNeedId" value={supportId} />
        <button
          type="submit"
          disabled={pending}
          onClick={onDeleted}
          title="Delete meeting"
          className="flex items-center gap-1 rounded-lg border border-border bg-transparent hover:bg-destructive/10 text-muted-foreground hover:text-destructive px-2 py-1 text-[11px] font-semibold transition-all disabled:opacity-50 cursor-pointer"
        >
          {pending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
        </button>
      </form> */}
    </div>
  );
}

function DeleteSupportButton({ supportId }: { supportId: string }) {
  const [, action, pending] = useActionState<DeleteSupportState, FormData>(deleteSupport, {});
  return (
    <form action={action}>
      <input type="hidden" name="supportId" value={supportId} />
      <button
        type="submit"
        disabled={pending}
        title="Remove support need"
        className="rounded p-1 text-info/70 hover:bg-info/10 hover:text-info transition-colors"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </form>
  );
}


function AddSupportRow({
  entryId,
  teamMembers = [],
  onScheduleMeeting,
}: {
  entryId: string;
  teamMembers?: TeamMember[];
  onScheduleMeeting?: (
    title: string,
    participantIds: string[],
    onCreated?: (eventView: CalendarEventView) => void
  ) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [state, action, pending] = useActionState<AddSupportState, FormData>(addSupport, {});
  const [text, setText] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [scheduledEvent, setScheduledEvent] = useState<CalendarEventView | null>(null);

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-2.5 flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed border-info/40 py-2 text-xs font-medium text-info transition-colors hover:border-info hover:bg-info/10 dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
      >
        <Plus size={13} className="dark:text-[#93C5FD]" /> Add Support Needed
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setAdding(false);
        setText("");
        setMentionedUserIds([]);
        setScheduledEvent(null);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget) && text.trim()) {
          e.currentTarget.requestSubmit();
        }
      }}
      className="mt-2 flex flex-col gap-2 rounded-lg border border-info/30 bg-card p-3 shadow-xs"
    >
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="mentionedUserId" value={mentionedUserIds.join(",")} />
      {scheduledEvent?.id && <input type="hidden" name="eventId" value={scheduledEvent.id} />}

      <div className="rounded-md border bg-background px-2.5 py-1.5">
        <MentionInput
          name="text"
          onChange={(v, ids) => {
            setText(v);
            setMentionedUserIds(ids);
          }}
          autoFocus
          placeholder="Describe support needed... (@ to mention team members)"
          teamMembers={teamMembers}
          className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent text-sm font-normal text-foreground"
        />
      </div>

      <div className="flex items-center justify-between border-t pt-2 border-info/20">
        <div className="flex items-center gap-2">
          {scheduledEvent ? (
            <ScheduledMeetingActions
              event={scheduledEvent}
              supportId=""
              fallbackTitle={text.trim() ? `Support Needed: ${text.trim()}` : "Support Needed Meeting"}
              onEdit={() => {
                const titleText = text.trim() ? `Support Needed: ${text.trim()}` : "Support Needed Meeting";
                onScheduleMeeting?.(titleText, mentionedUserIds, (createdView) => setScheduledEvent(createdView));
              }}
              onDeleted={() => setScheduledEvent(null)}
            />
          ) : (
            onScheduleMeeting && (
              <button
                type="button"
                onClick={() => {
                  const titleText = text.trim() ? `Support Needed: ${text.trim()}` : "Support Needed Meeting";
                  onScheduleMeeting(titleText, mentionedUserIds, (createdView) => setScheduledEvent(createdView));
                }}
                className="flex items-center gap-1.5 text-[11px] font-semibold rounded-lg border border-border bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground px-2.5 py-1 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Calendar size={12} className="text-muted-foreground" />
                Schedule Meeting
              </button>
            )
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="submit"
            disabled={pending}
            title="Add support"
            className="rounded-md bg-success/10 p-1.5 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setText("");
              setMentionedUserIds([]);
              setScheduledEvent(null);
            }}
            title="Cancel"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
      {state.message && state.message !== "created" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
    </form>
  );
}

// ── Review button ─────────────────────────────────────────────────────────────

function ReviewButton({ entryId }: { entryId: string }) {
  const [state, action, pending] = useActionState<ReviewStandupState, FormData>(reviewStandup, {});

  if (state.message === "reviewed") {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
        <CheckCheck size={16} /> Reviewed
      </div>
    );
  }

  return (
    <form action={action} className="w-full">
      <input type="hidden" name="entryId" value={entryId} />
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] dark:text-[#F8FAFC]"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
        {pending ? "Reviewing…" : "Reviewed ✓"}
      </button>
    </form>
  );
}

// ── Helper: Get yesterday tasks (explicit or fallback to previous entry's TODAY tasks) ──

function getYesterdayTasksForEntry(
  entry: MemberReviewEntry,
  allEntries: MemberReviewEntry[] = []
): { id?: string; text: string; isCompleted: boolean }[] {
  const explicitYesterday = entry.tasks.filter((t) => t.kind === "YESTERDAY");
  if (explicitYesterday.length > 0) {
    return explicitYesterday.map((t) => ({
      id: t.id,
      text: t.text,
      isCompleted: true,
    }));
  }

  const entryTime = new Date(entry.date).getTime();
  const prevEntry = allEntries
    .filter((e) => new Date(e.date).getTime() < entryTime && e.status !== "MISSED")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  if (prevEntry) {
    const prevTodayTasks = prevEntry.tasks.filter((t) => t.kind === "TODAY");
    const currentTodayTasksText = entry.tasks
      .filter((t) => t.kind === "TODAY")
      .map((t) => t.text.trim().toLowerCase());

    return prevTodayTasks.map((t) => {
      const isCarriedOver = currentTodayTasksText.includes(t.text.trim().toLowerCase());
      return {
        id: t.id,
        text: t.text,
        isCompleted: !isCarriedOver,
      };
    });
  }

  return [];
}

function isTaskCarriedOver(
  taskText: string,
  entry: MemberReviewEntry,
  allEntries: MemberReviewEntry[] = []
): boolean {
  const entryTime = new Date(entry.date).getTime();
  const prevEntry = allEntries
    .filter((e) => new Date(e.date).getTime() < entryTime && e.status !== "MISSED")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  if (!prevEntry) return false;

  const prevTodayTasksText = prevEntry.tasks
    .filter((t) => t.kind === "TODAY")
    .map((t) => t.text.trim().toLowerCase());

  return prevTodayTasksText.includes(taskText.trim().toLowerCase());
}

/** Find the most recent *submitted* entry strictly before the given entry's date. */
function getPrevEntry(entry: MemberReviewEntry, allEntries: MemberReviewEntry[] = []): MemberReviewEntry | undefined {
  const entryTime = new Date(entry.date).getTime();
  return allEntries
    .filter((e) => new Date(e.date).getTime() < entryTime && e.status !== "MISSED")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

export type TaskCarryLink = { date: Date; task: MemberReviewEntry["tasks"][number] };

/**
 * Walk backwards day-by-day through carried-over occurrences of the same TODAY
 * task text and return the full chain, oldest first, ending with today's own
 * row. Each day's carried-over task is a distinct DB row (its own
 * createdAt/addedBy/editedBy), so the chain is reconstructed by text match —
 * this lets the UI preserve "originally created" info even though the current
 * row's own createdAt reflects only the day it was last (re)submitted.
 */
function getTaskCarryChain(
  taskText: string,
  entry: MemberReviewEntry,
  allEntries: MemberReviewEntry[] = []
): TaskCarryLink[] {
  const norm = taskText.trim().toLowerCase();
  const matchIn = (e: MemberReviewEntry) =>
    e.tasks.find((t) => t.kind === "TODAY" && t.text.trim().toLowerCase() === norm);

  const chain: TaskCarryLink[] = [];
  let currentEntry: MemberReviewEntry | undefined = entry;
  let currentMatch = matchIn(entry);
  while (currentEntry && currentMatch) {
    chain.unshift({ date: currentEntry.date, task: currentMatch });
    const prevEntry = getPrevEntry(currentEntry, allEntries);
    const prevMatch = prevEntry ? matchIn(prevEntry) : undefined;
    if (!prevEntry || !prevMatch) break;
    currentEntry = prevEntry;
    currentMatch = prevMatch;
  }
  return chain;
}

function isBlockerCarriedOver(
  blockerText: string,
  entry: MemberReviewEntry,
  allEntries: MemberReviewEntry[] = []
): boolean {
  const prevEntry = getPrevEntry(entry, allEntries);
  if (!prevEntry) return false;
  const prevBlockerText = prevEntry.blockers
    .filter((b) => !b.resolved)
    .map((b) => b.text.trim().toLowerCase());
  return prevBlockerText.includes(blockerText.trim().toLowerCase());
}

function isSupportCarriedOver(
  supportText: string,
  entry: MemberReviewEntry,
  allEntries: MemberReviewEntry[] = []
): boolean {
  const prevEntry = getPrevEntry(entry, allEntries);
  if (!prevEntry) return false;
  const prevSupportText = prevEntry.supportNeeds
    .filter((s) => !s.resolved)
    .map((s) => s.text.trim().toLowerCase());
  return prevSupportText.includes(supportText.trim().toLowerCase());
}

function isLearningCarriedOver(
  learningLine: string,
  entry: MemberReviewEntry,
  allEntries: MemberReviewEntry[] = []
): boolean {
  const prevEntry = getPrevEntry(entry, allEntries);
  if (!prevEntry?.learningText) return false;
  const prevLines = prevEntry.learningText.split("\n").map((l) => l.trim().toLowerCase()).filter(Boolean);
  return prevLines.includes(learningLine.trim().toLowerCase());
}

// ── Compact entry preview (collapsed state) ───────────────────────────────────

function CompactEntryPreview({ entry, allEntries = [] }: { entry: MemberReviewEntry; allEntries?: MemberReviewEntry[] }) {
  const yesterdayTasks = getYesterdayTasksForEntry(entry, allEntries);
  const todayTasks = entry.tasks.filter((t) => t.kind === "TODAY");
  const hasFollowUps = entry.supportNeeds.length > 0;
  const hasBlockers = entry.blockers.length > 0;

  return (
    <div className="space-y-3 px-4 pb-4 pt-3">
      {yesterdayTasks.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Yesterday&apos;s Tasks
          </p>
          <div className="space-y-1.5">
            {yesterdayTasks.map((task, i) => (
              <div key={task.id || i} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold",
                    task.isCompleted ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  )}
                >
                  Y{i + 1}
                </span>
                <span className="text-sm leading-snug text-foreground/80 truncate">{task.text}</span>
                {!task.isCompleted && (
                  <span className="shrink-0 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-bold tracking-wide uppercase text-warning">
                    CO
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {todayTasks.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Today&apos;s Task
          </p>
          <div className="space-y-1.5">
            {todayTasks.map((task, i) => {
              const carried = isTaskCarriedOver(task.text, entry, allEntries);
              return (
                <div key={task.id} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                    T{i + 1}
                  </span>
                  <span className="text-sm leading-snug text-foreground/80 truncate">{task.text}</span>
                  {carried && (
                    <span className="shrink-0 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-bold tracking-wide uppercase text-warning">
                      CO
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(hasFollowUps || hasBlockers) && (
        <div className={cn("grid gap-2", hasFollowUps && hasBlockers ? "grid-cols-2" : "grid-cols-1")}>
          {hasFollowUps && (
            <div className="rounded-lg bg-info/10 border border-info/20 p-2.5">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-info">
                Support Needed (Meeting)
              </p>
              <ol className="space-y-0.5">
                {entry.supportNeeds.map((s, i) => {
                  const mentioned = s.mentionedUsers && s.mentionedUsers.length > 0
                    ? s.mentionedUsers
                    : (s.mentionedUser ? [s.mentionedUser] : []);

                  return (
                    <li key={s.id} className="text-xs leading-snug text-foreground/80">
                      {i + 1}){" "}
                      {renderTextWithMentions(s.text, mentioned, "font-semibold text-primary")}
                      {isSupportCarriedOver(s.text, entry, allEntries) && (
                        <span className="ml-1.5 shrink-0 rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-warning">
                          CO
                        </span>
                      )}
                      {s.editedBy && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground/70 font-normal">
                          (edited by {s.editedBy.name?.split(" ")[0] ?? s.editedBy.email.split("@")[0]})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          {hasBlockers && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-2.5">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-destructive">
                Blockers (Dependencies)
              </p>
              <ol className="space-y-0.5">
                {entry.blockers.map((b, i) => {
                  const mentioned = b.mentionedUsers && b.mentionedUsers.length > 0
                    ? b.mentionedUsers
                    : (b.mentionedUser ? [b.mentionedUser] : []);

                  return (
                    <li key={b.id} className="text-xs leading-snug text-destructive/90">
                      {i + 1}){" "}
                      {renderTextWithMentions(b.text, mentioned, "font-semibold text-destructive")}
                      {isBlockerCarriedOver(b.text, entry, allEntries) && (
                        <span className="ml-1.5 shrink-0 rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-warning">
                          CO
                        </span>
                      )}
                      {b.editedBy && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground/70 font-normal">
                          (edited by {b.editedBy.name?.split(" ")[0] ?? b.editedBy.email.split("@")[0]})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Today tasks section (priority-aware) ──────────────────────────────────────

// ── Today tasks section (priority-aware) ──────────────────────────────────────

type TaskItem = MemberReviewEntry["tasks"][number];

/** Renders a full name, prefixed with "Manager" when the actor holds that role. */
function actorLabel(actor?: { name: string | null; email: string; role?: "TEAM_MEMBER" | "MANAGER" } | null): string | null {
  if (!actor) return null;
  const name = actor.name ?? actor.email.split("@")[0];
  return actor.role === "MANAGER" ? `Manager ${name}` : name;
}

function TaskHistoryIcon({
  task,
  chain,
  memberUser,
}: {
  task: TaskItem;
  chain: TaskCarryLink[];
  memberUser?: { name?: string | null; email?: string | null; image?: string | null } | null;
}) {
  return <TaskAuditHistoryPopover task={task} chain={chain} memberUser={memberUser} />;
}

function TaskRow({
  task,
  rank,
  isLocked,
  takenPriorities,
  totalTasks,
  carryChain,
  memberUser,
}: {
  task: TaskItem;
  rank: number;
  isLocked: boolean;
  takenPriorities: string[];
  totalTasks: number;
  carryChain: TaskCarryLink[];
  memberUser?: { name?: string | null; email?: string | null; image?: string | null } | null;
}) {
  const isCarriedOver = carryChain.length > 1;
  return (
    <div className="group/task flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40">
      {/* Rank badge */}
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          task.managerPriority ? priorityColor(task.managerPriority) + " border" : "bg-muted text-muted-foreground"
        )}
      >
        {task.managerPriority ?? rank}
      </span>
      <span className="flex-1 text-sm flex items-center flex-wrap gap-1.5">
        <span>{task.text}</span>
        {task.priority && (
          <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
            {task.priority}
          </span>
        )}
        {isCarriedOver && (
          <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-warning shrink-0">
            CO
          </span>
        )}
        {task.addedAfterReview && (
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary shrink-0" title="Added After Review">
            NT
          </span>
        )}
        <TaskHistoryIcon task={task} chain={carryChain} memberUser={memberUser} />
      </span>

      {/* Manager controls — hidden once reviewed */}
      {!isLocked && (
        <div className="flex shrink-0 items-center gap-1">
          <EditTaskRow taskId={task.id} text={task.text} />
          <PriorityDropdown
            taskId={task.id}
            current={task.managerPriority ?? null}
            takenPriorities={takenPriorities}
            totalTasks={totalTasks}
          />
          <DeleteTaskButton taskId={task.id} />
        </div>
      )}

      {/* Locked: show priority as read-only coloured badge */}
      {isLocked && task.managerPriority && (
        <span className={cn(
          "shrink-0 rounded-lg border px-2 py-0.5 text-xs font-bold",
          priorityColor(task.managerPriority)
        )}>
          {task.managerPriority}
        </span>
      )}
    </div>
  );
}

// ── Yesterday tasks section (priority & edit aware) ───────────────────────────

function YesterdayTasksSection({
  tasks,
  isLocked,
  entryId,
}: {
  tasks: { id?: string; text: string; isCompleted: boolean }[];
  isLocked: boolean;
  entryId: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <CheckCircle2 size={15} className="text-primary" />
        What Did You Do Yesterday?
        <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </span>
      </h3>
      {tasks.length > 0 ? (
        <div className="space-y-1.5">
          {tasks.map((task, i) => (
            <div key={task.id || i} className="group/task flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors">
              <div className="flex flex-1 items-center gap-2 min-w-0">
                {task.isCompleted ? (
                  <CheckCircle2 size={16} className="shrink-0 text-success" />
                ) : (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-warning/50 bg-warning/10 text-[10px] font-bold text-warning">
                    •
                  </span>
                )}
                <span className={cn("text-sm leading-snug truncate flex-1", task.isCompleted ? "text-foreground" : "text-foreground/90")}>
                  {task.text}
                </span>
                {!task.isCompleted && (
                  <span className="shrink-0 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-bold tracking-wide uppercase text-warning">
                    CO
                  </span>
                )}
              </div>
              {!isLocked && task.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <EditTaskRow taskId={task.id} text={task.text} />
                  <DeleteTaskButton taskId={task.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No tasks logged for yesterday.</p>
      )}

      {/* Manager can add yesterday tasks */}
      <AddTaskRow entryId={entryId} kind="YESTERDAY" />
    </div>
  );
}

function TodayTasksSection({
  tasks,
  isLocked,
  entryId,
  entry,
  allEntries = [],
  memberUser,
}: {
  tasks: TaskItem[];
  isLocked: boolean;
  entryId: string;
  entry?: MemberReviewEntry;
  allEntries?: MemberReviewEntry[];
  memberUser?: { name?: string | null; email?: string | null; image?: string | null } | null;
}) {
  // Sort: P1 first, unassigned last
  const sorted = sortByPriority(tasks);

  function takenFor(taskId: string) {
    return tasks
      .filter((t) => t.id !== taskId && t.managerPriority)
      .map((t) => t.managerPriority as string);
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
        <Calendar size={15} className="text-primary" />
        What Will You Do Today?
        <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </span>
      </h3>

      <div className="space-y-1 mt-3">
        {sorted.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            rank={i + 1}
            isLocked={isLocked}
            takenPriorities={takenFor(task.id)}
            totalTasks={tasks.length}
            carryChain={entry ? getTaskCarryChain(task.text, entry, allEntries) : [{ date: task.createdAt, task }]}
            memberUser={memberUser}
          />
        ))}
      </div>

      {/* Manager can add tasks — still allowed after review */}
      <AddTaskRow entryId={entryId} />
    </div>
  );
}

// ── Manager: Learning section (Editable & Addable) ────────────────────────────

function LearningSection({
  entryId,
  learningText,
  isLocked,
  entry,
  allEntries = [],
}: {
  entryId: string;
  learningText: string | null;
  isLocked: boolean;
  entry: MemberReviewEntry;
  allEntries?: MemberReviewEntry[];
}) {
  const [, action, pending] = useActionState<UpdateLearningState, FormData>(updateLearningText, {});
  const [, startTransition] = useTransition();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [editText, setEditText] = useState("");

  const lines = learningText
    ? learningText.split("\n").map((l) => l.trim()).filter(Boolean)
    : [];

  const handleSaveAll = (newLines: string[]) => {
    const fd = new FormData();
    fd.set("entryId", entryId);
    fd.set("learningText", newLines.join("\n"));
    startTransition(() => {
      action(fd);
    });
  };

  const handleEdit = (index: number) => {
    if (!editText.trim()) return;
    const updated = [...lines];
    updated[index] = editText.trim();
    handleSaveAll(updated);
    setEditingIndex(null);
    setEditText("");
  };

  const handleDelete = (index: number) => {
    const updated = lines.filter((_, i) => i !== index);
    handleSaveAll(updated);
  };

  const handleAdd = () => {
    if (!newText.trim()) return;
    const updated = [...lines, newText.trim()];
    handleSaveAll(updated);
    setNewText("");
    setAdding(false);
  };

  if (isLocked && lines.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-primary">
        <span className="flex items-center gap-2">
          <GraduationCap size={15} className="text-primary" />
          What Will You Learn Today( Whyfi School )?
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {lines.length}
          </span>
        </span>
      </h3>

      <div className="space-y-1.5 mt-3">
        {lines.map((line, i) => {
          if (editingIndex === i) {
            return (
              <div key={i} className="flex items-center gap-2 rounded-lg border bg-background p-1.5">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleEdit(i);
                    }
                  }}
                  onBlur={() => {
                    if (editText.trim()) handleEdit(i);
                    else setEditingIndex(null);
                  }}
                  className="flex-1 rounded border px-2 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => handleEdit(i)}
                  disabled={pending}
                  className="rounded-md bg-success/10 p-1.5 text-success hover:bg-success/20 transition-colors"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingIndex(null)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            );
          }

          return (
            <div
              key={i}
              className="group/item flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start gap-2 text-sm leading-relaxed text-foreground/80 flex-1 min-w-0">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                <span className="truncate">{line}</span>
                {isLearningCarriedOver(line, entry, allEntries) && (
                  <span className="shrink-0 rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-warning">
                    CO
                  </span>
                )}
              </div>

              {!isLocked && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIndex(i);
                      setEditText(line);
                    }}
                    title="Edit learning item"
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(i)}
                    title="Delete learning item"
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {lines.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No learning items logged for today.</p>
        )}
      </div>

      {!isLocked && (
        <div className="mt-2.5">
          {adding ? (
            <div className="flex items-center gap-2 rounded-lg border bg-background p-1.5">
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                autoFocus
                placeholder="Describe what will be learned (Whyfi School)..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                onBlur={() => {
                  if (newText.trim()) handleAdd();
                  else setAdding(false);
                }}
                className="flex-1 rounded border px-2.5 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={pending}
                className="rounded-md bg-success/10 p-1.5 text-success hover:bg-success/20 transition-colors"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewText("");
                }}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed py-2 text-xs font-medium text-primary/70 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
            >
              <Plus size={13} className="dark:text-[#93C5FD]" /> Add Learning Task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Day entry expanded (full review form) ─────────────────────────────────────

function EntryExpanded({
  entry,
  allEntries = [],
  teamMembers = [],
  memberUser,
}: {
  entry: MemberReviewEntry;
  allEntries?: MemberReviewEntry[];
  teamMembers?: TeamMember[];
  memberUser?: { name?: string | null; email?: string | null; image?: string | null } | null;
}) {
  const router = useRouter();
  const yesterdayTasks = getYesterdayTasksForEntry(entry, allEntries);
  const todayTasks = entry.tasks.filter((t) => t.kind === "TODAY");
  const isReviewable = entry.status !== "REVIEWED";
  const isLocked = entry.status === "REVIEWED";
  const [scheduleModal, setScheduleModal] = useState<{
    supportId?: string;
    mode: "create" | "edit";
    title: string;
    participantIds: string[];
    event?: CalendarEventView;
    onCreated?: (eventView: CalendarEventView) => void;
  } | null>(null);
  const [localEvents, setLocalEvents] = useState<Record<string, CalendarEventView>>({});

  return (
    <div className="space-y-4">
      {/* Yesterday completed */}
      <YesterdayTasksSection
        tasks={yesterdayTasks}
        isLocked={isLocked}
        entryId={entry.id}
      />

      {/* Today tasks + priority */}
      {(todayTasks.length > 0 || !isLocked) && (
        <TodayTasksSection
          tasks={todayTasks}
          isLocked={isLocked}
          entryId={entry.id}
          entry={entry}
          allEntries={allEntries}
          memberUser={memberUser}
        />
      )}

      {/* What will you learn today */}
      <LearningSection
        entryId={entry.id}
        learningText={entry.learningText}
        isLocked={isLocked}
        entry={entry}
        allEntries={allEntries}
      />

      {/* Blockers */}
      {(entry.blockers.length > 0 || !isLocked) && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-destructive">
            <span className="flex items-center gap-2">
              <AlertCircle size={15} className="text-destructive" />
              Blockers (Dependencies)?
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                {entry.blockers.length}
              </span>
            </span>
          </h3>
          <div className="space-y-1.5 mt-2">
            {entry.blockers.map((b) => {
              const uIds = b.mentionedUserIds ? b.mentionedUserIds.split(",").filter(Boolean) : (b.mentionedUserId ? [b.mentionedUserId] : (b.mentionedUser ? [b.mentionedUser.id] : []));
              const members = b.mentionedUsers && b.mentionedUsers.length > 0
                ? b.mentionedUsers
                : uIds.map((id) => teamMembers.find((m) => m.id === id) ?? (b.mentionedUser?.id === id ? b.mentionedUser : null)).filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined);

              return (
                <div key={b.id} className="group/item flex items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-destructive/10">
                  {!isLocked ? (
                    <EditBlockerRow
                      blockerId={b.id}
                      initialText={b.text}
                      initialMentionedUserId={b.mentionedUserIds ?? b.mentionedUserId}
                      initialMentionedUser={b.mentionedUser}
                      editedBy={b.editedBy}
                      teamMembers={teamMembers}
                    />
                  ) : (
                    <div className="flex flex-1 flex-col gap-0.5">
                      <div className="flex flex-1 items-center gap-1.5">
                        <span className={cn("flex-1 text-sm leading-snug", b.resolved ? "line-through text-muted-foreground" : "text-destructive/90")}>
                          {renderTextWithMentions(b.text, members, "font-semibold text-destructive")}
                        </span>
                        {isBlockerCarriedOver(b.text, entry, allEntries) && (
                          <span className="shrink-0 rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-warning">
                            CO
                          </span>
                        )}
                      </div>
                      {b.editedBy && (
                        <span className="text-[10px] text-muted-foreground/70">
                          Edited by {b.editedBy.name?.split(" ")[0] ?? b.editedBy.email.split("@")[0]}
                        </span>
                      )}
                    </div>
                  )}
                  {!isLocked && <DeleteBlockerButton blockerId={b.id} />}
                </div>
              );
            })}
          </div>
          {!isLocked && <AddBlockerRow entryId={entry.id} teamMembers={teamMembers} />}
        </div>
      )}

      {/* Support needed */}
      {(entry.supportNeeds.length > 0 || !isLocked) && (
        <div className="rounded-xl border border-info/30 bg-info/10 p-4">
          <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-info">
            <span className="flex items-center gap-2">
              <SupportNeededIcon size={15} className="text-info" />
              Support Needed (Meeting)?
              <span className="rounded-full bg-info/15 px-2 py-0.5 text-xs font-semibold text-info">
                {entry.supportNeeds.length}
              </span>
            </span>
          </h3>
          <div className="space-y-1.5 mt-2">
            {entry.supportNeeds.map((s) => {
              const uIds = s.mentionedUserIds ? s.mentionedUserIds.split(",").filter(Boolean) : (s.mentionedUserId ? [s.mentionedUserId] : (s.mentionedUser ? [s.mentionedUser.id] : []));
              const members = s.mentionedUsers && s.mentionedUsers.length > 0
                ? s.mentionedUsers
                : uIds.map((id) => teamMembers.find((m) => m.id === id) ?? (s.mentionedUser?.id === id ? s.mentionedUser : null)).filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined);

              const activeEvent = s.event ? supportEventToView(s.event) : localEvents[s.id] ?? null;
              const hasMeeting = Boolean(s.eventId || s.event || localEvents[s.id]);

              return (
                <div key={s.id} className="group/item flex flex-col gap-1.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-info/10">
                  <div className="flex items-center justify-between gap-2">
                    {!isLocked ? (
                      <EditSupportRow
                        supportId={s.id}
                        initialText={s.text}
                        initialMentionedUserId={s.mentionedUserIds ?? s.mentionedUserId}
                        initialMentionedUser={s.mentionedUser}
                        editedBy={s.editedBy}
                        teamMembers={teamMembers}
                      />
                    ) : (
                      <div className="flex flex-1 flex-col gap-0.5">
                        <div className="flex flex-1 items-center gap-1.5">
                          <span className="flex-1 text-sm leading-snug text-foreground/90">
                            {renderTextWithMentions(s.text, members, "font-medium text-primary")}
                          </span>
                          {isSupportCarriedOver(s.text, entry, allEntries) && (
                            <span className="shrink-0 rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-warning">
                              CO
                            </span>
                          )}
                        </div>
                        {s.editedBy && (
                          <span className="text-[10px] text-muted-foreground/70">
                            Edited by {s.editedBy.name?.split(" ")[0] ?? s.editedBy.email.split("@")[0]}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pl-0.5 pt-0.5">
                    {hasMeeting ? (
                      <ScheduledMeetingActions
                        event={activeEvent}
                        supportId={s.id}
                        fallbackTitle={s.text.trim() ? `Support Needed: ${s.text.trim()}` : "Support Needed Meeting"}
                        onEdit={() => {
                          const view = activeEvent ?? undefined;
                          const titleText = s.text.trim() ? `Support Needed: ${s.text.trim()}` : "Support Needed Meeting";
                          setScheduleModal({
                            supportId: s.id,
                            mode: view ? "edit" : "create",
                            title: view?.title ?? titleText,
                            participantIds: uIds,
                            event: view,
                          });
                        }}
                        onDeleted={() => {
                          setLocalEvents((prev) => {
                            const next = { ...prev };
                            delete next[s.id];
                            return next;
                          });
                          router.refresh();
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const titleText = s.text.trim() ? `Support Needed: ${s.text.trim()}` : "Support Needed Meeting";
                          setScheduleModal({ supportId: s.id, mode: "create", title: titleText, participantIds: uIds });
                        }}
                        className="flex items-center gap-1.5 text-[11px] font-semibold rounded-lg border border-border bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground px-2.5 py-1 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                      >
                        <Calendar size={12} className="text-muted-foreground" />
                        Schedule Meeting
                      </button>
                    )}
                  </div>
                  {/* {!isLocked && <DeleteSupportButton supportId={s.id} />} */}
                </div>
              );
            })}
          </div>
          {!isLocked && (
            <AddSupportRow
              entryId={entry.id}
              teamMembers={teamMembers}
              onScheduleMeeting={(title, participantIds, onCreated) =>
                setScheduleModal({ mode: "create", title, participantIds, onCreated })
              }
            />
          )}
        </div>
      )}

      {/* Review action */}
      {isReviewable && (
        <div className="pt-1">
          <ReviewButton entryId={entry.id} />
        </div>
      )}

      {entry.status === "REVIEWED" && (
        <div className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          <CheckCheck size={16} />
          Reviewed{entry.reviewedBy ? ` by ${entry.reviewedBy.name?.split(" ")[0] ?? "manager"}` : ""}
        </div>
      )}

      {/* Event Scheduler Modal */}
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
            if (scheduleModal.supportId) {
              const sId = scheduleModal.supportId;
              setLocalEvents((prev) => ({ ...prev, [sId]: view }));
              if (scheduleModal.mode === "create") {
                void linkSupportNeedEvent(sId, view.id).then(() => router.refresh());
              } else {
                router.refresh();
              }
            } else if (scheduleModal.onCreated) {
              scheduleModal.onCreated(view);
              router.refresh();
            } else {
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}

// ── Today entry card — expanded by default ────────────────────────────────────

function TodayEntryCard({
  entry,
  allEntries = [],
  teamMembers = [],
  memberUser,
}: {
  entry: MemberReviewEntry;
  allEntries?: MemberReviewEntry[];
  teamMembers?: TeamMember[];
  memberUser?: { name?: string | null; email?: string | null; image?: string | null } | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const review = reviewStatus({
    status: entry.status,
    date: entry.date,
    reviewedAt: entry.reviewedAt,
    reviewedBy: entry.reviewedBy,
  });
  const dateStr = formatShortDate(entry.date);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: date + Today on row 1, Submitted on row 2 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{dateStr}</span>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Today
            </span>
          </div>
          {(entry.status === "SUBMITTED" || entry.status === "PENDING_REVIEW" || entry.status === "REVIEWED") && (
            <span className="w-fit rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              Submitted
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            review.kind === "reviewed" ? "text-success"
              : review.kind === "pending" ? "text-warning"
                : review.kind === "none" ? "text-muted-foreground"
                  : "text-destructive"
          )}>
            <span className={cn(
              "h-2 w-2 rounded-full",
              review.kind === "reviewed" ? "bg-success"
                : review.kind === "pending" ? "bg-warning"
                  : review.kind === "none" ? "bg-muted-foreground/40"
                    : "bg-destructive"
            )} />
            {review.label}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent"
          >
            <PenIcon
              size={15}
              className={cn("shrink-0 transition-transform duration-200", expanded && "hidden")}
            />
          </button>
        </div>
      </div>

      {entry.status !== "MISSED" && (
        <div className="border-t">
          {expanded ? (
            <div className="px-4 pb-4 pt-3">
              <EntryExpanded entry={entry} allEntries={allEntries} teamMembers={teamMembers} memberUser={memberUser} />
            </div>
          ) : (
            <CompactEntryPreview entry={entry} allEntries={allEntries} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Day card (non-today, collapsible) ─────────────────────────────────────────

function DayCardCollapsed({
  entry,
  allEntries = [],
  teamMembers = [],
  memberUser,
  defaultOpen = false,
}: {
  entry: MemberReviewEntry;
  allEntries?: MemberReviewEntry[];
  teamMembers?: TeamMember[];
  memberUser?: { name?: string | null; email?: string | null; image?: string | null } | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const review = reviewStatus({
    status: entry.status,
    date: entry.date,
    reviewedAt: entry.reviewedAt,
    reviewedBy: entry.reviewedBy,
  });
  const dayLabel = relativeDayLabel(entry.date);
  const dateStr = formatShortDate(entry.date);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{dateStr}</span>
          {dayLabel && dayLabel !== "Today" && (
            <span className="text-xs text-muted-foreground">{dayLabel}</span>
          )}
          {(entry.status === "SUBMITTED" || entry.status === "PENDING_REVIEW" || entry.status === "REVIEWED") && (
            <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              Submitted
            </span>
          )}
          {entry.status === "MISSED" && (
            <span className="rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
              Missed
            </span>
          )}
          {entry.status === "DRAFT" && (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              Draft
            </span>
          )}
          {entry.blockers.length > 0 && (
            <span className="rounded-full border border-destructive/20 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
              {entry.blockers.length} Blocker{entry.blockers.length > 1 ? "s" : ""}
            </span>
          )}
          {entry.supportNeeds.length > 0 && (
            <span className="rounded-full border border-info/40 bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
              {entry.supportNeeds.length} Follow-Up{entry.supportNeeds.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 text-xs">
          {review.kind === "reviewed" && (
            <span className="flex items-center gap-1 text-primary">
              <CheckCircle2 size={13} className="text-primary" />
              {review.label}
            </span>
          )}
          {review.kind === "pending" && (
            <span className="flex items-center gap-1 text-warning">
              <span className="h-2 w-2 rounded-full bg-warning" />
              {review.label}
            </span>
          )}
          {review.kind === "missed-deadline" && (
            <span className="flex items-center gap-1 text-destructive">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              {review.label}
            </span>
          )}
          {review.kind === "none" && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              {review.label}
            </span>
          )}
        </div>
        <PenIcon
          size={15}
          className={cn("shrink-0 text-muted-foreground transition-transform duration-200", open && " hidden")}
        />
      </button>

      {open && entry.status !== "MISSED" && (
        <div className="border-t px-4 pb-4 pt-3">
          <EntryExpanded entry={entry} allEntries={allEntries} teamMembers={teamMembers} memberUser={memberUser} />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  review: MemberReview;
  weekOffset: number;
  teamMembers?: TeamMember[];
  selectedDateStr?: string;
};

export function MemberReviewDetail({ review, weekOffset, teamMembers = [], selectedDateStr }: Props) {
  const router = useRouter();
  const { user, entries } = review;

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 6000);
    const handleFocus = () => router.refresh();
    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [router]);

  const { start, end } = getWeekRange(weekOffset);
  const weekLabel = formatWeekRange(start, end);
  const canGoForward = weekOffset < 0;

  const displayedEntries = entries.filter((e) => new Date(e.date).getTime() >= start.getTime());
  const todayEntry = displayedEntries.find((e) => relativeDayLabel(e.date) === "Today");
  const otherEntries = displayedEntries.filter((e) => relativeDayLabel(e.date) !== "Today");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Fixed header block: back button + member card */}
      <div className="flex shrink-0 flex-col gap-5 p-6 pb-5">
        {/* Back Button */}
        <div>
          <Link
            href={ROUTES.dsmAll}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Back to All DSM
          </Link>
        </div>

        {/* Member header */}
        <div className="flex items-center justify-between rounded-xl border bg-card p-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary ring-2 ring-background ring-offset-2 ring-offset-primary/10">
              {(user.name ?? user.email).slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h2 className="text-2xl font-bold">{toTitleCase(user.name ?? user.email.split("@")[0])}</h2>
              <p className="text-sm text-muted-foreground">{user.title ?? "Team Member"}</p>
            </div>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-1 rounded-full border bg-background px-2 py-1">
            <Link
              href={`/dsm/member/${user.id}?w=${weekOffset - 1}${selectedDateStr ? `&date=${selectedDateStr}` : ""}`}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent"
            >
              <ChevronLeft size={16} />
            </Link>
            <span className="min-w-16 text-center text-sm font-medium">{weekLabel}</span>
            <Link
              href={canGoForward ? `/dsm/member/${user.id}?w=${weekOffset + 1}${selectedDateStr ? `&date=${selectedDateStr}` : ""}` : `/dsm/member/${user.id}`}
              className={cn(
                "rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent",
                !canGoForward && "pointer-events-none opacity-30"
              )}
            >
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Scrollable entries list */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-0">
        <div className="flex flex-col gap-5">
          {/* Today entry — expanded by default */}
          {todayEntry && <TodayEntryCard entry={todayEntry} allEntries={entries} teamMembers={teamMembers} memberUser={user} />}

          {/* Previous days — auto-expanded if matching selectedDateStr */}
          {otherEntries.map((entry) => {
            const isTargetDate = selectedDateStr ? toIsoDateStr(toUtcDate(entry.date)) === selectedDateStr : false;
            return (
              <DayCardCollapsed
                key={entry.id}
                entry={entry}
                allEntries={entries}
                teamMembers={teamMembers}
                memberUser={user}
                defaultOpen={isTargetDate}
              />
            );
          })}

          {displayedEntries.length === 0 && (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              No Standups Recorded for This Week.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
