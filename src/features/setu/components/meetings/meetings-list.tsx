"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Building2, CalendarCheck2, Download, EllipsisVertical, ExternalLink, Eye, FilterX, MapPin, PencilLine, Plus, Search, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  searchMeetings,
  weekRange,
  type MeetingRange,
} from "../../utils";
import { Breadcrumbs, FilterDropdown, SetuButton, SetuPage, attempt } from "../setu-ui";

const RANGES: readonly MeetingRange[] = ["week", "today", "next7", "month", "all"];
const STATUSES: readonly (MeetingStatus | "all")[] = ["all", "UPCOMING", "COMPLETED", "CANCELLED", "DRAFT"];
const TYPES: readonly (MeetingMode | "all")[] = ["all", "ONLINE", "IN_OFFICE", "CLIENT_LOCATION"];
const TYPE_LABEL: Record<MeetingMode, string> = { ONLINE: "Online", IN_OFFICE: "In-office", CLIENT_LOCATION: "Client Location" };
const STATUS_ORDER: Record<MeetingStatus, number> = { UPCOMING: 0, DRAFT: 1, COMPLETED: 2, CANCELLED: 3 };

const WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });

/** "Office Furniture Deal (₹8.5L)". */
export function relatedLabel(deal: Deal | undefined): string {
  if (!deal) return "—";
  const name = deal.stage === "LEAD" ? `${deal.company} (Lead)` : dealTitle(deal);
  return deal.value ? `${name} (${formatInrShort(deal.value)})` : name;
}

