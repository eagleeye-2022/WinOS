"use client";

import Link from "next/link";
import {
  ArrowRight,
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  Copy,
  EllipsisVertical,
  MapPin,
  PencilLine,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RichDescriptionView, isEmptyDescription } from "@/components/shared/rich-description";
import { usePageViewState } from "@/lib/navigation/use-url-state";
import { MEETING_CHANNEL_LABEL, MEETING_STATUS, isOnlineChannel } from "../../constants";
import { useSetuStore } from "../../provider";
import type { DealMeeting, MeetingRsvp } from "../../types";
import { formatDate, formatTime, formatTimeRange, initials, avatarColor, meetingNumbers, relativeToNow } from "../../utils";
import { AddExternalAttendeeDialog } from "../deal/meeting-attendees";
import { CompleteMeetingDialog } from "../deal/meeting-dialogs";
import { Breadcrumbs, ComingSoon, SetuButton, SetuPage, attempt } from "../setu-ui";
import { useNow } from "./use-now";

const withoutProtocol = (url: string) => url.replace(/^https?:\/\//, "");

export function MeetingDetail({ meetingId }: { meetingId: string }) {
  const meeting = useSetuStore((s) => s.meetings.find((m) => m.id === meetingId));
  if (!meeting) {
    return (
      <SetuPage>
        <Breadcrumbs items={[{ label: "Sales" }, { label: "Activities" }, { label: "Meetings", href: ROUTES.setuMeetings }, { label: "Not found" }]} />
        <ComingSoon title="Meeting not found" text="This meeting doesn't exist (design-phase data resets when the page is refreshed)." />
        <div className="flex justify-center">
          <SetuButton variant="primary" asChild>
            <Link href={ROUTES.setuMeetings}>Back to Meetings</Link>
          </SetuButton>
        </div>
      </SetuPage>
    );
  }
  return <MeetingDetailBody meeting={meeting} />;
}

function MeetingDetailBody({ meeting: m }: { meeting: DealMeeting }) {
  const deal = useSetuStore((s) => s.deals.find((d) => d.id === m.dealId));
  const allMeetings = useSetuStore((s) => s.meetings);
  const dealMeetings = allMeetings.filter((x) => x.dealId === m.dealId);
  const cancelMeeting = useSetuStore((s) => s.cancelMeeting);
  const addInvite = useSetuStore((s) => s.addMeetingInvite);
  const setRsvp = useSetuStore((s) => s.setAttendeeRsvp);
  const [completeOpen, setCompleteOpen] = usePageViewState("MeetingDetail:complete", false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const now = useNow();

  const online = isOnlineChannel(m.channel);
  const upcoming = m.status === "UPCOMING";
  const status = MEETING_STATUS[m.status];
  const minutes = Math.round((Date.parse(m.endAt) - Date.parse(m.startAt)) / 60000);
  const number = meetingNumbers(dealMeetings).get(m.id) ?? 0;
  const confirmed = 1 + m.attendees.filter((a) => a.rsvp === "ACCEPTED" || a.attended).length;

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
    <SetuPage>
      <Breadcrumbs items={[{ label: "Sales" }, { label: "Activities" }, { label: "Meetings", href: ROUTES.setuMeetings }, { label: m.title }]} />

      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={cn("text-2xl font-bold leading-tight tracking-tight", m.status === "CANCELLED" && "line-through decoration-2")}>{m.title}</h1>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", status.tone)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} /> {status.label}
            </span>
          </div>
          <p className="setu-text-2 mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <Clock3 size={15} className="setu-accent-text" />
            {formatDate(m.startAt)} • {formatTimeRange(m.startAt, m.endAt)} IST
            {upcoming && now !== null && (
              <span className="rounded bg-[var(--setu-accent-soft)] px-1.5 py-0.5 text-xs font-semibold text-[var(--setu-accent)]">{relativeToNow(m.startAt, m.endAt, now)}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {m.link && online && (
            <SetuButton onClick={copyLink}>
              <Copy size={14} /> Copy Link
            </SetuButton>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SetuButton aria-label="More actions" className="w-10 px-0">
                <EllipsisVertical size={16} />
              </SetuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              {(upcoming || m.status === "DRAFT") && (
                <DropdownMenuItem asChild>
                  <Link href={ROUTES.setuMeetingEdit(m.id)}>
                    <PencilLine size={14} /> {m.status === "DRAFT" ? "Continue draft" : "Edit / Reschedule"}
                  </Link>
                </DropdownMenuItem>
              )}
              {upcoming && (
                <DropdownMenuItem onSelect={() => setCompleteOpen(true)}>
                  <CircleCheck size={14} /> Complete & log summary
                </DropdownMenuItem>
              )}
              {deal && (
                <DropdownMenuItem asChild>
                  <Link href={`${ROUTES.setuDeal(deal.id)}?tab=meetings`}>
                    <CircleDollarSign size={14} /> Open {deal.company}
                  </Link>
                </DropdownMenuItem>
              )}
              {upcoming && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onSelect={() => {
                      void attempt(cancelMeeting(m.id), "Meeting cancelled");
                    }}
                  >
                    <Ban size={14} /> Cancel meeting
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {upcoming && online && m.link && (
            <SetuButton variant="primary" asChild className="h-9 px-4">
              <a href={m.link} target="_blank" rel="noreferrer">
                <Video size={15} /> Join Call
              </a>
            </SetuButton>
          )}
        </div>
      </div>

      {/* Room / location banner */}
      {upcoming &&
        (online ? (
          <section className="setu-card flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-[var(--setu-accent)] px-6 py-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
                <Video size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--setu-accent)]">{MEETING_CHANNEL_LABEL[m.channel]}</span>
                  <span className="text-xs text-[var(--setu-text-3)]">•</span>
                  <span className="setu-text-2 text-xs font-medium">
                    {m.link ? "Online Video Room Ready" : "Meeting link pending"}
                  </span>
                </div>
                {m.link ? (
                  <p className="mt-0.5 font-mono text-xs text-[var(--setu-text)] select-all">
                    {withoutProtocol(m.link)}
                  </p>
                ) : (
                  <p className="setu-text-2 mt-0.5 text-xs">No link has been attached to this meeting yet.</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {m.link ? (
                <>
                  <SetuButton size="sm" onClick={copyLink}>
                    <Copy size={13} /> Copy Link
                  </SetuButton>
                  <SetuButton variant="primary" size="sm" asChild>
                    <a href={m.link} target="_blank" rel="noreferrer">
                      Start Meeting <ArrowRight size={14} />
                    </a>
                  </SetuButton>
                </>
              ) : (
                <SetuButton variant="primary" size="sm" asChild>
                  <Link href={ROUTES.setuMeetingEdit(m.id)}>Add meeting link</Link>
                </SetuButton>
              )}
            </div>
          </section>
        ) : (
          <section className="setu-card flex items-center gap-3.5 border-l-4 border-l-[var(--setu-accent)] px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
              <MapPin size={20} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[var(--setu-accent)]">{MEETING_CHANNEL_LABEL[m.channel]}</span>
              <p className="mt-0.5 text-sm font-medium">{m.location || "Location not added yet"}</p>
            </div>
          </section>
        ))}

      {/* Overview */}
      <section className="setu-card px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Meeting Overview</h2>
          <span className="setu-text-2 rounded-md bg-[var(--setu-well)] px-2 py-1 text-[11px] font-semibold">{m.type}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)]/40 p-4 sm:grid-cols-4">
          <div>
            <span className="setu-text-2 text-xs font-medium">Date & Time</span>
            <p className="mt-1 text-sm font-semibold">{formatDate(m.startAt)}</p>
            <p className="setu-text-3 text-xs">{formatTimeRange(m.startAt, m.endAt)} IST</p>
          </div>
          <div>
            <span className="setu-text-2 text-xs font-medium">Duration</span>
            <p className="mt-1 text-sm font-semibold">{minutes} mins</p>
            <p className="setu-text-3 text-xs">Scheduled window</p>
          </div>
          <div>
            <span className="setu-text-2 text-xs font-medium">Attendees</span>
            <p className="mt-1 text-sm font-semibold">{m.attendees.length + 1} people</p>
            <p className="setu-text-3 text-xs">{confirmed} confirmed</p>
          </div>
          <div>
            <span className="setu-text-2 text-xs font-medium">Associated Deal</span>
            <p className="mt-1 truncate text-sm font-semibold">
              {deal ? (
                <Link href={ROUTES.setuDeal(deal.id)} className="hover:text-[var(--setu-accent)] hover:underline">
                  {deal.company}
                </Link>
              ) : (
                <span className="setu-text-3">—</span>
              )}
            </p>
            {deal && <p className="setu-text-3 truncate text-xs">{deal.title || deal.contactName}</p>}
          </div>
        </div>
        {!isEmptyDescription(m.agenda) && (
          <div className="mt-4 rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)]/40 px-4 py-3.5">
            <h3 className="text-xs font-semibold text-[var(--setu-text)]">Agenda & Objectives</h3>
            <div className="mt-1 text-sm leading-relaxed [&_p]:my-0">
              <RichDescriptionView value={m.agenda} />
            </div>
          </div>
        )}
      </section>

      {/* Summary (completed) */}
      {m.status === "COMPLETED" && m.summary && !isEmptyDescription(m.summary) && (
        <section className="setu-card px-6 py-5">
          <h2 className="text-base font-semibold">Meeting Notes & Summary</h2>
          <div className="mt-3 rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] px-4 py-3 text-sm leading-relaxed [&_p]:my-0">
            <RichDescriptionView value={m.summary} />
          </div>
          {m.recordingUrl && (
            <a href={m.recordingUrl} target="_blank" rel="noreferrer" className="setu-accent-text mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline">
              View Recording <ArrowRight size={14} />
            </a>
          )}
        </section>
      )}

      {/* Participants */}
      <section className="setu-card px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Participants</h2>
            <span className="setu-text-2 rounded-md bg-[var(--setu-well)] px-2 py-0.5 text-xs font-semibold">{confirmed} Confirmed</span>
          </div>
          {upcoming && (
            <button type="button" onClick={() => setInviteOpen(true)} className="setu-accent-text flex cursor-pointer items-center gap-1.5 text-xs font-semibold hover:underline">
              <UserPlus size={14} /> Add Invite
            </button>
          )}
        </div>
        <div className="mt-4 space-y-2">
          <ParticipantRow
            name={m.hostName}
            badge="Host"
            badgeTone="bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]"
            subtitle={[m.hostRole, "WinOS CRM"].filter(Boolean).join(" • ")}
            right={
              <span className="setu-accent-text inline-flex items-center gap-1 rounded-full bg-[var(--setu-accent-soft)] px-2.5 py-0.5 text-xs font-semibold">
                <CircleCheck size={12} /> Organizer
              </span>
            }
          />
          {m.attendees.map((a) => (
            <ParticipantRow
              key={a.id}
              name={a.name}
              badge={a.source === "LEAD" ? "Lead" : a.external ? "External Guest" : "Internal"}
              badgeTone={a.external ? "bg-[var(--setu-well)] setu-text-2" : "bg-[var(--setu-well)] setu-text-2"}
              subtitle={[a.role, a.company].filter(Boolean).join(" • ")}
              email={a.email}
              right={
                m.status === "COMPLETED" ? (
                  <AttendancePill attended={a.attended !== false} />
                ) : (
                  <RsvpMenu value={a.rsvp ?? "PENDING"} disabled={!upcoming} onChange={(r) => void attempt(setRsvp(m.id, a.id, r), "RSVP recorded")} />
                )
              }
            />
          ))}
        </div>
      </section>

      {/* History */}
      <section className="setu-card px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Activity & History</h2>
          <span className="setu-text-3 text-xs">Logged automatically</span>
        </div>
        {m.history.length === 0 ? (
          <p className="setu-text-2 mt-4 text-sm">No activity yet.</p>
        ) : (
          <ol className="relative mt-4 space-y-4 border-l border-[var(--setu-line)] pl-5">
            {m.history.map((h) => (
              <li key={h.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[25px] top-1.5 h-2 w-2 rounded-full ring-4 ring-[var(--setu-card)]",
                    h.tone === "green" ? "bg-green-500" : h.tone === "amber" ? "bg-amber-500" : h.tone === "red" ? "bg-red-500" : "bg-blue-600"
                  )}
                />
                <p className="text-xs">
                  <span className="font-semibold text-[var(--setu-text)]">{h.title}</span>
                  <span className="setu-text-3">
                    {" "}
                    • {formatDate(h.at)}, {formatTime(h.at)}
                  </span>
                </p>
                <p className="setu-text-2 mt-0.5 text-xs">{h.detail}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {deal && (
        <CompleteMeetingDialog deal={deal} meeting={m} number={number} open={completeOpen && upcoming} onClose={() => setCompleteOpen(false)} />
      )}
      <AddExternalAttendeeDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onAdd={(a) => void attempt(addInvite(m.id, a), `${a.name} invited`)}
      />
    </SetuPage>
  );
}

function ParticipantRow({
  name,
  badge,
  badgeTone,
  subtitle,
  email,
  right,
}: {
  name: string;
  badge: string;
  badgeTone: string;
  subtitle: string;
  email?: string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-xl border border-[var(--setu-line)] bg-[var(--setu-card)] px-4 py-3 transition-colors hover:bg-[var(--setu-well)]/30">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white", avatarColor(name))}>
        {initials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{name}</span>
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", badgeTone)}>{badge}</span>
        </p>
        {subtitle && <p className="setu-text-2 text-xs">{subtitle}</p>}
        {email && <p className="setu-text-3 font-mono text-[11px]">{email}</p>}
      </div>
      {right}
    </div>
  );
}

const RSVP_STYLE: Record<MeetingRsvp, { label: string; tone: string; icon: React.ElementType }> = {
  ACCEPTED: { label: "Accepted", tone: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400", icon: CheckCheck },
  PENDING: { label: "Awaiting RSVP", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300", icon: Clock3 },
  DECLINED: { label: "Declined", tone: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400", icon: X },
};

/** RSVP pill; the menu records a response the attendee gave by other means (email / call). */
function RsvpMenu({ value, onChange, disabled }: { value: MeetingRsvp; onChange: (r: MeetingRsvp) => void; disabled?: boolean }) {
  const s = RSVP_STYLE[value];
  const pill = (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", s.tone)}>
      <s.icon size={12} /> {s.label}
      {!disabled && <ChevronDown size={12} />}
    </span>
  );
  if (disabled) return pill;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="cursor-pointer" aria-label="Record RSVP">
          {pill}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(RSVP_STYLE) as MeetingRsvp[]).map((r) => {
          const Icon = RSVP_STYLE[r].icon;
          return (
            <DropdownMenuItem key={r} onSelect={() => onChange(r)}>
              <Icon size={14} /> {RSVP_STYLE[r].label}
              {r === value && <Check size={14} className="ml-auto" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AttendancePill({ attended }: { attended: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        attended ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : "bg-[var(--setu-card)] setu-text-2"
      )}
    >
      {attended ? <Check size={12} /> : <X size={12} />} {attended ? "Attended" : "Absent"}
    </span>
  );
}
