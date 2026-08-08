"use client";

import { useActionState, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Search, X, ChevronLeft, ChevronRight, ChevronDown, Play, CheckCircle2, Pencil, MessageSquare, Clock, Clock3, User, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFullDate } from "@/features/dsm/utils";
import { formatEventTime } from "@/features/dsr/utils";
import { daysOpen, filterSupport, type SupportStatusFilter } from "../utils";
import { markSupportResolved, type MarkSupportResolvedState } from "../actions/mark-resolved";
import { createSupport, type CreateSupportState } from "../actions/create-support";
import { sendSupportReminder, type SupportReminderState } from "../actions/send-reminder";
import { addSupportComment, type AddSupportCommentState } from "../actions/add-support-comment";
import { editSupport, type EditSupportState } from "../actions/edit-support";
import type { SupportNeedItem } from "../queries";
import type { TeamMember } from "@/features/dsm/queries";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

const STATUS_STYLES = {
  in_progress: "border border-blue-500/40 text-blue-700 dark:text-blue-400 bg-transparent",
  resolved: "border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-transparent",
} as const;

function StatusBadge({ resolved }: { resolved: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
      resolved ? STATUS_STYLES.resolved : STATUS_STYLES.in_progress
    )}>
      {resolved ? "Resolved" : "In Progress"}
    </span>
  );
}

// ── Activity Timeline ─────────────────────────────────────────────────────────

