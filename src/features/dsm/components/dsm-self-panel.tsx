"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { TodaysFocusCard } from "./today-focus-card";
import { SubmitDsmForm, dsmEditDraftKey } from "./submit-dsm-form";
import { WeekHistory } from "./week-history";
import { KpiCards } from "./kpi-cards";
import { AddTaskAfterReviewRow } from "./add-task-after-review-row";
import { SelfReviewButton } from "./self-review-button";
import { isSelfReviewed } from "../utils";
import type { EntryWithDetails, KpiStats, TeamMember, ParkedTask, YesterdaySummary } from "../queries";
import type { CalendarEventView } from "@/features/calendar/queries";
import type { AdditionalWorkItem } from "./yesterday-additional-work";

type DsmSelfPanelProps = {
  entry: EntryWithDetails | null;
  yesterday: YesterdaySummary;
  yesterdayAdditionalWork?: AdditionalWorkItem[];
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
  parkedTasks?: ParkedTask[];
  currentUserId: string;
};

export function DsmSelfPanel({
  entry,
  yesterday,
  yesterdayAdditionalWork = [],
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
  parkedTasks,
  currentUserId,
}: DsmSelfPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const canEdit = entry?.status === "SUBMITTED" || entry?.status === "PENDING_REVIEW";

  // Unsaved edits to the submitted DSM (kept in this browser) → reopen the editor with them.
  useEffect(() => {
    if (!canEdit) return;
    try {
      if (localStorage.getItem(dsmEditDraftKey(currentUserId, todayDateStr))) setIsEditing(true);
    } catch {
      // Storage unavailable — open normally.
    }
  }, [canEdit, currentUserId, todayDateStr]);
  const showForm = !entry || entry.status === "DRAFT" || isEditing;

  if (showForm) {
    return (
      <>
        {/* <TodaysFocusCard entry={entry} /> */}
        <SubmitDsmForm
          entry={entry}
          yesterday={yesterday}
          yesterdayAdditionalWork={yesterdayAdditionalWork}
          yesterdayIncompleteTasks={yesterdayIncompleteTasks}
          yesterdayBlockers={yesterdayBlockers}
          yesterdaySupportNeeds={yesterdaySupportNeeds}
          yesterdayIncompleteLearningItems={yesterdayIncompleteLearningItems}
          teamMembers={teamMembers}
          todayDateStr={todayDateStr}
          todayCalendarEvents={todayCalendarEvents}
          parkedTasks={parkedTasks ?? []}
          currentUserId={currentUserId}
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
          <div className="flex items-center gap-2">
            {/* {entry?.status === "REVIEWED" && (
              <AddTaskAfterReviewRow entryId={entry.id} />
            )} */}
            {/* Self-review: a mark only — the DSM stays editable until the manager's Review. */}
            {canEdit && entry && (
              <SelfReviewButton entryId={entry.id} selfReviewed={isSelfReviewed(entry.timelineEvents)} />
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                title="Edit Today's DSM"
                aria-label="Edit Today's DSM"
                className="rounded-full border bg-card p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pencil size={16} />
              </button>
            )}
          </div>
        }
      />
      <KpiCards stats={kpiStats} />
    </>
  );
}
