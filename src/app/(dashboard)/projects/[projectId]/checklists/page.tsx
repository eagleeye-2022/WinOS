"use client";

import React from "react";
import { ChecklistWorkspaceView } from "@/features/projects/components/views/checklist-workspace-view";

export default function ChecklistsPage() {
  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <ChecklistWorkspaceView />
    </div>
  );
}