function SupportTimeline({ item, isResolved }: { item: SupportNeedItem; isResolved: boolean }) {
  const events = useMemo(() => {
    const evs: Array<{
      id: string;
      label: string;
      timeStr: string;
      colorClass: string;
    }> = [];

    // 1. Created event
    evs.push({
      id: "created",
      label: `Requested by ${item.raisedBy.name ?? item.raisedBy.email.split("@")[0]}`,
      timeStr: formatEventTime(item.date),
      colorClass: "bg-amber-500",
    });

    // 2. Support From event
    if (item.supportFrom) {
      evs.push({
        id: "supportFrom",
        label: `Requested From ${item.supportFrom.name ?? item.supportFrom.email.split("@")[0]}`,
        timeStr: formatEventTime(item.date),
        colorClass: "bg-violet-500",
      });
    }

    // 3. Edit event
    if (item.editedBy) {
      evs.push({
        id: "edited",
        label: `Edited by ${item.editedBy.name ?? item.editedBy.email.split("@")[0]}`,
        timeStr: formatEventTime(item.date),
        colorClass: "bg-blue-500",
      });
    }

    // 4. Comment events
    for (const c of item.comments) {
      evs.push({
        id: `comment-${c.id}`,
        label: `Update from ${c.author.name ?? c.author.email.split("@")[0]}: "${c.text}"`,
        timeStr: formatEventTime(c.createdAt),
        colorClass: "bg-blue-500",
      });
    }

    // 5. Final resolution status
    if (isResolved) {
      evs.push({
        id: "resolved",
        label: "Marked as Resolved (Manager Resolution)",
        timeStr: formatEventTime(new Date()),
        colorClass: "bg-emerald-500",
      });
    } else {
      evs.push({
        id: "active",
        label: `Support Active (${daysOpen(item.date)} days active)`,
        timeStr: formatEventTime(item.date),
        colorClass: "bg-amber-500",
      });
    }

    return evs;
  }, [item, isResolved]);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock3 size={14} className="text-muted-foreground" />
        <span className="text-sm font-semibold">Report Timeline</span>
      </div>
      <div className="flex flex-col">
        {events.map((ev, i) => {
          const isLast = i === events.length - 1;
          return (
            <div key={ev.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cn("mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full", ev.colorClass)} />
                {!isLast && (
                  <div className="my-1 w-px flex-1 bg-border" style={{ minHeight: "16px" }} />
                )}
              </div>
              <div className={cn(!isLast && "pb-3")}>
                <p className="text-xs font-semibold leading-snug">{ev.label}</p>
                <p className="text-xs text-muted-foreground">{ev.timeStr}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── User avatar ───────────────────────────────────────────────────────────────

function UserAvatar({ user }: { user: { name: string | null; email: string } | null }) {
  if (!user) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {(user.name ?? user.email).slice(0, 2).toUpperCase()}
      </span>
      <span className="text-sm">
        {user.name?.split(" ")[0] ?? user.email.split("@")[0]}
      </span>
    </div>
  );
}

// ── Comments ──────────────────────────────────────────────────────────────────

function CommentThread({ comments }: { comments: SupportNeedItem["comments"] }) {
  if (comments.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground/60">No Updates Yet.</p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {comments.map((c) => (
        <div key={c.id} className="rounded-lg border bg-background px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">
              {c.author.name?.split(" ")[0] ?? c.author.email.split("@")[0]}
            </span>
            <span className="text-xs text-muted-foreground">{formatEventTime(c.createdAt)}</span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{c.text}</p>
        </div>
      ))}
    </div>
  );
}

// ── CommentForm ───────────────────────────────────────────────────────────────

function CommentForm({ supportId }: { supportId: string }) {
  const [state, action, pending] = useActionState<AddSupportCommentState, FormData>(
    addSupportComment, {}
  );
  const [text, setText] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.message === "added") setText("");
  }, [state.message]);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="supportId" value={supportId} />
      <textarea
        name="text"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share an Update — Solved or Not, What's Remaining, What Support You Still Need..."
        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
      />
      {state.errors?.text && <p className="text-xs text-destructive">{state.errors.text[0]}</p>}
      {state.message === "added" && <p className="text-xs text-emerald-600">Update Posted.</p>}
      {state.message && state.message !== "added" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 self-end rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
      >
        <MessageSquare size={12} />
        {pending ? "Posting…" : "Post Update"}
      </button>
    </form>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  item,
  isManager,
  canComment,
  onClose,
}: {
  item: SupportNeedItem;
  isManager: boolean;
  canComment: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [resolveState, resolveAction, resolvePending] = useActionState<MarkSupportResolvedState, FormData>(
    markSupportResolved, {}
  );
  const [reminderState, reminderAction, reminderPending] = useActionState<SupportReminderState, FormData>(
    sendSupportReminder, {}
  );
  const days = daysOpen(item.date);
  const isResolved = resolveState.message === "resolved"
    ? true
    : resolveState.message === "unresolved"
    ? false
    : item.resolved;

  const [editingText, setEditingText] = useState(false);
  const [editState, editAction, editPending] = useActionState<EditSupportState, FormData>(editSupport, {});

  // Refresh page data when resolve or edit succeeds
  useEffect(() => {
    if (resolveState.message === "resolved" || resolveState.message === "unresolved" || editState.message === "updated") {
      router.refresh();
    }
  }, [resolveState.message, editState.message, router]);

  return (
    <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col border-l bg-card xl:w-96 shadow-lg transition-all animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <span className="text-base font-bold">Support Request Details</span>
          <p className="text-xs text-muted-foreground">ID: {item.id.slice(0, 8)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <X size={15} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0 flex-col gap-5 overflow-y-auto px-5 py-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Description</p>
            {(isManager || canComment) && !isResolved && (
              <button
                type="button"
                onClick={() => setEditingText((v) => !v)}
                className="text-muted-foreground hover:text-primary transition-colors"
                title="Edit description"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
          {editingText ? (
            <form
              action={async (fd) => {
                await editAction(fd);
                setEditingText(false);
              }}
              className="flex flex-col gap-2"
            >
              <input type="hidden" name="supportId" value={item.id} />
              <textarea
                name="text"
                rows={3}
                defaultValue={item.text}
                autoFocus
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
              />
              {editState.message && editState.message !== "updated" && (
                <p className="text-xs text-destructive">{editState.message}</p>
              )}
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingText(false)}
                  className="rounded border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editPending}
                  className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {editPending ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              <p className="text-sm leading-relaxed font-medium">{item.text}</p>
              {item.editedBy && (
                <span className="text-[10px] text-muted-foreground/70 block font-normal">
                  (edited by {item.editedBy.name?.split(" ")[0] ?? item.editedBy.email.split("@")[0]})
                </span>
              )}
              {item.supportFrom && (
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-xs font-medium text-muted-foreground">Requested From:</span>
                  <span className="inline-flex items-center rounded-full border border-violet-500/40 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-400 bg-transparent">
                    {item.supportFrom.name?.split(" ")[0] ?? item.supportFrom.email.split("@")[0]}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Days Open
          </p>
          <p className={cn("text-sm font-semibold", days > 0 ? "text-destructive" : "text-foreground")}>
            {days === 0 ? "Today" : `${days} Day${days !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="h-px bg-border" />

        {/* Visual Timeline */}
        <SupportTimeline item={item} isResolved={isResolved} />

        <div className="h-px bg-border" />

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Updates & Comments
          </p>
          <CommentThread comments={item.comments} />
        </div>

        {canComment && !isResolved && <CommentForm supportId={item.id} />}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 border-t px-5 py-4">
        {(resolveState.message && !["resolved", "unresolved"].includes(resolveState.message)) && (
          <p className="text-xs text-destructive">{resolveState.message}</p>
        )}
        {reminderState.message === "sent" && (
          <p className="text-xs text-emerald-600">Reminder Sent.</p>
        )}
        {reminderState.message === "no_target" && (
          <p className="text-xs text-muted-foreground">No Manager Found to Notify.</p>
        )}
        {reminderState.message === "already_resolved" && (
          <p className="text-xs text-muted-foreground">This Support Request Is Already Resolved.</p>
        )}
        {isManager && (
          <form action={resolveAction}>
            <input type="hidden" name="supportId" value={item.id} />
            <input type="hidden" name="resolved" value={isResolved ? "false" : "true"} />
            <button
              type="submit"
              disabled={resolvePending}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50",
                isResolved
                  ? "bg-secondary text-secondary-foreground border hover:bg-accent"
                  : "bg-primary text-primary-foreground"
              )}
            >
              <CheckCircle2 size={16} />
              {resolvePending
                ? "Updating…"
                : isResolved
                ? "Mark as Pending (Reopen)"
                : "Mark as Resolved"}
            </button>
          </form>
        )}

        <form action={reminderAction}>
          <input type="hidden" name="supportId" value={item.id} />
          <button
            type="submit"
            disabled={isResolved || reminderPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Play size={14} />
            {reminderPending ? "Sending…" : "Send Reminder"}
          </button>
        </form>
      </div>
    </aside>
  );
}

// ── Request Support modal ─────────────────────────────────────────────────────

function RequestSupportModal({
  teamMembers,
  onClose,
}: {
  teamMembers?: TeamMember[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CreateSupportState, FormData>(createSupport, {});

  if (state.message === "created") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
          <div className="mb-4 flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={18} />
            <span className="font-semibold">Support Requested Successfully.</span>
          </div>
          <button
            type="button"
            onClick={() => { router.refresh(); onClose(); }}
            className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">Request Support</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
            <X size={15} />
          </button>
        </div>
        <form action={action} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Description <span className="text-destructive">*</span>
            </label>
            <textarea
              name="text"
              rows={4}
              placeholder="Describe What Support You Need..."
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
            />
            {state.errors?.text && <p className="mt-1 text-xs text-destructive">{state.errors.text[0]}</p>}
          </div>

          {teamMembers && teamMembers.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Request Support From (Optional)
              </label>
              <select
                name="supportFromUserId"
                defaultValue=""
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">None / Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email.split("@")[0]} ({m.role === "MANAGER" ? "Manager" : "Team Member"})
                  </option>
                ))}
              </select>
            </div>
          )}

          {state.message && state.message !== "created" && (
            <p className="text-xs text-destructive">{state.message}</p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-accent">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Submitting…" : "Request Support"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

type ViewMode = "all" | "mine" | "for-me";

type Props = {
  items: SupportNeedItem[];
  itemsForMe: SupportNeedItem[];
  teamMembers?: TeamMember[];
  currentUserId: string;
  isManager: boolean;
};

export function SupportClient({ items, itemsForMe, teamMembers, currentUserId, isManager }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => (isManager ? "all" : "mine"));
  const [statusFilter, setStatusFilter] = useState<SupportStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const activeItems = useMemo(() => {
    if (viewMode === "all") return items;
    if (viewMode === "mine") return isManager ? items.filter((s) => s.raisedBy.id === currentUserId) : items;
    return itemsForMe;
  }, [viewMode, items, itemsForMe, isManager, currentUserId]);

  const [selectedId, setSelectedId] = useState<string | null>(() => activeItems[0]?.id ?? items[0]?.id ?? null);

  const filtered = useMemo(
    () => filterSupport(activeItems, statusFilter, search),
    [activeItems, statusFilter, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const allItems = [...items, ...itemsForMe];
  const selected = allItems.find((s) => s.id === selectedId) ?? null;

  const pendingCount = activeItems.filter((s) => !s.resolved).length;
  const resolvedCount = activeItems.filter((s) => s.resolved).length;
  const forMeActiveCount = itemsForMe.filter((s) => !s.resolved).length;

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    setPage(1);
    setStatusFilter("all");
    setSearch("");
    const next = mode === "all" ? items : mode === "mine" ? (isManager ? items.filter((s) => s.raisedBy.id === currentUserId) : items) : itemsForMe;
    setSelectedId(next[0]?.id ?? null);
  };

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{isManager ? "Team Support Needed" : "Support Needed"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isManager
                ? "Track Support Requests, Coordinate Team Assistance, and Resolve Blockers."
                : "Identify Challenges Early and Collaborate to Keep Work Moving."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <PlusCircle size={16} />
            Request Support
          </button>
        </div>

        {/* Dashboard Metric Stat Cards */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Total Card */}
          <div
            onClick={() => {
              if (viewMode === "for-me") handleViewChange(isManager ? "all" : "mine");
              setStatusFilter("all");
              setPage(1);
            }}
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-xl border border-border bg-transparent p-3 shadow-2xs transition-all hover:scale-[1.01] hover:border-primary/50 active:scale-[0.99]",
              statusFilter === "all" && viewMode !== "for-me" && "ring-2 ring-primary/40 border-primary/50"
            )}
          >
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Support</p>
              <p className="text-xl font-bold text-foreground">{activeItems.length}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-transparent text-primary">
              <HelpCircle size={16} />
            </div>
          </div>

          {/* Pending Card */}
          <div
            onClick={() => {
              setStatusFilter("in_progress");
              setPage(1);
            }}
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-xl border border-amber-500/30 bg-transparent p-3 shadow-2xs transition-all hover:scale-[1.01] hover:border-amber-500/60 active:scale-[0.99]",
              statusFilter === "in_progress" && "ring-2 ring-amber-500/40 border-amber-500/60"
            )}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Pending</p>
                <span className="text-[9px] font-semibold uppercase text-amber-600 dark:text-amber-400 border border-amber-500/40 px-1.5 py-0.2 rounded-full bg-transparent">
                  Active
                </span>
              </div>
              <p className="text-xl font-bold text-amber-800 dark:text-amber-300">{pendingCount}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-transparent text-amber-600 dark:text-amber-400">
              <Clock size={16} />
            </div>
          </div>

          {/* Resolved Card */}
          <div
            onClick={() => {
              setStatusFilter("resolved");
              setPage(1);
            }}
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-xl border border-emerald-500/30 bg-transparent p-3 shadow-2xs transition-all hover:scale-[1.01] hover:border-emerald-500/60 active:scale-[0.99]",
              statusFilter === "resolved" && "ring-2 ring-emerald-500/40 border-emerald-500/60"
            )}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Resolved</p>
                <span className="text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded-full bg-transparent">
                  Done
                </span>
              </div>
              <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">{resolvedCount}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-transparent text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>

          {/* Support for Me Card */}
          <div
            onClick={() => {
              handleViewChange("for-me");
              setPage(1);
            }}
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-xl border border-violet-500/30 bg-transparent p-3 shadow-2xs transition-all hover:scale-[1.01] hover:border-violet-500/60 active:scale-[0.99]",
              viewMode === "for-me" && "ring-2 ring-violet-500/40 border-violet-500/60"
            )}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wider">For Me</p>
                <span className="text-[9px] font-semibold uppercase text-violet-600 dark:text-violet-400 border border-violet-500/40 px-1.5 py-0.2 rounded-full bg-transparent">
                  Assigned
                </span>
              </div>
              <p className="text-xl font-bold text-violet-800 dark:text-violet-300">{forMeActiveCount}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-500/30 bg-transparent text-violet-600 dark:text-violet-400">
              <User size={16} />
            </div>
          </div>
        </div>

        {/* View tabs & Status filters */}
        {/*
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-0 rounded-xl border bg-muted/30 p-1">
            {isManager && (
              <button
                type="button"
                onClick={() => handleViewChange("all")}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                  viewMode === "all"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Team Support ({items.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => handleViewChange("mine")}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                viewMode === "mine"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              My Requests
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("for-me")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                viewMode === "for-me"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Support Requested for Me
              {forMeActiveCount > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                  {forMeActiveCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-xl border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => { setStatusFilter("all"); setPage(1); }}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === "all"
                  ? "bg-card text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Status
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter("in_progress"); setPage(1); }}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === "in_progress"
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Pending ({activeItems.filter((s) => !s.resolved).length})
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter("resolved"); setPage(1); }}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === "resolved"
                  ? "bg-emerald-600 text-white font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Resolved ({activeItems.filter((s) => s.resolved).length})
            </button>
          </div>
        </div>
        */}

        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
              className="appearance-none rounded-lg border bg-background py-2 pl-3 pr-8 text-sm outline-none focus:border-primary"
            >
              <option value="all">Status: All</option>
              <option value="in_progress">In Progress (Pending)</option>
              <option value="resolved">Resolved</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-2">
            <Search size={13} className="shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by Title or Description..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Date Raised
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  From
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {search || statusFilter !== "all"
                      ? "No Support Requests Match Your Filters."
                      : viewMode === "mine"
                      ? "No Support Requests Recorded Yet."
                      : viewMode === "for-me"
                      ? "No One Has Requested Support from You Yet."
                      : "No Support Requests Found in the System."}
                  </td>
                </tr>
              ) : (
                paginated.map((item) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isSelected
                          ? "border-l-[3px] border-l-primary bg-primary/5"
                          : "border-l-[3px] border-l-transparent hover:bg-muted/30"
                      )}
                    >
                      <td className="max-w-xs px-5 py-3.5">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{item.text}</p>
                        {item.editedBy && (
                          <span className="text-[10px] text-muted-foreground/70 block mt-0.5 font-normal">
                            (edited by {item.editedBy.name?.split(" ")[0] ?? item.editedBy.email.split("@")[0]})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge resolved={item.resolved} />
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground">
                        {formatFullDate(item.date)}
                      </td>
                      <td className="px-4 py-3.5">
                        <UserAvatar user={item.raisedBy} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination footer */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-t px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {Math.min((safePage - 1) * PAGE_SIZE + 1, filtered.length)}–
                {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} Item
                {filtered.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-accent disabled:opacity-30"
                >
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded border text-xs font-medium transition-colors",
                      p === safePage
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-accent disabled:opacity-30"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Detail Panel ────────────────────────────────────────────── */}
      {selected && (
        <DetailPanel
          item={selected}
          isManager={isManager}
          canComment={isManager || selected.raisedBy.id === currentUserId || selected.supportFrom?.id === currentUserId}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      {showModal && (
        <RequestSupportModal
          teamMembers={teamMembers}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
