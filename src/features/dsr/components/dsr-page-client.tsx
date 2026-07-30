"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { DsrForm } from "./dsr-form";
import { InsightsPanel } from "./insights-panel";
import { DsrHistory } from "./dsr-history";
import { DsrHistoryCard } from "./dsr-history-card";
import { WorkspaceNotesPanel } from "@/features/dsm/components/workspace-notes-panel";
import type { SharedNoteData } from "@/features/dsm/queries";
import { formatDayHeader, formatFullDate, formatShortDate, toUtcDate } from "@/features/dsm/utils";
import type { DsrEntryData, DsrStandupPrefill, DsrInsights } from "../queries";

type Props = {
  entry: DsrEntryData | null;
  prefill: DsrStandupPrefill;
  weeklyEntries: DsrEntryData[];
  insights: DsrInsights;
  todayDateStr: string;
  weekOffset: number;
  justSubmitted: boolean;
  basePath?: string;
  sharedNotes?: SharedNoteData[];
  userRole?: string;
  dsmReviewed?: boolean;
};

export function DsrPageClient({
  entry,
  prefill,
  weeklyEntries,
  insights,
  todayDateStr,
  weekOffset,
  justSubmitted,
  basePath = "/dsr",
  sharedNotes = [],
  userRole,
  dsmReviewed = true,
}: Props) {
  const submitFnRef = useRef<() => void>(() => { });
  const [, forceRender] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [rightTab, setRightTab] = useState<"insights" | "notes">("insights");

  const isReviewed = entry?.status === "REVIEWED";
  const canSubmit = !entry || entry.status === "DRAFT";
  const isSubmittedNotReviewed = (entry?.status === "SUBMITTED" || entry?.status === "PENDING_REVIEW") && !isReviewed;
  const canEditExisting = isSubmittedNotReviewed;
  const editable = (canSubmit || isSubmittedNotReviewed || isEditing) && dsmReviewed && !isReviewed;
  const showForm = editable || justSubmitted || isReviewed;
  const now = toUtcDate();
  const cp = insights.completionPercent;
  const ct = insights.completedTaskCount;
  const pt = insights.plannedTaskCount;

  function handlePanelSubmit() {
    submitFnRef.current();
  }

  function handleRegisterSubmit(fn: () => void) {
    submitFnRef.current = fn;
    forceRender((n) => n + 1);
  }

  return (
    <div className="flex h-full">
      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{formatDayHeader(now)}</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Evening Review
            </p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight">{formatFullDate(now)}</h1>
          </div>

          {(cp > 0 || !canSubmit) && (
            <div className="flex items-center divide-x divide-border rounded-lg border bg-card shadow-sm">
              <div className="flex flex-col items-center px-5 py-3 text-center">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Completion
                </span>
                <span className="text-2xl font-bold text-primary">{cp}%</span>
              </div>
              <div className="flex flex-col items-center px-5 py-3 text-center">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Tasks
                </span>
                <span className="text-2xl font-bold">{ct}/{pt}</span>
              </div>
            </div>
          )}
        </div>

        {/* DSM-not-reviewed lock banner */}
        {!dsmReviewed && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500">
              <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" className="h-4 w-4">
                <circle cx="5" cy="5" r="4" />
                <path d="M5 3v2.5M5 6.7v.01" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">DSR Locked</p>
              <p className="text-sm text-muted-foreground">
                Your DSM for today must be reviewed by your manager before you can fill out or submit your DSR.
              </p>
            </div>
          </div>
        )}

        {/* Reviewed lock banner */}
        {isReviewed && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white font-bold text-sm">
              ✓
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">DSR Reviewed by Manager</p>
              <p className="text-sm text-muted-foreground">
                This DSR has been reviewed and locked. All fields are in read-only preview mode.
              </p>
            </div>
          </div>
        )}

        {/* Success banner */}
        {justSubmitted && !isReviewed && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500">
              <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" className="h-4 w-4">
                <polyline points="1.5,5 4,7.5 8.5,2.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">DSR Submitted Successfully</p>
              <p className="text-sm text-muted-foreground">
                Your Team Focus Has Been Updated for {formatShortDate(now)}.
              </p>
            </div>
          </div>
        )}

        {isReviewed && entry ? (
          <DsrHistoryCard entry={entry} defaultOpen={true} />
        ) : showForm ? (
          <DsrForm
            entry={entry}
            prefill={prefill}
            todayDateStr={todayDateStr}
            onRegisterSubmit={editable ? handleRegisterSubmit : undefined}
            readOnly={!editable}
            onCancel={isEditing ? () => setIsEditing(false) : undefined}
          />
        ) : (
          <>
            {canEditExisting && dsmReviewed && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Pencil size={13} />
                  Edit Today&apos;s DSR
                </button>
              </div>
            )}
            <DsrHistory entries={weeklyEntries} weekOffset={weekOffset} basePath={basePath} />
          </>
        )}
      </div>

      {/* ── Right Panel (Summary & Workspace Notes Tabs) ─────────────── */}
      <aside className="w-80 shrink-0 border-l xl:w-96 flex flex-col bg-card h-full sticky top-0 overflow-hidden">
        {/* Tab Selector Header */}
        <div className="flex border-b bg-muted/40 p-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setRightTab("insights")}
            className={cn(
              "flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors text-center",
              rightTab === "insights"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Summary & Review
          </button>
          <button
            type="button"
            onClick={() => setRightTab("notes")}
            className={cn(
              "flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors text-center flex items-center justify-center gap-1.5",
              rightTab === "notes"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Workspace Notes</span>
            {sharedNotes.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
                {sharedNotes.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          {rightTab === "insights" ? (
            <InsightsPanel
              insights={insights}
              entry={entry ?? (weeklyEntries[0] ?? null)}
            />
          ) : (
            <WorkspaceNotesPanel
              sharedNotes={sharedNotes}
              userRole={userRole}
            />
          )}
        </div>

        {/* Fixed Submit DSR button footer (visible for all tabs) */}
        {editable && (
          <div className="shrink-0 border-t bg-card p-4 shadow-lg">
            <button
              type="button"
              onClick={handlePanelSubmit}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 shadow-md"
            >
              {isSubmittedNotReviewed || isEditing ? "Save Changes" : "Submit DSR"}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
