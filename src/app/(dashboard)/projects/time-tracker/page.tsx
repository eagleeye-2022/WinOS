"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getTimeLogsAction } from "@/features/projects/actions/project-actions";
import { TimeTrackerView } from "@/features/projects/components/views/time-tracker-view";
import { UserTimeGroup } from "@/features/projects/types";

export default function TimeTrackerPage() {
  const [timeGroups, setTimeGroups] = useState<UserTimeGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      setIsLoading(true);
      try {
        const groups = await getTimeLogsAction();
        setTimeGroups(groups);
      } catch (err) {
        console.error("Failed to load time logs:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadLogs();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
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
