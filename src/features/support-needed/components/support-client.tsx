"use client";

import { useActionState, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Search, X, ChevronLeft, ChevronRight, ChevronDown, Play, CheckCircle2, Pencil, MessageSquare } from "lucide-react";
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
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
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
  const isResolved = item.resolved || resolveState.message === "resolved";

  const [editingText, setEditingText] = useState(false);
  const [editState, editAction, editPending] = useActionState<EditSupportState, FormData>(editSupport, {});

  useEffect(() => {
    if (resolveState.message === "resolved" || editState.message === "updated") {
      router.refresh();
    }
  }, [resolveState.message, editState.message, router]);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l bg-card xl:w-80">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <span className="text-base font-bold">Support Details</span>
        <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
          <X size={15} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Description
            </p>
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
            <div>
              <p className="text-sm leading-relaxed">{item.text}</p>
              {item.editedBy && (
                <span className="text-[10px] text-muted-foreground/70 block mt-1 font-normal">
                  (edited by {item.editedBy.name?.split(" ")[0] ?? item.editedBy.email.split("@")[0]})
                </span>
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

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Updates
          </p>
          <CommentThread comments={item.comments} />
        </div>

        {canComment && !isResolved && <CommentForm supportId={item.id} />}

        {resolveState.message && resolveState.message !== "resolved" && (
          <p className="text-xs text-destructive">{resolveState.message}</p>
        )}
        {reminderState.message === "sent" && (
          <p className="text-xs text-emerald-600">Reminder Sent.</p>
        )}
        {reminderState.message === "no_target" && (
          <p className="text-xs text-muted-foreground">
            No One to Notify — Add a @mention When Requesting Support.
          </p>
        )}
        {reminderState.message === "already_resolved" && (
          <p className="text-xs text-muted-foreground">This Item Is Already Resolved.</p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t px-5 py-4">
        {isManager && (
          <form action={resolveAction}>
            <input type="hidden" name="supportId" value={item.id} />
            <button
              type="submit"
              disabled={isResolved || resolvePending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <svg className="h-3.75 w-3.75" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              {isResolved ? "Resolved" : resolvePending ? "Resolving…" : "Mark as Resolved"}
            </button>
          </form>
        )}
        <form action={reminderAction}>
          <input type="hidden" name="supportId" value={item.id} />
          <button
            type="submit"
            disabled={isResolved || reminderPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            <Play size={14} />
            {reminderPending ? "Sending…" : "Send Reminder"}
          </button>
        </form>
      </div>
    </aside>
  );
}

// ── Request support modal ─────────────────────────────────────────────────────

function RequestSupportModal({
  teamMembers,
  onClose,
}: {
  teamMembers: TeamMember[];
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
            <span className="font-semibold">Support Request Raised.</span>
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
              placeholder="What Support Do You Need?"
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
            />
            {state.errors?.text && <p className="mt-1 text-xs text-destructive">{state.errors.text[0]}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Support From <span className="font-normal opacity-60">(optional)</span>
            </label>
            <select
              name="mentionedUserId"
              defaultValue=""
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">No One Specific</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email.split("@")[0]}{m.title ? ` — ${m.title}` : ""}
                </option>
              ))}
            </select>
          </div>
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
              {pending ? "Requesting…" : "Request Support"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

type ViewMode = "mine" | "for-me";

type Props = {
  items: SupportNeedItem[];
  itemsForMe: SupportNeedItem[];
  teamMembers: TeamMember[];
  currentUserId: string;
  isManager: boolean;
};

export function SupportClient({ items, itemsForMe, teamMembers, currentUserId, isManager }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("mine");
  const [statusFilter, setStatusFilter] = useState<SupportStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => items[0]?.id ?? null);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const activeItems = viewMode === "mine" ? items : itemsForMe;

  const filtered = useMemo(
    () => filterSupport(activeItems, statusFilter, search),
    [activeItems, statusFilter, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const allItems = [...items, ...itemsForMe];
  const selected = allItems.find((s) => s.id === selectedId) ?? null;
  const activeCount = items.filter((s) => !s.resolved).length;
  const forMeActiveCount = itemsForMe.filter((s) => !s.resolved).length;

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    setPage(1);
    setStatusFilter("all");
    setSearch("");
    const next = mode === "mine" ? items : itemsForMe;
    setSelectedId(next[0]?.id ?? null);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Support Needed</h1>
              <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                {activeCount} Active
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Identify Challenges Early and Collaborate to Keep Work Moving.
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

        {/* View tabs */}
        <div className="mb-4 flex w-fit gap-0 rounded-xl border bg-muted/30 p-1">
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
            Requests for Me
            {forMeActiveCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {forMeActiveCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as SupportStatusFilter); setPage(1); }}
              className="appearance-none rounded-lg border bg-background py-2 pl-3 pr-8 text-sm outline-none focus:border-primary"
            >
              <option value="all">Status: All</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="relative">
            <select
              className="appearance-none rounded-lg border bg-background py-2 pl-3 pr-8 text-sm outline-none focus:border-primary"
              defaultValue=""
            >
              <option value="">Priority: All</option>
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
        <div className="overflow-hidden rounded-xl border bg-card">
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
                  {viewMode === "mine" ? "Support From" : "Requested By"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {search || statusFilter !== "all"
                      ? "No Items Match Your Filters."
                      : viewMode === "mine"
                      ? "No Support Requests Yet. Add One from Your DSM or Use the Button Above."
                      : "No One Has Requested Support from You Yet."}
                  </td>
                </tr>
              ) : (
                paginated.map((item) => {
                  const isSelected = item.id === selectedId;
                  const personToShow = viewMode === "mine" ? item.supportFrom : item.raisedBy;
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
                        <UserAvatar user={personToShow} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-t px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {paginated.length} of {filtered.length} Item{filtered.length !== 1 ? "s" : ""}
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

      {/* ── Detail panel ──────────────────────────────────────────────── */}
      {selected && (
        <DetailPanel
          key={selected.id}
          item={selected}
          isManager={isManager}
          canComment={isManager || selected.raisedBy.id === currentUserId}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {showModal && (
        <RequestSupportModal
          teamMembers={teamMembers}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
