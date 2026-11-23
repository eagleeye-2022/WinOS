"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  FileText,
  Handshake,
  LayoutGrid,
  Plus,
  RotateCcw,
  Search,
  Timer,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { Input } from "@/components/ui/input";
import { useUrlState, usePageViewState } from "@/lib/navigation/use-url-state";
import { DEAL_STAGES, STAGE_BY_ID, STAGE_IDS } from "../../constants";
import { useSetuStore } from "../../provider";
import type { DealStage } from "../../types";
import {
  boardSummary,
  countByStage,
  filterDeals,
  formatInrShort,
  isoDate,
  nextMeetingByDeal,
  type DueFilter,
  type RelatedFilter,
} from "../../utils";
import { CreateLeadDialog } from "../deal-form-dialog";
import { Breadcrumbs, FilterDropdown, SetuButton, SetuPage } from "../setu-ui";
import { DealCard } from "./deal-card";

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "any", label: "Any Time" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

const RELATED_OPTIONS: { value: RelatedFilter; label: string }[] = [
  { value: "all", label: "Lead & Deal" },
  { value: "lead", label: "Leads" },
  { value: "deal", label: "Deals" },
];

const DUE_VALUES = DUE_OPTIONS.map((o) => o.value);
const RELATED_VALUES = RELATED_OPTIONS.map((o) => o.value);

