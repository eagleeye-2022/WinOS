import React from "react";
import { ProjectWorkspaceProvider } from "@/features/projects/context/project-workspace-context";

/**
 * A WhyFi School list is a learning `Project` (see whyfi/constants.ts), so its task pages reuse the
 * Srijan task workspace — loaded once here and shared by the list's task/subtask pages, like the
 * `/projects/[projectId]` layout.
 */
export default async function WhyfiListLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  return (
    <div className="h-full w-full">
      <ProjectWorkspaceProvider projectId={listId}>{children}</ProjectWorkspaceProvider>
    </div>
  );
}
