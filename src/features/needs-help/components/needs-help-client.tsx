"use client";

import { useActionState, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/features/dsm/utils";
import { daysOpen, filterHelpRequests, type HelpStatusFilter } from "../utils";
import { markHelpResolved, type MarkHelpResolvedState } from "../actions/mark-help-resolved";
import type { HelpRequestItem } from "../queries";

const PAGE_SIZE = 8;

function getVisiblePages(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    if (!pages.includes(i)) pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  if (!pages.includes(total)) pages.push(total);
  return pages;
}

const STATUS_STYLES = {
  in_progress: "border border-info/40 text-info bg-transparent",
  resolved: "border border-success/40 text-success bg-transparent",
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

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ item, onClose }: { item: HelpRequestItem; onClose: () => void }) {
  const router = useRouter();
  const [resolveState, resolveAction, resolvePending] = useActionState<MarkHelpResolvedState, FormData>(
    markHelpResolved, {}
  );
  const days = daysOpen(item.date);
  const isResolved = item.resolved || resolveState.message === "resolved";

  useEffect(() => {
    if (resolveState.message === "resolved") router.refresh();
  }, [resolveState.message, router]);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l bg-card xl:w-80">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <span className="text-sm font-semibold">Request Details</span>
        <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
          <X size={15} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Description</p>
          <p className="text-sm leading-relaxed">{item.text}</p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Days Open
          </p>
          <p className={cn("text-sm font-semibold", days > 3 ? "text-destructive" : "text-foreground")}>
            {days === 0 ? "Today" : `${days} Day${days !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</p>
          <StatusBadge resolved={isResolved} />
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Requested By
          </p>
          <UserAvatar user={item.raisedBy} />
        </div>

        <div className="h-px bg-border" />

        {resolveState.message && resolveState.message !== "resolved" && (
          <p className="text-xs text-destructive">{resolveState.message}</p>
        )}
      </div>

      <div className="border-t px-5 py-4">
        <form action={resolveAction}>
          <input type="hidden" name="supportId" value={item.id} />
          <button
            type="submit"
            disabled={isResolved || resolvePending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {resolvePending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {isResolved ? "Resolved" : resolvePending ? "Resolving…" : "Mark as Resolved"}
          </button>
        </form>
      </div>
    </aside>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

type Props = { items: HelpRequestItem[] };

export function NeedsHelpClient({ items }: Props) {
  const [statusFilter, setStatusFilter] = useState<HelpStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => items[0]?.id ?? null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => filterHelpRequests(items, statusFilter, search),
    [items, statusFilter, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = items.find((s) => s.id === selectedId) ?? null;
  const activeCount = items.filter((s) => !s.resolved).length;

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Needs My Help</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Support Requests Where Teammates Have Tagged You for Help.
            </p>
          </div>
        </div>

        {/* Dashboard Metric Stat Cards */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-xl border border-border bg-transparent p-3 shadow-2xs transition-all hover:scale-[1.01] hover:border-primary/50 active:scale-[0.99]",
              statusFilter === "all" && "ring-2 ring-primary/40 border-primary/50"
            )}
          >
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Requests</p>
              <p className="text-xl font-bold text-foreground">{items.length}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-transparent text-primary">
              <Search size={16} />
            </div>
          </div>

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
                <p className="text-[11px] font-semibold text-warning uppercase tracking-wider">Pending</p>
                <span className="text-[9px] font-semibold uppercase text-warning border border-amber-500/40 px-1.5 py-0.2 rounded-full bg-transparent">
                  Active
                </span>
              </div>
              <p className="text-xl font-bold text-warning">{activeCount}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-transparent text-warning">
              <Search size={16} />
            </div>
          </div>

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
                <p className="text-[11px] font-semibold text-success uppercase tracking-wider">Resolved</p>
                <span className="text-[9px] font-semibold uppercase text-success border border-emerald-500/40 px-1.5 py-0.2 rounded-full bg-transparent">
                  Done
                </span>
              </div>
              <p className="text-xl font-bold text-success">{items.length - activeCount}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-transparent text-success">
              <CheckCircle2 size={16} />
            </div>
          </div>
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
            <ChevronRight size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-muted-foreground" />
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-2">
            <Search size={13} className="shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by Description or Requester..."
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
                      ? "No Items Match Your Filters."
                      : "No One Has Tagged You for Support Yet."}
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
                      <td className="px-4 py-3.5 text-sm text-muted-foreground">
                        {formatShortDate(item.date)}
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
                  className="flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-accent disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft size={13} />
                </button>
                {getVisiblePages(safePage, totalPages).map((p, idx) =>
                  typeof p === "number" ? (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer",
                        p === safePage
                          ? "border-primary bg-primary text-primary-foreground font-bold"
                          : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {p}
                    </button>
                  ) : (
                    <span key={`dots-${idx}`} className="px-1 text-xs text-muted-foreground">
                      ...
                    </span>
                  )
                )}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-accent disabled:opacity-30 cursor-pointer"
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
    </div>
  );
}
