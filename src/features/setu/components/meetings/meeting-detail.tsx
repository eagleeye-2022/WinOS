"use client";

import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  Copy,
  EllipsisVertical,
  History,
  Info,
  ListChecks,
  MapPin,
  PencilLine,
  Timer,
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
              <Copy /> Copy Link
            </SetuButton>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SetuButton aria-label="More actions" className="w-10 px-0">
                <EllipsisVertical />
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
            <SetuButton variant="primary" asChild className="h-10 px-5">
              <a href={m.link} target="_blank" rel="noreferrer">
                <Video /> Start Meeting (Host)
              </a>
            </SetuButton>
          )}
        </div>
      </div>

      {/* Room / location banner */}
      {upcoming &&
        (online ? (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-6 text-white shadow-[var(--setu-shadow-lg)]">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Video size={24} />
              </span>
              <div className="min-w-0">
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">{MEETING_CHANNEL_LABEL[m.channel]}</span>
                <p className="mt-1.5 text-xl font-semibold">{m.link ? "Online Video Room Ready" : "Online meeting — link not added yet"}</p>
                {m.link && (
                  <p className="mt-1 text-sm text-white/80">
                    Room Link: <span className="font-mono text-xs text-white">{withoutProtocol(m.link)}</span>
                  </p>
                )}
              </div>
            </div>
            {m.link ? (
              <a
                href={m.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
              >
                Start Meeting as Host <ArrowRight size={18} />
              </a>
            ) : (
              <Link href={ROUTES.setuMeetingEdit(m.id)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-blue-700">
                Add meeting link
              </Link>
            )}
          </section>
        ) : (
          <section className="setu-card flex items-start gap-4 px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
              <MapPin size={22} />
            </span>
            <div>
              <span className="setu-text-2 text-[11px] font-semibold uppercase tracking-wider">{MEETING_CHANNEL_LABEL[m.channel]}</span>
              <p className="mt-0.5 text-lg font-semibold">{m.location || "Location not added yet"}</p>
            </div>
          </section>
        ))}

      {/* Overview */}
      <section className="setu-card px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Info size={18} className="setu-accent-text" /> Meeting Information & Overview
          </h2>
          <span className="setu-text-2 rounded-md bg-[var(--setu-well)] px-2 py-1 text-[11px] font-bold uppercase tracking-wider">{m.type}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoTile icon={CalendarDays} label="Date & Time" value={formatDate(m.startAt)} sub={`${formatTimeRange(m.startAt, m.endAt)} IST`} />
          <InfoTile icon={Timer} label="Duration" value={String(minutes)} sub="mins scheduled window" inline />
          <InfoTile icon={Users} label="Attendees" value={String(m.attendees.length + 1)} sub="incl. host" inline />
          <InfoTile
            icon={CircleDollarSign}
            label="Lead / Deal"
            value={
              deal ? (
                <Link href={ROUTES.setuDeal(deal.id)} className="hover:underline">
                  {deal.company}
                </Link>
              ) : (
                "—"
              )
            }
            sub={deal ? (deal.title || deal.contactName) : undefined}
            tone="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
          />
        </div>
        {!isEmptyDescription(m.agenda) && (
          <div className="mt-4 rounded-xl bg-[var(--setu-well)] px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <ListChecks size={14} className="setu-accent-text" /> Agenda & Objectives
            </p>
            <div className="mt-1 text-sm leading-relaxed [&_p]:my-0">
              <RichDescriptionView value={m.agenda} />
            </div>
          </div>
        )}
      </section>

      {/* Summary (completed) */}
      {m.status === "COMPLETED" && m.summary && !isEmptyDescription(m.summary) && (
        <section className="setu-card px-6 py-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CircleCheck size={18} className="text-green-600" /> Meeting Notes & Discussion Summary
          </h2>
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
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users size={19} className="setu-accent-text" /> Participants
            <span className="setu-text-2 rounded-md bg-[var(--setu-well)] px-2 py-0.5 text-xs font-semibold">{confirmed} Confirmed</span>
          </h2>
          {upcoming && (
            <button type="button" onClick={() => setInviteOpen(true)} className="setu-accent-text flex cursor-pointer items-center gap-1.5 text-sm font-semibold hover:underline">
              <UserPlus size={15} /> Add Invite
            </button>
          )}
        </div>
        <div className="mt-4 space-y-2.5">
          <ParticipantRow
            name={m.hostName}
            badge="Host / Organizer"
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
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History size={18} className="setu-accent-text" /> Meeting Activity & Audit History
          </h2>
          <span className="setu-text-3 text-xs">Logged automatically</span>
        </div>
        {m.history.length === 0 ? (
          <p className="setu-text-2 mt-4 text-sm">No activity yet.</p>
        ) : (
          <ol className="relative mt-4 space-y-5 border-l border-[var(--setu-line)] pl-6">
            {m.history.map((h) => (
              <li key={h.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[29px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--setu-card)]",
                    h.tone === "green" ? "bg-green-500" : h.tone === "amber" ? "bg-amber-500" : h.tone === "red" ? "bg-red-500" : "bg-blue-600"
                  )}
                />
                <p className="text-xs">
                  <span className="font-semibold">{h.title}</span>
                  <span className="setu-text-2">
                    {" "}
                    • {formatDate(h.at)}, {formatTime(h.at)}
                  </span>
                </p>
                <p className="setu-text-2 text-sm">{h.detail}</p>
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

function InfoTile({
  icon: Icon,
  label,
  value,
  sub,
  inline,
  tone = "bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  inline?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[var(--setu-well)] px-4 py-3.5">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="setu-text-2 text-[11px] font-semibold uppercase tracking-wider">{label}</p>
        {inline ? (
          <p className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold">{value}</span>
            {sub && <span className="setu-text-2 text-xs font-medium">{sub}</span>}
          </p>
        ) : (
          <>
            <p className="truncate text-xs font-semibold">{value}</p>
            {sub && <p className="setu-text-2 truncate text-xs">{sub}</p>}
          </>
        )}
      </div>
    </div>
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
    <div className="flex flex-wrap items-center gap-4 rounded-xl bg-[var(--setu-well)] px-4 py-3">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white", avatarColor(name))}>{initials(name)}</span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold">{name}</span>
          <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", badgeTone)}>{badge}</span>
        </p>
        {subtitle && <p className="setu-text-2 text-sm">{subtitle}</p>}
        {email && <p className="setu-text-3 font-mono text-xs">{email}</p>}
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
