"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  Building2,
  Calendar,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  EllipsisVertical,
  ExternalLink,
  Eye,
  Filter,
  FilterX,
  MapPin,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Users,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { MEETING_STATUS, isOnlineChannel, modeOfChannel, type MeetingMode } from "../../constants";
import { useSetuStore } from "../../provider";
import type { Deal, DealMeeting, MeetingStatus } from "../../types";
import {
  dealTitle,
  formatDate,
  formatInrShort,
  formatRange,
  formatTimeRange,
  inMeetingRange,
  isoDate,
  meetingsCsv,
  relativeDay,
  searchMeetings,
  weekRange,
  type MeetingRange,
} from "../../utils";
import { Breadcrumbs, FilterDropdown, SetuButton, SetuPage, attempt } from "../setu-ui";

const RANGES: readonly MeetingRange[] = ["week", "today", "next7", "month", "all"];
const STATUSES: readonly (MeetingStatus | "all")[] = ["all", "UPCOMING", "COMPLETED", "CANCELLED", "DRAFT"];
const TYPES: readonly (MeetingMode | "all")[] = ["all", "ONLINE", "IN_OFFICE", "CLIENT_LOCATION"];
const TYPE_LABEL: Record<MeetingMode, string> = {
  ONLINE: "Online",
  IN_OFFICE: "In-office",
  CLIENT_LOCATION: "Client Location",
};
const STATUS_ORDER: Record<MeetingStatus, number> = { UPCOMING: 0, DRAFT: 1, COMPLETED: 2, CANCELLED: 3 };

const WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });

/** "Office Furniture Deal (₹8.5L)". */
export function relatedLabel(deal: Deal | undefined): string {
  if (!deal) return "—";
  const name = deal.stage === "LEAD" ? `${deal.company} (Lead)` : dealTitle(deal);
  return deal.value ? `${name} (${formatInrShort(deal.value)})` : name;
}

/**
 * Setu CRM → Activities → Meetings
 * High-craft executive meetings schedule with interactive status tiles,
 * channel filters, quick video launch, and direct deal links.
 */
