"use client";

import { Zap, MessageSquare, TrendingDown, Clock3, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEventTime } from "../utils";
import type { DsrInsights, DsrEntryData } from "../queries";

// ── Weekly trend bar chart ────────────────────────────────────────────────────

function WeeklyTrendChart({
  trend,
  streak,
}: {
  trend: DsrInsights["weeklyTrend"];
  streak: number;
}) {
  const max = Math.max(...trend.map((t) => t.percent), 100);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-primary" />
          <span className="text-sm font-semibold">Weekly Trend</span>
        </div>
        {streak > 0 && (
          <span className="text-xs font-semibold text-primary">
            {streak} DAY STREAK
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-1 h-20">
        {trend.map(({ day, percent, isToday }) => (
          <div key={day} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end justify-center" style={{ height: "64px" }}>
              <div
                className={cn(
                  "w-full max-w-6 rounded-t-sm transition-all",
                  isToday ? "bg-primary" : percent > 0 ? "bg-primary/30" : "bg-muted"
                )}
                style={{ height: `${Math.max((percent / max) * 64, percent > 0 ? 4 : 2)}px` }}
              />
            </div>
            <span className={cn(
              "text-[9px] font-medium",
              isToday ? "text-primary" : "text-muted-foreground/60"
            )}>
              {isToday ? "TODAY" : day}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Report timeline ───────────────────────────────────────────────────────────

function ReportTimeline({ events }: { events: DsrEntryData["timelineEvents"] }) {
  if (events.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock3 size={14} className="text-muted-foreground" />
        <span className="text-sm font-semibold">Report Timeline</span>
      </div>
      <div className="flex flex-col">
        {events.map((event, i) => {
          const isLast = i === events.length - 1;
          return (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                {!isLast && (
                  <div className="my-1 w-px flex-1 bg-border" style={{ minHeight: "14px" }} />
                )}
              </div>
              <div className={cn(!isLast && "pb-3")}>
                <p className="text-xs font-semibold">{event.label}</p>
                <p className="text-[10px] text-muted-foreground">{formatEventTime(event.occurredAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  insights: DsrInsights;
  entry: DsrEntryData | null;
  showSubmitButton?: boolean;
  onSubmit?: () => void;
};

export function InsightsPanel({ insights, entry, showSubmitButton, onSubmit }: Props) {
  const {
    completionPercent,
    completedTaskCount,
    plannedTaskCount,
    streak,
    breakthroughDays,
    breakdownDays,
    weeklyTrend,
    daySummary,
    insightQuote,
  } = insights;

  const hasTimeline = (entry?.timelineEvents?.length ?? 0) > 0;
  const hasManagerComment = !!entry?.managerComment;
  const isReviewed = entry?.status === "REVIEWED";

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <h2 className="text-lg font-bold">Insights Panel</h2>

      {/* Day Summary */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <Zap size={14} className="text-primary" />
          <span className="text-sm font-semibold">Day Summary</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{daySummary}</p>
        {completionPercent > 0 && (
          <div className="mt-3 flex items-end gap-1">
            <div className="h-0.5 flex-1 rounded-full bg-primary/20">
              <div
                className="h-0.5 rounded-full bg-primary transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Weekly trend */}
      <WeeklyTrendChart trend={weeklyTrend} streak={streak} />

      {/* Productivity Insights */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Zap size={14} className="text-primary" />
          <span className="text-sm font-semibold">Productivity Insights</span>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-primary">
              <Zap size={13} className="fill-primary" />
              Breakthrough Days
            </div>
            <span className="text-sm font-bold text-primary">{breakthroughDays}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <TrendingDown size={13} />
              Breakdown Days
            </div>
            <span className="text-sm font-bold text-muted-foreground">{breakdownDays}</span>
          </div>
          {insightQuote && (
            <blockquote className="mt-1 rounded-md border-l-2 border-primary/40 bg-primary/5 px-3 py-2 text-xs italic text-muted-foreground leading-relaxed">
              &ldquo;{insightQuote}&rdquo;
            </blockquote>
          )}
        </div>
      </div>

      {/* Report Timeline — visible after submit */}
      {hasTimeline && entry && (
        <ReportTimeline events={entry.timelineEvents} />
      )}

      {/* Manager Comments — visible after review */}
      {(isReviewed || hasManagerComment) && (
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCheck size={14} className="text-emerald-600" />
            <span className="text-sm font-semibold">Manager Comments</span>
          </div>
          <div className="min-h-16 rounded-md border bg-background px-3 py-2.5 text-sm text-muted-foreground">
            {entry?.managerComment || (
              <span className="italic text-muted-foreground/50">No comments yet.</span>
            )}
          </div>
        </div>
      )}

      {/* Submit DSR button */}
      {showSubmitButton && (
        <button
          type="button"
          onClick={onSubmit}
          className="mt-auto w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Submit DSR
        </button>
      )}

      {/* Completion stats strip (for history view) */}
      {!showSubmitButton && completionPercent > 0 && (
        <div className="flex items-center justify-between rounded-xl border bg-card p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{completionPercent}%</p>
            <p className="text-xs text-muted-foreground">COMPLETION</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{completedTaskCount}/{plannedTaskCount}</p>
            <p className="text-xs text-muted-foreground">TASKS</p>
          </div>
          {streak > 0 && (
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{streak}</p>
              <p className="text-xs text-muted-foreground">STREAK</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
