"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { MemberTaskTimerBadge } from "@/features/dsm/manager/components/member-task-timer-badge";
import {
  DueDateCell,
  ProjectPill,
  STICKY_PROJECT_COL_2,
  TASK_TABLE_SCROLL,
  TaskIdChip,
  WrappedTaskText,
} from "@/components/shared/task-table-parts";
import { projectTaskHref } from "@/lib/project-task-href";
import { isTaskDone } from "@/features/projects/types";
import { getWhyfiTasksByCodesAction, type WhyfiPickerTask } from "@/features/whyfi/actions";
import { parseLearningLineCode, stripLearningLineCode } from "@/features/whyfi/constants";

type LearningItem = { id: string; text: string; completed: boolean };

/**
 * "What Will You Learn Today (WhyFi School)?" on a report — the same table as the DSM card
 * (StandupLearningSection), without the # column: Done · List · Task ID · Learning Task · Status · Due Date · Effort
 * Logs. Lines linked to a WhyFi School card ("[WL-1-T3] …") fill in the card's columns; the Done
 * cell is the caller's (read-only tick, or the manager's toggle).
 */
export function ReportLearningTable({
  items,
  memberId,
  dateStr,
  renderDone,
}: {
  items: LearningItem[];
  memberId?: string;
  /** The report's day, "YYYY-MM-DD" — for the logged-effort badge. */
  dateStr: string;
  renderDone: (item: LearningItem) => React.ReactNode;
}) {
  // Linked WhyFi School cards for the lines (read-only lookup, same as the DSM card).
  const codesKey = items.map((l) => parseLearningLineCode(l.text)).filter(Boolean).join(",");
  const [cards, setCards] = useState<Map<string, WhyfiPickerTask>>(new Map());
  useEffect(() => {
    if (!codesKey) return;
    let cancelled = false;
    getWhyfiTasksByCodesAction(codesKey.split(","))
      .then((res) => {
        if (!cancelled) setCards(new Map(res.map((t) => [t.code, t])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [codesKey]);

  return (
    <div className={TASK_TABLE_SCROLL}>
      <table className={cn("w-full min-w-[900px] border-collapse", STICKY_PROJECT_COL_2)}>
        <thead>
          <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="w-10 whitespace-nowrap pb-2.5 pr-2 font-semibold">Done</th>
            <th className="whitespace-nowrap pb-2.5 pr-3 font-semibold">List</th>
            <th className="whitespace-nowrap pb-2.5 pr-3 font-semibold">Task ID</th>
            <th className="whitespace-nowrap pb-2.5 pr-3 font-semibold">Learning Task</th>
            <th className="w-24 whitespace-nowrap pb-2.5 pr-3 font-semibold">Status</th>
            <th className="whitespace-nowrap pb-2.5 pr-3 font-semibold">Due Date</th>
            <th className="whitespace-nowrap pb-2.5 pr-3 font-semibold">Effort Logs</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const code = parseLearningLineCode(item.text);
            const card = code ? cards.get(code) : undefined;
            const text = stripLearningLineCode(item.text);
            const cardDone = card ? isTaskDone(card.status) : false;
            return (
              <tr key={item.id} className="border-b transition-colors last:border-b-0 hover:bg-muted/40">
                <td className="py-2.5 pr-2 align-top">{renderDone(item)}</td>
                <td className="py-2.5 pr-3 align-top">
                  {card ? <ProjectPill name={card.listName} /> : <span className="text-xs text-muted-foreground/60">—</span>}
                </td>
                <td className="py-2.5 pr-3 align-top">
                  {code ? (
                    <TaskIdChip code={code} title={card?.title || text} href={card ? projectTaskHref(card.projectId, code) : null} />
                  ) : (
                    <span className="text-xs text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 align-top">
                  <span className={cn("text-sm", !item.completed && "text-muted-foreground")}>
                    <WrappedTaskText text={text} />
                  </span>
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 align-top">
                  {card ? (
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-xs font-bold",
                        cardDone
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : card.status === "In Progress"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                      )}
                    >
                      {card.status}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 align-top">
                  <DueDateCell dueDate={card?.dueDate || null} />
                </td>
                <td className="py-2.5 pr-3 align-top">
                  {code && card ? (
                    <MemberTaskTimerBadge taskId={card.id} taskCode={code} memberId={memberId} dateStr={dateStr} />
                  ) : (
                    <span className="text-xs text-muted-foreground/60">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Read-only Done tick (green when learned) — for report history cards. */
export function LearnedTick({ done }: { done: boolean }) {
  return (
    <span
      title={done ? "Learned" : "Not learned"}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
        done ? "bg-success text-success-foreground" : "border border-border bg-muted"
      )}
    >
      {done && (
        <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5">
          <polyline points="1,4 3,6 7,2" />
        </svg>
      )}
    </span>
  );
}
