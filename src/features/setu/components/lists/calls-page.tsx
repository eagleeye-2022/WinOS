"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Clock,
  Clock3,
  Download,
  Filter,
  FilterX,
  Mic,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Plus,
  RotateCcw,
  Search,
  Signal,
  Sparkles,
  User,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { useUrlState, usePageViewState } from "@/lib/navigation/use-url-state";
import { CALL_DIRECTION, CALL_OUTCOME } from "../../constants";
import { useSetuStore } from "../../provider";
import type { CallDirection, CallOutcome } from "../../types";
import {
  callStats,
  dealTitle,
  formatDate,
  formatDuration,
  formatHoursMinutes,
  formatTime,
  isoDate,
  logSeconds,
  plainText,
} from "../../utils";
import { downloadCsv, inPeriod, matchesText, toCsv, type Period } from "../../insights";
import { CallCard, LogCallDialog, SortMenu } from "../deal/deal-calls-tab";
import { FilterDropdown, SetuButton, SetuPage, attempt } from "../setu-ui";
import { ListHeader } from "./list-ui";

type Sort = "recent" | "oldest" | "longest";
const SORTS: readonly Sort[] = ["recent", "oldest", "longest"];
const SORT_LABEL: Record<Sort, string> = { recent: "Most Recent", oldest: "Oldest", longest: "Longest" };
const PERIODS: readonly Period[] = ["all", "today", "week", "month", "quarter"];
const PERIOD_LABEL: Record<Period, string> = {
  all: "Any Time",
  today: "Today",
  week: "Last 7 Days",
  month: "This Month",
  quarter: "This Quarter",
};
const DIRECTIONS: readonly (CallDirection | "all")[] = ["all", "OUTBOUND", "INBOUND"];
const OUTCOMES: readonly (CallOutcome | "all")[] = ["all", ...(Object.keys(CALL_OUTCOME) as CallOutcome[])];

/**
 * Setu CRM → Activities → Calls
 * High-craft call logs stream with interactive call analytics,
 * unified filter bar, audio recording chips, and quick deal navigation.
 */
