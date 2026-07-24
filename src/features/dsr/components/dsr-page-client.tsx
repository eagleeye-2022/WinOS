"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { DsrForm } from "./dsr-form";
import { InsightsPanel } from "./insights-panel";
import { DsrHistory } from "./dsr-history";
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
}: Props) {
  const submitFnRef = useRef<() => void>(() => { });
  const [, forceRender] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [rightTab, setRightTab] = useState<"insights" | "notes">("insights");

  // Show form when no entry, when it's a draft, or right after submission (so user sees submitted data)
  const canSubmit = !entry || entry.status === "DRAFT";
  const canEditExisting = entry?.status === "SUBMITTED" || entry?.status === "PENDING_REVIEW";
  const editable = canSubmit || isEditing;
  const showForm = editable || justSubmitted;
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
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Evening Review
            </p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight">{formatFullDate(now)}</h1>
          </div>

          {(cp > 0 || !canSubmit) && (
            <div className="flex items-center divide-x divide-border rounded-lg border bg-card shadow-sm">
              <div className="flex flex-col items-center px-5 py-3 text-center">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Completion
                </span>
                <span className="text-2xl font-bold text-primary">{cp}%</span>
              </div>
              <div className="flex flex-col items-center px-5 py-3 text-center">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Tasks
                </span>
                <span className="text-2xl font-bold">{ct}/{pt}</span>
              </div>
            </div>
          )}
        </div>

        {/* Success banner */}
        {justSubmitted && (
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

        {showForm ? (
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
            {canEditExisting && (
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
      <aside className="w-80 shrink-0 overflow-hidden border-l xl:w-96 flex flex-col bg-card">
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
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
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
              showSubmitButton={editable}
              onSubmit={editable ? handlePanelSubmit : undefined}
            />
          ) : (
            <WorkspaceNotesPanel
              sharedNotes={sharedNotes}
              userRole={userRole}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
