"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Ban,
  CalendarDays,
  Check,
  CircleCheck,
  EllipsisVertical,
  ExternalLink,
  Eye,
  FilePen,
  Link2,
  MapPin,
  PencilLine,
  Search,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RichDescriptionView, isEmptyDescription } from "@/components/shared/rich-description";
import { useUrlState, usePageViewState } from "@/lib/navigation/use-url-state";
import { MEETING_CHANNEL_LABEL, MEETING_STATUS, isOnlineChannel } from "../../constants";
import { useSetuStore } from "../../provider";
import type { Deal, DealMeeting, MeetingStatus } from "../../types";
import { formatDate, formatSpan, formatTime, formatTimeRange, isoDate, meetingNumbers, meetingStats, relativeDay, searchMeetings } from "../../utils";
import { SetuButton, attempt } from "../setu-ui";
import { SortMenu } from "./deal-calls-tab";
import { CompleteMeetingDialog, MeetingFormDialog, type MeetingDialogMode } from "./meeting-dialogs";

type MeetingFilter = "all" | "upcoming" | "completed";
type MeetingSort = "newest" | "oldest";
const FILTERS: readonly MeetingFilter[] = ["all", "upcoming", "completed"];
const SORTS: readonly MeetingSort[] = ["newest", "oldest"];
const SORT_LABEL: Record<MeetingSort, string> = { newest: "Date (Newest)", oldest: "Date (Oldest)" };

/** Which dialog is open (JSON-safe so it's remembered with the page). Scheduling is a full page. */
type DialogState = { kind: MeetingDialogMode | "complete"; id?: string } | null;

const scheduleHref = (dealId: string) => `${ROUTES.setuMeetingNew}?deal=${dealId}`;

const withoutProtocol = (url: string) => url.replace(/^https?:\/\//, "");

export function DealMeetingsTab({ deal }: { deal: Deal }) {
  const allMeetings = useSetuStore((s) => s.meetings);
  const cancelMeeting = useSetuStore((s) => s.cancelMeeting);
  const [q, setQ] = useUrlState("meetq", "");
  const [filter, setFilter] = useUrlState<MeetingFilter>("meetings", "all", { allowed: FILTERS });
  const [sort, setSort] = useUrlState<MeetingSort>("meetsort", "newest", { allowed: SORTS });
  const [dialog, setDialog] = usePageViewState<DialogState>("DealMeetings:dialog", null);

  const today = isoDate(new Date());
  const meetings = allMeetings.filter((m) => m.dealId === deal.id);
  const numbers = meetingNumbers(meetings);
  const stats = meetingStats(meetings);
  const next = meetings.filter((m) => m.status === "UPCOMING").sort((a, b) => a.startAt.localeCompare(b.startAt))[0];

  const status: MeetingStatus | null = filter === "upcoming" ? "UPCOMING" : filter === "completed" ? "COMPLETED" : null;
  const visible = searchMeetings(meetings, q)
    .filter((m) => !status || m.status === status)
    .sort((a, b) => (sort === "oldest" ? a.startAt.localeCompare(b.startAt) : b.startAt.localeCompare(a.startAt)));

  const dialogMeeting = dialog?.id ? meetings.find((m) => m.id === dialog.id) : undefined;
  const close = () => setDialog(null);

  const cancel = (m: DealMeeting) => {
    void attempt(cancelMeeting(m.id), "Meeting cancelled");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-base font-semibold">Meetings</h2>
          <p className="setu-text-2 text-xs">
            {stats.total} scheduled & past meeting{stats.total === 1 ? "" : "s"} · {stats.external} external · {stats.virtual} virtual
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SetuButton size="sm" onClick={() => setDialog({ kind: "log" })}>
            Log Meeting
          </SetuButton>
          <SetuButton variant="primary" size="sm" asChild>
            <Link href={scheduleHref(deal.id)}>
              Schedule Meeting
            </Link>
          </SetuButton>
        </div>
      </div>

      {/* Next meeting banner */}
      {next && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--setu-accent-ring)] bg-[var(--setu-accent-soft)] px-4 py-2.5 text-sm">
          <span className="flex flex-wrap items-center gap-3">
            <span className="rounded bg-[var(--setu-card)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--setu-accent)]">Upcoming</span>
            <span className="font-semibold">{next.title}</span>
            <span className="setu-text-2">
              ({relativeDay(next.startAt, today) ?? formatDate(next.startAt)}, {formatTime(next.startAt)} IST)
            </span>
          </span>
          {next.link && (
            <a href={next.link} target="_blank" rel="noreferrer" className="setu-accent-text flex items-center gap-0.5 text-xs font-semibold hover:underline">
              Quick Join <ArrowUpRight size={14} />
            </a>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)] p-1">
          {FILTERS.map((f) => {
            const count = f === "all" ? stats.total : f === "upcoming" ? stats.upcoming : stats.completed;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "cursor-pointer rounded-md px-3.5 py-1.5 text-sm font-medium capitalize transition-colors",
                  filter === f ? "bg-[var(--setu-accent-soft)] text-[var(--setu-accent)] font-semibold" : "setu-text-2 hover:text-[var(--setu-text)]"
                )}
              >
                {f} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search size={15} className="setu-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search meetings, agendas…" className="setu-input h-10 pl-9" />
          </div>
          <SortMenu value={sort} onChange={setSort} options={SORTS} labels={SORT_LABEL} />
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="setu-card setu-text-2 px-6 py-12 text-center text-sm">{meetings.length === 0 ? "No meetings yet. Schedule the first one." : "No meetings match."}</div>
      ) : (
        visible.map((m) =>
          m.status === "UPCOMING" ? (
            <UpcomingMeetingCard
              key={m.id}
              meeting={m}
              number={numbers.get(m.id) ?? 0}
              today={today}
              onComplete={() => setDialog({ kind: "complete", id: m.id })}
              onCancel={() => cancel(m)}
            />
          ) : (
            <PastMeetingCard key={m.id} meeting={m} number={numbers.get(m.id) ?? 0} onEdit={() => setDialog({ kind: "edit", id: m.id })} />
          )
        )
      )}

      <MeetingFormDialog
        deal={deal}
        mode={dialog?.kind === "edit" ? "edit" : "log"}
        meeting={dialog?.kind === "edit" ? dialogMeeting : undefined}
        open={dialog?.kind === "log" || (dialog?.kind === "edit" && Boolean(dialogMeeting))}
        onClose={close}
      />
      <CompleteMeetingDialog
        deal={deal}
        meeting={dialog?.kind === "complete" ? dialogMeeting : undefined}
        number={dialogMeeting ? (numbers.get(dialogMeeting.id) ?? 0) : 0}
        open={dialog?.kind === "complete" && Boolean(dialogMeeting)}
        onClose={close}
      />
    </div>
  );
}

