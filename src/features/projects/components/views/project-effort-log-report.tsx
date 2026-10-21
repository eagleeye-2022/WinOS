"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getTimeLogsAction } from "../../actions/project-actions";
import { TimeTrackerView } from "./time-tracker-view";
import type { UserTimeGroup } from "../../types";

/**
 * One project's effort logs in the same report as Srijan → Effort Logs (/projects/effort-log-report):
 * Day / Month / Range picker, Group By User / Date / Project, expand-collapse, Task Notes popup…
 * Used by the project's Effort Logs tab and /projects/[projectId]/effort-log-report.
 */
export function ProjectEffortLogReport({
  projectId,
  projectName,
  projectStart,
  projectEnd,
}: {
  projectId: string;
  projectName?: string;
  /** Project start / end (DD/MM/YYYY) — shown on the picker's "Project Span" option. */
  projectStart?: string;
  projectEnd?: string;
}) {
  const [timeGroups, setTimeGroups] = useState<UserTimeGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getTimeLogsAction(projectId)
      .then((groups) => {
        if (!cancelled) setTimeGroups(groups);
      })
      .catch((err) => console.error("Failed to load project time logs:", err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <TimeTrackerView
        initialGroups={timeGroups}
        projectId={projectId}
        projectName={projectName}
        projectSpan={{ start: projectStart, end: projectEnd }}
      />
    </div>
  );
}