export function MeetingsList() {
  const router = useRouter();
  const meetings = useSetuStore((s) => s.meetings);
  const deals = useSetuStore((s) => s.deals);
  const cancelMeeting = useSetuStore((s) => s.cancelMeeting);

  const [q, setQ] = useUrlState("q", "");
  const [range, setRange] = useUrlState<MeetingRange>("range", "week", { allowed: RANGES });
  const [status, setStatus] = useUrlState<MeetingStatus | "all">("status", "all", { allowed: STATUSES });
  const [type, setType] = useUrlState<MeetingMode | "all">("type", "all", { allowed: TYPES });

  const today = isoDate(new Date());
  const week = weekRange(today);
  const dealById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);

  // Plain values (cheap to compute) — useMemo here tripped the React Compiler lint.
  const inRange = searchMeetings(
      meetings,
      q,
      (m) => `${dealById.get(m.dealId)?.company ?? ""} ${dealById.get(m.dealId)?.title ?? ""}`
  ).filter((m) => inMeetingRange(m.startAt, range, today) && (type === "all" || modeOfChannel(m.channel) === type));

  const rows = inRange
      .filter((m) => status === "all" || m.status === status)
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (a.status === "UPCOMING" ? a.startAt.localeCompare(b.startAt) : b.startAt.localeCompare(a.startAt))
      );

  const pace = {
      scheduled: inRange.filter((m) => m.status === "UPCOMING").length,
      completed: inRange.filter((m) => m.status === "COMPLETED").length,
      cancelled: inRange.filter((m) => m.status === "CANCELLED").length,
      onlineCount: inRange.filter((m) => isOnlineChannel(m.channel)).length,
  };

  const filtered = q !== "" || range !== "week" || status !== "all" || type !== "all";
  const activeFiltersCount =
    (q ? 1 : 0) + (range !== "week" ? 1 : 0) + (status !== "all" ? 1 : 0) + (type !== "all" ? 1 : 0);

  const rangeOptions: { value: MeetingRange; label: string }[] = [
    { value: "week", label: `This Week (${formatRange(week.start, week.end)})` },
    { value: "today", label: "Today" },
    { value: "next7", label: "Next 7 Days" },
    { value: "month", label: "This Month" },
    { value: "all", label: "All Time" },
  ];

  const clearAllFilters = () => {
    setQ("");
    setRange("week");
    setStatus("all");
    setType("all");
  };

  const exportCsv = () => {
    if (rows.length === 0) return toast.info("No meetings to export");
    const blob = new Blob(
      [meetingsCsv(rows.map((m) => ({ meeting: m, related: relatedLabel(dealById.get(m.dealId)) })))],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meetings-${range}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} meetings to CSV`);
  };

  return (
    <SetuPage className="space-y-5 pb-12">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Sales" }, { label: "Activities" }, { label: "Meetings" }]} />
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--setu-text)] sm:text-3xl">
            Customer Meetings
          </h1>
          <p className="mt-1 text-xs text-[var(--setu-text-2)] sm:text-sm">
            Schedule and manage client demos, discovery discussions, and proposal reviews.
          </p>
        </div>

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
            asChild
          >
            <Link href={ROUTES.setuMeetingNew}>
              <Plus className="h-4 w-4" />
              <span>Schedule Meeting</span>
            </Link>
          </SetuButton>
        </div>
      </div>

      {/* ── INTERACTIVE MEETINGS KPI STRIP ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Card 1: Upcoming Scheduled */}
        <button
          type="button"
          onClick={() => setStatus(status === "UPCOMING" ? "all" : "UPCOMING")}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-[var(--setu-accent)] hover:shadow-md",
            status === "UPCOMING"
              ? "border-[var(--setu-accent)] bg-[var(--setu-card)] ring-2 ring-[var(--setu-accent-ring)]"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Upcoming
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
              <CalendarClock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {pace.scheduled}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Scheduled client sessions
            </p>
          </div>
        </button>

        {/* Card 2: Completed Meetings */}
        <button
          type="button"
          onClick={() => setStatus(status === "COMPLETED" ? "all" : "COMPLETED")}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-emerald-500 hover:shadow-md",
            status === "COMPLETED"
              ? "border-emerald-500 bg-[var(--setu-card)] ring-2 ring-emerald-500/30"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Completed
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {pace.completed}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Conducted successfully
            </p>
          </div>
        </button>

        {/* Card 3: Online Video Sessions */}
        <button
          type="button"
          onClick={() => setType(type === "ONLINE" ? "all" : "ONLINE")}
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:border-violet-500 hover:shadow-md",
            type === "ONLINE"
              ? "border-violet-500 bg-[var(--setu-card)] ring-2 ring-violet-500/30"
              : "border-[var(--setu-line)] bg-[var(--setu-card)]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Online Video
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
              <Video className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {pace.onlineCount}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Google Meet / Video calls
            </p>
          </div>
        </button>

        {/* Card 4: Cancelled / Drafts */}
        <div className="flex flex-col justify-between rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] p-4 text-left shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
              Cancelled / Drafts
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-500/10 text-zinc-500">
              <Ban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-[var(--setu-text)]">
              {pace.cancelled}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--setu-text-3)]">
              Cancelled or incomplete
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
              placeholder="Search meetings by title, company, attendees, notes..."
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

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              value={range}
              onChange={(v) => setRange(v as MeetingRange)}
              options={rangeOptions}
              className="h-9 min-w-44 rounded-xl text-xs"
            />
            <FilterDropdown
              value={status}
              onChange={(v) => setStatus(v as MeetingStatus | "all")}
              options={[
                { value: "all", label: "All Statuses" },
                ...STATUSES.filter((s) => s !== "all").map((s) => ({
                  value: s,
                  label: MEETING_STATUS[s as MeetingStatus].label,
                })),
              ]}
              className="h-9 rounded-xl text-xs"
            />
            <FilterDropdown
              value={type}
              onChange={(v) => setType(v as MeetingMode | "all")}
              options={[
                { value: "all", label: "All Types" },
                ...TYPES.filter((t) => t !== "all").map((t) => ({
                  value: t,
                  label: TYPE_LABEL[t as MeetingMode],
                })),
              ]}
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

        {/* Counter & Quick Status Tabs */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between border-t border-[var(--setu-line)] pt-2.5 text-xs text-[var(--setu-text-3)]">
          <div className="flex items-center gap-2">
            <span>
              Showing <span className="font-semibold text-[var(--setu-text)]">{rows.length}</span> of {inRange.length} meetings
            </span>
            {filtered && (
              <span className="inline-flex items-center rounded-full bg-[var(--setu-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--setu-accent)]">
                Filtered view
              </span>
            )}
          </div>

          {/* Quick status tabs */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              onClick={() => setStatus("all")}
              className={cn(
                "rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors",
                status === "all"
                  ? "bg-[var(--setu-soft)] text-[var(--setu-text)] font-semibold"
                  : "text-[var(--setu-text-3)] hover:text-[var(--setu-text)]"
              )}
            >
              All ({inRange.length})
            </button>
            <button
              onClick={() => setStatus("UPCOMING")}
              className={cn(
                "rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors",
                status === "UPCOMING"
                  ? "bg-[var(--setu-soft)] text-[var(--setu-text)] font-semibold"
                  : "text-[var(--setu-text-3)] hover:text-[var(--setu-text)]"
              )}
            >
              Upcoming ({pace.scheduled})
            </button>
            <button
              onClick={() => setStatus("COMPLETED")}
              className={cn(
                "rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors",
                status === "COMPLETED"
                  ? "bg-[var(--setu-soft)] text-[var(--setu-text)] font-semibold"
                  : "text-[var(--setu-text-3)] hover:text-[var(--setu-text)]"
              )}
            >
              Completed ({pace.completed})
            </button>
          </div>
        </div>
      </div>

      {/* ── HIGH-CRAFT MEETINGS TABLE ─────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-card)] shadow-sm">
        <div className="setu-scroll-x overflow-x-auto">
          <table className="w-full text-left text-xs" style={{ minWidth: 920 }}>
            <thead>
              <tr className="border-b border-[var(--setu-line)] bg-[var(--setu-well)] text-[11px] font-semibold uppercase tracking-wider text-[var(--setu-text-2)]">
                <th className="py-3.5 pl-5 pr-4">Meeting Title</th>
                <th className="py-3.5 px-4">Related Lead / Deal</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Channel / Location</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 pr-4 pl-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--setu-line)]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--setu-well)] text-[var(--setu-text-3)]">
                        <CalendarClock className="h-6 w-6" />
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-[var(--setu-text)]">
                        {meetings.length === 0 ? "No meetings scheduled" : "No meetings match current filters"}
                      </h3>
                      <p className="text-xs text-[var(--setu-text-3)]">
                        {meetings.length === 0
                          ? "Schedule client product demos, discovery calls, and milestone review meetings."
                          : "Try expanding your date range or clearing your status filter."}
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
                        <Link
                          href={ROUTES.setuMeetingNew}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-[var(--setu-accent-ring)] bg-[var(--setu-accent-soft)] text-[var(--setu-accent)] hover:bg-[color-mix(in_oklch,var(--setu-accent)_20%,transparent)] px-3 py-1.5 text-xs font-semibold"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Schedule Meeting</span>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((m) => {
                  const online = isOnlineChannel(m.channel);
                  const s = MEETING_STATUS[m.status];
                  const stop = (e: React.MouseEvent) => e.stopPropagation();
                  const dateLine = `${WEEKDAY.format(new Date(m.startAt))}, ${formatDate(m.startAt)}`;
                  const dayRel = relativeDay(m.startAt, today);

                  return (
                    <tr
                      key={m.id}
                      onClick={() => router.push(ROUTES.setuMeeting(m.id))}
                      className="group cursor-pointer transition-colors hover:bg-[var(--setu-soft)]/60"
                    >
                      {/* Meeting Title */}
                      <td className="py-3.5 pl-5 pr-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                              online
                                ? "bg-sky-500/10 text-sky-500"
                                : m.channel === "IN_OFFICE"
                                ? "bg-violet-500/10 text-violet-500"
                                : "bg-amber-500/10 text-amber-500"
                            )}
                          >
                            {online ? (
                              <Video className="h-4 w-4" />
                            ) : m.channel === "IN_OFFICE" ? (
                              <Building2 className="h-4 w-4" />
                            ) : (
                              <MapPin className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span
                              className={cn(
                                "block truncate font-semibold text-[var(--setu-text)] group-hover:text-[var(--setu-accent)]",
                                m.status === "CANCELLED" && "line-through opacity-60"
                              )}
                            >
                              {m.title}
                            </span>
                            <span className="block truncate text-[11px] text-[var(--setu-text-3)]">
                              {m.attendees?.length || 0} attendee{m.attendees?.length === 1 ? "" : "s"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Related Deal / Lead */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-[var(--setu-text)]">
                          {relatedLabel(dealById.get(m.dealId))}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium text-[var(--setu-text)]">
                          {dayRel === "Today" ? (
                            <span className="font-bold text-sky-500">Today</span>
                          ) : (
                            <span>{dateLine}</span>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--setu-text-3)] font-mono">
                          {formatTimeRange(m.startAt, m.endAt)} (IST)
                        </span>
                      </td>

                      {/* Channel / Location */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {online ? (
                          m.link ? (
                            <a
                              href={m.link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={stop}
                              className="inline-flex items-center gap-1.5 text-xs text-sky-500 hover:underline"
                            >
                              <Video className="h-3 w-3" />
                              <span>Online Meet</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--setu-text-2)]">
                              <Video className="h-3 w-3" />
                              <span>Online</span>
                            </span>
                          )
                        ) : (
                          <div className="flex flex-col text-xs">
                            <span className="text-[var(--setu-text)]">
                              {m.channel === "IN_OFFICE" ? "In-office" : "Client Location"}
                            </span>
                            {m.location && (
                              <span className="truncate max-w-[160px] text-[10px] text-[var(--setu-text-3)]">
                                {m.location}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            s.tone
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                          {s.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pr-4 pl-2 text-right whitespace-nowrap" onClick={stop}>
                        <div className="flex items-center justify-end gap-1.5">
                          {m.status === "UPCOMING" && online && m.link ? (
                            <a
                              href={m.link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--setu-accent-ring)] bg-[var(--setu-accent-soft)] text-[var(--setu-accent)] hover:bg-[color-mix(in_oklch,var(--setu-accent)_20%,transparent)] px-2.5 py-1 text-xs font-semibold shadow-sm transition-all active:scale-95"
                            >
                              <Video className="h-3 w-3" />
                              <span>Join</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => router.push(ROUTES.setuMeeting(m.id))}
                              className="rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)] px-2.5 py-1 text-xs font-medium text-[var(--setu-text-2)] transition-all hover:bg-[var(--setu-soft)] hover:text-[var(--setu-text)]"
                            >
                              {m.status === "COMPLETED" ? "Summary" : "View"}
                            </button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Meeting actions"
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)] text-[var(--setu-text-2)] hover:bg-[var(--setu-soft)] hover:text-[var(--setu-text)]"
                              >
                                <EllipsisVertical className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border-[var(--setu-line)] bg-[var(--setu-card)]">
                              <DropdownMenuItem onSelect={() => router.push(ROUTES.setuMeeting(m.id))}>
                                <Eye className="mr-2 h-3.5 w-3.5" /> View details
                              </DropdownMenuItem>
                              {(m.status === "UPCOMING" || m.status === "DRAFT") && (
                                <DropdownMenuItem asChild>
                                  <Link href={ROUTES.setuMeetingEdit(m.id)}>
                                    <PencilLine className="mr-2 h-3.5 w-3.5" />{" "}
                                    {m.status === "DRAFT" ? "Continue draft" : "Edit / Reschedule"}
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              {m.status === "UPCOMING" && (
                                <DropdownMenuItem
                                  className="text-rose-500 focus:text-rose-500"
                                  onSelect={() => void attempt(cancelMeeting(m.id), "Meeting cancelled")}
                                >
                                  <Ban className="mr-2 h-3.5 w-3.5" /> Cancel meeting
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SetuPage>
  );
}