export function CallsPage() {
  const calls = useSetuStore((s) => s.calls);
  const deals = useSetuStore((s) => s.deals);
  const deleteCall = useSetuStore((s) => s.deleteCall);

  const [q, setQ] = useUrlState("q", "");
  const [direction, setDirection] = useUrlState<CallDirection | "all">("direction", "all", { allowed: DIRECTIONS });
  const [outcome, setOutcome] = useUrlState<CallOutcome | "all">("outcome", "all", { allowed: OUTCOMES });
  const [rep, setRep] = useUrlState("rep", "");
  const [period, setPeriod] = useUrlState<Period>("period", "all", { allowed: PERIODS });
  const [sort, setSort] = useUrlState<Sort>("sort", "recent", { allowed: SORTS });
  // null = closed, "new" = Log Call, an id = edit that call.
  const [dialog, setDialog] = usePageViewState<string | null>("CallsPage:dialog", null);

  const today = isoDate(new Date());
  const dealById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);
  const reps = useMemo(() => [...new Set(calls.map((c) => c.repName))].sort(), [calls]);

  const rows = useMemo(() => {
    return calls
      .filter((c) => {
        const d = dealById.get(c.dealId);
        return (
          (direction === "all" || c.direction === direction) &&
          (outcome === "all" || c.outcome === outcome) &&
          (!rep || c.repName === rep) &&
          inPeriod(c.startedAt, period, today) &&
          matchesText(q, c.title, plainText(c.summary), c.contactName, c.repName, d?.company, d?.title)
        );
      })
      .sort((a, b) =>
        sort === "oldest"
          ? a.startedAt.localeCompare(b.startedAt)
          : sort === "longest"
          ? logSeconds(b) - logSeconds(a)
          : b.startedAt.localeCompare(a.startedAt)
      );
  }, [calls, direction, outcome, rep, period, q, sort, today, dealById]);

  const stats = useMemo(() => callStats(rows), [rows]);
  const filtered = q !== "" || direction !== "all" || outcome !== "all" || rep !== "" || period !== "all";
  const activeFiltersCount =
    (q ? 1 : 0) +
    (direction !== "all" ? 1 : 0) +
    (outcome !== "all" ? 1 : 0) +
    (rep ? 1 : 0) +
    (period !== "all" ? 1 : 0);
  const editing = dialog && dialog !== "new" ? calls.find((c) => c.id === dialog) : undefined;

  const clearAllFilters = () => {
    setQ("");
    setDirection("all");
    setOutcome("all");
    setRep("");
    setPeriod("all");
  };

  const exportCsv = () => {
    if (!rows.length) return toast.info("No calls to export");
    downloadCsv(
      `setu-calls-${today}.csv`,
      toCsv([
        ["Date", "Start", "Duration", "Title", "Lead / Deal", "Contact", "Rep", "Direction", "Outcome", "Summary"],
        ...rows.map((c) => [
          formatDate(c.startedAt),
          formatTime(c.startedAt),
          formatDuration(logSeconds(c)),
          c.title,
          dealById.get(c.dealId)?.company ?? "",
          c.contactName,
          c.repName,
          CALL_DIRECTION[c.direction].label,
          CALL_OUTCOME[c.outcome].label,
          plainText(c.summary),
        ]),
      ])
    );
    toast.success(`Exported ${rows.length} calls to CSV`);
  };

  return (
    <SetuPage className="space-y-5 pb-12">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <ListHeader
        crumbs={[{ label: "Sales" }, { label: "Activities" }, { label: "Calls" }]}
        title="Call Activity Logs"
        subtitle="Every inbound, outbound, and recorded discovery call across your leads and enterprise deals."
        actions={
          <div className="flex items-center gap-2.5">
            <SetuButton
              onClick={exportCsv}
              disabled={rows.length === 0}
              variant="secondary"
              className="gap-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </SetuButton>
            <SetuButton
              variant="primary"
              onClick={() => setDialog("new")}
             
            >
              <Plus className="h-4 w-4" />
              <span>Log Call</span>
            </SetuButton>
          </div>
        }
      />

      {/* ── INTERACTIVE CALL KPI TILES ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Card 1: Total Calls */}
        <button
          type="button"
          onClick={() => {
            setDirection("all");
            setOutcome("all");
          }}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md",
            direction === "all" && outcome === "all"
              ? "border-[var(--setu-accent)] bg-[var(--setu-card)] ring-2 ring-[var(--setu-accent-ring)]"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Total Calls
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <PhoneCall className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {stats.total}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              {stats.outbound} outbound · {stats.inbound} inbound
            </p>
          </div>
        </button>

        {/* Card 2: Total Talk Time */}
        <div className="flex flex-col justify-between rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] p-4 text-left shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Total Talk Time
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
              <Clock3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {formatHoursMinutes(stats.talkSeconds)}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Across all logged calls
            </p>
          </div>
        </div>

        {/* Card 3: Connect Rate */}
        <button
          type="button"
          onClick={() => setOutcome(outcome === "CONNECTED" ? "all" : "CONNECTED")}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-emerald-500 hover:shadow-md",
            outcome === "CONNECTED"
              ? "border-emerald-500 bg-[var(--setu-card)] ring-2 ring-emerald-500/30"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Connect Rate
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Signal className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {stats.total ? `${stats.connectRate}%` : "—"}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Calls connected to prospect
            </p>
          </div>
        </button>

        {/* Card 4: Audio Recordings */}
        <div className="flex flex-col justify-between rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] p-4 text-left shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              With Audio
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Volume2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {stats.withAudio}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Calls with attached audio
            </p>
          </div>
        </div>
      </div>

      {/* ── FILTER TOOLBAR ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] p-3 shadow-sm">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          {/* Search Box */}
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--setu-text-3)]" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search calls by notes, summary, company, contact..."
              className="h-9 w-full rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] pl-9 pr-8 text-xs text-[var(--setu-text)] placeholder:text-[var(--setu-text-3)] focus:border-[var(--setu-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--setu-accent-ring)]"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[var(--setu-text-3)] hover:text-[var(--setu-text)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--setu-line)] bg-[var(--setu-card)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--setu-text-3)] sm:inline-block">
                /
              </kbd>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              value={period}
              onChange={(v) => setPeriod(v as Period)}
              options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
              className="h-9 rounded-xl text-xs"
            />
            <FilterDropdown
              label="Direction"
              value={direction}
              onChange={(v) => setDirection(v as CallDirection | "all")}
              options={DIRECTIONS.map((d) => ({
                value: d,
                label: d === "all" ? "All Directions" : CALL_DIRECTION[d].label,
              }))}
              className="h-9 rounded-xl text-xs"
            />
            <FilterDropdown
              label="Outcome"
              value={outcome}
              onChange={(v) => setOutcome(v as CallOutcome | "all")}
              options={OUTCOMES.map((o) => ({
                value: o,
                label: o === "all" ? "All Outcomes" : CALL_OUTCOME[o].label,
              }))}
              className="h-9 rounded-xl text-xs"
            />
            <FilterDropdown
              label="Rep"
              value={rep}
              onChange={setRep}
              options={[{ value: "", label: "All Reps" }, ...reps.map((r) => ({ value: r, label: r }))]}
              className="h-9 rounded-xl text-xs"
            />

            {/* Clear All Button */}
            {filtered && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] px-3 text-xs font-medium text-[var(--setu-text-2)] transition-all hover:bg-[var(--setu-soft)] hover:text-[var(--setu-text)]"
              >
                <FilterX className="h-3.5 w-3.5 text-rose-500" />
                <span>Reset ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Counter, Quick Direction Tabs & Sort */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between border-t border-[var(--setu-line)] pt-2.5 text-xs text-[var(--setu-text-3)]">
          <div className="flex items-center gap-3">
            <span>
              Showing <span className="font-semibold text-[var(--setu-text)]">{rows.length}</span> of {calls.length} calls
            </span>
            {filtered && (
              <span className="inline-flex items-center rounded-full bg-[var(--setu-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--setu-accent)]">
                Filtered view
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Direction Tabs */}
            <div className="hidden items-center gap-1.5 sm:flex">
              {DIRECTIONS.map((d) => {
                const active = direction === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className={cn(
                      "rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors",
                      active
                        ? "bg-[var(--setu-soft)] text-[var(--setu-text)] font-semibold"
                        : "text-[var(--setu-text-3)] hover:text-[var(--setu-text)]"
                    )}
                  >
                    {d === "all" ? "All" : CALL_DIRECTION[d].label}
                  </button>
                );
              })}
            </div>

            {/* Sort Menu */}
            <SortMenu value={sort} onChange={setSort} options={SORTS} labels={SORT_LABEL} />
          </div>
        </div>
      </div>

      {/* ── CALLS STREAM CARDS ────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] p-16 text-center shadow-sm">
          <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--setu-well)] text-[var(--setu-text-3)]">
              <PhoneCall className="h-6 w-6" />
            </div>
            <h3 className="mt-1 text-sm font-semibold text-[var(--setu-text)]">
              {calls.length === 0 ? "No calls logged yet" : "No calls match current filters"}
            </h3>
            <p className="text-xs text-[var(--setu-text-3)]">
              {calls.length === 0
                ? "Log your first discovery call or client check-in to track call activity and outcomes."
                : "Try adjusting your search query, direction, outcome, or period filter."}
            </p>
            {filtered ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-[var(--setu-line)] bg-[var(--setu-card)] px-3 py-1.5 text-xs font-semibold text-[var(--setu-text)] shadow-sm hover:bg-[var(--setu-soft)]"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear all filters</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDialog("new")}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-[var(--setu-accent-ring)] bg-[var(--setu-accent-soft)] text-[var(--setu-accent)] hover:bg-[color-mix(in_oklch,var(--setu-accent)_20%,transparent)] px-3 py-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Log First Call</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const d = dealById.get(c.dealId);
            return (
              <CallCard
                key={c.id}
                call={c}
                related={
                  d
                    ? { href: `${ROUTES.setuDeal(d.id)}?tab=calls`, label: `${d.company} · ${dealTitle(d)}` }
                    : undefined
                }
                onEdit={() => setDialog(c.id)}
                onDelete={() => void attempt(deleteCall(c.id), "Call deleted")}
              />
            );
          })}
        </div>
      )}

      {/* ── DIALOG ────────────────────────────────────────────────────────── */}
      <LogCallDialog
        key={dialog ?? "closed"}
        deal={editing ? dealById.get(editing.dealId) : undefined}
        call={editing}
        open={dialog === "new" || Boolean(editing)}
        onClose={() => setDialog(null)}
      />
    </SetuPage>
  );
}
