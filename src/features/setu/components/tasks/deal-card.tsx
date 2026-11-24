"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  Clock3,
  ExternalLink,
  GripVertical,
  Phone,
  UsersRound,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSetuStore } from "../../provider";
import { DEAL_STAGES, MEETING_CHANNEL_LABEL, STAGE_BY_ID, STAGE_DOT, isOnlineChannel } from "../../constants";
import type { Deal, DealMeeting, DealStage } from "../../types";
import {
  dealTitle,
  displayCode,
  formatDate,
  formatInr,
  formatSlashDate,
  formatTime,
  isoDate,
  phoneDigits,
} from "../../utils";

function getInitials(name: string) {
  if (!name) return "??";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/**
 * One Tasks-board card. The body follows the deal's stage:
 * Lead / Discussions: phone pill + note box
 * Meeting: scheduled meeting details with attendees + channel
 * Proposal / Negotiation: contract value + version / request
 * Closed Won / Lost: finalized value + outcome date / reason.
 * Drags between columns and navigates to the deal workspace on click.
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

  const isOverdue = deal.dueDate && deal.dueDate < today && deal.stage !== "CLOSED_WON" && deal.stage !== "CLOSED_LOST";
  const isDueToday = deal.dueDate && deal.dueDate === today;

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
      className={cn(
        "setu-card group relative cursor-grab active:cursor-grabbing p-3.5 transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--setu-accent-ring)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--setu-accent-ring)]",
        isOverdue && "border-rose-300/60 dark:border-rose-500/30"
      )}
    >
      {/* Top Header: Code badge with stage dot + grip handle */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-md border border-[var(--setu-line)] bg-[var(--setu-soft)] px-2 py-0.5 text-[10px] font-mono font-semibold text-[var(--setu-text-2)]">
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STAGE_DOT[deal.stage])} />
          <span>{displayCode(deal)}</span>
        </div>

        <div className="flex items-center gap-1">
          <StageSelect deal={deal} />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--setu-text-3)] hover:text-[var(--setu-accent)]">
            <ArrowUpRight size={13} />
          </span>
          <GripVertical
            size={14}
            className="text-[var(--setu-text-3)] opacity-40 group-hover:opacity-90 transition-opacity"
            aria-hidden
          />
        </div>
      </div>

      {/* Main Title & Company */}
      <div className="mt-2.5">
        <h3 className="text-[13px] font-bold leading-snug text-[var(--setu-text)] group-hover:text-[var(--setu-accent)] transition-colors line-clamp-2">
          {deal.stage === "MEETING" ? meeting?.title || dealTitle(deal) : dealTitle(deal)}
        </h3>
        <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--setu-text-2)]">
          {deal.company}
          {deal.contactRole ? ` · ${deal.contactRole}` : ""}
        </p>
      </div>

      {/* Body: Stage-specific content */}
      <div className="mt-3 space-y-2">
        <CardBody deal={deal} meeting={meeting} today={today} />
      </div>

      {/* Footer: Owner avatar + Due date / timestamp */}
      <div className="mt-3 pt-2.5 border-t border-[var(--setu-line)]/50 flex items-center justify-between gap-2 text-[10px]">
        {/* Owner Info */}
        <div className="flex items-center gap-1.5 min-w-0" title={`Owner: ${deal.ownerName}`}>
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--setu-accent-soft)] text-[9px] font-bold text-[var(--setu-accent-text)] border border-[var(--setu-accent-ring)]">
            {getInitials(deal.ownerName)}
          </div>
          <span className="truncate font-medium text-[var(--setu-text-2)] max-w-[90px]">{deal.ownerName}</span>
        </div>

        {/* Due Date Indicator */}
        {isOverdue ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
            <AlertCircle size={10} /> Overdue
          </span>
        ) : isDueToday ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
            <Clock3 size={10} /> Today
          </span>
        ) : deal.dueDate ? (
          <span className="inline-flex items-center gap-1 text-[var(--setu-text-3)] font-medium">
            <Calendar size={10} /> {formatDate(deal.dueDate)}
          </span>
        ) : (
          <span className="text-[var(--setu-text-3)] font-medium text-[9px]">
            {formatDate(deal.updatedAt)}
          </span>
        )}
      </div>
    </article>
  );
}

/**
 * Stage picker on the card — same move as dragging to another column. The menu renders in a
 * portal, but React events still bubble to the card, so clicks/keys/drags are stopped here
 * to keep the card from navigating to the deal.
 */
