"use client";

import { useActionState, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Search, X, ChevronLeft, ChevronRight, ChevronDown, Play, CheckCircle2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFullDate } from "@/features/dsm/utils";
import { daysOpen, filterBlockers, type BlockerStatusFilter, type BlockerPriorityFilter } from "../utils";
import { markBlockerResolved, type MarkBlockerResolvedState } from "../actions/mark-resolved";
import { createBlocker, type CreateBlockerState } from "../actions/create-blocker";
import { sendBlockerReminder, type BlockerReminderState } from "../actions/send-reminder";
import type { BlockerItem } from "../queries";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

// ── Badge helpers ─────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
} as const;

const PRIORITY_STYLES = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-orange-100 text-orange-700",
  LOW: "bg-violet-100 text-violet-700",
} as const;

function StatusBadge({ resolved }: { resolved: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
      resolved ? STATUS_STYLES.resolved : STATUS_STYLES.in_progress
    )}>
      {resolved ? "Resolved" : "In Progress"}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: "LOW" | "MEDIUM" | "HIGH" }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
      PRIORITY_STYLES[priority]
    )}>
      {priority}
    </span>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  item,
  onClose,
}: {
  item: BlockerItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [resolveState, resolveAction, resolvePending] = useActionState<MarkBlockerResolvedState, FormData>(
    markBlockerResolved, {}
  );
  const [reminderState, reminderAction, reminderPending] = useActionState<BlockerReminderState, FormData>(
    sendBlockerReminder, {}
  );
  const days = daysOpen(item.date);
  const isResolved = item.resolved || resolveState.message === "resolved";

  // Refresh page data when resolve succeeds so the table row stays in sync
  useEffect(() => {
    if (resolveState.message === "resolved") router.refresh();
  }, [resolveState.message, router]);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l bg-card xl:w-80">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4">
        <span className="text-base font-bold">Blocker Details</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <X size={15} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Description</p>
            <button type="button" className="text-muted-foreground hover:text-primary">
              <Pencil size={13} />
            </button>
          </div>
          <p className="text-sm leading-relaxed">{item.text}</p>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Days Open
          </p>
          <p className={cn("text-sm font-semibold", days > 0 ? "text-destructive" : "text-foreground")}>
            {days === 0 ? "Today" : `${days} Day${days !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="h-px bg-border" />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 border-t px-5 py-4">
        {(resolveState.message && resolveState.message !== "resolved") && (
          <p className="text-xs text-destructive">{resolveState.message}</p>
        )}
        {reminderState.message === "sent" && (
          <p className="text-xs text-emerald-600">Reminder sent.</p>
        )}
        {reminderState.message === "no_target" && (
          <p className="text-xs text-muted-foreground">No manager found to notify.</p>
        )}
        {reminderState.message === "already_resolved" && (
          <p className="text-xs text-muted-foreground">This blocker is already resolved.</p>
        )}
        <form action={resolveAction}>
          <input type="hidden" name="blockerId" value={item.id} />
          <button
            type="submit"
            disabled={isResolved || resolvePending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <svg className="h-3.75 w-3.75" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            {isResolved ? "Resolved" : resolvePending ? "Resolving…" : "Mark as Resolved"}
          </button>
        </form>

        <form action={reminderAction}>
          <input type="hidden" name="blockerId" value={item.id} />
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

// ── Raise blocker modal ───────────────────────────────────────────────────────

function RaiseBlockerModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CreateBlockerState, FormData>(createBlocker, {});

  if (state.message === "created") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
          <div className="mb-4 flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={18} />
            <span className="font-semibold">Blocker raised successfully.</span>
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
          <h2 className="text-base font-semibold">Raise New Blocker</h2>
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
              placeholder="Describe what is blocking you..."
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
            />
            {state.errors?.text && <p className="mt-1 text-xs text-destructive">{state.errors.text[0]}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Priority</label>
            <select
              name="priority"
              defaultValue="MEDIUM"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
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
              {pending ? "Raising…" : "Raise Blocker"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

type Props = { items: BlockerItem[] };

export function BlockersClient({ items }: Props) {
  const [statusFilter, setStatusFilter] = useState<BlockerStatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<BlockerPriorityFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => items[0]?.id ?? null);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(
    () => filterBlockers(items, statusFilter, priorityFilter, search),
    [items, statusFilter, priorityFilter, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = items.find((b) => b.id === selectedId) ?? null;
  const activeCount = items.filter((b) => !b.resolved).length;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">My Blockers</h1>
              <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                {activeCount} Active
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage and resolve dependencies hindering your workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <PlusCircle size={16} />
            Raise New Blocker
          </button>
        </div>

        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
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
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value as typeof priorityFilter); setPage(1); }}
              className="appearance-none rounded-lg border bg-background py-2 pl-3 pr-8 text-sm outline-none focus:border-primary"
            >
              <option value="all">Priority: All</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-2">
            <Search size={13} className="shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by title or description..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Blocker Detail
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Date Raised
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Blocked By
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {search || statusFilter !== "all" || priorityFilter !== "all"
                      ? "No blockers match your filters."
                      : "No blockers recorded yet. Raise one from your DSM or use the button above."}
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
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge resolved={item.resolved} />
                      </td>
                      <td className="px-4 py-3.5">
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground">
                        {formatFullDate(item.date)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {(item.raisedBy.name ?? item.raisedBy.email).slice(0, 2).toUpperCase()}
                          </span>
                          <span className="text-sm">
                            {item.raisedBy.name?.split(" ")[0] ?? item.raisedBy.email.split("@")[0]}
                          </span>
                        </div>
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
                Showing {paginated.length} of {filtered.length} blocker{filtered.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
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
                  className="flex h-7 w-7 items-center justify-center rounded border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
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
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {showModal && <RaiseBlockerModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
