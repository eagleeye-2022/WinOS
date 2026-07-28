"use client";

import { useState } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { reviewStatus, relativeDayLabel, formatShortDate } from "../utils";
import type { EntryWithDetails } from "../queries";

type StandupDayCardProps = {
  entry: EntryWithDetails;
  defaultOpen?: boolean;
};

const PRIORITY_COLORS = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-amber-600",
  HIGH: "text-destructive",
};

export function StandupDayCard({ entry, defaultOpen = false }: StandupDayCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const review = reviewStatus({
    status: entry.status,
    date: entry.date,
    reviewedAt: entry.reviewedAt,
    reviewedBy: entry.reviewedBy,
  });

  const todayTasks = entry.tasks.filter((t) => t.kind === "TODAY");
  const dayLabel = relativeDayLabel(entry.date);
  const dateStr = formatShortDate(entry.date);
  const blockerCount = entry.blockers.length;
  const supportCount = entry.supportNeeds.length;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Card header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{dateStr}</span>
          {dayLabel && (
            dayLabel === "Today" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {dayLabel}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{dayLabel}</span>
            )
          )}

          {(entry.status === "SUBMITTED" || entry.status === "PENDING_REVIEW" || entry.status === "REVIEWED") && (
            <span className="rounded-full border border-emerald-600/40 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Submitted
            </span>
          )}
          {entry.status === "MISSED" && (
            <span className="rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
              Missed
            </span>
          )}
          {entry.status === "DRAFT" && (
            <span className="rounded-full border border-amber-400/40 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Draft
            </span>
          )}

          {blockerCount > 0 && (
            <span className="rounded-full border border-destructive/20 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
              {blockerCount} Blocker{blockerCount > 1 ? "s" : ""}
            </span>
          )}
          {supportCount > 0 && (
            <span className="rounded-full border border-sky-400/30 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
              {supportCount} Support Needed
            </span>
          )}
        </div>

        {/* Review status */}
        <div className="flex shrink-0 items-center gap-1.5 text-xs">
          {review.kind === "reviewed" && (
            <span className="flex items-center gap-1 text-primary">
              <CheckCircle2 size={13} className="text-primary" />
              {review.label}
            </span>
          )}
          {review.kind === "pending" && (
            <span className="flex items-center gap-1 text-amber-600">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {review.label}
            </span>
          )}
          {review.kind === "missed-deadline" && (
            <span className="flex items-center gap-1 text-destructive">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              {review.label}
            </span>
          )}
          {review.kind === "none" && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              {review.label}
            </span>
          )}
        </div>

        <ChevronDown size={15} className={cn("ml-2 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>

      {/* Expanded content */}
      {open && entry.status !== "MISSED" && (
        <div className="border-t px-4 pb-4 pt-3">
          {todayTasks.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Today&apos;s Task
              </p>
              <div className="flex flex-col gap-1.5">
                {todayTasks.map((task, i) => (
                  <div key={task.id} className="flex items-center gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                      T{i + 1}
                    </span>
                    <span>{task.text}</span>
                    {task.priority && (
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        task.priority === "P1" && "bg-emerald-100 text-emerald-800 border border-emerald-300",
                        task.priority === "P2" && "bg-blue-100 text-blue-800 border border-blue-300",
                        task.priority === "P3" && "bg-amber-100 text-amber-800 border border-amber-300",
                        !["P1","P2","P3"].includes(task.priority) && "bg-primary/10 text-primary"
                      )}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(entry.supportNeeds.length > 0 || entry.blockers.length > 0) && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {entry.supportNeeds.length > 0 && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Support Needed (Meeting)
                  </p>
                  {entry.supportNeeds.map((s, i) => {
                    const mentioned = s.mentionedUsers ?? (s.mentionedUser ? [s.mentionedUser] : []);
                    return (
                      <p key={s.id} className="text-xs leading-relaxed">
                        {i + 1}){" "}
                        {mentioned.map((m) => (
                          <span key={m.id} className="font-medium text-primary">
                            @{m.name?.split(" ")[0]?.toLowerCase() ?? m.email.split("@")[0]}&nbsp;
                          </span>
                        ))}
                        {s.text}
                      </p>
                    );
                  })}
                </div>
              )}
              {entry.blockers.length > 0 && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Blockers (Data Needed)
                  </p>
                  {entry.blockers.map((b, i) => {
                    const mentioned = b.mentionedUsers ?? (b.mentionedUser ? [b.mentionedUser] : []);
                    return (
                      <p key={b.id} className={cn("text-xs leading-relaxed", PRIORITY_COLORS[b.priority])}>
                        {i + 1}){" "}
                        {mentioned.map((m) => (
                          <span key={m.id} className="font-semibold underline">
                            @{m.name?.split(" ")[0]?.toLowerCase() ?? m.email.split("@")[0]}&nbsp;
                          </span>
                        ))}
                        {b.text}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
