"use client";

import React, { use } from "react";
import { PhasesTableView } from "@/features/projects/components/views/phases-table-view";

export default function PhasesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <PhasesTableView projectId={projectId} />
    </div>
  );
}

