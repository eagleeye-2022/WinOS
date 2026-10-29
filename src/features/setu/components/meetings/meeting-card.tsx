"use client";

import { ArrowRight, Bot } from "lucide-react";
import { MEETING_TYPE_LABEL } from "../../constants";
import type { Meeting121 } from "../../types";
import { formatDate } from "../../utils";
import { Pill, SetuAvatar } from "../setu-ui";

export function MeetingCard({
  meeting,
  onOpen,
  onConvert,
}: {
  meeting: Meeting121;
  onOpen: () => void;
  onConvert: () => void;
}) {
  const pending = meeting.pendingReferralNames.length;
  const converted = meeting.prospectIds.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="setu-card setu-card-hover flex cursor-pointer flex-col p-5"
    >
      <div className="flex items-start gap-3.5">
        <span className="setu-tile p-1">
          <SetuAvatar name={meeting.memberName} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold tracking-tight">{meeting.memberName}</div>
          <div className="setu-text-2 truncate text-xs">
            {meeting.business} · {meeting.connectedVia || "Direct"}
          </div>
          <div className="setu-text-3 mt-0.5 text-[11px]">
            {formatDate(meeting.date)} · {MEETING_TYPE_LABEL[meeting.type]}
          </div>
        </div>
        {meeting.capturedViaBot && (
          <span title="Captured via WhatsApp bot" className="setu-chip flex h-7 w-7 items-center justify-center text-emerald-500">
            <Bot size={14} />
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Metric value={meeting.refsReceived} label="Received" className="text-green-500" />
        <Metric value={meeting.refsGiven} label="Given" className="text-violet-500" />
        <Metric value={meeting.followUps} label="Follow-ups" className="text-orange-500" />
      </div>

      <div className="mt-5 flex items-center gap-1.5">
        {pending > 0 && <Pill dot="bg-amber-500">{pending} to convert</Pill>}
        {converted > 0 && <Pill dot="bg-green-500">{converted} in pipeline</Pill>}
        {pending === 0 && converted === 0 && <Pill>No referrals</Pill>}
        {pending > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConvert();
            }}
            className="setu-accent-text ml-auto inline-flex cursor-pointer items-center gap-1 text-xs font-semibold hover:underline"
          >
            Convert <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function Metric({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className="setu-chip px-2 py-2.5 text-center">
      <div className={`text-lg font-bold tabular-nums leading-none ${className}`}>{value}</div>
      <div className="setu-text-3 mt-1 text-[10px]">{label}</div>
    </div>
  );
}
