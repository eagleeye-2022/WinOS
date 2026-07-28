"use client";

import { useActionState, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, CheckCheck,
  Star, Clock3, AlertCircle, Zap, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { reviewDsr, type ReviewDsrState } from "../actions/review-dsr";
import { toggleDsrTask, type ToggleDsrTaskState } from "../actions/toggle-dsr-task";
import { formatEventTime, dsrReviewStatus } from "@/features/dsr/utils";
import { relativeDayLabel, weekOfMonth, getWeekRange, formatShortDate } from "@/features/dsm/utils";
import { DsrHistoryCard } from "@/features/dsr/components/dsr-history-card";
import type { DsrEntryData } from "@/features/dsr/queries";
import type { MemberDsrReview } from "../queries";

// ── Date entry header — static strip matching Figma image 2 ──────────────────

function DateEntryHeader({ entry }: { entry: DsrEntryData }) {
  const review = dsrReviewStatus({
    status: entry.status,
    date: entry.date,
    reviewedAt: entry.reviewedAt,
    reviewedBy: entry.reviewedBy,
  });
  const dateStr = formatShortDate(entry.date);

  return (
    <div className="flex items-center justify-between rounded-xl border bg-card px-5 py-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{dateStr}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Today
          </span>
        </div>
        {(entry.status === "SUBMITTED" ||
          entry.status === "PENDING_REVIEW" ||
          entry.status === "REVIEWED") && (
          <span className="w-fit rounded-full border border-emerald-600/40 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Submitted
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn(
          "flex items-center gap-1.5 text-xs",
          review.kind === "reviewed" ? "text-emerald-600"
            : review.kind === "none" ? "text-muted-foreground"
            : review.kind === "missed-deadline" ? "text-destructive"
            : "text-amber-600"
        )}>
          <span className={cn(
            "h-2 w-2 rounded-full",
            review.kind === "reviewed" ? "bg-emerald-500"
              : review.kind === "none" ? "bg-muted-foreground/40"
              : review.kind === "missed-deadline" ? "bg-destructive"
              : "bg-amber-500"
          )} />
          {review.label}
        </span>
        <ChevronDown size={14} className="text-muted-foreground" />
      </div>
    </div>
  );
}

// ── Outcome of the Day card ───────────────────────────────────────────────────

function ResultCard({ entry }: { entry: DsrEntryData }) {
  if (!entry.resultOfDay) return null;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
          <Star size={11} className="fill-white text-white" />
        </span>
        <h3 className="text-sm font-semibold">Outcome of the Day</h3>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        &ldquo;{entry.resultOfDay}&rdquo;
      </p>
    </div>
  );
}

// ── Task progress card ────────────────────────────────────────────────────────

function TaskItemRow({ task, locked }: { task: DsrEntryData["plannedTasks"][number]; locked?: boolean }) {
  const [, action, pending] = useActionState<ToggleDsrTaskState, FormData>(toggleDsrTask, {});
  const [, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(() => action(fd));
      }}
      className="flex items-center gap-2.5"
    >
      <input type="hidden" name="taskId" value={task.id} />
      <button
        type="submit"
        disabled={pending || locked}
        title={locked ? "Waiting on DSM review" : task.completed ? "Mark as uncompleted" : "Mark as completed"}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer disabled:opacity-50",
          task.completed ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-muted border border-border hover:border-emerald-500"
        )}
      >
        {task.completed && (
          <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5">
            <polyline points="1,4 3,6 7,2" />
          </svg>
        )}
      </button>
      <span className={cn("flex-1 text-sm select-none", task.completed ? "line-through text-muted-foreground" : "text-foreground")}>
        {task.text}
      </span>
      {task.priority && (
        <span className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
          task.priority.toUpperCase() === "P1" && "bg-emerald-100 text-emerald-800 border border-emerald-300",
          task.priority.toUpperCase() === "P2" && "bg-blue-100 text-blue-800 border border-blue-300",
          task.priority.toUpperCase() === "P3" && "bg-amber-100 text-amber-800 border border-amber-300",
          !["P1","P2","P3"].includes(task.priority.toUpperCase()) && "bg-primary/10 text-primary border border-primary/20"
        )}>
          {task.priority.toUpperCase()}
        </span>
      )}
    </form>
  );
}

