"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Download,
  FilterX,
  Mail,
  MapPin,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  UserCheck,
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
import type { DealStage } from "../../types";
import {
  formatDate,
  formatDateTime,
  isoDate,
  matchesDue,
  nextMeetingByDeal,
  phoneDigits,
  relativeDay,
  type DueFilter,
} from "../../utils";
import { LEAD_STAGES, downloadCsv, isLead, matchesText, toCsv } from "../../insights";
import { CreateLeadDialog, EditDealDialog } from "../deal-form-dialog";
import { FilterDropdown, SetuAvatar, SetuButton, SetuPage, StageBadge } from "../setu-ui";
import { DealRowMenu, ListHeader } from "./list-ui";

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "any", label: "Any Due Date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due Today" },
  { value: "week", label: "Due This Week" },
  { value: "month", label: "Due This Month" },
];
const DUE_VALUES = DUE_OPTIONS.map((o) => o.value);
const STAGE_VALUES: readonly (DealStage | "all")[] = ["all", ...LEAD_STAGES];

/**
 * Setu CRM → Leads Funnel
 * High-craft executive prospects pipeline with interactive metric tiles,
 * unified filter bar, responsive table hierarchy, and micro-actions.
 */
export function LeadsPage() {
  const router = useRouter();
  const deals = useSetuStore((s) => s.deals);
  const meetings = useSetuStore((s) => s.meetings);

  const [q, setQ] = useUrlState("q", "");
  const [stage, setStage] = useUrlState<DealStage | "all">("stage", "all", { allowed: STAGE_VALUES });
  const [owner, setOwner] = useUrlState("owner", "");
  const [source, setSource] = useUrlState("source", "");
  const [due, setDue] = useUrlState<DueFilter>("due", "any", { allowed: DUE_VALUES });
  const [creating, setCreating] = usePageViewState("LeadsPage:create", false);
  const [editId, setEditId] = usePageViewState<string | null>("LeadsPage:edit", null);

  const today = isoDate(new Date());
  const leads = useMemo(() => deals.filter(isLead), [deals]);
  const nextMeetings = useMemo(() => nextMeetingByDeal(meetings), [meetings]);
  const owners = useMemo(() => [...new Set(leads.map((d) => d.ownerName))].sort(), [leads]);
  const sources = useMemo(() => [...new Set(leads.map((d) => d.source).filter(Boolean))].sort(), [leads]);

  const dueOf = (id: string, dueDate?: string) =>
    dueDate ?? (nextMeetings.get(id) ? isoDate(nextMeetings.get(id)!.startAt) : undefined);

  // Filtered rows
  const rows = useMemo(() => {
    return leads
      .filter(
        (d) =>
          (stage === "all" || d.stage === stage) &&
          (!owner || d.ownerName === owner) &&
          (!source || d.source === source) &&
          matchesDue(dueOf(d.id, d.dueDate), due, today) &&
          matchesText(q, d.contactName, d.company, d.leadCode, d.email, d.phone, d.location, d.source, d.remark)
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [leads, stage, owner, source, due, today, q, nextMeetings]);

  const filtered = q !== "" || stage !== "all" || owner !== "" || source !== "" || due !== "any";
  const activeFiltersCount = (q ? 1 : 0) + (stage !== "all" ? 1 : 0) + (owner ? 1 : 0) + (source ? 1 : 0) + (due !== "any" ? 1 : 0);
  const editing = deals.find((d) => d.id === editId);

  // Stats computed from live store
  const stats = useMemo(() => {
    const total = leads.length;
    const meetingCount = leads.filter((d) => nextMeetings.has(d.id)).length;
    const dueTodayCount = leads.filter((d) => dueOf(d.id, d.dueDate) === today).length;
    const overdueCount = leads.filter((d) => {
      const dDate = dueOf(d.id, d.dueDate);
      return dDate !== undefined && dDate < today;
    }).length;
    const freshCount = leads.filter((d) => d.stage === "LEAD").length;
    const discussionCount = leads.filter((d) => d.stage === "DISCUSSION").length;

    return {
      total,
      meetings: meetingCount,
      dueToday: dueTodayCount,
      overdue: overdueCount,
      fresh: freshCount,
      discussion: discussionCount,
    };
  }, [leads, nextMeetings, today]);

  const clearAllFilters = () => {
    setQ("");
    setStage("all");
    setOwner("");
    setSource("");
    setDue("any");
  };

  const exportCsv = () => {
    if (!rows.length) return toast.info("No leads to export");
    downloadCsv(
      `setu-leads-${today}.csv`,
      toCsv([
        ["Code", "Contact", "Role", "Company", "Stage", "Phone", "Email", "Location", "Source", "Owner", "Due", "Last Updated"],
        ...rows.map((d) => [
          d.leadCode,
          d.contactName,
          d.contactRole,
          d.company,
          STAGE_BY_ID[d.stage].label,
          d.phone,
          d.email,
          d.location,
          d.source,
          d.ownerName,
          dueOf(d.id, d.dueDate) ?? "",
          formatDateTime(d.updatedAt),
        ]),
      ])
    );
    toast.success(`Exported ${rows.length} leads to CSV`);
  };

  return (
    <SetuPage className="space-y-5 pb-12">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <ListHeader
        crumbs={[{ label: "Sales" }, { label: "Leads" }]}
        title="Leads Pipeline"
        subtitle="Prospects before a proposal — tracking discovery calls, scheduled meetings, and requirement discussions."
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
            <SetuButton
              variant="primary"
              onClick={() => setCreating(true)}
             
            >
              <Plus />
              <span>Create Lead</span>
            </SetuButton>
          </div>
        }
      />

      {/* ── INTERACTIVE KPI STRIP (Quick Filter Tiles) ────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Tile 1: All Leads */}
        <button
          type="button"
          onClick={() => {
            setStage("all");
            setDue("any");
          }}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md",
            stage === "all" && due === "any"
              ? "border-[var(--setu-accent)] bg-[var(--setu-card)] ring-2 ring-[var(--setu-accent-ring)]"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              All Leads
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {stats.total}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              {stats.fresh} fresh · {stats.discussion} discussions
            </p>
          </div>
        </button>

        {/* Tile 2: Meetings Booked */}
        <button
          type="button"
          onClick={() => {
            setStage(stage === "MEETING" ? "all" : "MEETING");
          }}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md",
            stage === "MEETING"
              ? "border-[var(--setu-accent)] bg-[var(--setu-card)] ring-2 ring-[var(--setu-accent-ring)]"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Meetings Booked
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
              <CalendarClock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {stats.meetings}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Prospects with upcoming demo
            </p>
          </div>
        </button>

        {/* Tile 3: Due Today */}
        <button
          type="button"
          onClick={() => {
            setDue(due === "today" ? "any" : "today");
          }}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md",
            due === "today"
              ? "border-[var(--setu-accent)] bg-[var(--setu-card)] ring-2 ring-[var(--setu-accent-ring)]"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Due Today
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <AlarmClock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {stats.dueToday}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Follow-ups scheduled for today
            </p>
          </div>
        </button>

        {/* Tile 4: Overdue Follow-ups */}
        <button
          type="button"
          onClick={() => {
            setDue(due === "overdue" ? "any" : "overdue");
          }}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md",
            due === "overdue"
              ? "border-[var(--setu-accent)] bg-[var(--setu-card)] ring-2 ring-[var(--setu-accent-ring)]"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Overdue
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <AlarmClock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div
              className={cn(
                "text-2xl font-bold tracking-tight tabular-nums",
                stats.overdue > 0 ? "text-rose-500" : "text-[var(--setu-text)]"
              )}
            >
              {stats.overdue}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              {stats.overdue > 0 ? "Requires urgent follow-up" : "All follow-ups on track"}
            </p>
          </div>
        </button>
      </div>

      {/* ── FILTER TOOLBAR ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] p-3 shadow-sm">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          {/* Search Box with Clear Button & Shortcut Badge */}
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--setu-text-3)]" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contact, company, code, location, phone..."
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

          {/* Filter Dropdowns Grid */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Stage"
              value={stage}
              onChange={(v) => setStage(v as DealStage | "all")}
              options={[{ value: "all", label: "All Stages" }, ...LEAD_STAGES.map((s) => ({ value: s, label: STAGE_BY_ID[s].label }))]}
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
              label="Source"
              value={source}
              onChange={setSource}
              options={[{ value: "", label: "All Sources" }, ...sources.map((o) => ({ value: o, label: o }))]}
              className="h-9 rounded-xl text-xs"
            />
            <FilterDropdown
              value={due}
              onChange={(v) => setDue(v as DueFilter)}
              options={DUE_OPTIONS}
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

        {/* Counter & Active Filter Pills */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between border-t border-[var(--setu-line)] pt-2.5 text-xs text-[var(--setu-text-3)]">
          <div className="flex items-center gap-2">
            <span>
              Showing <span className="font-semibold text-[var(--setu-text)]">{rows.length}</span> of {leads.length} leads
            </span>
            {filtered && (
              <span className="inline-flex items-center rounded-full bg-[var(--setu-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--setu-accent)]">
                Filtered view
              </span>
            )}
          </div>

          {/* Quick stage toggle tabs */}
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
              All
            </button>
            {LEAD_STAGES.map((s) => (
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
                {STAGE_BY_ID[s].label} ({leads.filter((d) => d.stage === s).length})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── HIGH-CRAFT TABLE ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] shadow-sm">
        <div className="setu-scroll-x overflow-x-auto">
          <table className="w-full text-left text-xs" style={{ minWidth: 960 }}>
            <thead>
              <tr className="border-b border-[var(--setu-line)] bg-[var(--setu-well)] text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
                <th className="py-3.5 pl-5 pr-4">Prospect & Role</th>
                <th className="py-3.5 px-4">Company & ID</th>
                <th className="py-3.5 px-4">Funnel Stage</th>
                <th className="py-3.5 px-4">Direct Contact</th>
                <th className="py-3.5 px-4">Source</th>
                <th className="py-3.5 px-4">Assigned Rep</th>
                <th className="py-3.5 px-4">Next Action / Due</th>
                <th className="py-3.5 px-4">Last Activity</th>
                <th className="py-3.5 pr-4 pl-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--setu-line)]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--setu-well)] text-[var(--setu-text-3)]">
                        <UserRoundSearch className="h-6 w-6" />
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-[var(--setu-text)]">
                        {leads.length === 0 ? "No prospects in your pipeline" : "No leads match current filters"}
                      </h3>
                      <p className="text-xs text-[var(--setu-text-3)]">
                        {leads.length === 0
                          ? "Create your first lead to start tracking prospects through your sales funnel."
                          : "Try adjusting your search query, stage, owner, or due date filters."}
                      </p>
                      {filtered ? (
                        <SetuButton
                          size="sm"
                          onClick={clearAllFilters}
                          className="mt-2"
                        >
                          <RotateCcw />
                          <span>Clear all filters</span>
                        </SetuButton>
                      ) : (
                        <SetuButton
                          variant="primary"
                          size="sm"
                          onClick={() => setCreating(true)}
                          className="mt-2"
                        >
                          <Plus />
                          <span>Create First Lead</span>
                        </SetuButton>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((d) => {
                  const next = nextMeetings.get(d.id);
                  const dueDate = dueOf(d.id, d.dueDate);
                  const isOverdue = dueDate !== undefined && dueDate < today;
                  const isDueToday = dueDate === today;

                  return (
                    <tr
                      key={d.id}
                      onClick={() => router.push(ROUTES.setuDeal(d.id))}
                      className="group cursor-pointer transition-colors hover:bg-[var(--setu-soft)]/60"
                    >
                      {/* Prospect & Role */}
                      <td className="py-3.5 pl-5 pr-4">
                        <div className="flex items-center gap-3">
                          <SetuAvatar name={d.contactName || d.company} size="sm" />
                          <div className="min-w-0">
                            <span className="block truncate font-semibold text-[var(--setu-text)] group-hover:text-[var(--setu-accent)]">
                              {d.contactName || "Unnamed Contact"}
                            </span>
                            <span className="block truncate text-[11px] text-[var(--setu-text-3)]">
                              {d.contactRole || "Decision Maker"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Company & ID */}
                      <td className="py-3.5 px-4">
                        <span className="block font-medium text-[var(--setu-text)]">{d.company}</span>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="inline-block rounded border border-[var(--setu-line)] bg-[var(--setu-well)] px-1.5 py-0.2 font-mono text-[10px] text-[var(--setu-text-2)]">
                            {d.leadCode}
                          </span>
                          {d.location && (
                            <span className="flex items-center gap-0.5 text-[10px] text-[var(--setu-text-3)]">
                              <MapPin className="h-2.5 w-2.5" /> {d.location}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Funnel Stage */}
                      <td className="py-3.5 px-4">
                        <StageBadge stage={d.stage} suffix="" />
                      </td>

                      {/* Direct Outreach */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1">
                          {d.phone ? (
                            <a
                              href={`tel:+${phoneDigits(d.phone)}`}
                              className="inline-flex items-center gap-1.5 text-xs text-[var(--setu-accent)] hover:underline"
                              title="Call contact"
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="tabular-nums">{d.phone}</span>
                            </a>
                          ) : null}
                          {d.email ? (
                            <a
                              href={`mailto:${d.email}`}
                              className="inline-flex items-center gap-1.5 text-xs text-[var(--setu-text-2)] hover:text-[var(--setu-text)] hover:underline"
                              title="Send email"
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[160px]">{d.email}</span>
                            </a>
                          ) : null}
                          {!d.phone && !d.email && <span className="text-[11px] text-[var(--setu-text-3)]">—</span>}
                        </div>
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        {d.source ? (
                          <span className="inline-flex items-center rounded-md border border-[var(--setu-line)] bg-[var(--setu-well)] px-2 py-0.5 text-[11px] font-medium text-[var(--setu-text-2)]">
                            {d.source}
                          </span>
                        ) : (
                          <span className="text-[var(--setu-text-3)]">—</span>
                        )}
                      </td>

                      {/* Assigned Rep */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <SetuAvatar name={d.ownerName} size="xs" />
                          <span className="text-xs font-medium text-[var(--setu-text)]">{d.ownerName}</span>
                        </div>
                      </td>

                      {/* Next Action / Due */}
                      <td className="py-3.5 px-4">
                        {next ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-violet-500 dark:text-violet-300">
                            <CalendarClock className="h-3 w-3 shrink-0" />
                            <span>Meeting {formatDate(next.startAt)}</span>
                          </div>
                        ) : isOverdue ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                            <span>Overdue · {formatDate(dueDate!)}</span>
                          </div>
                        ) : isDueToday ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-500 dark:text-amber-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span>Due Today</span>
                          </div>
                        ) : dueDate ? (
                          <span className="text-xs text-[var(--setu-text-2)]">Due {formatDate(dueDate)}</span>
                        ) : (
                          <span className="text-xs text-[var(--setu-text-3)]">—</span>
                        )}
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap text-[var(--setu-text-2)]">
                        {relativeDay(d.updatedAt, today) ?? formatDate(d.updatedAt)}
                      </td>

                      {/* Menu Actions */}
                      <td className="py-3.5 pr-4 pl-2 text-right" onClick={(e) => e.stopPropagation()}>
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

      {/* ── DIALOGS ──────────────────────────────────────────────────────── */}
      <CreateLeadDialog stage={creating ? "LEAD" : null} onClose={() => setCreating(false)} />
      {editing && <EditDealDialog deal={editing} open onClose={() => setEditId(null)} />}
    </SetuPage>
  );
}
