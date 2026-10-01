"use client";

import { useState } from "react";
import { ChevronDown, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimerWidget } from "@/features/projects/components/timer-widget";
import { ActiveTimerProvider } from "@/features/projects/context/active-timer-context";
import { MemberTaskTimerBadge } from "../manager/components/member-task-timer-badge";
import { CoreTaskDetails } from "./core-task-details";
import type { CoreDailyTask } from "../queries";

type CoreDailyTasksPanelProps = {
  tasks: CoreDailyTask[];
  /** Manager review mode: show this member's live timer / logged effort read-only instead of
   *  a start/stop timer for the viewer. */
  memberView?: { memberId: string; dateStr: string };
};

/** EED Core's shared daily tasks (DSM, meetings, …), pinned on /dsm so anyone can start a timer. */
export function CoreDailyTasksPanel({ tasks, memberView }: CoreDailyTasksPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const card = (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-center gap-2">
        <Repeat size={14} className="text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Daily Core Tasks</span>
        <span className="ml-auto text-xs text-muted-foreground">EED Core</span>
      </div>

      <ul className="flex flex-col divide-y">
        {tasks.map((task) => {
          const isExpanded = expandedId === task.id;
          return (
            <li key={task.id} className="py-2 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground" title={task.title}>
                    {task.title}
                  </p>
                  <span className="font-mono text-[11px] text-muted-foreground">{task.code}</span>
                </div>
                {memberView ? (
                  <MemberTaskTimerBadge
                    taskId={task.id}
                    taskCode={task.code}
                    memberId={memberView.memberId}
                    dateStr={memberView.dateStr}
                  />
                ) : (
                  <TimerWidget
                    taskId={task.id}
                    taskCode={task.code}
                    taskTitle={task.title}
                    projectId={task.projectId}
                    defaultExpanded={true}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : task.id)}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? `Hide details of ${task.title}` : `Show details of ${task.title}`}
                  title={isExpanded ? "Hide details" : "Show details"}
                  className="shrink-0 cursor-pointer rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronDown size={14} className={cn("transition-transform duration-150", isExpanded && "rotate-180")} />
                </button>
              </div>
              {isExpanded && <CoreTaskDetails task={task} />}
            </li>
          );
        })}
      </ul>
    </div>
  );

  return memberView ? card : <ActiveTimerProvider>{card}</ActiveTimerProvider>;
}
