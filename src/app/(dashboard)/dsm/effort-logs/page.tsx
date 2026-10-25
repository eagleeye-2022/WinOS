"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getTimeLogsAction } from "@/features/projects/actions/project-actions";
import { TimeTrackerView } from "@/features/projects/components/views/time-tracker-view";
import { UserTimeGroup } from "@/features/projects/types";

/**
 * Standup → Effort Log: the same report as Srijan → Effort Logs, opened from the DSM sidebar — all
 * effort (every project and WhyFi School). Managers see the whole team's logs; members only their
 * own (getTimeLogsAction scopes it on the server).
 */
export default function DsmEffortLogsPage() {
  const [timeGroups, setTimeGroups] = useState<UserTimeGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getTimeLogsAction()
      .then(setTimeGroups)
      .catch((err) => console.error("Failed to load time logs:", err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-background overflow-hidden">
      <TimeTrackerView initialGroups={timeGroups} />
    </div>
  );
}