/** Setu → Activities → Tasks: the sales board (one card per lead / deal, a column per stage). */
export function TasksBoard() {
  const deals = useSetuStore((s) => s.deals);
  const moveDeal = useSetuStore((s) => s.moveDeal);
  const activeTimer = useSetuStore((s) => s.activeTimer);
  const meetings = useSetuStore((s) => s.meetings);

  const [q, setQ] = useUrlState("q", "");
  const [owner, setOwner] = useUrlState("owner", "");
  const [due, setDue] = useUrlState<DueFilter>("due", "any", { allowed: DUE_VALUES });
  const [related, setRelated] = useUrlState<RelatedFilter>("related", "all", { allowed: RELATED_VALUES });
  const [stageFilter, setStageFilter] = useUrlState<DealStage | "">("stage", "", { allowed: STAGE_IDS });
  const [createStage, setCreateStage] = usePageViewState<DealStage | null>("TasksBoard:create", null);
  const [dragOver, setDragOver] = useState<DealStage | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const today = isoDate(new Date());
  const nextMeetings = useMemo(() => nextMeetingByDeal(meetings), [meetings]);
  const filtered = useMemo(
    () => filterDeals(deals, { q, owner, due, related }, today, nextMeetings),
    [deals, q, owner, due, related, today, nextMeetings]
  );
  const counts = countByStage(filtered);
  const summary = boardSummary(deals);
  const owners = useMemo(() => [...new Set(deals.map((d) => d.ownerName))].sort(), [deals]);
  const columns = stageFilter ? DEAL_STAGES.filter((s) => s.id === stageFilter) : DEAL_STAGES;

  // Additional live KPI metrics
  const wonDeals = useMemo(() => deals.filter((d) => d.stage === "CLOSED_WON"), [deals]);
  const wonValue = useMemo(() => wonDeals.reduce((sum, d) => sum + (d.value ?? 0), 0), [wonDeals]);

  const proposalDeals = useMemo(
    () => deals.filter((d) => d.stage === "PROPOSAL" || d.stage === "NEGOTIATION"),
    [deals]
  );
  const proposalValue = useMemo(
    () => proposalDeals.reduce((sum, d) => sum + (d.value ?? 0), 0),
    [proposalDeals]
  );

  const upcomingMeetingsCount = useMemo(
    () => meetings.filter((m) => m.status === "UPCOMING").length,
    [meetings]
  );

  const activeFilterCount =
    (q ? 1 : 0) +
    (owner ? 1 : 0) +
    (due !== "any" ? 1 : 0) +
    (related !== "all" ? 1 : 0) +
    (stageFilter ? 1 : 0);

  const hasFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setQ("");
    setOwner("");
    setDue("any");
    setRelated("all");
    setStageFilter("");
  };

  const onDrop = (stage: DealStage, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    setDraggingId(null);
    const id = e.dataTransfer.getData("text/setu-deal-id");
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return;
    moveDeal(id, stage)
      .then(() => toast.success(`${deal.company} → ${STAGE_BY_ID[stage].label}`))
      .catch((err: Error) => toast.error(err.message));
  };

  return (
    <SetuPage>
      {/* Breadcrumb + active timer badge if running */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs items={[{ label: "Sales" }, { label: "Tasks & Board" }]} />

        {activeTimer && (
          <Link
            href={`${ROUTES.setuDeal(activeTimer.dealId)}?tab=time-logs`}
            className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm transition-all hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
            <Timer size={13} />
            <span>Active Task Timer Running</span>
          </Link>
        )}
      </div>

      {/* Title + Action Buttons */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--setu-text)]">Tasks & Sales Pipeline</h1>
          <p className="mt-1 text-sm text-[var(--setu-text-2)]">
            Visual Kanban sales board. Drag and drop deals across stages to progress through the sales cycle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <SetuButton
            variant="primary"
            className="h-9 px-4 text-sm font-semibold shadow-sm"
            onClick={() => setCreateStage("LEAD")}
          >
            <Plus size={16} /> Create Task
          </SetuButton>
        </div>
      </div>

      {/* KPI Summary Strip with Interactive Filter Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1: Open Pipeline */}
        <button
          type="button"
          onClick={() => {
            setStageFilter("");
            setRelated("all");
          }}
          className={cn(
            "setu-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm cursor-pointer",
            stageFilter === "" && "ring-1 ring-[var(--setu-accent-ring)]"
          )}
        >
          <div className="flex items-center justify-between text-[var(--setu-text-2)]">
            <span className="text-xs font-medium uppercase tracking-wider">Active Pipeline</span>
            <TrendingUp size={16} className="text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-[var(--setu-text)] tabular-nums">
            {formatInrShort(summary.pipelineValue)}
          </div>
          <div className="mt-1 text-xs text-[var(--setu-text-2)]">
            {summary.activeTasks} open · {summary.stagesInMotion} stages active
          </div>
        </button>

        {/* Metric 2: Proposal & Negotiation */}
        <button
          type="button"
          onClick={() => setStageFilter((cur) => (cur === "PROPOSAL" ? "" : "PROPOSAL"))}
          className={cn(
            "setu-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm cursor-pointer",
            stageFilter === "PROPOSAL" && "ring-1 ring-[var(--setu-accent-ring)]"
          )}
        >
          <div className="flex items-center justify-between text-[var(--setu-text-2)]">
            <span className="text-xs font-medium uppercase tracking-wider">Proposal & Neg.</span>
            <FileText size={16} className="text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-[var(--setu-text)] tabular-nums">
            {formatInrShort(proposalValue)}
          </div>
          <div className="mt-1 text-xs text-[var(--setu-text-2)]">
            {proposalDeals.length} high intent deals in flight
          </div>
        </button>

        {/* Metric 3: Upcoming Meetings */}
        <button
          type="button"
          onClick={() => setStageFilter((cur) => (cur === "MEETING" ? "" : "MEETING"))}
          className={cn(
            "setu-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm cursor-pointer",
            stageFilter === "MEETING" && "ring-1 ring-[var(--setu-accent-ring)]"
          )}
        >
          <div className="flex items-center justify-between text-[var(--setu-text-2)]">
            <span className="text-xs font-medium uppercase tracking-wider">Scheduled Meets</span>
            <CalendarDays size={16} className="text-violet-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-[var(--setu-text)] tabular-nums">
            {upcomingMeetingsCount}
          </div>
          <div className="mt-1 text-xs text-[var(--setu-text-2)]">
            Product demos & client consultations
          </div>
        </button>

        {/* Metric 4: Closed Won */}
        <button
          type="button"
          onClick={() => setStageFilter((cur) => (cur === "CLOSED_WON" ? "" : "CLOSED_WON"))}
          className={cn(
            "setu-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm cursor-pointer",
            stageFilter === "CLOSED_WON" && "ring-1 ring-emerald-500/50"
          )}
        >
          <div className="flex items-center justify-between text-[var(--setu-text-2)]">
            <span className="text-xs font-medium uppercase tracking-wider">Won Revenue</span>
            <BadgeCheck size={16} className="text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatInrShort(wonValue)}
          </div>
          <div className="mt-1 text-xs text-[var(--setu-text-2)]">
            {wonDeals.length} deals successfully closed
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-2.5 rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input with shortcut hint and clear button */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--setu-text-3)]" />
            <Input
              ref={searchInputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks by title, lead, deal, contact… (Press /)"
              className="h-9 w-full rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] pl-9 pr-8 text-xs text-[var(--setu-text)] shadow-none placeholder:text-[var(--setu-text-3)] focus-visible:border-[var(--setu-accent)] focus-visible:ring-2 focus-visible:ring-[var(--setu-accent-ring)]"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[var(--setu-text-3)] hover:text-[var(--setu-text)]"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Owner Filter */}
          <FilterDropdown
            label="Owner"
            value={owner}
            onChange={setOwner}
            options={[{ value: "", label: "All Reps" }, ...owners.map((o) => ({ value: o, label: o }))]}
            className="h-9 rounded-xl text-xs"
          />

          {/* Due Date Filter */}
          <FilterDropdown
            label="Due Date"
            value={due}
            onChange={(v) => setDue(v as DueFilter)}
            options={DUE_OPTIONS}
            className="h-9 rounded-xl text-xs"
          />

          {/* Related Lead/Deal Filter */}
          <FilterDropdown
            label="Related"
            value={related}
            onChange={(v) => setRelated(v as RelatedFilter)}
            options={RELATED_OPTIONS}
            className="h-9 rounded-xl text-xs"
          />

          {/* Clear Filters Button */}
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] px-3 text-xs font-medium text-[var(--setu-text-2)] transition-all hover:bg-[var(--setu-soft)] hover:text-[var(--setu-text)]"
            >
              <RotateCcw size={12} className="text-rose-500" />
              <span>Reset ({activeFilterCount})</span>
            </button>
          )}
        </div>

        {/* Stage Filter Chips / Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[var(--setu-line)]/50">
          <StageChip
            active={stageFilter === ""}
            onClick={() => setStageFilter("")}
            icon={LayoutGrid}
            label="All Stages"
            count={filtered.length}
          />
          {DEAL_STAGES.map((s) => (
            <StageChip
              key={s.id}
              active={stageFilter === s.id}
              onClick={() => setStageFilter((cur) => (cur === s.id ? "" : s.id))}
              icon={s.icon}
              label={s.chip}
              count={counts[s.id]}
            />
          ))}
        </div>
      </div>

      {/* Kanban Board Container */}
      <div
        className="setu-scroll-x -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6"
        data-scroll-key="setu-tasks-board"
      >
        <div
          className="flex min-w-max items-start gap-4"
          onDragEnd={() => {
            setDraggingId(null);
            setDragOver(null);
          }}
        >
          {columns.map((stage) => {
            const cards = filtered.filter((d) => d.stage === stage.id);
            const stageTotal = cards.reduce((sum, d) => sum + (d.value ?? 0), 0);
            const Icon = stage.icon;

            return (
              <section
                key={stage.id}
                aria-label={stage.label}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOver !== stage.id) setDragOver(stage.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDragOver((s) => (s === stage.id ? null : s));
                  }
                }}
                onDrop={(e) => onDrop(stage.id, e)}
                className={cn(
                  "setu-well flex w-[308px] shrink-0 flex-col rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] transition-all duration-150",
                  dragOver === stage.id &&
                    "border-[var(--setu-accent)] bg-[var(--setu-accent-soft)]/20 shadow-[0_0_0_2px_var(--setu-accent-ring)]"
                )}
              >
                {/* Column Header */}
                <header className="flex items-center gap-2.5 border-b border-[var(--setu-line)]/50 px-3.5 py-3">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm", stage.tile)}>
                    <Icon size={14} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--setu-text)]">
                        {stage.label}
                      </h2>
                      <span className={cn("rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums shrink-0", stage.count)}>
                        {cards.length}
                      </span>
                    </div>

                    {stageTotal > 0 && (
                      <p className="mt-0.5 text-[10px] font-semibold text-[var(--setu-text-2)] tabular-nums">
                        {formatInrShort(stageTotal)}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCreateStage(stage.id)}
                    aria-label={`Add deal to ${stage.label}`}
                    title={`Add deal to ${stage.label}`}
                    className="setu-text-2 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[var(--setu-soft)] hover:text-[var(--setu-text)]"
                  >
                    <Plus size={15} />
                  </button>
                </header>

                {/* Column Body / Cards List */}
                <div className="flex min-h-36 flex-col gap-2.5 p-3">
                  {cards.length === 0 ? (
                    <div
                      className={cn(
                        "flex min-h-28 flex-1 flex-col items-center justify-center rounded-lg border border-dashed text-xs text-[var(--setu-text-3)] p-4 text-center transition-colors",
                        dragOver === stage.id
                          ? "border-[var(--setu-accent)] bg-[var(--setu-accent-soft)]/30 text-[var(--setu-accent-text)] font-semibold"
                          : "border-[var(--setu-line)]"
                      )}
                    >
                      {draggingId ? (
                        <span>Drop deal here</span>
                      ) : (
                        <div className="space-y-1">
                          <p>No deals in this stage</p>
                          <button
                            type="button"
                            onClick={() => setCreateStage(stage.id)}
                            className="font-semibold text-[var(--setu-accent-text)] hover:underline"
                          >
                            + Add one
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    cards.map((d) => (
                      <DealCard
                        key={d.id}
                        deal={d}
                        meeting={nextMeetings.get(d.id)}
                        today={today}
                        onDragStart={() => setDraggingId(d.id)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Create Lead / Deal Form Dialog */}
      <CreateLeadDialog stage={createStage} onClose={() => setCreateStage(null)} />
    </SetuPage>
  );
}

function StageChip({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-[var(--setu-accent-ring)] bg-[var(--setu-accent-soft)] font-semibold text-[var(--setu-accent)]"
          : "border-[var(--setu-line)] bg-[var(--setu-well)] text-[var(--setu-text-3)] hover:text-[var(--setu-text)]"
      )}
    >
      <Icon size={12} />
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] font-bold tabular-nums",
          active ? "bg-[var(--setu-card)] text-[var(--setu-accent)]" : "bg-[var(--setu-card)] text-[var(--setu-text-3)]"
        )}
      >
        {count}
      </span>
    </button>
  );
}
