"use client";

import { useRouter } from "next/navigation";
import { Clock3, ExternalLink, GripVertical, Phone, UsersRound, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { MEETING_CHANNEL_LABEL, isOnlineChannel } from "../../constants";
import type { Deal, DealMeeting } from "../../types";
import { dealTitle, displayCode, formatDate, formatDateTime, formatInr, formatSlashDate, formatTime, isoDate, phoneDigits } from "../../utils";

/**
 * One Tasks-board card. The body follows the deal's stage, as in the design: phone + note for
 * Lead / Discussions, the meeting for Meeting, value boxes for Proposal → Closed.
 * The whole card drags between columns and opens the deal on click.
 */
export function DealCard({
  deal,
  meeting,
  today,
  onDragStart,
}: {
  deal: Deal;
  /** The deal's next upcoming meeting (shown in the Meeting column). */
  meeting?: DealMeeting;
  today: string;
  onDragStart: () => void;
}) {
  const router = useRouter();
  const open = () => router.push(ROUTES.setuDeal(deal.id));
  const showUpdated = deal.stage !== "MEETING";

  return (
    <article
      role="link"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/setu-deal-id", deal.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter") open();
      }}
      className="setu-card group relative cursor-pointer p-4 transition-shadow hover:shadow-[var(--setu-shadow-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--setu-accent-ring)]"
    >
      <GripVertical size={14} className="setu-text-3 absolute right-3 top-3 opacity-60 group-hover:opacity-100" aria-hidden />

      <h3 className="pr-5 text-sm font-semibold leading-snug">{deal.stage === "MEETING" ? meeting?.title || dealTitle(deal) : dealTitle(deal)}</h3>
      <p className="setu-text-2 mt-0.5 truncate text-xs">
        {deal.company} • {displayCode(deal)}
      </p>

      <div className="mt-3 space-y-2">
        <CardBody deal={deal} meeting={meeting} today={today} />
      </div>

      {showUpdated && <p className="setu-text-2 mt-3 text-right text-[11px] font-medium">Last Updated : {formatDateTime(deal.updatedAt)}</p>}
    </article>
  );
}

function CardBody({ deal, meeting, today }: { deal: Deal; meeting?: DealMeeting; today: string }) {
  switch (deal.stage) {
    case "LEAD":
    case "DISCUSSION":
      return (
        <>
          <PhoneChip phone={deal.phone} />
          {deal.remark && <NoteBox text={deal.remark} />}
        </>
      );

    case "MEETING":
      return <MeetingBody meeting={meeting} today={today} />;

    case "PROPOSAL":
      return (
        <div className="setu-soft flex items-end justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <p className="setu-text-2 text-[10px] font-semibold uppercase tracking-wider">Proposal Value</p>
            <p className="setu-accent-text text-lg font-bold leading-tight tabular-nums">{deal.value !== undefined ? formatInr(deal.value) : "—"}</p>
          </div>
          {deal.proposalVersion !== undefined && <span className="mb-1 text-xs font-bold">V{deal.proposalVersion}</span>}
        </div>
      );

    case "NEGOTIATION":
      return (
        <ValueBox
          tone="border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10"
          label="Deal Value:"
          value={deal.value}
          detail={deal.remark ? `Request: ${deal.remark}` : undefined}
          detailTone="text-amber-700 dark:text-amber-400"
        />
      );

    case "CLOSED_WON":
      return (
        <div className="flex items-end justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 dark:border-green-500/25 dark:bg-green-500/10">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">Closed Deal</p>
            <p className="text-lg font-bold leading-tight tabular-nums">{deal.value !== undefined ? formatInr(deal.value) : "—"}</p>
          </div>
          {deal.closedAt && <span className="setu-text-2 mb-1 shrink-0 text-[11px] font-medium">{formatDate(deal.closedAt)}</span>}
        </div>
      );

    case "CLOSED_LOST":
      return (
        <ValueBox
          tone="border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10"
          label="Deal Value:"
          value={deal.value}
          detail={deal.remark ? `Reason: ${deal.remark}` : undefined}
          detailTone="text-red-600 dark:text-red-400"
        />
      );
  }
}

function PhoneChip({ phone }: { phone: string }) {
  if (!phone) return null;
  return (
    <a
      href={`tel:+${phoneDigits(phone)}`}
      onClick={(e) => e.stopPropagation()}
      className="setu-soft setu-accent-text flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:underline"
    >
      <Phone size={13} /> {phone}
    </a>
  );
}

function NoteBox({ text }: { text: string }) {
  return (
    <p className="setu-soft border-l-[3px] border-[var(--setu-accent)] px-3 py-1.5 text-xs leading-snug">
      <span className="font-medium">Note:</span> <span className="setu-text-2">{text}</span>
    </p>
  );
}

function ValueBox({
  tone,
  label,
  value,
  detail,
  detailTone,
}: {
  tone: string;
  label: string;
  value?: number;
  detail?: string;
  detailTone: string;
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", tone)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="setu-text-2">{label}</span>
        <span className="font-bold tabular-nums">{value !== undefined ? formatInr(value) : "—"}</span>
      </div>
      {detail && <p className={cn("mt-1 text-[11px] font-medium leading-snug", detailTone)}>{detail}</p>}
    </div>
  );
}

function MeetingBody({ meeting: m, today }: { meeting?: DealMeeting; today: string }) {
  if (!m) return <NoteBox text="No meeting scheduled yet" />;
  const [first, ...rest] = m.attendees;
  const date = isoDate(m.startAt);
  return (
    <>
      <div className="setu-soft space-y-1 px-3 py-2">
        <p className="flex items-center gap-2 text-xs font-medium">
          <UsersRound size={13} className="text-violet-600 dark:text-violet-400" />
          {first?.name ?? "No attendees"}
          {rest.length > 0 && ` + ${rest.length} other${rest.length > 1 ? "s" : ""}`}
        </p>
        <p className="setu-text-2 flex min-w-0 items-center gap-2 text-[11px] font-medium">
          <Video size={12} className="shrink-0" />
          {isOnlineChannel(m.channel) && m.link ? (
            <a
              href={m.link}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex min-w-0 items-center gap-1 hover:underline"
            >
              <span className="truncate">{m.link.replace(/^https?:\/\//, "")}</span>
              <ExternalLink size={11} className="setu-accent-text shrink-0" />
            </a>
          ) : (
            <span className="truncate">{m.location || MEETING_CHANNEL_LABEL[m.channel]}</span>
          )}
        </p>
      </div>
      <div className="flex items-center justify-between pt-1 text-[11px] font-semibold">
        <span>
          {formatSlashDate(date)}
          {date === today && " (Today)"}
        </span>
        <span className="setu-text-2 flex items-center gap-1">
          <Clock3 size={12} /> {formatTime(m.startAt)}
        </span>
      </div>
    </>
  );
}
