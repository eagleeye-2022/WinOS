"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dsrReviewStatus } from "../utils";
import { formatShortDate, relativeDayLabel } from "@/features/dsm/utils";
import type { DsrEntryData } from "../queries";

import { renderTextWithMentions } from "./dsr-form";

export function DsrHistoryCard({
  entry,
  defaultOpen = false,
}: {
  entry: DsrEntryData;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const review = dsrReviewStatus({
    status: entry.status,
    date: entry.date,
    reviewedAt: entry.reviewedAt,
    reviewedBy: entry.reviewedBy,
  });

  const dayLabel = relativeDayLabel(entry.date);
  const dateStr = formatShortDate(entry.date);
  const blockerCount = entry.resolvedBlockers.length;
  const completedCount = entry.completedTaskCount;
  const totalCount = entry.plannedTaskCount;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        {/* Left: date + badges */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{dateStr}</span>

          {/* Day label — "Today" as badge, "Yesterday" as plain text */}
          {dayLabel === "Today" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Today
            </span>
          )}
          {dayLabel === "Yesterday" && (
            <span className="text-xs text-muted-foreground">Yesterday</span>
          )}

          {/* Submission status badge */}
          {entry.status !== "MISSED" && entry.status !== "DRAFT" && (
            <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              Submitted
            </span>
          )}
          {entry.status === "MISSED" && (
            <span className="rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
              Missed
            </span>
          )}

          {/* Blocker count badge */}
          {blockerCount > 0 && (
            <span className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
              {blockerCount} Blocker{blockerCount > 1 ? "s" : ""} (Dependencies) Resolved
            </span>
          )}

          {/* Task completion badge */}
          {totalCount > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {completedCount}/{totalCount} Task Completed
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

        {/* Completion stats — only when meaningful */}
        {entry.status !== "MISSED" && entry.completionPercent > 0 && (
          <div className="hidden shrink-0 items-center gap-5 text-right sm:flex">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Completion
              </p>
              <p className="text-xl font-bold text-primary">{entry.completionPercent}%</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Tasks
              </p>
              <p className="text-xl font-bold">{completedCount}/{totalCount}</p>
            </div>
          </div>
        )}

        {open
          ? <ChevronUp size={15} className="ml-2 shrink-0 text-muted-foreground" />
          : <ChevronDown size={15} className="ml-2 shrink-0 text-muted-foreground" />}
      </button>

      {/* Expanded content */}
      {open && entry.status !== "MISSED" && (
        <div className="border-t px-5 pb-5 pt-4">
          {/* Outcome of the Day */}
          {entry.resultOfDay && (
            <div className="mb-4 rounded-lg border bg-muted/30 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Outcome of the Day
              </p>
              <p className="text-xs leading-relaxed text-foreground italic">
                &ldquo;{renderTextWithMentions(entry.resultOfDay)}&rdquo;
              </p>
            </div>
          )}

          {/* Completed tasks */}
          {entry.plannedTasks.filter((t) => t.completed).length > 0 && (
            <div className="mb-4">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Today&apos;s Task Completed
              </p>
              <div className="flex flex-col gap-1.5">
                {entry.plannedTasks.filter((t) => t.completed).map((task, i) => (
                  <div key={task.id} className="flex items-center gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                      T{i + 1}
                    </span>
                    <span>{renderTextWithMentions(task.text)}</span>
                    {task.priority && (
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        task.priority.toUpperCase() === "P1" && "bg-success/15 text-success border border-success/30",
                        task.priority.toUpperCase() === "P2" && "bg-info/15 text-info border border-info/30",
                        task.priority.toUpperCase() === "P3" && "bg-warning/15 text-warning border border-warning/30",
                        !["P1","P2","P3"].includes(task.priority.toUpperCase()) && "bg-primary/10 text-primary border border-primary/20"
                      )}>
                        {task.priority.toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional work done */}
          {entry.additionalWorks && entry.additionalWorks.length > 0 && (
            <div className="mb-4">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Additional Work Done Today
              </p>
              <div className="flex flex-col gap-1.5">
                {entry.additionalWorks.map((work, i) => (
                  <div key={work.id || i} className="flex items-center gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                      +
                    </span>
                    <span>{renderTextWithMentions(work.text)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Support received + Blockers solved */}
          {(entry.followUpsDone.length > 0 || entry.resolvedBlockers.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {entry.followUpsDone.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Support Needed (Meeting) Resolved
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {entry.followUpsDone.map((f, i) => (
                      <p key={f.id} className="text-xs leading-relaxed">
                        {i + 1}) {renderTextWithMentions(f.text ? f.text.replace(/^(@\S+\s*)+/, "").trim() : "")}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {entry.resolvedBlockers.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Blockers (Dependencies) Resolved
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {Array.from(
                      new Map(
                        (entry.resolvedBlockers ?? [])
                          .filter((b) => b.resolved !== false)
                          .map((b) => [
                            (b.text || "").trim().toLowerCase(),
                            b,
                          ])
                      ).values()
                    ).map((b, i) => (
                      <p key={b.id} className="text-xs leading-relaxed">
                        {i + 1}) {renderTextWithMentions(b.text ? b.text.replace(/^(@\S+\s*)+/, "").trim() : "")}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(entry.learningItems ?? []).length > 0 && (
            <div className="mt-3 rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                What Will You Learn Today( WhyFi )? ({entry.learningItems.filter((l) => l.completed).length}/{entry.learningItems.length} Learned)
              </p>
              <div className="flex flex-col gap-1.5">
                {entry.learningItems.map((l) => (
                  <p key={l.id} className={cn("text-xs leading-relaxed", l.completed ? "text-foreground" : "text-muted-foreground line-through")}>
                    {renderTextWithMentions(l.text)}
                  </p>
                ))}
              </div>
            </div>
          )}

          {(entry.sentiment || entry.reflection) && (
            <div className="mt-3 rounded-lg border bg-muted/30 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {entry.sentiment ? `${entry.sentiment} Sentiment & Key Learnings` : "Day Reflection"}
              </p>
              {entry.reflection && (
                <p className="text-xs leading-relaxed text-foreground">
                  {renderTextWithMentions(entry.reflection)}
                </p>
              )}
            </div>
          )}

          {entry.managerComment && (
            <div className="mt-3 rounded-lg border border-success/40 bg-success/10 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-success">
                Manager Feedback
              </p>
              <p className="text-xs leading-relaxed text-success whitespace-pre-wrap">
                {entry.managerComment}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
