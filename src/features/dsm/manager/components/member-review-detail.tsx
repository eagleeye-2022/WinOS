"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, ChevronDown,
  CheckCircle2, CheckCheck, AlertTriangle, Calendar, Handshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { reviewStandup, type ReviewStandupState } from "../actions/review-standup";
import { setTaskPriority, type SetTaskPriorityState } from "../actions/set-task-priority";
import { reviewStatus, relativeDayLabel, formatShortDate, weekOfMonth, getWeekRange } from "@/features/dsm/utils";
import type { MemberReview, MemberReviewEntry } from "../queries";

// ── Priority picker ───────────────────────────────────────────────────────────

type Priority = "P1" | "P2" | "P3";

const PRIORITY_COLORS: Record<Priority, string> = {
  P1: "bg-destructive/10 text-destructive border-destructive/30",
  P2: "bg-amber-50 text-amber-700 border-amber-300",
  P3: "bg-sky-50 text-sky-700 border-sky-300",
};

function PriorityDropdown({ taskId, current }: { taskId: string; current: Priority | null }) {
  const [, action, pending] = useActionState<SetTaskPriorityState, FormData>(setTaskPriority, {});

  return (
    <form action={action} className="relative flex items-center">
      <input type="hidden" name="taskId" value={taskId} />
      <select
        name="priority"
        defaultValue={current ?? ""}
        onChange={(e) => {
          const form = e.target.form;
          if (form) {
            const fd = new FormData(form);
            fd.set("priority", e.target.value);
            action(fd);
          }
        }}
        disabled={pending}
        className={cn(
          "appearance-none rounded-lg border py-1.5 pl-3 pr-7 text-xs outline-none transition-colors",
          current ? PRIORITY_COLORS[current] : "border-border bg-background text-muted-foreground"
        )}
      >
        <option value="">Select Priority</option>
        <option value="P1">Priority 1 (P1)</option>
        <option value="P2">Priority 2 (P2)</option>
        <option value="P3">Priority 3 (P3)</option>
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 text-current opacity-60" />
    </form>
  );
}

// ── Review button ─────────────────────────────────────────────────────────────

function ReviewButton({ entryId }: { entryId: string }) {
  const [state, action, pending] = useActionState<ReviewStandupState, FormData>(reviewStandup, {});

  if (state.message === "reviewed") {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
        <CheckCheck size={16} /> Reviewed
      </div>
    );
  }

  return (
    <form action={action} className="w-full">
      <input type="hidden" name="entryId" value={entryId} />
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <CheckCheck size={16} />
        {pending ? "Reviewing…" : "Reviewed ✓"}
      </button>
    </form>
  );
}

// ── Compact entry preview (collapsed state) ───────────────────────────────────

