"use client";

import React, { use } from "react";
import { useProjectWorkspace } from "@/features/projects/context/project-workspace-context";
import { ProjectEffortLogReport } from "@/features/projects/components/views/project-effort-log-report";

export default function ProjectTimeTrackerPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  // The [projectId] layout already loads the project — no separate fetch for its name.
  const { project } = useProjectWorkspace();
  return (
    <ProjectEffortLogReport
      projectId={projectId}
      projectName={project?.name}
      projectStart={project?.startDate}
      projectEnd={project?.deadline}
    />
  );
}
