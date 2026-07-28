"use client";

import { useActionState, useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown,
  CheckCircle2, CheckCheck, AlertTriangle, Calendar, Handshake,
  Pencil, Trash2, X, Check, Plus,
  PenIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { reviewStandup, type ReviewStandupState } from "../actions/review-standup";
import { setTaskPriority, type SetTaskPriorityState } from "../actions/set-task-priority";
import { editTask, type EditTaskState } from "../actions/edit-task";
import { deleteTask, type DeleteTaskState } from "../actions/delete-task";
import { addTask, type AddTaskState } from "../actions/add-task";
import { editBlocker, type EditBlockerState } from "@/features/blockers/actions/edit-blocker";
import { deleteBlocker, type DeleteBlockerState } from "@/features/blockers/actions/delete-blocker";
import { addBlocker, type AddBlockerState } from "@/features/blockers/actions/add-blocker";
import { editSupport, type EditSupportState } from "@/features/support-needed/actions/edit-support";
import { deleteSupport, type DeleteSupportState } from "@/features/support-needed/actions/delete-support";
import { addSupport, type AddSupportState } from "@/features/support-needed/actions/add-support";
import { reviewStatus, relativeDayLabel, formatShortDate, weekOfMonth, getWeekRange } from "@/features/dsm/utils";
import type { MemberReview, MemberReviewEntry } from "../queries";
import { MentionInput } from "@/components/shared/mention-input";
import type { TeamMember } from "@/features/dsm/queries";


// ── Mention helpers ───────────────────────────────────────────────────────────

/** Strips the "@Name " text MentionInput just inserted, since the mention is tracked as a chip instead */
function stripMentionInsertion(value: string, member: { name: string | null; email: string }): string {
  const label = member.name || member.email.split("@")[0];
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value.replace(new RegExp(`@${escaped}\\s?`), "").replace(/\s{2,}/g, " ");
}

// ── Priority helpers ──────────────────────────────────────────────────────────

/** Priority levels for a given task count — exactly one level per task, unbounded */
function priorityLevels(taskCount: number): string[] {
  const n = Math.max(taskCount, 0);
  return Array.from({ length: n }, (_, i) => `P${i + 1}`);
}

/** Priority → colour classes, cycling through a palette for any number of levels */
const PRIORITY_COLOR_CYCLE = [
  "bg-red-50 text-red-700 border-red-300",
  "bg-amber-50 text-amber-700 border-amber-300",
  "bg-sky-50 text-sky-700 border-sky-300",
  "bg-violet-50 text-violet-700 border-violet-300",
  "bg-emerald-50 text-emerald-700 border-emerald-300",
  "bg-pink-50 text-pink-700 border-pink-300",
  "bg-orange-50 text-orange-700 border-orange-300",
  "bg-teal-50 text-teal-700 border-teal-300",
  "bg-indigo-50 text-indigo-700 border-indigo-300",
  "bg-lime-50 text-lime-700 border-lime-300",
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
        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/task:opacity-100 hover:bg-accent hover:text-foreground"
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
        className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        title="Cancel"
        className="rounded p-1 text-muted-foreground hover:bg-accent"
      >
        <X size={14} />
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
        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/task:opacity-100 hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 size={13} />
      </button>
    </form>
  );
}

// ── Manager: Add task ─────────────────────────────────────────────────────────

