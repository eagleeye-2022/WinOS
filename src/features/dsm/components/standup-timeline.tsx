"use client";

import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEventTime } from "../utils";
import type { EntryTimelineEvent } from "../queries";

const TIMELINE_STEPS = [
  { type: "SUBMITTED", label: "Report Submitted" },
  // { type: "OPENED", label: "Manager Opened" },
  { type: "APPROVED", label: "Manager Approved" },
] as const;

type StandupTimelineProps = {
  events?: EntryTimelineEvent[];
  entry?: {
    status: string;
    submittedAt?: Date | null;
    reviewedAt?: Date | null;
    createdAt?: Date | null;
    timelineEvents?: EntryTimelineEvent[];
  } | null;
};

export function StandupTimeline({ events: propEvents, entry }: StandupTimelineProps) {
  const safeEvents = propEvents ?? entry?.timelineEvents ?? [];
  const status = entry?.status ?? (safeEvents.length > 0 ? "SUBMITTED" : "DRAFT");

  // Determine completion for fixed steps fallback
  const isSubmitted = status === "SUBMITTED" || status === "PENDING_REVIEW" || status === "REVIEWED" || safeEvents.some((e) => e.type === "SUBMITTED");
  // const isOpened = status === "PENDING_REVIEW" || status === "REVIEWED" || safeEvents.some((e) => e.type === "OPENED");
  const isApproved = status === "REVIEWED" || safeEvents.some((e) => e.type === "APPROVED");

  const lastCompletedIndex = isApproved ? 1 : isSubmitted ? 0 : -1;

  const fixedTypes = new Set<string>(TIMELINE_STEPS.map((s) => s.type));
  const extraEvents = safeEvents.filter((e) => !fixedTypes.has(e.type));
  const isLastFixed = extraEvents.length === 0;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="mb-4 flex items-center gap-2">
        <Clock3 size={14} className="text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Report Timeline</span>
      </div>

      <div className="flex flex-col">
        {TIMELINE_STEPS.map((step, i) => {
          const dbEvent = safeEvents.find((e) => e.type === step.type);

          let isComplete = false;
          let eventTime: Date | null | undefined = dbEvent?.occurredAt;

          if (step.type === "SUBMITTED") {
            isComplete = isSubmitted;
            eventTime = eventTime ?? entry?.submittedAt ?? entry?.createdAt;
          } else if (step.type === "APPROVED") {
            isComplete = isApproved;
            eventTime = eventTime ?? entry?.reviewedAt;
          }

          const isCurrent = i === lastCompletedIndex;
          const isLast = i === TIMELINE_STEPS.length - 1 && isLastFixed;

          let awaitingLabel = "Awaiting Action";
          if (step.type === "APPROVED") awaitingLabel = "Awaiting Manager Review";

          return (
            <div key={step.type} className="flex gap-3">
              {/* Dot + vertical connecting line */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "mt-0.5 h-3 w-3 shrink-0 rounded-full transition-all",
                    isCurrent
                      ? "border-2 border-primary bg-card ring-2 ring-primary/20"
                      : isComplete
                        ? "bg-primary"
                        : "bg-muted-foreground/30"
                  )}
                />
                {!isLast && (
                  <div className="my-1 w-px flex-1 bg-border" style={{ minHeight: "18px" }} />
                )}
              </div>

              {/* Step label & timestamp */}
              <div className={cn(!isLast && "pb-4")}>
                <p
                  className={cn(
                    "text-xs font-semibold leading-tight",
                    !isComplete && "italic text-muted-foreground/50 font-normal"
                  )}
                >
                  {isComplete ? (dbEvent?.label || step.label) : awaitingLabel}
                </p>
                {isComplete && eventTime && (
                  <p className="mt-0.5 text-xs text-muted-foreground font-medium">
                    {formatEventTime(new Date(eventTime))}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {extraEvents.map((event, i) => {
          const isLast = i === extraEvents.length - 1;
          return (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-primary" />
                {!isLast && (
                  <div className="my-1 w-px flex-1 bg-border" style={{ minHeight: "18px" }} />
                )}
              </div>
              <div className={cn(!isLast && "pb-4")}>
                <p className="text-xs font-semibold leading-tight text-foreground">{event.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground font-medium">
                  {formatEventTime(new Date(event.occurredAt))}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
