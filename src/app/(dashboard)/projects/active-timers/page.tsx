"use client";

import React from "react";
import { ActiveTimersPageView } from "@/features/projects/components/views/active-timers-page-view";

export default function ActiveTimersPage() {
  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <ActiveTimersPageView />
    </div>
  );
}