function AddTaskRow({ entryId }: { entryId: string }) {
  const [adding, setAdding] = useState(false);
  const [state, action, pending] = useActionState<AddTaskState, FormData>(addTask, {});
  const inputRef = useRef<HTMLInputElement>(null);

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-2.5 flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed py-2 text-xs font-medium text-primary/70 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
      >
        <Plus size={13} /> Add Task
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
      <input type="hidden" name="kind" value="TODAY" />
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          name="text"
          placeholder="Type new task description..."
          autoFocus
          className="flex-1 rounded border px-2.5 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setAdding(false)}
          className="rounded border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          Cancel
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
  const [text, setText] = useState(initialText);
  const [prevInitialText, setPrevInitialText] = useState(initialText);

  const getInitialIds = () => {
    if (initialMentionedUserId) return initialMentionedUserId.split(",").filter(Boolean);
    if (initialMentionedUser?.id) return [initialMentionedUser.id];
    return [];
  };

  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>(getInitialIds);
  const [, action, pending] = useActionState<EditBlockerState, FormData>(editBlocker, {});

  if (initialText !== prevInitialText) {
    setPrevInitialText(initialText);
    setText(initialText);
    setMentionedUserIds(getInitialIds());
  }

  const addMention = (mId: string, updatedText?: string) => {
    if (mId && !mentionedUserIds.includes(mId)) {
      setMentionedUserIds((prev) => [...prev, mId]);
    }
    if (updatedText !== undefined) {
      setText(updatedText);
    }
  };

  const removeMention = (mId: string) => {
    setMentionedUserIds((prev) => prev.filter((id) => id !== mId));
  };

  const mentionedMembers = mentionedUserIds
    .map((id) => teamMembers.find((m) => m.id === id) ?? (initialMentionedUser?.id === id ? initialMentionedUser : null))
    .filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined);

  if (!editing) {
    return (
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <div className="flex flex-1 flex-wrap items-center gap-1 min-w-0">
            {mentionedMembers.map((m) => (
              <span key={m.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary shrink-0 select-none">
                @{m.name?.split(" ")[0]?.toLowerCase() ?? m.email.split("@")[0]}
              </span>
            ))}
            <span className="text-sm leading-snug text-destructive/90 truncate">{initialText}</span>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded border px-2 py-1 text-xs font-medium text-destructive/70 opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-destructive/10 hover:text-destructive"
          >
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

      <div className="flex flex-1 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2.5 py-1">
        {mentionedMembers.map((m) => (
          <span
            key={m.id}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary select-none"
          >
            @{m.name?.split(" ")[0]?.toLowerCase() ?? m.email.split("@")[0]}
            <button
              type="button"
              onClick={() => removeMention(m.id)}
              className="text-primary/60 hover:text-destructive transition-colors"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <MentionInput
          name="text"
          value={text}
          onChange={setText}
          placeholder="Edit blocker... (@ to mention member)"
          teamMembers={teamMembers}
          onSelectMention={(mId, updatedText) => addMention(mId, updatedText)}
          className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent min-w-[120px] flex-1 text-sm font-normal text-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        title="Save"
        className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setText(initialText);
          setMentionedUserIds(getInitialIds());
        }}
        title="Cancel"
        className="rounded p-1 text-muted-foreground hover:bg-accent"
      >
        <X size={14} />
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
        className="rounded p-1 text-destructive/70 opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 size={13} />
      </button>
    </form>
  );
}


function AddBlockerRow({ entryId, teamMembers = [] }: { entryId: string; teamMembers?: TeamMember[] }) {
  const [adding, setAdding] = useState(false);
  const [state, action, pending] = useActionState<AddBlockerState, FormData>(addBlocker, {});
  const [text, setText] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);

  const addMention = (mId: string, updatedText?: string) => {
    if (mId && !mentionedUserIds.includes(mId)) {
      setMentionedUserIds((prev) => [...prev, mId]);
    }
    if (updatedText !== undefined) {
      setText(updatedText);
    }
  };

  const removeMention = (mId: string) => {
    setMentionedUserIds((prev) => prev.filter((id) => id !== mId));
  };

  const mentionedMembers = mentionedUserIds
    .map((id) => teamMembers.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined);

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-2.5 flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed border-destructive/40 py-2 text-xs font-medium text-destructive transition-colors hover:border-destructive hover:bg-destructive/10"
      >
        <Plus size={13} /> Add Blocker
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
      className="mt-2 flex items-center gap-1.5"
    >
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="mentionedUserId" value={mentionedUserIds.join(",")} />

      <div className="flex flex-1 flex-wrap items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5">
        {mentionedMembers.map((m) => (
          <span
            key={m!.id}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary select-none"
          >
            @{m!.name?.split(" ")[0]?.toLowerCase() ?? m!.email.split("@")[0]}
            <button
              type="button"
              onClick={() => removeMention(m!.id)}
              className="text-primary/60 hover:text-destructive transition-colors"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <MentionInput
          name="text"
          value={text}
          onChange={setText}
          placeholder={mentionedMembers.length > 0 ? "Describe blocker..." : "Describe blocker... (@ to mention team members)"}
          teamMembers={teamMembers}
          onSelectMention={(mId, updatedText) => addMention(mId, updatedText)}
          className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent min-w-[120px] flex-1 text-sm font-normal text-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        title="Add"
        className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          setAdding(false);
          setText("");
          setMentionedUserIds([]);
        }}
        title="Cancel"
        className="rounded p-1 text-muted-foreground hover:bg-accent"
      >
        <X size={14} />
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
  const [text, setText] = useState(initialText);
  const [prevInitialText, setPrevInitialText] = useState(initialText);

  const getInitialIds = () => {
    if (initialMentionedUserId) return initialMentionedUserId.split(",").filter(Boolean);
    if (initialMentionedUser?.id) return [initialMentionedUser.id];
    return [];
  };

  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>(getInitialIds);
  const [, action, pending] = useActionState<EditSupportState, FormData>(editSupport, {});

  if (initialText !== prevInitialText) {
    setPrevInitialText(initialText);
    setText(initialText);
    setMentionedUserIds(getInitialIds());
  }

  const addMention = (mId: string, updatedText?: string) => {
    if (mId && !mentionedUserIds.includes(mId)) {
      setMentionedUserIds((prev) => [...prev, mId]);
    }
    if (updatedText !== undefined) {
      setText(updatedText);
    }
  };

  const removeMention = (mId: string) => {
    setMentionedUserIds((prev) => prev.filter((id) => id !== mId));
  };

  const mentionedMembers = mentionedUserIds
    .map((id) => teamMembers.find((m) => m.id === id) ?? (initialMentionedUser?.id === id ? initialMentionedUser : null))
    .filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined);

  if (!editing) {
    return (
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <div className="flex flex-1 flex-wrap items-center gap-1 min-w-0">
            {mentionedMembers.map((m) => (
              <span key={m.id} className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 shrink-0 select-none">
                @{m.name?.split(" ")[0]?.toLowerCase() ?? m.email.split("@")[0]}
              </span>
            ))}
            <span className="text-sm leading-snug text-foreground/90 truncate">{initialText}</span>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded border px-2 py-1 text-xs font-medium text-sky-700/70 opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-sky-100 hover:text-sky-800"
          >
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

      <div className="flex flex-1 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2.5 py-1">
        {mentionedMembers.map((m) => (
          <span
            key={m.id}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 select-none"
          >
            @{m.name?.split(" ")[0]?.toLowerCase() ?? m.email.split("@")[0]}
            <button
              type="button"
              onClick={() => removeMention(m.id)}
              className="text-sky-600 hover:text-destructive transition-colors"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <MentionInput
          name="text"
          value={text}
          onChange={setText}
          placeholder="Edit support need... (@ to mention member)"
          teamMembers={teamMembers}
          onSelectMention={(mId, updatedText) => addMention(mId, updatedText)}
          className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent min-w-[120px] flex-1 text-sm font-normal text-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        title="Save"
        className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setText(initialText);
          setMentionedUserIds(getInitialIds());
        }}
        title="Cancel"
        className="rounded p-1 text-muted-foreground hover:bg-accent"
      >
        <X size={14} />
      </button>
    </form>
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
        className="rounded p-1 text-sky-700/70 opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-sky-100 hover:text-sky-800"
      >
        <Trash2 size={13} />
      </button>
    </form>
  );
}


function AddSupportRow({ entryId, teamMembers = [] }: { entryId: string; teamMembers?: TeamMember[] }) {
  const [adding, setAdding] = useState(false);
  const [state, action, pending] = useActionState<AddSupportState, FormData>(addSupport, {});
  const [text, setText] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);

  const addMention = (mId: string, updatedText?: string) => {
    if (mId && !mentionedUserIds.includes(mId)) {
      setMentionedUserIds((prev) => [...prev, mId]);
    }
    if (updatedText !== undefined) {
      setText(updatedText);
    }
  };

  const removeMention = (mId: string) => {
    setMentionedUserIds((prev) => prev.filter((id) => id !== mId));
  };

  const mentionedMembers = mentionedUserIds
    .map((id) => teamMembers.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined);

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-2.5 flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed border-sky-300 py-2 text-xs font-medium text-sky-700 transition-colors hover:border-sky-500 hover:bg-sky-100/50"
      >
        <Plus size={13} /> Add Support Needed
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
      className="mt-2 flex items-center gap-1.5"
    >
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="mentionedUserId" value={mentionedUserIds.join(",")} />

      <div className="flex flex-1 flex-wrap items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5">
        {mentionedMembers.map((m) => (
          <span
            key={m!.id}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 select-none"
          >
            @{m!.name?.split(" ")[0]?.toLowerCase() ?? m!.email.split("@")[0]}
            <button
              type="button"
              onClick={() => removeMention(m!.id)}
              className="text-sky-600 hover:text-destructive transition-colors"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <MentionInput
          name="text"
          value={text}
          onChange={setText}
          placeholder={mentionedMembers.length > 0 ? "Describe support needed..." : "Describe support needed... (@ to mention team members)"}
          teamMembers={teamMembers}
          onSelectMention={(mId, updatedText) => addMention(mId, updatedText)}
          className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent min-w-[120px] flex-1 text-sm font-normal text-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        title="Add"
        className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          setAdding(false);
          setText("");
          setMentionedUserIds([]);
        }}
        title="Cancel"
        className="rounded p-1 text-muted-foreground hover:bg-accent"
      >
        <X size={14} />
      </button>
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
      <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
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
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <CheckCheck size={16} />
        {pending ? "Reviewing…" : "Reviewed ✓"}
      </button>
    </form>
  );
}

// ── Compact entry preview (collapsed state) ───────────────────────────────────

function CompactEntryPreview({ entry }: { entry: MemberReviewEntry }) {
  const todayTasks = entry.tasks.filter((t) => t.kind === "TODAY");
  const hasFollowUps = entry.supportNeeds.length > 0;
  const hasBlockers = entry.blockers.length > 0;

  return (
    <div className="space-y-3 px-4 pb-4 pt-3">
      {todayTasks.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Today&apos;s Task
          </p>
          <div className="space-y-1.5">
            {todayTasks.map((task, i) => (
              <div key={task.id} className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                  T{i + 1}
                </span>
                <span className="text-sm leading-snug text-foreground/80">{task.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(hasFollowUps || hasBlockers) && (
        <div className={cn("grid gap-2", hasFollowUps && hasBlockers ? "grid-cols-2" : "grid-cols-1")}>
          {hasFollowUps && (
            <div className="rounded-lg bg-accent/60 p-2.5">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Follow-Ups
              </p>
              <ol className="space-y-0.5">
                {entry.supportNeeds.slice(0, 2).map((s, i) => {
                  const mentioned = s.mentionedUsers && s.mentionedUsers.length > 0
                    ? s.mentionedUsers
                    : (s.mentionedUser ? [s.mentionedUser] : []);

                  return (
                    <li key={s.id} className="text-xs leading-snug text-foreground/70">
                      {i + 1}){" "}
                      {mentioned.map((m) => (
                        <span key={m.id} className="font-semibold text-primary">
                          @{m.name?.split(" ")[0]?.toLowerCase() ?? m.email.split("@")[0]}&nbsp;
                        </span>
                      ))}
                      {s.text}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          {hasBlockers && (
            <div className="rounded-lg bg-destructive/5 p-2.5">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-destructive">
                Blockers
              </p>
              <ol className="space-y-0.5">
                {entry.blockers.slice(0, 2).map((b, i) => {
                  const mentioned = b.mentionedUsers && b.mentionedUsers.length > 0
                    ? b.mentionedUsers
                    : (b.mentionedUser ? [b.mentionedUser] : []);

                  return (
                    <li key={b.id} className="text-xs leading-snug text-destructive/70">
                      {i + 1}){" "}
                      {mentioned.map((m) => (
                        <span key={m.id} className="font-semibold text-destructive">
                          @{m.name?.split(" ")[0]?.toLowerCase() ?? m.email.split("@")[0]}&nbsp;
                        </span>
                      ))}
                      {b.text}
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

function TaskRow({
  task,
  rank,
  isLocked,
  takenPriorities,
  totalTasks,
}: {
  task: TaskItem;
  rank: number;
  isLocked: boolean;
  takenPriorities: string[];
  totalTasks: number;
}) {
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
      <span className="flex-1 text-sm">
        {task.text}
        {task.priority && (
          <span className="ml-2 inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
            {task.priority}
          </span>
        )}
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

function TodayTasksSection({
  tasks,
  isLocked,
  entryId,
}: {
  tasks: TaskItem[];
  isLocked: boolean;
  entryId: string;
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
          />
        ))}
      </div>

      {/* Admin / Manager can add tasks */}
      {!isLocked && <AddTaskRow entryId={entryId} />}
    </div>
  );
}

// ── Day entry expanded (full review form) ─────────────────────────────────────

function EntryExpanded({ entry, teamMembers = [] }: { entry: MemberReviewEntry; teamMembers?: TeamMember[] }) {
  const yesterdayTasks = entry.tasks.filter((t) => t.kind === "YESTERDAY");
  const todayTasks = entry.tasks.filter((t) => t.kind === "TODAY");
  const isReviewable = entry.status === "SUBMITTED" || entry.status === "PENDING_REVIEW";
  const isLocked = entry.status === "REVIEWED";

  return (
    <div className="space-y-4">
      {/* Yesterday completed */}
      {yesterdayTasks.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <CheckCircle2 size={15} className="text-primary" />
            What Did You Complete Yesterday?
          </h3>
          <div className="space-y-2">
            {yesterdayTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-2.5">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary" />
                <span className="text-sm">{task.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today tasks + priority */}
      {(todayTasks.length > 0 || !isLocked) && (
        <TodayTasksSection tasks={todayTasks} isLocked={isLocked} entryId={entry.id} />
      )}

      {/* Blockers */}
      {(entry.blockers.length > 0 || !isLocked) && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-destructive">
            <span className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-destructive" />
              Blockers (Data Needed)
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
                <div key={b.id} className="group/item flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-destructive/10">
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
                        {members.map((m) => (
                          <span key={m.id} className="text-xs font-semibold text-primary shrink-0">
                            @{m.name?.split(" ")[0]?.toLowerCase() ?? m.email.split("@")[0]}&nbsp;
                          </span>
                        ))}
                        <span className={cn("flex-1 text-sm leading-snug", b.resolved ? "line-through text-muted-foreground" : "text-destructive/90")}>
                          {b.text}
                        </span>
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
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
          <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-sky-700">
            <span className="flex items-center gap-2">
              <Handshake size={15} className="text-sky-700" />
              Support Needed (Meeting)
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
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

              return (
                <div key={s.id} className="group/item flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-sky-100/60">
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
                        {members.map((m) => (
                          <span key={m.id} className="text-xs font-medium text-primary shrink-0">
                            @{m.name?.split(" ")[0]?.toLowerCase() ?? m.email.split("@")[0]}&nbsp;
                          </span>
                        ))}
                        <span className="flex-1 text-sm leading-snug text-foreground/90">
                          {s.text}
                        </span>
                      </div>
                      {s.editedBy && (
                        <span className="text-[10px] text-muted-foreground/70">
                          Edited by {s.editedBy.name?.split(" ")[0] ?? s.editedBy.email.split("@")[0]}
                        </span>
                      )}
                    </div>
                  )}
                  {!isLocked && <DeleteSupportButton supportId={s.id} />}
                </div>
              );
            })}
          </div>
          {!isLocked && <AddSupportRow entryId={entry.id} teamMembers={teamMembers} />}
        </div>
      )}

      {/* Review action */}
      {isReviewable && (
        <div className="pt-1">
          <ReviewButton entryId={entry.id} />
        </div>
      )}

      {entry.status === "REVIEWED" && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCheck size={16} />
          Reviewed{entry.reviewedBy ? ` by ${entry.reviewedBy.name?.split(" ")[0] ?? "manager"}` : ""}
        </div>
      )}
    </div>
  );
}

// ── Today entry card — expanded by default ────────────────────────────────────

function TodayEntryCard({ entry, teamMembers = [] }: { entry: MemberReviewEntry; teamMembers?: TeamMember[] }) {
  const [expanded, setExpanded] = useState(false);
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
            <span className="w-fit rounded-full border border-emerald-600/40 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Submitted
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            review.kind === "reviewed" ? "text-emerald-600"
              : review.kind === "pending" ? "text-amber-600"
                : review.kind === "none" ? "text-muted-foreground"
                  : "text-destructive"
          )}>
            <span className={cn(
              "h-2 w-2 rounded-full",
              review.kind === "reviewed" ? "bg-emerald-500"
                : review.kind === "pending" ? "bg-amber-500"
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
              <EntryExpanded entry={entry} teamMembers={teamMembers} />
            </div>
          ) : (
            <CompactEntryPreview entry={entry} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Day card (non-today, collapsible) ─────────────────────────────────────────

function DayCardCollapsed({ entry, teamMembers = [] }: { entry: MemberReviewEntry; teamMembers?: TeamMember[] }) {
  const [open, setOpen] = useState(false);
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
            <span className="rounded-full border border-emerald-600/40 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Submitted
            </span>
          )}
          {entry.status === "MISSED" && (
            <span className="rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
              Missed
            </span>
          )}
          {entry.status === "DRAFT" && (
            <span className="rounded-full border border-amber-400/40 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Draft
            </span>
          )}
          {entry.blockers.length > 0 && (
            <span className="rounded-full border border-destructive/20 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
              {entry.blockers.length} Blocker{entry.blockers.length > 1 ? "s" : ""}
            </span>
          )}
          {entry.supportNeeds.length > 0 && (
            <span className="rounded-full border border-sky-300/50 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
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
            <span className="flex items-center gap-1 text-amber-600">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
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
          <EntryExpanded entry={entry} teamMembers={teamMembers} />
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
};

export function MemberReviewDetail({ review, weekOffset, teamMembers = [] }: Props) {
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

  const { start } = getWeekRange(weekOffset);
  const weekLabel = `Week ${weekOfMonth(start)}`;
  const canGoForward = weekOffset < 0;

  const todayEntry = entries.find((e) => relativeDayLabel(e.date) === "Today");
  const otherEntries = entries.filter((e) => relativeDayLabel(e.date) !== "Today");

  return (
    <div className="flex flex-col gap-5">
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
            <h2 className="text-2xl font-bold">{user.name ?? user.email.split("@")[0]}</h2>
            <p className="text-sm text-muted-foreground">{user.title ?? "Team Member"}</p>
          </div>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-1 rounded-full border bg-background px-2 py-1">
          <Link
            href={`/dsm/member/${user.id}?w=${weekOffset - 1}`}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="min-w-16 text-center text-sm font-medium">{weekLabel}</span>
          <Link
            href={canGoForward ? `/dsm/member/${user.id}?w=${weekOffset + 1}` : `/dsm/member/${user.id}`}
            className={cn(
              "rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent",
              !canGoForward && "pointer-events-none opacity-30"
            )}
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {/* Today entry — expanded by default */}
      {todayEntry && <TodayEntryCard entry={todayEntry} teamMembers={teamMembers} />}

      {/* Previous days — collapsed by default */}
      {otherEntries.map((entry) => (
        <DayCardCollapsed key={entry.id} entry={entry} teamMembers={teamMembers} />
      ))}

      {entries.length === 0 && (
        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No Standups Recorded for This Week.
        </div>
      )}
    </div>
  );
}