function StageSelect({ deal }: { deal: Deal }) {
  const moveDeal = useSetuStore((s) => s.moveDeal);
  const [saving, setSaving] = useState(false);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const change = (value: string) => {
    const stage = value as DealStage;
    if (stage === deal.stage || saving) return;
    setSaving(true);
    moveDeal(deal.id, stage)
      .then(() => toast.success(`${deal.company} → ${STAGE_BY_ID[stage].label}`))
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setSaving(false));
  };

  return (
    <div onClick={stop} onKeyDown={stop} onPointerDown={stop} onDragStart={(e) => e.preventDefault()} draggable={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={saving}
            aria-label={`Change stage (currently ${STAGE_BY_ID[deal.stage].label})`}
            className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-[var(--setu-line)] bg-[var(--setu-card)] px-1.5 text-[10px] font-semibold text-[var(--setu-text-2)] transition-colors hover:border-[var(--setu-accent)] hover:text-[var(--setu-accent)] disabled:opacity-60"
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STAGE_DOT[deal.stage])} />
            <span className="max-w-[80px] truncate">{STAGE_BY_ID[deal.stage].label}</span>
            <ChevronDown size={11} className="shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40" onClick={stop} onKeyDown={stop}>
          <DropdownMenuLabel className="text-[11px]">Move to stage</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={deal.stage} onValueChange={change}>
            {DEAL_STAGES.map((s) => (
              <DropdownMenuRadioItem key={s.id} value={s.id} className="text-xs">
                <span className={cn("mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full", STAGE_DOT[s.id])} />
                {s.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CardBody({ deal, meeting, today }: { deal: Deal; meeting?: DealMeeting; today: string }) {
  switch (deal.stage) {
    case "LEAD":
    case "DISCUSSION":
      return (
        <div className="space-y-1.5">
          <PhoneChip phone={deal.phone} />
          {deal.remark && <NoteBox text={deal.remark} />}
        </div>
      );

    case "MEETING":
      return <MeetingBody meeting={meeting} today={today} />;

    case "PROPOSAL":
      return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--setu-line)] bg-[var(--setu-soft)] px-2.5 py-2">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--setu-text-2)]">Proposal Value</p>
            <p className="text-sm font-bold text-[var(--setu-accent-text)] tabular-nums mt-0.5">
              {deal.value !== undefined ? formatInr(deal.value) : "—"}
            </p>
          </div>
          {deal.proposalVersion !== undefined && (
            <span className="rounded-md border border-[var(--setu-line)] bg-[var(--setu-card)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--setu-text-2)]">
              V{deal.proposalVersion}
            </span>
          )}
        </div>
      );

    case "NEGOTIATION":
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2 dark:border-amber-500/25 dark:bg-amber-500/10">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Deal Value</span>
            <span className="text-sm font-bold tabular-nums text-amber-900 dark:text-amber-200">
              {deal.value !== undefined ? formatInr(deal.value) : "—"}
            </span>
          </div>
          {deal.remark && (
            <p className="mt-1 border-t border-amber-200/60 pt-1 text-[10px] font-medium leading-snug text-amber-800 dark:border-amber-500/20 dark:text-amber-300">
              {deal.remark}
            </p>
          )}
        </div>
      );

    case "CLOSED_WON":
      return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Won Value</p>
            <p className="text-sm font-bold tabular-nums text-emerald-900 dark:text-emerald-200 mt-0.5">
              {deal.value !== undefined ? formatInr(deal.value) : "—"}
            </p>
          </div>
          {deal.closedAt && (
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
              {formatDate(deal.closedAt)}
            </span>
          )}
        </div>
      );

    case "CLOSED_LOST":
      return (
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-2 dark:border-rose-500/25 dark:bg-rose-500/10">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Lost Value</span>
            <span className="text-sm font-bold tabular-nums text-rose-900 dark:text-rose-200">
              {deal.value !== undefined ? formatInr(deal.value) : "—"}
            </span>
          </div>
          {deal.remark && (
            <p className="mt-1 border-t border-rose-200/60 pt-1 text-[10px] font-medium leading-snug text-rose-800 dark:border-rose-500/20 dark:text-rose-300">
              {deal.remark}
            </p>
          )}
        </div>
      );
  }
}

function PhoneChip({ phone }: { phone: string }) {
  if (!phone) return null;
  return (
    <a
      href={`tel:+${phoneDigits(phone)}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--setu-line)] bg-[var(--setu-soft)] px-2 py-1 text-[11px] font-medium text-[var(--setu-text)] transition-colors hover:border-[var(--setu-accent)] hover:text-[var(--setu-accent)]"
      title={`Call ${phone}`}
    >
      <Phone size={11} className="text-[var(--setu-accent)]" />
      <span>{phone}</span>
    </a>
  );
}

function NoteBox({ text }: { text: string }) {
  return (
    <p className="rounded-md border-l-2 border-[var(--setu-accent)] bg-[var(--setu-soft)] px-2 py-1 text-[11px] leading-snug text-[var(--setu-text-2)]">
      {text}
    </p>
  );
}

function MeetingBody({ meeting: m, today }: { meeting?: DealMeeting; today: string }) {
  if (!m) return <NoteBox text="No meeting scheduled yet" />;
  const [first, ...rest] = m.attendees;
  const date = isoDate(m.startAt);
  return (
    <div className="space-y-1.5 rounded-lg border border-[var(--setu-line)] bg-[var(--setu-soft)] p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--setu-text)]">
          <UsersRound size={12} className="text-violet-500" />
          <span className="truncate">{first?.name ?? "No attendees"}</span>
          {rest.length > 0 && (
            <span className="text-[10px] font-normal text-[var(--setu-text-2)]">+{rest.length}</span>
          )}
        </p>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--setu-text-2)] tabular-nums">
          <Clock3 size={11} /> {formatTime(m.startAt)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px]">
        <div className="flex min-w-0 items-center gap-1 text-[var(--setu-text-2)]">
          <Video size={11} className="shrink-0 text-violet-500" />
          {isOnlineChannel(m.channel) && m.link ? (
            <a
              href={m.link}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex min-w-0 items-center gap-1 truncate font-medium text-[var(--setu-accent)] hover:underline"
            >
              <span className="truncate">{m.link.replace(/^https?:\/\//, "")}</span>
              <ExternalLink size={10} className="shrink-0" />
            </a>
          ) : (
            <span className="truncate">{m.location || MEETING_CHANNEL_LABEL[m.channel]}</span>
          )}
        </div>
        <span className={cn("shrink-0 font-medium", date === today ? "text-amber-600 font-bold" : "text-[var(--setu-text-3)]")}>
          {formatSlashDate(date)}
          {date === today && " (Today)"}
        </span>
      </div>
    </div>
  );
}
