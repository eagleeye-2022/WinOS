import React from "react";

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Project Details</h1>
      <p className="text-sm text-muted-foreground mt-2">Viewing details for project</p>
    </div>
  );
}
