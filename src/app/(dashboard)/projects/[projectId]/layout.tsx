import React from "react";
import { ProjectWorkspaceProvider } from "@/features/projects/context/project-workspace-context";

export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div className="h-full w-full">
      <ProjectWorkspaceProvider projectId={projectId}>{children}</ProjectWorkspaceProvider>
    </div>
  );
}
