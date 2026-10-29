"use client";

import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_LABEL } from "../../constants";
import { useSetuStore } from "../../store";
import type { Prospect } from "../../types";
import { formatInrShort } from "../../utils";
import { SetuAvatar, SourceBadge } from "../setu-ui";

export function ProspectCard({ prospect, onOpen }: { prospect: Prospect; onOpen: () => void }) {
  const meeting = useSetuStore((s) => (prospect.meetingId ? s.meetings.find((m) => m.id === prospect.meetingId) : undefined));
  const won = prospect.stage === "WON";
  const lost = prospect.stage === "LOST";
  const sourceLabel = meeting && prospect.source === "MEETING_121" ? `From 121 · ${meeting.memberName}` : SOURCE_LABEL[prospect.source];

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/prospect-id", prospect.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      className={cn(
        "setu-chip group cursor-grab p-3.5 transition-[border-color,transform] hover:-translate-y-px hover:border-[var(--setu-text-3)] active:cursor-grabbing",
        lost && "opacity-70"
      )}
    >
      <div className="flex items-start gap-2.5">
        <SetuAvatar name={prospect.name} size="xs" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className={cn("text-[13px] font-semibold leading-snug", won && "text-green-500", lost && "line-through decoration-red-500/60")}>
            {prospect.name}
          </div>
          <div className="setu-text-3 mt-0.5 truncate text-[11px]">
            {[prospect.business, prospect.connectedVia].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
        {prospect.value !== undefined && (
          <span className="setu-text-2 shrink-0 text-[11px] font-semibold tabular-nums">{formatInrShort(prospect.value)}</span>
        )}
      </div>
      {prospect.remark && <div className="setu-text-2 mt-2.5 line-clamp-2 text-[11px] leading-relaxed">{prospect.remark}</div>}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--setu-line)] pt-2.5">
        <SourceBadge source={prospect.source} label={sourceLabel} />
        {prospect.phone && <Phone size={11} className="setu-text-3 shrink-0" />}
      </div>
    </div>
  );
}
