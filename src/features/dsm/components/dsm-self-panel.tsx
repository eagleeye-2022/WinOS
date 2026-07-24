"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { TodaysFocusCard } from "./today-focus-card";
import { SubmitDsmForm } from "./submit-dsm-form";
import { WeekHistory } from "./week-history";
import { KpiCards } from "./kpi-cards";
import type { EntryWithDetails, KpiStats, TeamMember } from "../queries";

type DsmSelfPanelProps = {
  entry: EntryWithDetails | null;
  yesterdayTasks: string[];
  yesterdayIncompleteTasks: string[];
  yesterdayBlockers: { text: string; priority: "LOW" | "MEDIUM" | "HIGH"; mentionedUserId?: string | null }[];
  teamMembers: TeamMember[];
  todayDateStr: string;
  weekEntries: EntryWithDetails[];
  weekOffset: number;
  kpiStats: KpiStats;
  basePath?: string;
};

export function DsmSelfPanel({
  entry,
  yesterdayTasks,
  yesterdayIncompleteTasks,
  yesterdayBlockers,
  teamMembers,
  todayDateStr,
  weekEntries,
  weekOffset,
  kpiStats,
  basePath = "/dsm",
}: DsmSelfPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const canEdit = entry?.status === "SUBMITTED" || entry?.status === "PENDING_REVIEW";
  const showForm = !entry || entry.status === "DRAFT" || isEditing;

  if (showForm) {
    return (
      <>
        <TodaysFocusCard entry={entry} />
        <SubmitDsmForm
          entry={entry}
          yesterdayTasks={yesterdayTasks}
          yesterdayIncompleteTasks={yesterdayIncompleteTasks}
          yesterdayBlockers={yesterdayBlockers}
          teamMembers={teamMembers}
          todayDateStr={todayDateStr}
          onCancel={isEditing ? () => setIsEditing(false) : undefined}
        />
      </>
    );
  }

  return (
    <>
      {canEdit && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Pencil size={13} />
            Edit Today&apos;s DSM
          </button>
        </div>
      )}
      <WeekHistory entries={weekEntries} weekOffset={weekOffset} basePath={basePath} />
      <KpiCards stats={kpiStats} />
    </>
  );
}