function MeetingMenu({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Meeting actions" className="setu-text-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--setu-soft)]">
          <EllipsisVertical size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function UpcomingMeetingCard({
  meeting: m,
  number,
  today,
  onComplete,
  onCancel,
}: {
  meeting: DealMeeting;
  number: number;
  today: string;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const day = relativeDay(m.startAt, today);
  const hasExternal = m.attendees.some((a) => a.external);
  const online = isOnlineChannel(m.channel);

  const copyLink = async () => {
    if (!m.link) return;
    try {
      await navigator.clipboard.writeText(m.link);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <article className="setu-card border-[var(--setu-accent-ring)] px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--setu-accent-soft)] px-2.5 py-0.5 text-[var(--setu-accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--setu-accent)]" /> Upcoming
          </span>
          {hasExternal && <span className="setu-text-2 rounded-full bg-[var(--setu-well)] px-2.5 py-0.5">External</span>}
          <span className="setu-text-2 rounded-full bg-[var(--setu-well)] px-2.5 py-0.5">{MEETING_CHANNEL_LABEL[m.channel]}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <SetuButton size="sm" asChild>
            <Link href={ROUTES.setuMeetingEdit(m.id)}>Edit / Reschedule</Link>
          </SetuButton>
          <SetuButton size="sm" variant="soft" asChild>
            <Link href={ROUTES.setuMeeting(m.id)}>View Details</Link>
          </SetuButton>
          <MeetingMenu>
            <DropdownMenuItem onSelect={onComplete}>
              <CircleCheck size={14} /> Complete & log summary
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={ROUTES.setuMeeting(m.id)}>
                <Eye size={14} /> Full meeting page
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={onCancel}>
              <Ban size={14} /> Cancel meeting
            </DropdownMenuItem>
          </MeetingMenu>
        </div>
      </div>

      <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight">
        <Link href={ROUTES.setuMeeting(m.id)} className="hover:underline">
          Meeting #{number} — {m.title}
        </Link>
      </h3>
      <p className="setu-text-2 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="setu-accent-text flex items-center gap-1.5 font-medium">
          <CalendarDays size={15} />
          {day ? `${day}, ` : ""}
          {formatDate(m.startAt)}
        </span>
        <span>·</span>
        <span>{formatTimeRange(m.startAt, m.endAt)} (IST)</span>
        <span>·</span>
        <span>
          Host:{" "}
          <span className="font-semibold text-[var(--setu-text)]">
            {m.hostName}
            {m.hostRole && ` (${m.hostRole})`}
          </span>
        </span>
      </p>

      <div className="setu-soft mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 text-sm">
        <span className="setu-text-2 text-xs font-semibold uppercase tracking-wider">Participants:</span>
        {m.attendees.length === 0 ? (
          <span className="setu-text-3 text-xs">None added</span>
        ) : (
          m.attendees.map((a) => (
            <span key={a.id} className="flex items-center gap-1.5 font-medium">
              <span className={cn("h-1.5 w-1.5 rounded-full", a.external ? "bg-green-500" : "bg-blue-600")} />
              {a.name}
            </span>
          ))
        )}
      </div>

      {!isEmptyDescription(m.agenda) && (
        <div className="mt-3 rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider">Agenda & Scope:</p>
          <div className="mt-1 text-sm leading-relaxed [&_p]:my-0">
            <RichDescriptionView value={m.agenda} />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--setu-line)] pt-4">
        {online && m.link ? (
          <>
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <Link2 size={15} className="setu-accent-text shrink-0" />
              <span className="truncate font-mono">{withoutProtocol(m.link)}</span>
              <button type="button" onClick={copyLink} className="setu-accent-text cursor-pointer text-xs font-semibold underline">
                Copy Link
              </button>
            </span>
            <SetuButton variant="primary" asChild>
              <a href={m.link} target="_blank" rel="noreferrer">
                Join Meeting <ExternalLink />
              </a>
            </SetuButton>
          </>
        ) : (
          <span className="setu-text-2 flex items-center gap-2 text-sm">
            {online ? <Video size={15} /> : <MapPin size={15} />}
            {online ? "No meeting link added yet." : m.location || MEETING_CHANNEL_LABEL[m.channel]}
          </span>
        )}
      </div>
    </article>
  );
}

/** Completed, cancelled or draft meeting. */
function PastMeetingCard({ meeting: m, number, onEdit }: { meeting: DealMeeting; number: number; onEdit: () => void }) {
  const seconds = (Date.parse(m.endAt) - Date.parse(m.startAt)) / 1000;
  const attended = m.attendees.filter((a) => a.attended !== false);
  const status = MEETING_STATUS[m.status];
  const Icon = m.status === "COMPLETED" ? Check : m.status === "CANCELLED" ? Ban : FilePen;
  return (
    <article className={cn("setu-card px-6 py-5", m.status === "CANCELLED" && "opacity-75")}>
      <div className="flex items-start gap-4">
        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", status.tone)}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className={cn("text-base font-semibold", m.status === "CANCELLED" && "line-through decoration-1")}>
                <Link href={ROUTES.setuMeeting(m.id)} className="hover:underline">
                  Meeting #{number} — {m.title}
                </Link>
              </h3>
              <p className="setu-text-2 mt-0.5 text-sm">
                {formatDate(m.startAt)} · {formatTimeRange(m.startAt, m.endAt)} ({formatSpan(seconds)}) · Type: <span className="font-semibold text-[var(--setu-text)]">{m.type}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.tone)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} /> {status.label}
              </span>
              <MeetingMenu>
                <DropdownMenuItem asChild>
                  <Link href={ROUTES.setuMeeting(m.id)}>
                    <Eye size={14} /> View details
                  </Link>
                </DropdownMenuItem>
                {m.status === "COMPLETED" && (
                  <DropdownMenuItem onSelect={onEdit}>
                    <PencilLine size={14} /> Edit details & summary
                  </DropdownMenuItem>
                )}
                {m.status === "DRAFT" && (
                  <DropdownMenuItem asChild>
                    <Link href={ROUTES.setuMeetingEdit(m.id)}>
                      <PencilLine size={14} /> Continue draft
                    </Link>
                  </DropdownMenuItem>
                )}
              </MeetingMenu>
            </div>
          </div>

          {m.summary && !isEmptyDescription(m.summary) && (
            <div className="setu-text-2 mt-3 rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)] px-4 py-3 text-sm italic [&_p]:my-0">
              <RichDescriptionView value={m.summary} />
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="setu-text-2">
              <span className="font-semibold text-[var(--setu-text)]">Attendees:</span> {attended.map((a) => a.name).join(", ") || "—"}
            </span>
            {m.recordingUrl && (
              <a href={m.recordingUrl} target="_blank" rel="noreferrer" className="setu-accent-text flex items-center gap-1 text-xs font-semibold hover:underline">
                View Recording <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
