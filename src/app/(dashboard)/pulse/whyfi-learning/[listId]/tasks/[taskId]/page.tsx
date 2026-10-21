"use client";

import React, { use } from "react";
import { SingleTaskWorkspaceView } from "@/features/projects/components/views/single-task-workspace-view";

/**
 * WhyFi School task / subtask page — the same full task page as Srijan (description, subtasks,
 * comments, effort logs, timer), kept inside Pulse: its links stay on WhyFi School routes.
 */
export default function WhyfiTaskPage({ params }: { params: Promise<{ listId: string; taskId: string }> }) {
  const { listId, taskId } = use(params);
  return (
    <SingleTaskWorkspaceView
      projectId={listId}
      taskId={taskId}
      backHref="/pulse/whyfi-learning"
      taskHrefBase={`/pulse/whyfi-learning/${listId}/tasks`}
      isLearningList
    />
  );
}
