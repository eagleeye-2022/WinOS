"use client";

import React, { useState, useEffect, use } from "react";
import { Loader2 } from "lucide-react";
import { getTimeLogsAction, getProjectByIdAction } from "@/features/projects/actions/project-actions";
import { TimeTrackerView } from "@/features/projects/components/views/time-tracker-view";
import { UserTimeGroup } from "@/features/projects/types";

export default function ProjectTimeTrackerPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const [timeGroups, setTimeGroups] = useState<UserTimeGroup[]>([]);
  const [projectName, setProjectName] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      setIsLoading(true);
      try {
        const [groups, project] = await Promise.all([
          getTimeLogsAction(projectId),
          getProjectByIdAction(projectId),
        ]);
        setTimeGroups(groups);
        setProjectName(project?.name);
      } catch (err) {
        console.error("Failed to load project time logs:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadLogs();
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-background overflow-hidden">
      <TimeTrackerView initialGroups={timeGroups} projectId={projectId} projectName={projectName} />
    </div>
  );
}
