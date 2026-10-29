"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getTimeLogsAction } from "@/features/projects/actions/project-actions";
import { TimeTrackerView } from "@/features/projects/components/views/time-tracker-view";
import { UserTimeGroup } from "@/features/projects/types";

/**
 * Pulse → WhyFi Effort Logs: the effort log report filtered to time logged on WhyFi School
 * (learning list) tasks only. Same layout as Standup → Effort Log and Srijan → Effort Logs (no
 * extra title bar); the report itself labels the list column "WhyFi School" and drops billing.
 */
export default function WhyfiEffortLogsPage() {
  const [timeGroups, setTimeGroups] = useState<UserTimeGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getTimeLogsAction(undefined, { learningOnly: true })
      .then(setTimeGroups)
      .catch((err) => console.error("Failed to load WhyFi School time logs:", err))
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
      <TimeTrackerView initialGroups={timeGroups} learningOnly />
    </div>
  );
}
