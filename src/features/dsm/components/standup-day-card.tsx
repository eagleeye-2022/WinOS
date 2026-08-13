"use client";

import { useState } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderTextWithMentions } from "@/components/shared/mention-text";
import { reviewStatus, relativeDayLabel, formatShortDate } from "../utils";
import type { EntryWithDetails } from "../queries";

type StandupDayCardProps = {
  entry: EntryWithDetails;
  defaultOpen?: boolean;
};

const PRIORITY_COLORS = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-warning",
  HIGH: "text-destructive",
};

export function StandupDayCard({ entry, defaultOpen }: StandupDayCardProps) {
  const isToday = relativeDayLabel(entry.date) === "Today";
  const [open, setOpen] = useState(defaultOpen ?? isToday);

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
            <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              Submitted
            </span>
          )}
          {entry.status === "MISSED" && (
            <span className="rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
              Missed
            </span>
          )}
          {entry.status === "DRAFT" && (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              Draft
            </span>
          )}

          {blockerCount > 0 && (
            <span className="rounded-full border border-destructive/20 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
              {blockerCount} Blocker{blockerCount > 1 ? "s" : ""} (Dependencies)
            </span>
          )}
          {supportCount > 0 && (
            <span className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
              {supportCount} Support Needed (Meeting)
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
            <span className="flex items-center gap-1 text-warning">
              <span className="h-2 w-2 rounded-full bg-warning" />
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
                {todayTasks.map((task, i) => {
                  const p = task.managerPriority ?? task.priority;
                  return (
                    <div key={task.id} className="flex items-center gap-2 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                        T{i + 1}
                      </span>
                      <span>{task.text}</span>
                      {p && (
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                          p.toUpperCase() === "P1" && "bg-success/10 text-success border border-success/30",
                          p.toUpperCase() === "P2" && "bg-info/10 text-info border border-info/30",
                          p.toUpperCase() === "P3" && "bg-warning/10 text-warning border border-warning/30",
                          !["P1","P2","P3"].includes(p.toUpperCase()) && "bg-primary/10 text-primary border border-primary/20"
                        )}>
                          {p.toUpperCase()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {entry.learningText && (
            <div className="mt-3 rounded-md border bg-muted/30 p-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                What Will You Learn Today( WhyFi )?
              </p>
              <p className="text-xs leading-relaxed">{entry.learningText}</p>
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
                      <div key={s.id} className="flex flex-col gap-0.5">
                        <p className="text-xs leading-relaxed">
                          {i + 1}){" "}
                          {renderTextWithMentions(s.text, mentioned, "font-medium text-primary")}
                          {s.editedBy && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground/70 font-normal">
                              (edited by {s.editedBy.name?.split(" ")[0] ?? s.editedBy.email.split("@")[0]})
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              {entry.blockers.length > 0 && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Blockers (Dependencies)
                  </p>
                  {entry.blockers.map((b, i) => {
                    const mentioned = b.mentionedUsers ?? (b.mentionedUser ? [b.mentionedUser] : []);
                    return (
                      <div key={b.id} className="flex flex-col gap-0.5">
                        <p className={cn("text-xs leading-relaxed", PRIORITY_COLORS[b.priority])}>
                          {i + 1}){" "}
                          {renderTextWithMentions(b.text, mentioned, "font-semibold underline")}
                          {b.editedBy && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground/70 font-normal">
                              (edited by {b.editedBy.name?.split(" ")[0] ?? b.editedBy.email.split("@")[0]})
                            </span>
                          )}
                        </p>
                      </div>
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
