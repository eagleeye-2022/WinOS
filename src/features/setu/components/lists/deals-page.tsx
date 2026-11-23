"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  CircleX,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  FilterX,
  Handshake,
  IndianRupee,
  Layers,
  MoreHorizontal,
  Percent,
  RotateCcw,
  Search,
  Sparkles,
  TrendingUp,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { useUrlState, usePageViewState } from "@/lib/navigation/use-url-state";
import { STAGE_BY_ID } from "../../constants";
import { useSetuStore } from "../../provider";
import type { Deal, DealStage } from "../../types";
import {
  dealTitle,
  displayCode,
  formatDate,
  formatDateTime,
  formatInr,
  formatInrShort,
  isoDate,
  relativeDay,
} from "../../utils";
import {
  DEALS_STAGES,
  downloadCsv,
  inPeriod,
  matchesText,
  pipelineStats,
  toCsv,
  type Period,
} from "../../insights";
import { EditDealDialog } from "../deal-form-dialog";
import { FilterDropdown, SetuAvatar, SetuButton, SetuPage, StageBadge } from "../setu-ui";
import { DealRowMenu, ListHeader } from "./list-ui";

type StageFilter = "all" | "open" | DealStage;
type Sort = "updated" | "value" | "closed";

const STAGE_VALUES: readonly StageFilter[] = ["all", "open", ...DEALS_STAGES];
const PERIODS: readonly Period[] = ["all", "month", "quarter"];
const SORTS: readonly Sort[] = ["updated", "value", "closed"];

const PERIOD_LABEL: Record<Period, string> = {
  all: "Any Time",
  today: "Today",
  week: "This Week",
  month: "This Month",
  quarter: "This Quarter",
};

const SORT_LABEL: Record<Sort, string> = {
  updated: "Last Updated",
  value: "Highest Value",
  closed: "Recently Closed",
};

/**
 * Setu CRM → Deals Pipeline
 * High-craft executive deals workspace with interactive pipeline filters,
 * commercial valuation prominence, revision tracking, and stage transitions.
 */
