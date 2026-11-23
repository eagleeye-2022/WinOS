"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Plus, RotateCcw, Search, Timer } from "lucide-react";
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
  const hasFilters = q !== "" || owner !== "" || due !== "any" || related !== "all" || stageFilter !== "";

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
      {/* Breadcrumb + pipeline summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs items={[{ label: "Sales" }, { label: "Tasks" }]} />
        <div className="setu-text-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-[var(--setu-accent-ring)] bg-[var(--setu-accent-soft)] px-3.5 py-1 text-xs font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--setu-accent)]" />
          <span>{summary.stagesInMotion} Stages in Motion</span>
          <span aria-hidden>•</span>
          <span className="setu-accent-text">{formatInrShort(summary.pipelineValue)} Pipeline Active</span>
          <span aria-hidden>•</span>
          <span>{summary.activeTasks} Active Tasks</span>
        </div>
      </div>

      {/* Title + actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">Tasks</h1>
          <p className="setu-text-2 mt-1 text-sm">Manage and track sales activities across your leads and deals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Only while a timer runs — it jumps to that deal's Time Logs. */}
          {activeTimer && (
            <SetuButton variant="soft" asChild className="h-9 px-4 text-sm font-medium">
              <Link href={`${ROUTES.setuDeal(activeTimer.dealId)}?tab=time-logs`}>
                <Timer /> Active Task
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
                </span>
              </Link>
            </SetuButton>
          )}
          <SetuButton variant="primary" className="h-9 px-4 text-sm font-medium" onClick={() => setCreateStage("LEAD")}>
            <Plus /> Create Task
          </SetuButton>
        </div>
      </div>

      {/* Filters */}
      <div className="setu-card space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px] flex-1">
            <Search size={16} className="setu-text-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks by title, lead, deal, contact…"
              className="setu-input h-9 pl-10"
            />
          </div>
          <FilterDropdown
            label="Owner"
            value={owner}
            onChange={setOwner}
            options={[{ value: "", label: "All Reps" }, ...owners.map((o) => ({ value: o, label: o }))]}
          />
          <FilterDropdown label="Due Date" value={due} onChange={(v) => setDue(v as DueFilter)} options={DUE_OPTIONS} />
          <FilterDropdown label="Related" value={related} onChange={(v) => setRelated(v as RelatedFilter)} options={RELATED_OPTIONS} />
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="setu-accent-text flex cursor-pointer items-center gap-1.5 px-2 text-sm font-semibold disabled:cursor-default disabled:opacity-50"
          >
            <RotateCcw size={14} /> Clear Filters
          </button>
        </div>

        {/* Stage chips */}
        <div className="flex flex-wrap gap-2">
          <StageChip active={stageFilter === ""} onClick={() => setStageFilter("")} icon={LayoutGrid} label="All" count={filtered.length} />
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

      {/* Board */}
      <div className="setu-scroll-x -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6" data-scroll-key="setu-tasks-board">
        <div
          className="flex min-w-max items-start gap-4"
          onDragEnd={() => {
            setDraggingId(null);
            setDragOver(null);
          }}
        >
          {columns.map((stage) => {
            const cards = filtered.filter((d) => d.stage === stage.id);
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
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver((s) => (s === stage.id ? null : s));
                }}
                onDrop={(e) => onDrop(stage.id, e)}
                className={cn(
                  "setu-well flex w-[300px] shrink-0 flex-col transition-[border-color,box-shadow]",
                  dragOver === stage.id && "border-[var(--setu-accent)] shadow-[0_0_0_3px_var(--setu-accent-ring)]"
                )}
              >
                <header className="flex items-center gap-2.5 px-4 pb-3 pt-4">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", stage.tile)}>
                    <Icon size={15} />
                  </span>
                  <h2 className="text-xs font-bold uppercase tracking-wide">{stage.label}</h2>
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums", stage.count)}>{cards.length}</span>
                  <button
                    type="button"
                    onClick={() => setCreateStage(stage.id)}
                    aria-label={`Add to ${stage.label}`}
                    title={`Add to ${stage.label}`}
                    className="setu-text-2 ml-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[var(--setu-soft)] hover:text-[var(--setu-text)]"
                  >
                    <Plus size={17} />
                  </button>
                </header>
                <div className="flex min-h-32 flex-col gap-3 px-3 pb-3">
                  {cards.length === 0 ? (
                    <div className="setu-text-3 flex min-h-28 flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--setu-line-strong)] text-xs">
                      {draggingId ? "Drop here" : "No tasks"}
                    </div>
                  ) : (
                    cards.map((d) => (
                      <DealCard key={d.id} deal={d} meeting={nextMeetings.get(d.id)} today={today} onDragStart={() => setDraggingId(d.id)} />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

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
        "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-[var(--setu-accent)] text-[var(--setu-accent-ink)]"
          : "setu-text-2 border-[var(--setu-line)] bg-[var(--setu-soft)] hover:text-[var(--setu-text)]"
      )}
    >
      <Icon size={13} />
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
          active ? "bg-white/25" : "bg-[var(--setu-card)]"
        )}
      >
        {count}
      </span>
    </button>
  );
}