/** Setu → Activities → Meetings: every meeting across leads and deals. */
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

  const inRange = searchMeetings(meetings, q, (m) => `${dealById.get(m.dealId)?.company ?? ""} ${dealById.get(m.dealId)?.title ?? ""}`).filter(
    (m) => inMeetingRange(m.startAt, range, today) && (type === "all" || modeOfChannel(m.channel) === type)
  );
  const rows = inRange
    .filter((m) => status === "all" || m.status === status)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.status === "UPCOMING" ? a.startAt.localeCompare(b.startAt) : b.startAt.localeCompare(a.startAt)));
  const pace = {
    scheduled: inRange.filter((m) => m.status === "UPCOMING").length,
    completed: inRange.filter((m) => m.status === "COMPLETED").length,
    cancelled: inRange.filter((m) => m.status === "CANCELLED").length,
  };
  const filtered = q !== "" || range !== "week" || status !== "all" || type !== "all";

  const rangeOptions: { value: MeetingRange; label: string }[] = [
    { value: "week", label: `This Week (${formatRange(week.start, week.end)})` },
    { value: "today", label: "Today" },
    { value: "next7", label: "Next 7 Days" },
    { value: "month", label: "This Month" },
    { value: "all", label: "All Time" },
  ];

  const exportCsv = () => {
    if (rows.length === 0) return toast.info("No meetings to export");
    const blob = new Blob([meetingsCsv(rows.map((m) => ({ meeting: m, related: relatedLabel(dealById.get(m.dealId)) })))], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meetings-${range}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SetuPage>
      <Breadcrumbs items={[{ label: "Sales" }, { label: "Activities" }, { label: "Meetings" }]} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">Meetings</h1>
          <p className="setu-text-2 mt-1 text-sm">Schedule and manage customer meetings, sales discussions and follow-ups.</p>
        </div>
        <SetuButton variant="primary" asChild className="h-9 px-5 text-sm">
          <Link href={ROUTES.setuMeetingNew}>
            <Plus /> Schedule Meeting
          </Link>
        </SetuButton>
      </div>

      {/* Filters */}
      <div className="setu-card flex flex-wrap items-center gap-2.5 p-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="setu-text-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search meetings, participants, deals…" className="setu-input h-9 border-transparent pl-10" />
        </div>
        <FilterDropdown value={range} onChange={(v) => setRange(v as MeetingRange)} options={rangeOptions} className="min-w-56" />
        <FilterDropdown
          value={status}
          onChange={(v) => setStatus(v as MeetingStatus | "all")}
          options={[{ value: "all", label: "All Statuses" }, ...STATUSES.filter((s) => s !== "all").map((s) => ({ value: s, label: MEETING_STATUS[s as MeetingStatus].label }))]}
          className="min-w-36"
        />
        <FilterDropdown
          value={type}
          onChange={(v) => setType(v as MeetingMode | "all")}
          options={[{ value: "all", label: "All Types" }, ...TYPES.filter((t) => t !== "all").map((t) => ({ value: t, label: TYPE_LABEL[t as MeetingMode] }))]}
          className="min-w-36"
        />
        <button
          type="button"
          onClick={() => {
            setQ("");
            setRange("week");
            setStatus("all");
            setType("all");
          }}
          disabled={!filtered}
          aria-label="Clear filters"
          title="Clear filters"
          className="setu-text-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg hover:bg-[var(--setu-soft)] disabled:cursor-default disabled:opacity-40"
        >
          <FilterX size={18} />
        </button>
      </div>

      {/* Table */}
      <section className="setu-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--setu-well)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
              <CalendarCheck2 size={17} />
            </span>
            <div>
              <p className="setu-text-2 text-[11px] font-semibold uppercase tracking-wider">{range === "week" ? "Weekly Pace" : "Pace"}</p>
              <p className="text-sm font-semibold">
                <span className="setu-accent-text">{pace.scheduled} Scheduled</span> • <span className="text-green-600">{pace.completed} Completed</span> •{" "}
                <span className="setu-text-2">{pace.cancelled} Cancelled</span>
              </p>
            </div>
          </div>
          <SetuButton size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download /> Export Summary
          </SetuButton>
        </div>

        <div className="setu-scroll-x overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="setu-text-2 text-left text-xs font-semibold uppercase tracking-wide">
                <th className="px-4 py-3.5 font-semibold">Meeting Title</th>
                <th className="px-4 py-3.5 font-semibold">Related Deal / Lead</th>
                <th className="px-4 py-3.5 font-semibold">Date & Time</th>
                <th className="px-4 py-3.5 font-semibold">Meeting Type</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--setu-line)] border-t border-[var(--setu-line)]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="setu-text-2 px-6 py-14 text-center">
                    No meetings {filtered ? "match these filters" : "this week"}.
                  </td>
                </tr>
              ) : (
                rows.map((m) => (
                  <MeetingRow
                    key={m.id}
                    meeting={m}
                    related={relatedLabel(dealById.get(m.dealId))}
                    onOpen={() => router.push(ROUTES.setuMeeting(m.id))}
                    onCancel={() => {
                      void attempt(cancelMeeting(m.id), "Meeting cancelled");
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SetuPage>
  );
}

function MeetingRow({ meeting: m, related, onOpen, onCancel }: { meeting: DealMeeting; related: string; onOpen: () => void; onCancel: () => void }) {
  const online = isOnlineChannel(m.channel);
  const s = MEETING_STATUS[m.status];
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const dateLine = `${WEEKDAY.format(new Date(m.startAt))}, ${formatDate(m.startAt)}`;
  return (
    <tr onClick={onOpen} className="cursor-pointer hover:bg-[var(--setu-soft)]/60">
      <td className="px-4 py-4">
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              online ? "bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]" : "bg-[var(--setu-well)] setu-text-2"
            )}
          >
            {online ? <Video size={15} /> : m.channel === "IN_OFFICE" ? <Building2 size={15} /> : <MapPin size={15} />}
          </span>
          <span className={cn("text-sm font-semibold", m.status === "CANCELLED" && "line-through decoration-1")}>{m.title}</span>
        </span>
      </td>
      <td className="setu-text-2 px-4 py-4">{related}</td>
      <td className="px-4 py-4">
        <p className="whitespace-nowrap font-medium">{dateLine}</p>
        <p className="setu-text-2 whitespace-nowrap text-xs">{formatTimeRange(m.startAt, m.endAt)} (IST)</p>
      </td>
      <td className="px-4 py-4">
        {online ? (
          m.link ? (
            <a href={m.link} target="_blank" rel="noreferrer" onClick={stop} className="inline-flex items-center gap-1 hover:underline">
              Online <ExternalLink size={12} className="setu-accent-text" />
            </a>
          ) : (
            "Online"
          )
        ) : (
          <span>
            {m.channel === "IN_OFFICE" ? "In-office" : "Client Location"}
            {m.location && <span className="setu-text-2 block text-xs">{m.location}</span>}
          </span>
        )}
      </td>
      <td className="px-4 py-4">
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", s.tone)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} /> {s.label}
        </span>
      </td>
      <td className="px-4 py-4" onClick={stop}>
        <span className="flex items-center gap-1">
          {m.status === "UPCOMING" && online && m.link ? (
            <SetuButton variant="primary" size="sm" asChild className="h-7 px-3">
              <a href={m.link} target="_blank" rel="noreferrer">
                Join
              </a>
            </SetuButton>
          ) : (
            <SetuButton variant="ghost" size="sm" className="h-7 px-3" onClick={onOpen}>
              {m.status === "COMPLETED" ? "Summary" : "View"}
            </SetuButton>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Meeting actions" className="setu-text-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--setu-soft)]">
                <EllipsisVertical size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onOpen}>
                <Eye size={14} /> View details
              </DropdownMenuItem>
              {(m.status === "UPCOMING" || m.status === "DRAFT") && (
                <DropdownMenuItem asChild>
                  <Link href={ROUTES.setuMeetingEdit(m.id)}>
                    <PencilLine size={14} /> {m.status === "DRAFT" ? "Continue draft" : "Edit / Reschedule"}
                  </Link>
                </DropdownMenuItem>
              )}
              {m.status === "UPCOMING" && (
                <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={onCancel}>
                  <Ban size={14} /> Cancel meeting
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </td>
    </tr>
  );
}
