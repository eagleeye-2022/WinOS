"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { dsrReviewStatus } from "../utils";
import { formatShortDate, relativeDayLabel } from "@/features/dsm/utils";
import type { DsrEntryData } from "../queries";

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
  const followUpCount = entry.followUpsDone.length;
  const completedCount = entry.completedTaskCount;
  const totalCount = entry.plannedTaskCount;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{dateStr}</span>
          {dayLabel && (
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              dayLabel === "Today" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
            )}>
              {dayLabel}
            </span>
          )}

          {entry.status !== "MISSED" && entry.status !== "DRAFT" && (
            <span className="rounded-full border border-emerald-600/40 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Submitted
            </span>
          )}
          {entry.status === "MISSED" && (
            <span className="rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-[11px] font-medium text-destructive">
              Missed
            </span>
          )}

          {blockerCount > 0 && (
            <span className="rounded-full border border-amber-300/50 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              {blockerCount} Blocker{blockerCount > 1 ? "s" : ""} Resolved
            </span>
          )}
          {followUpCount > 0 && (
            <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
              {followUpCount} Follow-up{followUpCount > 1 ? "s" : ""} Done
            </span>
          )}
          {totalCount > 0 && completedCount > 0 && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              {completedCount}/{totalCount} Task Completed
            </span>
          )}
        </div>

        {/* Review status */}
        <div className="flex shrink-0 items-center gap-1.5 text-xs">
          {review.kind === "reviewed" && (
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 size={13} className="text-emerald-500" />
              {review.label}
            </span>
          )}
          {(review.kind === "pending" || review.kind === "missed-deadline") && (
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

        {entry.status !== "MISSED" && (
          entry.completionPercent > 0 ? (
            <div className="hidden shrink-0 items-center gap-4 text-right sm:flex">
              <div>
                <p className="text-[10px] font-medium uppercase text-muted-foreground">Completion</p>
                <p className="text-lg font-bold text-primary">{entry.completionPercent}%</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase text-muted-foreground">Tasks</p>
                <p className="text-lg font-bold">{completedCount}/{totalCount}</p>
              </div>
            </div>
          ) : null
        )}

        {open ? <ChevronUp size={15} className="ml-2 shrink-0 text-muted-foreground" /> : <ChevronDown size={15} className="ml-2 shrink-0 text-muted-foreground" />}
      </button>

      {open && entry.status !== "MISSED" && (
        <div className="border-t px-5 pb-5 pt-4">
          {/* Completed tasks */}
          {entry.plannedTasks.filter((t) => t.completed).length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Today&apos;s Task Completed
              </p>
              <div className="flex flex-col gap-1.5">
                {entry.plannedTasks.filter((t) => t.completed).map((task, i) => (
                  <div key={task.id} className="flex items-center gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                      T{i + 1}
                    </span>
                    <span>{task.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(entry.followUpsDone.length > 0 || entry.resolvedBlockers.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {entry.resolvedBlockers.length > 0 && (
                <div className="rounded-lg border bg-card p-3">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Blockers Resolved
                  </p>
                  <div className="flex flex-col gap-2">
                    {entry.resolvedBlockers.map((b) => (
                      <div key={b.id} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-primary bg-primary text-primary-foreground">
                          <Check size={9} strokeWidth={3} />
                        </span>
                        <span className="text-xs leading-relaxed line-through text-muted-foreground">
                          {b.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {entry.followUpsDone.length > 0 && (
                <div className="rounded-lg border bg-card p-3">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Follow-ups Done
                  </p>
                  <div className="flex flex-col gap-2">
                    {entry.followUpsDone.map((f) => (
                      <div key={f.id} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-primary bg-primary text-primary-foreground">
                          <Check size={9} strokeWidth={3} />
                        </span>
                        <span className="text-xs leading-relaxed line-through text-muted-foreground">
                          {f.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
