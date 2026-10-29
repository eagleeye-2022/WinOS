"use client";

import { ArrowUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSetuStore } from "../../store";
import type { Prospect } from "../../types";

/** Kanban card: name, referrer / business, phone or status line, and where it came from. */
export function ProspectCard({ prospect, onOpen }: { prospect: Prospect; onOpen: () => void }) {
  const meeting = useSetuStore((s) => (prospect.meetingId ? s.meetings.find((m) => m.id === prospect.meetingId) : undefined));
  const won = prospect.stage === "WON";
  const lost = prospect.stage === "LOST";

  const source =
    prospect.source === "WHATSAPP_BOT"
      ? "Via WhatsApp Bot"
      : prospect.source === "MEETING_121" && meeting
        ? `From 121 ${meeting.memberName.replace(/\s+Ji$/, "")}`
        : null;
  const ref = [prospect.connectedVia, prospect.business].filter(Boolean).join(" · ");

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/prospect-id", prospect.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      className={cn(
        "setu-chip cursor-grab px-3.5 py-3 transition-[border-color,transform] hover:-translate-y-px hover:border-[var(--setu-text-3)] active:cursor-grabbing",
        won && "border-green-500/40 bg-green-500/10",
        lost && "border-red-500/40 bg-red-500/10"
      )}
    >
      <div className={cn("text-[13px] font-semibold leading-snug", won && "text-green-600 dark:text-green-400", lost && "text-red-700 dark:text-red-400")}>
        {prospect.name}
      </div>
      {won ? (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
          <Check size={11} /> {prospect.remark || "Closed"}
        </div>
      ) : (
        <div className={cn("mt-1 truncate text-[11px]", lost ? "text-red-600 dark:text-red-400" : "setu-text-2")}>
          {lost ? [prospect.business, prospect.phone].filter(Boolean).join(" · ") || ref : ref || prospect.remark}
        </div>
      )}
      {!won && !lost && (prospect.phone || (ref && prospect.remark)) && (
        <div className="setu-text-3 mt-0.5 truncate text-[11px]">{prospect.phone || prospect.remark}</div>
      )}
      {source && !won && !lost && (
        <div className="setu-accent-text mt-1.5 flex items-center gap-0.5 text-[10px] font-semibold">
          <ArrowUp size={10} /> {source}
        </div>
      )}
    </div>
  );
}