function CompactEntryPreview({ entry }: { entry: MemberReviewEntry }) {
  const todayTasks = entry.tasks.filter((t) => t.kind === "TODAY");
  const hasFollowUps = entry.supportNeeds.length > 0;
  const hasBlockers = entry.blockers.length > 0;

  return (
    <div className="space-y-3 px-4 pb-4 pt-3">
      {todayTasks.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Today&apos;s Task
          </p>
          <div className="space-y-1.5">
            {todayTasks.map((task, i) => (
              <div key={task.id} className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                  T{i + 1}
                </span>
                <span className="text-sm leading-snug text-foreground/80">{task.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(hasFollowUps || hasBlockers) && (
        <div className={cn("grid gap-2", hasFollowUps && hasBlockers ? "grid-cols-2" : "grid-cols-1")}>
          {hasFollowUps && (
            <div className="rounded-lg bg-accent/60 p-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Follow-Ups
              </p>
              <ol className="space-y-0.5">
                {entry.supportNeeds.slice(0, 2).map((s, i) => (
                  <li key={s.id} className="text-xs leading-snug text-foreground/70">
                    {i + 1}) {s.text}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {hasBlockers && (
            <div className="rounded-lg bg-destructive/5 p-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                Blockers
              </p>
              <ol className="space-y-0.5">
                {entry.blockers.slice(0, 2).map((b, i) => (
                  <li key={b.id} className="text-xs leading-snug text-destructive/70">
                    {i + 1}){" "}
                    {b.mentionedUser && (
                      <span className="font-semibold text-destructive">
                        @{b.mentionedUser.name?.split(" ")[0]?.toLowerCase() ?? b.mentionedUser.email.split("@")[0]}&nbsp;
                      </span>
                    )}
                    {b.text}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Day entry expanded (full review form) ─────────────────────────────────────

function EntryExpanded({ entry }: { entry: MemberReviewEntry }) {
  const yesterdayTasks = entry.tasks.filter((t) => t.kind === "YESTERDAY");
  const todayTasks = entry.tasks.filter((t) => t.kind === "TODAY");
  const isReviewable = entry.status === "SUBMITTED" || entry.status === "PENDING_REVIEW";

  return (
    <div className="space-y-4">
      {/* Yesterday completed */}
      {yesterdayTasks.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <CheckCircle2 size={15} className="text-primary" />
            What Did You Complete Yesterday?
          </h3>
          <div className="space-y-2">
            {yesterdayTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-2.5">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary" />
                <span className="text-sm">{task.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today tasks + priority */}
      {todayTasks.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Calendar size={15} className="text-primary" />
            What Will You Do Today?
          </h3>
          <div className="space-y-2.5">
            {todayTasks.map((task, i) => (
              <div key={task.id} className="flex items-center gap-2.5">
                <span className="w-7 shrink-0 text-xs font-semibold text-muted-foreground">
                  T{i + 1}:
                </span>
                <span className="flex-1 text-sm">{task.text}</span>
                <PriorityDropdown
                  taskId={task.id}
                  current={task.managerPriority as Priority | null}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blockers */}
      {entry.blockers.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle size={15} className="text-destructive" />
            Blockers (Data Needed)
          </h3>
          <ol className="space-y-1 text-sm text-destructive/90">
            {entry.blockers.map((b, i) => (
              <li key={b.id}>
                {i + 1}.{" "}
                {b.mentionedUser && (
                  <span className="font-semibold text-primary">
                    @{b.mentionedUser.name?.split(" ")[0]?.toLowerCase() ?? b.mentionedUser.email.split("@")[0]}&nbsp;
                  </span>
                )}
                {b.text}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Support needed */}
      {entry.supportNeeds.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-sky-700">
            <Handshake size={15} className="text-sky-700" />
            Support Needed (Meeting)
          </h3>
          <ol className="space-y-1 text-sm">
            {entry.supportNeeds.map((s, i) => (
              <li key={s.id}>
                {i + 1}.{" "}
                {s.mentionedUser && (
                  <span className="font-medium text-primary">
                    @{s.mentionedUser.name?.split(" ")[0]?.toLowerCase() ?? s.mentionedUser.email.split("@")[0]}&nbsp;
                  </span>
                )}
                {s.text}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Review action */}
      {isReviewable && (
        <div className="pt-1">
          <ReviewButton entryId={entry.id} />
        </div>
      )}

      {entry.status === "REVIEWED" && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCheck size={16} />
          Reviewed{entry.reviewedBy ? ` by ${entry.reviewedBy.name?.split(" ")[0] ?? "manager"}` : ""}
        </div>
      )}
    </div>
  );
}

// ── Today entry card — expanded by default ────────────────────────────────────

function TodayEntryCard({ entry }: { entry: MemberReviewEntry }) {
  const [expanded, setExpanded] = useState(false);
  const review = reviewStatus({
    status: entry.status,
    date: entry.date,
    reviewedAt: entry.reviewedAt,
    reviewedBy: entry.reviewedBy,
  });
  const dateStr = formatShortDate(entry.date);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: date + Today on row 1, Submitted on row 2 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{dateStr}</span>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              Today
            </span>
          </div>
          {(entry.status === "SUBMITTED" || entry.status === "PENDING_REVIEW" || entry.status === "REVIEWED") && (
            <span className="w-fit rounded-full border border-emerald-600/40 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Submitted
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            review.kind === "reviewed" ? "text-emerald-600"
            : review.kind === "pending" ? "text-amber-600"
            : review.kind === "none" ? "text-muted-foreground"
            : "text-destructive"
          )}>
            <span className={cn(
              "h-2 w-2 rounded-full",
              review.kind === "reviewed" ? "bg-emerald-500"
              : review.kind === "pending" ? "bg-amber-500"
              : review.kind === "none" ? "bg-muted-foreground/40"
              : "bg-destructive"
            )} />
            {review.label}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent"
          >
            <ChevronDown
              size={15}
              className={cn("transition-transform duration-200", expanded && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {entry.status !== "MISSED" && (
        <div className="border-t">
          {expanded ? (
            <div className="px-4 pb-4 pt-3">
              <EntryExpanded entry={entry} />
            </div>
          ) : (
            <CompactEntryPreview entry={entry} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Day card (non-today, collapsible) ─────────────────────────────────────────

function DayCardCollapsed({ entry }: { entry: MemberReviewEntry }) {
  const [open, setOpen] = useState(false);
  const review = reviewStatus({
    status: entry.status,
    date: entry.date,
    reviewedAt: entry.reviewedAt,
    reviewedBy: entry.reviewedBy,
  });
  const dayLabel = relativeDayLabel(entry.date);
  const dateStr = formatShortDate(entry.date);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{dateStr}</span>
          {dayLabel && dayLabel !== "Today" && (
            <span className="text-[11px] text-muted-foreground">{dayLabel}</span>
          )}
          {(entry.status === "SUBMITTED" || entry.status === "PENDING_REVIEW" || entry.status === "REVIEWED") && (
            <span className="rounded-full border border-emerald-600/40 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Submitted
            </span>
          )}
          {entry.status === "MISSED" && (
            <span className="rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-[11px] font-medium text-destructive">
              Missed
            </span>
          )}
          {entry.status === "DRAFT" && (
            <span className="rounded-full border border-amber-400/40 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              Draft
            </span>
          )}
          {entry.blockers.length > 0 && (
            <span className="rounded-full border border-destructive/20 bg-destructive/5 px-2 py-0.5 text-[11px] font-medium text-destructive">
              {entry.blockers.length} Blocker{entry.blockers.length > 1 ? "s" : ""}
            </span>
          )}
          {entry.supportNeeds.length > 0 && (
            <span className="rounded-full border border-sky-300/50 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
              {entry.supportNeeds.length} Follow-Up{entry.supportNeeds.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

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

        <ChevronDown
          size={15}
          className={cn("shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && entry.status !== "MISSED" && (
        <div className="border-t px-4 pb-4 pt-3">
          <EntryExpanded entry={entry} />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  review: MemberReview;
  weekOffset: number;
};

export function MemberReviewDetail({ review, weekOffset }: Props) {
  const { user, entries } = review;
  const { start } = getWeekRange(weekOffset);
  const weekLabel = `Week ${weekOfMonth(start)}`;
  const canGoForward = weekOffset < 0;

  const todayEntry = entries.find((e) => relativeDayLabel(e.date) === "Today");
  const otherEntries = entries.filter((e) => relativeDayLabel(e.date) !== "Today");

  return (
    <div className="flex flex-col gap-5">
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

        {/* Week navigation */}
        <div className="flex items-center gap-1 rounded-full border bg-background px-2 py-1">
          <Link
            href={`/dsm/member/${user.id}?w=${weekOffset - 1}`}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="min-w-16 text-center text-sm font-medium">{weekLabel}</span>
          <Link
            href={canGoForward ? `/dsm/member/${user.id}?w=${weekOffset + 1}` : `/dsm/member/${user.id}`}
            className={cn(
              "rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent",
              !canGoForward && "pointer-events-none opacity-30"
            )}
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {/* Today entry — expanded by default */}
      {todayEntry && <TodayEntryCard entry={todayEntry} />}

      {/* Previous days — collapsed by default */}
      {otherEntries.map((entry) => (
        <DayCardCollapsed key={entry.id} entry={entry} />
      ))}

      {entries.length === 0 && (
        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No Standups Recorded for This Week.
        </div>
      )}
    </div>
  );
}