function TaskProgressCard({ entry, locked }: { entry: DsrEntryData; locked?: boolean }) {
  const { completedTaskCount, plannedTaskCount, plannedTasks } = entry;
  const percent = plannedTaskCount > 0
    ? Math.round((completedTaskCount / plannedTaskCount) * 100)
    : 0;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 size={14} className="text-emerald-600" />
          Task Progress
        </h3>
        <span className="text-sm font-bold text-primary">
          {completedTaskCount}/{plannedTaskCount}
        </span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex flex-col gap-2">
        {plannedTasks.map((task) => (
          <TaskItemRow key={task.id} task={task} locked={locked} />
        ))}
      </div>
    </div>
  );
}

// ── Blockers & support card ───────────────────────────────────────────────────

function BlockersSupportCard({ entry }: { entry: DsrEntryData }) {
  const { resolvedBlockers, followUpsDone } = entry;

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive">
          <AlertCircle size={11} className="fill-white text-destructive" />
        </span>
        Blockers &amp; Support
      </h3>

      {resolvedBlockers.length > 0 && (
        <div className="mb-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="inline-block h-3 w-0.5 rounded-full bg-destructive" />
            Blockers
          </p>
          <div className="flex flex-col gap-2">
            {resolvedBlockers.map((b) => (
              <div
                key={b.id}
                className={cn(
                  "flex items-start justify-between gap-2 rounded-lg border p-2.5",
                  b.resolved
                    ? "border-emerald-200/60 bg-emerald-50/60"
                    : "border-destructive/20 bg-destructive/5"
                )}
              >
                <span className="flex items-start gap-1.5">
                  {b.resolved ? (
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle size={13} className="mt-0.5 shrink-0 text-destructive" />
                  )}
                  <span className={cn(
                    "text-xs font-semibold leading-snug",
                    b.resolved ? "text-emerald-700" : "text-destructive"
                  )}>
                    {b.text}
                  </span>
                </span>
                <span className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                  b.resolved
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-destructive/10 text-destructive"
                )}>
                  {b.resolved ? "Resolved" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {followUpsDone.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="inline-block h-3 w-0.5 rounded-full bg-muted-foreground/50" />
            Support
          </p>
          <div className="flex flex-col gap-2">
            {followUpsDone.map((f) => (
              <div
                key={f.id}
                className="flex items-start justify-between gap-2 rounded-lg border bg-muted/30 p-2.5"
              >
                <div className="flex items-center gap-2">
                  {f.completed ? (
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                  ) : (
                    <Clock3 size={13} className="shrink-0 text-muted-foreground" />
                  )}
                  <span className="text-xs">{f.text}</span>
                </div>
                <span className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                  f.completed
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                )}>
                  {f.completed ? "Completed" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {resolvedBlockers.length === 0 && followUpsDone.length === 0 && (
        <p className="text-xs text-muted-foreground/60">No Blockers or Support Items Recorded.</p>
      )}
    </div>
  );
}

// ── Breakthrough / breakdown sentiment card ───────────────────────────────────

function SentimentCard({ entry }: { entry: DsrEntryData }) {
  const { sentiment, reflection } = entry;
  if (!sentiment && !reflection) return null;

  const isBreakthrough = sentiment === "BREAKTHROUGH";

  return (
    <div className={cn(
      "rounded-xl border border-l-4 p-4",
      isBreakthrough
        ? "border-emerald-200 border-l-emerald-500 bg-emerald-50/40"
        : "border-destructive/20 border-l-destructive bg-destructive/5"
    )}>
      <div className="mb-3 flex items-center gap-2">
        <Zap size={14} className={isBreakthrough ? "text-emerald-600" : "text-destructive"} />
        <h3 className="text-sm font-semibold">
          {isBreakthrough ? "Breakthrough" : "Breakdown"} Sentiment
        </h3>
        {sentiment && (
          <span className={cn(
            "ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase",
            isBreakthrough
              ? "bg-emerald-100 text-emerald-700"
              : "bg-destructive/10 text-destructive"
          )}>
            {isBreakthrough ? "Breakthrough" : "Breakdown"}
          </span>
        )}
      </div>
      {reflection && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Key Learnings
          </p>
          <p className="text-sm leading-relaxed text-foreground/80">{reflection}</p>
        </div>
      )}
    </div>
  );
}

// ── Report timeline — proper dot + connecting-line layout ─────────────────────

const TIMELINE_STEPS = [
  { type: "SUBMITTED", label: "Report Submitted" },
  { type: "OPENED",    label: "Manager Opened"   },
  { type: "APPROVED",  label: "Manager Approved" },
] as const;

function TimelineCard({ events }: { events: DsrEntryData["timelineEvents"] }) {
  const lastCompletedIndex = TIMELINE_STEPS.reduce(
    (lastIdx, step, i) => (events.find((e) => e.type === step.type) ? i : lastIdx),
    -1
  );

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Clock3 size={14} className="text-muted-foreground" />
        <span className="text-sm font-semibold">Report Timeline</span>
      </div>

      <div className="flex flex-col">
        {TIMELINE_STEPS.map((step, i) => {
          const event = events.find((e) => e.type === step.type);
          const isComplete = !!event;
          const isCurrent = i === lastCompletedIndex;
          const isLast = i === TIMELINE_STEPS.length - 1;

          return (
            <div key={step.type} className="flex gap-3">
              {/* Dot + vertical connecting line */}
              <div className="flex flex-col items-center">
                <span className={cn(
                  "mt-0.5 h-3 w-3 shrink-0 rounded-full",
                  isCurrent ? "border-2 border-emerald-500 bg-card"
                    : isComplete ? "bg-emerald-500"
                    : "bg-muted"
                )} />
                {!isLast && (
                  <div className="my-1 w-px flex-1 bg-border" style={{ minHeight: "16px" }} />
                )}
              </div>

              {/* Step text */}
              <div className={cn(!isLast && "pb-4")}>
                <p className={cn(
                  "text-xs font-semibold leading-tight",
                  !isComplete && "italic text-muted-foreground/50"
                )}>
                  {isComplete ? step.label : "Awaiting Approval"}
                </p>
                {isComplete && event && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatEventTime(event.occurredAt)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Reviewer actions card ─────────────────────────────────────────────────────

function ReviewerActionsCard({
  entryId,
  userId,
  memberName,
  isReviewed,
  dsmReviewed,
  managerComment,
}: {
  entryId: string;
  userId: string;
  memberName: string;
  isReviewed: boolean;
  dsmReviewed: boolean;
  managerComment?: string | null;
}) {
  const [state, action, pending] = useActionState<ReviewDsrState, FormData>(reviewDsr, {});
  const [comment, setComment] = useState("");

  if (isReviewed) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCheck size={16} />
          DSR Reviewed
        </div>
        {managerComment && (
          <div className="rounded-lg bg-emerald-100/60 p-3 text-xs text-emerald-900 border border-emerald-200">
            <p className="font-semibold uppercase tracking-wider text-[10px] text-emerald-700 mb-1">
              Manager Comment:
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">{managerComment}</p>
          </div>
        )}
      </div>
    );
  }

  if (!dsmReviewed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="text-sm font-semibold text-amber-700">Waiting on DSM Review</div>
        <p className="mt-1 text-xs text-amber-700/80">
          This member&apos;s DSM must be reviewed before their DSR can be reviewed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Reviewer Actions</h3>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="entryId" value={entryId} />
        <input type="hidden" name="userId" value={userId} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Manager Comments
          </label>
          <textarea
            name="managerComment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={`Add Feedback or Notes for ${memberName}...`}
            rows={4}
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
          />
        </div>
        {state.message && state.message !== "reviewed" && (
          <p className="text-xs text-destructive">{state.message}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <CheckCheck size={16} />
          {pending ? "Reviewing…" : "Reviewed"}
        </button>
      </form>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  review: MemberDsrReview;
  weekOffset: number;
  showHistory?: boolean;
};

export function DsrMemberReview({ review, weekOffset, showHistory }: Props) {
  const router = useRouter();
  const { user, todayEntry, weekEntries, todayDsmReviewed } = review;

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 6000);
    const handleFocus = () => router.refresh();
    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [router]);
  const { start } = getWeekRange(weekOffset);
  const weekLabel = `Week ${weekOfMonth(start)}`;
  const canGoForward = weekOffset < 0;

  const memberFirstName = user.name?.split(" ")[0] ?? "Member";
  const isReviewed = todayEntry?.status === "REVIEWED";

  const shouldShowHistory =
    showHistory ||
    !todayEntry ||
    isReviewed ||
    (todayEntry.status !== "SUBMITTED" && todayEntry.status !== "PENDING_REVIEW");

  return (
    <div className="flex flex-col gap-5">
      {/* Back Button */}
      <div>
        <Link
          href={ROUTES.dsrManage}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to All DSR
        </Link>
      </div>

      {/* Member header */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary ring-2 ring-background ring-offset-2 ring-offset-primary/10">
            {(user.name ?? user.email).slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h2 className="text-2xl font-bold">{user.name ?? user.email.split("@")[0]}</h2>
            <p className="text-sm text-muted-foreground">{user.title ?? "Team Member"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border bg-background px-2 py-1">
          <Link
            href={`/dsr/member/${user.id}?w=${weekOffset - 1}`}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="min-w-16 text-center text-sm font-medium">{weekLabel}</span>
          <Link
            href={canGoForward ? `/dsr/member/${user.id}?w=${weekOffset + 1}` : `/dsr/member/${user.id}`}
            className={cn(
              "rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent",
              !canGoForward && "pointer-events-none opacity-30"
            )}
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {!shouldShowHistory && todayEntry ? (
        <>
          {/* Date entry header strip — matches image 2 */}
          <DateEntryHeader entry={todayEntry} />

          {/* Review detail — left content wider (3fr), right actions narrower (2fr) */}
          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            {/* Left: content cards */}
            <div className="flex flex-col gap-4">
              <ResultCard entry={todayEntry} />
              <TaskProgressCard entry={todayEntry} locked={!todayDsmReviewed} />
              <BlockersSupportCard entry={todayEntry} />
              <SentimentCard entry={todayEntry} />
            </div>

            {/* Right: reviewer actions + timeline */}
            <div className="flex flex-col gap-4">
              <ReviewerActionsCard
                entryId={todayEntry.id}
                userId={user.id}
                memberName={memberFirstName}
                isReviewed={isReviewed}
                dsmReviewed={todayDsmReviewed}
                managerComment={todayEntry.managerComment}
              />
              <TimelineCard events={todayEntry.timelineEvents} />
            </div>
          </div>
        </>
      ) : (
        /* Weekly history view */
        <div className="flex flex-col gap-2">
          <div className="mb-2">
            <h2 className="text-lg font-semibold">This Week&apos;s Standups</h2>
            <p className="text-sm text-muted-foreground">
              Review Daily Status Updates for {user.name ?? user.email.split("@")[0]}.
            </p>
          </div>
          {weekEntries.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              No DSR Entries for This Week.
            </div>
          ) : (
            weekEntries.map((entry) => (
              <DsrHistoryCard
                key={entry.id}
                entry={entry}
                defaultOpen={relativeDayLabel(entry.date) === "Today"}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
