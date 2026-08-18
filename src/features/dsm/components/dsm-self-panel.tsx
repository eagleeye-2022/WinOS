"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { TodaysFocusCard } from "./today-focus-card";
import { SubmitDsmForm } from "./submit-dsm-form";
import { WeekHistory } from "./week-history";
import { KpiCards } from "./kpi-cards";
import type { EntryWithDetails, KpiStats, TeamMember } from "../queries";
import type { CalendarEventView } from "@/features/calendar/queries";

type DsmSelfPanelProps = {
  entry: EntryWithDetails | null;
  yesterdayTasks: string[];
  yesterdayIncompleteTasks: string[];
  yesterdayBlockers: { text: string; priority: "LOW" | "MEDIUM" | "HIGH"; mentionedUserId?: string | null }[];
  yesterdaySupportNeeds: { text: string; mentionedUserId?: string | null }[];
  yesterdayIncompleteLearningItems: string[];
  teamMembers: TeamMember[];
  todayDateStr: string;
  weekEntries: EntryWithDetails[];
  weekOffset: number;
  kpiStats: KpiStats;
  basePath?: string;
  todayCalendarEvents?: CalendarEventView[];
};

export function DsmSelfPanel({
  entry,
  yesterdayTasks,
  yesterdayIncompleteTasks,
  yesterdayBlockers,
  yesterdaySupportNeeds,
  yesterdayIncompleteLearningItems,
  teamMembers,
  todayDateStr,
  weekEntries,
  weekOffset,
  kpiStats,
  basePath = "/dsm",
  todayCalendarEvents,
}: DsmSelfPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const canEdit = entry?.status === "SUBMITTED" || entry?.status === "PENDING_REVIEW";
  const showForm = !entry || entry.status === "DRAFT" || isEditing;

  if (showForm) {
    return (
      <>
        {/* <TodaysFocusCard entry={entry} /> */}
        <SubmitDsmForm
          entry={entry}
          yesterdayTasks={yesterdayTasks}
          yesterdayIncompleteTasks={yesterdayIncompleteTasks}
          yesterdayBlockers={yesterdayBlockers}
          yesterdaySupportNeeds={yesterdaySupportNeeds}
          yesterdayIncompleteLearningItems={yesterdayIncompleteLearningItems}
          teamMembers={teamMembers}
          todayDateStr={todayDateStr}
          todayCalendarEvents={todayCalendarEvents}
          onCancel={isEditing ? () => setIsEditing(false) : undefined}
        />
      </>
    );
  }

  return (
    <>
      <WeekHistory
        entries={weekEntries}
        weekOffset={weekOffset}
        basePath={basePath}
        headerAction={
          canEdit ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              title="Edit Today's DSM"
              aria-label="Edit Today's DSM"
              className="rounded-full border bg-card p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground dark:text-[#3B82F6] dark:hover:text-[#2563EB]"
            >
              <Pencil size={16} className="dark:text-[#93C5FD]" />
            </button>
          ) : undefined
        }
      />
      <KpiCards stats={kpiStats} />
    </>
  );
}