export function DealsPage() {
  const router = useRouter();
  const all = useSetuStore((s) => s.deals);

  const [q, setQ] = useUrlState("q", "");
  const [stage, setStage] = useUrlState<StageFilter>("stage", "all", { allowed: STAGE_VALUES });
  const [owner, setOwner] = useUrlState("owner", "");
  const [period, setPeriod] = useUrlState<Period>("period", "all", { allowed: PERIODS });
  const [sort, setSort] = useUrlState<Sort>("sort", "updated", { allowed: SORTS });
  const [editId, setEditId] = usePageViewState<string | null>("DealsPage:edit", null);

  const today = isoDate(new Date());

  // Only records from Proposal on are deals
  const deals = useMemo(() => all.filter((d) => DEALS_STAGES.includes(d.stage)), [all]);
  const owners = useMemo(() => [...new Set(deals.map((d) => d.ownerName))].sort(), [deals]);

  /** Closed deals are dated by their close date; open ones by their last update. */
  const dateOf = (d: Deal) => d.closedAt ?? d.updatedAt;

  // Filtered rows
  const rows = useMemo(() => {
    return deals
      .filter(
        (d) =>
          (stage === "all" || (stage === "open" ? !STAGE_BY_ID[d.stage].closed : d.stage === stage)) &&
          (!owner || d.ownerName === owner) &&
          inPeriod(dateOf(d), period, today) &&
          matchesText(q, d.title, d.company, d.contactName, d.dealCode, d.leadCode, d.remark)
      )
      .sort((a, b) =>
        sort === "value"
          ? (b.value ?? 0) - (a.value ?? 0)
          : sort === "closed"
          ? (b.closedAt ?? "").localeCompare(a.closedAt ?? "")
          : b.updatedAt.localeCompare(a.updatedAt)
      );
  }, [deals, stage, owner, period, q, sort, today]);

  const stats = useMemo(() => pipelineStats(rows), [rows]);
  const openRows = useMemo(() => rows.filter((d) => !STAGE_BY_ID[d.stage].closed), [rows]);
  const openValue = useMemo(() => openRows.reduce((n, d) => n + (d.value ?? 0), 0), [openRows]);

  const filtered = q !== "" || stage !== "all" || owner !== "" || period !== "all";
  const activeFiltersCount = (q ? 1 : 0) + (stage !== "all" ? 1 : 0) + (owner ? 1 : 0) + (period !== "all" ? 1 : 0);
  const editing = all.find((d) => d.id === editId);

  const clearAllFilters = () => {
    setQ("");
    setStage("all");
    setOwner("");
    setPeriod("all");
  };

  const exportCsv = () => {
    if (!rows.length) return toast.info("No deals to export");
    downloadCsv(
      `setu-deals-${today}.csv`,
      toCsv([
        ["Code", "Deal", "Company", "Contact", "Stage", "Value (INR)", "Proposal", "Owner", "Closed", "Last Updated"],
        ...rows.map((d) => [
          displayCode(d),
          dealTitle(d),
          d.company,
          d.contactName,
          STAGE_BY_ID[d.stage].label,
          d.value ?? "",
          d.proposalVersion ? `V${d.proposalVersion}` : "",
          d.ownerName,
          d.closedAt ?? "",
          formatDateTime(d.updatedAt),
        ]),
      ])
    );
    toast.success(`Exported ${rows.length} deals to CSV`);
  };

  return (
    <SetuPage className="space-y-5 pb-12">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <ListHeader
        crumbs={[{ label: "Sales" }, { label: "Deals" }]}
        title="Commercial Deals"
        subtitle="Active proposals, commercial negotiations, and closed contracts across your enterprise pipeline."
        actions={
          <div className="flex items-center gap-2.5">
            <SetuButton
              onClick={exportCsv}
              disabled={rows.length === 0}
              variant="secondary"
            >
              <Download />
              <span>Export CSV</span>
            </SetuButton>
            <SetuButton asChild variant="primary">
              <Link href={ROUTES.setuTasks}>
                <Layers />
                <span>Tasks Board</span>
              </Link>
            </SetuButton>
          </div>
        }
      />

      {/* ── INTERACTIVE KPI STRIP (Deals Pipeline Metrics) ───────────────── */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Card 1: Open Pipeline */}
        <button
          type="button"
          onClick={() => setStage(stage === "open" ? "all" : "open")}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md",
            stage === "open"
              ? "border-[var(--setu-accent)] bg-[var(--setu-card)] ring-2 ring-[var(--setu-accent-ring)]"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Open Pipeline
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
              <CircleDollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {formatInr(openValue)}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              {openRows.length} active deal{openRows.length === 1 ? "" : "s"} in motion
            </p>
          </div>
        </button>

        {/* Card 2: Closed Won */}
        <button
          type="button"
          onClick={() => setStage(stage === "CLOSED_WON" ? "all" : "CLOSED_WON")}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md",
            stage === "CLOSED_WON"
              ? "border-[var(--setu-accent)] bg-[var(--setu-card)] ring-2 ring-[var(--setu-accent-ring)]"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Closed Won
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <BadgeCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {formatInr(stats.wonValue)}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              {stats.wonCount} won contract{stats.wonCount === 1 ? "" : "s"}
            </p>
          </div>
        </button>

        {/* Card 3: Win Rate */}
        <button
          type="button"
          onClick={() => setStage("all")}
          className="group flex flex-col justify-between rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Win Rate
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {stats.winRate === null ? "—" : `${stats.winRate}%`}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              {stats.wonCount} won · {stats.lostCount} lost
            </p>
          </div>
        </button>

        {/* Card 4: Avg Won Deal Size */}
        <button
          type="button"
          onClick={() => setSort("value")}
          className="group flex flex-col justify-between rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Avg. Deal Size
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Handshake className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {stats.avgWon ? formatInr(stats.avgWon) : "—"}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Average closed contract value
            </p>
          </div>
        </button>
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
              placeholder="Search deal title, company, contact, code..."
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
              label="Stage"
              value={stage}
              onChange={(v) => setStage(v as StageFilter)}
              options={[
                { value: "all", label: "All Stages" },
                { value: "open", label: "Open Deals" },
                ...DEALS_STAGES.map((s) => ({ value: s, label: STAGE_BY_ID[s].label })),
              ]}
              className="h-9 rounded-xl text-xs"
            />
            <FilterDropdown
              label="Owner"
              value={owner}
              onChange={setOwner}
              options={[{ value: "", label: "All Reps" }, ...owners.map((o) => ({ value: o, label: o }))]}
              className="h-9 rounded-xl text-xs"
            />
            <FilterDropdown
              label="Period"
              value={period}
              onChange={(v) => setPeriod(v as Period)}
              options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
              className="h-9 rounded-xl text-xs"
            />
            <FilterDropdown
              label="Sort"
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              options={SORTS.map((s) => ({ value: s, label: SORT_LABEL[s] }))}
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

        {/* Counter & Quick Stage Tabs */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between border-t border-[var(--setu-line)] pt-2.5 text-xs text-[var(--setu-text-3)]">
          <div className="flex items-center gap-2">
            <span>
              Showing <span className="font-semibold text-[var(--setu-text)]">{rows.length}</span> of {deals.length} deals
            </span>
            {filtered && (
              <span className="inline-flex items-center rounded-full bg-[var(--setu-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--setu-accent)]">
                Filtered view
              </span>
            )}
          </div>

          {/* Quick Stage Tabs */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              onClick={() => setStage("all")}
              className={cn(
                "rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors",
                stage === "all"
                  ? "bg-[var(--setu-soft)] text-[var(--setu-text)] font-semibold"
                  : "text-[var(--setu-text-3)] hover:text-[var(--setu-text)]"
              )}
            >
              All ({deals.length})
            </button>
            <button
              onClick={() => setStage("open")}
              className={cn(
                "rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors",
                stage === "open"
                  ? "bg-[var(--setu-soft)] text-[var(--setu-text)] font-semibold"
                  : "text-[var(--setu-text-3)] hover:text-[var(--setu-text)]"
              )}
            >
              Open ({deals.filter((d) => !STAGE_BY_ID[d.stage].closed).length})
            </button>
            {DEALS_STAGES.map((s) => {
              const countVal = deals.filter((d) => d.stage === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStage(s)}
                  className={cn(
                    "rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors",
                    stage === s
                      ? "bg-[var(--setu-soft)] text-[var(--setu-text)] font-semibold"
                      : "text-[var(--setu-text-3)] hover:text-[var(--setu-text)]"
                  )}
                >
                  {STAGE_BY_ID[s].label} ({countVal})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── HIGH-CRAFT DEALS TABLE ────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] shadow-sm">
        <div className="setu-scroll-x overflow-x-auto">
          <table className="w-full text-left text-xs" style={{ minWidth: 940 }}>
            <thead>
              <tr className="border-b border-[var(--setu-line)] bg-[var(--setu-well)] text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
                <th className="py-3.5 pl-5 pr-4">Deal & ID</th>
                <th className="py-3.5 px-4">Company & Contact</th>
                <th className="py-3.5 px-4">Pipeline Stage</th>
                <th className="py-3.5 px-4">Contract Value</th>
                <th className="py-3.5 px-4">Proposal</th>
                <th className="py-3.5 px-4">Owner</th>
                <th className="py-3.5 px-4">Status / Timeline</th>
                <th className="py-3.5 pr-4 pl-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--setu-line)]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--setu-well)] text-[var(--setu-text-3)]">
                        <Handshake className="h-6 w-6" />
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-[var(--setu-text)]">
                        {deals.length === 0 ? "No deals in pipeline" : "No deals match current filters"}
                      </h3>
                      <p className="text-xs text-[var(--setu-text-3)]">
                        {deals.length === 0
                          ? "Leads automatically advance to deals as soon as they reach Proposal stage."
                          : "Try adjusting your search query, stage, owner, or timeframe filters."}
                      </p>
                      {filtered && (
                        <SetuButton
                          size="sm"
                          onClick={clearAllFilters}
                          className="mt-2"
                        >
                          <RotateCcw />
                          <span>Clear all filters</span>
                        </SetuButton>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((d) => {
                  const isWon = d.stage === "CLOSED_WON";
                  const isLost = d.stage === "CLOSED_LOST";

                  return (
                    <tr
                      key={d.id}
                      onClick={() => router.push(ROUTES.setuDeal(d.id))}
                      className="group cursor-pointer transition-colors hover:bg-[var(--setu-soft)]/60"
                      title="Click to view deal details"
                    >
                      {/* Deal & Code */}
                      <td className="py-3.5 pl-5 pr-4">
                        <span className="block font-semibold text-[var(--setu-text)] group-hover:text-[var(--setu-accent)]">
                          {dealTitle(d)}
                        </span>
                        <span className="mt-0.5 inline-block rounded border border-[var(--setu-line)] bg-[var(--setu-well)] px-1.5 py-0.2 font-mono text-[10px] text-[var(--setu-text-2)]">
                          {displayCode(d)}
                        </span>
                      </td>

                      {/* Company & Contact */}
                      <td className="py-3.5 px-4">
                        <span className="block font-medium text-[var(--setu-text)]">{d.company}</span>
                        <span className="block text-[11px] text-[var(--setu-text-3)]">{d.contactName || "—"}</span>
                      </td>

                      {/* Pipeline Stage */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StageBadge stage={d.stage} suffix="" />
                      </td>

                      {/* Contract Value */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {d.value !== undefined ? (
                          <span
                            className={cn(
                              "font-semibold tabular-nums text-sm",
                              isWon ? "text-emerald-500 font-bold" : "text-[var(--setu-text)]"
                            )}
                          >
                            {formatInr(d.value)}
                          </span>
                        ) : (
                          <span className="text-[var(--setu-text-3)]">—</span>
                        )}
                      </td>

                      {/* Proposal Revision */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        {d.proposalVersion ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[var(--setu-line)] bg-[var(--setu-well)] px-2 py-0.5 text-[11px] font-semibold text-[var(--setu-text)]">
                            <FileText className="h-3 w-3 text-[var(--setu-text-3)]" />
                            V{d.proposalVersion}
                          </span>
                        ) : (
                          <span className="text-[var(--setu-text-3)]">—</span>
                        )}
                      </td>

                      {/* Assigned Rep */}
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <SetuAvatar name={d.ownerName} size="xs" />
                          <span className="font-medium text-[var(--setu-text)]">{d.ownerName}</span>
                        </div>
                      </td>

                      {/* Status / Timeline */}
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        {isWon ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-500 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Won {d.closedAt ? formatDate(d.closedAt) : ""}</span>
                          </span>
                        ) : isLost ? (
                          <span className="inline-flex items-center gap-1.5 text-rose-500 font-medium">
                            <CircleX className="h-3.5 w-3.5" />
                            <span>Lost {d.closedAt ? formatDate(d.closedAt) : ""}</span>
                          </span>
                        ) : (
                          <span className="text-[var(--setu-text-2)]">
                            Updated {relativeDay(d.updatedAt, today) ?? formatDate(d.updatedAt)}
                          </span>
                        )}
                      </td>

                      {/* Row Menu */}
                      <td className="py-3.5 pr-4 pl-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <DealRowMenu deal={d} onEdit={() => setEditId(d.id)} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── EDIT DEAL DIALOG ────────────────────────────────────────────── */}
      {editing && <EditDealDialog deal={editing} open onClose={() => setEditId(null)} />}
    </SetuPage>
  );
}
