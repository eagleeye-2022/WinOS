"use client";

import { ArrowRight, Bot, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEETING_TYPE_LABEL, STAGE_BY_ID } from "../../constants";
import { useSetuStore } from "../../store";
import type { Meeting121 } from "../../types";
import { formatDate } from "../../utils";
import { Pill } from "../setu-ui";

/** Meeting card: who / when on top, the three referral numbers, then status tags + Convert. */
export function MeetingCard({
  meeting,
  onOpen,
  onConvert,
}: {
  meeting: Meeting121;
  onOpen: () => void;
  onConvert: () => void;
}) {
  const firstProspect = useSetuStore((s) => s.prospects.find((p) => meeting.prospectIds.includes(p.id)));
  const pending = meeting.pendingReferralNames.length;
  const converted = meeting.prospectIds.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="setu-card setu-card-hover flex cursor-pointer flex-col overflow-hidden"
    >
      {/* Top */}
      <div className="border-b border-[var(--setu-line)] px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-[15px] font-semibold tracking-tight">{meeting.memberName}</div>
          {meeting.capturedViaBot && (
            <span title="Captured via WhatsApp bot">
              <Bot size={14} className="text-emerald-500" />
            </span>
          )}
        </div>
        <div className="setu-text-2 mt-0.5 truncate text-xs">
          {meeting.business} · {meeting.connectedVia || "Direct"}
        </div>
        <div className="setu-text-3 mt-1 flex items-center gap-1 text-[11px]">
          <CalendarDays size={11} /> {formatDate(meeting.date)} · {MEETING_TYPE_LABEL[meeting.type]}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 px-5 py-4">
        <Metric value={meeting.refsReceived} label="Refs Received" className="text-green-500" />
        <Metric value={meeting.refsGiven} label="Refs Given" className="setu-accent-text" />
        {pending > 0 ? (
          <Metric value={meeting.followUps} label="Follow-ups" className="text-orange-500" />
        ) : (
          <Metric value={converted} label="Prospect" className="text-violet-500" />
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center gap-1.5 border-t border-[var(--setu-line)] px-5 py-3">
        {firstProspect && <Pill dot={STAGE_BY_ID[firstProspect.stage].dot}>{STAGE_BY_ID[firstProspect.stage].short}</Pill>}
        {pending > 0 && <Pill dot="bg-amber-500">Follow up</Pill>}
        {pending > 0 && <Pill dot="bg-green-500">{pending} refs</Pill>}
        {pending === 0 && converted > 0 && <Pill dot="bg-green-500">Converted ✓</Pill>}
        {pending === 0 && converted === 0 && <Pill>No referrals</Pill>}
        {pending > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConvert();
            }}
            className={cn(
              "setu-chip setu-accent-text ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1 px-2.5 py-1 text-[11px] font-semibold",
              "transition-colors hover:border-[var(--setu-accent)]"
            )}
          >
            Convert refs <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function Metric({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className="setu-chip px-2 py-2.5 text-center">
      <div className={cn("text-lg font-bold tabular-nums leading-none", className)}>{value}</div>
      <div className="setu-text-3 mt-1 text-[10px]">{label}</div>
    </div>
  );
}
