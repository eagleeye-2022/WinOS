"use client";

import React, { use } from "react";
import { SingleTaskWorkspaceView } from "@/features/projects/components/views/single-task-workspace-view";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;
  const taskId = resolvedParams.taskId;

  return <SingleTaskWorkspaceView projectId={projectId} taskId={taskId} />;
}
