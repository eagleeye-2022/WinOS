"use client";

import { useState } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderTextWithMentions } from "@/components/shared/mention-text";
import { reviewStatus, relativeDayLabel, formatShortDate } from "../utils";
import type { EntryWithDetails } from "../queries";
import { TaskAuditHistoryPopover } from "./task-audit-history-popover";
import { toggleStandupTask } from "../actions/toggle-standup-task";
import { MemberTaskTimerBadge } from "@/features/dsm/manager/components/member-task-timer-badge";
import { TimerWidget } from "@/features/projects/components/timer-widget";
import { TaskIdChip, ProjectPill, DueDateCell, TaskTableHead, PriorityBadge, ExpandableTaskText } from "@/components/shared/task-table-parts";
import { AddTaskAfterReviewRow } from "./add-task-after-review-row";
import { StandupLearningSection } from "./standup-learning-section";

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
  const isReviewed = entry.status === "REVIEWED";

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
          {(todayTasks.length > 0 || isReviewed) && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Today&apos;s Task
              </p>
              {todayTasks.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <TaskTableHead withCheckbox={entry.status === "DRAFT"} withAction={true} withProject={false} withTimeTracked={false} />
                    <tbody>
                      {todayTasks.map((task, i) => {
                        const p = task.managerPriority ?? task.priority;
                        return (
                          <tr key={task.id} className="border-b last:border-b-0 hover:bg-muted/40 transition-colors">
                            {entry.status === "DRAFT" && (
                              <td className="py-2 pr-2 align-top">
                                <input
                                  type="checkbox"
                                  checked={task.isCompleted ?? false}
                                  onChange={async (e) => {
                                    await toggleStandupTask(task.id, e.target.checked);
                                  }}
                                  className="h-3.5 w-3.5 rounded border-muted-foreground accent-primary cursor-pointer shrink-0"
                                />
                              </td>
                            )}
                            <td className="py-2.5 pr-2 align-top">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                                T{i + 1}
                              </span>
                            </td>
                            {/* Project / Task ID cells temporarily disabled — Projects module not part of this deploy
                            <td className="py-2.5 pr-3 align-top">
                              {task.projectTask?.project ? <ProjectPill name={task.projectTask.project.name} /> : <span className="text-xs text-muted-foreground/60">—</span>}
                            </td>
                            <td className="py-2.5 pr-3 align-top">
                              {task.projectTask ? <TaskIdChip code={task.projectTask.code} /> : <span className="text-xs text-muted-foreground/60">—</span>}
                            </td>
                            */}
                            <td className="py-2.5 pr-3 align-top">
                              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                                <span className={cn(task.isCompleted && "line-through text-muted-foreground")}>
                                  <ExpandableTaskText text={task.text} />
                                </span>
                                {task.addedAfterReview && (
                                  <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary shrink-0" title="Added After Review">
                                    NT
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="w-20 py-2.5 pr-3 align-top whitespace-nowrap">
                              <PriorityBadge priority={p} />
                            </td>
                            <td className="py-2.5 pr-3 align-top">
                              <DueDateCell dueDate={task.dueDate} />
                            </td>
                            {/* Timer cell temporarily disabled — Projects module not part of this deploy
                            <td className="py-2.5 pr-3 align-top">
                              {task.projectTaskId && isToday ? (
                                <TimerWidget
                                  taskId={task.projectTaskId}
                                  taskCode={task.projectTask?.code ?? undefined}
                                  taskTitle={task.text}
                                  projectId={task.projectTask?.project?.id}
                                  defaultExpanded={true}
                                />
                              ) : task.projectTaskId ? (
                                <MemberTaskTimerBadge
                                  taskId={task.projectTaskId}
                                  taskCode={task.projectTask?.code}
                                  memberId={entry.user?.id}
                                  dateStr={new Date(entry.date).toISOString().slice(0, 10)}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground/60">—</span>
                              )}
                            </td>
                            */}
                            <td className="py-2.5 pr-2 align-top text-center">
                              <div className="flex items-center justify-center">
                                <TaskAuditHistoryPopover task={task} memberUser={entry.user} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-1">No tasks logged for today.</p>
              )}

              {isReviewed && (
                <AddTaskAfterReviewRow entryId={entry.id} userId={entry.user?.id} />
              )}
            </div>
          )}

          <StandupLearningSection
            entryId={entry.id}
            learningText={entry.learningText}
            isReviewed={isReviewed}
          />

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
                        <p className={cn("text-xs leading-relaxed flex flex-wrap items-center gap-1", PRIORITY_COLORS[b.priority])}>
                          <span>{i + 1})</span>
                          {b.projectTask && (
                            <span className="rounded bg-destructive/10 border border-destructive/20 text-destructive px-1.5 py-0.5 text-[10px] font-mono font-bold shrink-0">
                              [{b.projectTask.code}]
                            </span>
                          )}
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
