"use client";

import { useState } from "react";
import { Check, CheckCircle2, ExternalLink, Link2, Loader2, MonitorUp, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { validateRecordingUrl, isReportLate, formatMinutes, type ReportConfig } from "../reporting";

export type { ReportConfig };

/** How the member provides the recording: record it here (stored in WinOS) or paste a link. */
export type RecordingMode = "record" | "link";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateStr: string;
  memberName?: string | null;
  config: ReportConfig;
  /** True when editing an already-submitted report (lateness is then fixed by the first submit). */
  isEdit: boolean;
  completedCount: number;
  totalCount: number;
  totalLoggedMinutes: number;
  recordingUrl: string;
  onRecordingUrl: (v: string) => void;
  /** Server storage key of a recording made with the on-page recorder ("" when none). */
  recordingFile: string;
  /** Closes this popup and scrolls to the on-page recorder (recording happens outside the popup). */
  onRecordNow: () => void;
  dayFeedback: string;
  onDayFeedback: (v: string) => void;
  suggestions: string;
  onSuggestions: (v: string) => void;
  resultOfDay: string;
  /** Submits with only the chosen recording kind (the other is sent empty). */
  onSubmit: (mode: RecordingMode) => void;
  pending: boolean;
  serverError?: string;
};

const STEPS = ["Recording", "Feedback", "Confirm"] as const;

export function SubmitReportModal({
  open,
  onOpenChange,
  dateStr,
  config,
  isEdit,
  completedCount,
  totalCount,
  totalLoggedMinutes,
  recordingUrl,
  onRecordingUrl,
  recordingFile,
  onRecordNow,
  // dayFeedback / onDayFeedback are still accepted but unused while "How was the day?" is hidden.
  suggestions,
  onSuggestions,
  resultOfDay,
  onSubmit,
  pending,
  serverError,
}: Props) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<RecordingMode>(recordingFile ? "record" : recordingUrl ? "link" : "record");
  const [touchedLink, setTouchedLink] = useState(false);

  const linkCheck = validateRecordingUrl(recordingUrl, config.allowedHosts);
  const lateNow = !isEdit && isReportLate(dateStr, new Date(), config.cutoff);
  const outcomeMissing = !resultOfDay.trim();

  // Recorded here → no link needed. Not recorded here → a valid link is required.
  const hasRecording = mode === "record" ? !!recordingFile : linkCheck.ok;

  const canNext = step === 0 ? hasRecording : step === 1 ? true : hasRecording && !outcomeMissing;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"
        // Clicking outside while recording would lose the recorder — require an explicit close.
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        // No description while the instructions text below is hidden (silences Radix's a11y warning).
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Update End-of-Day Report" : "Submit End-of-Day Report"}</DialogTitle>
          {/* Instructions text hidden for now.
          <DialogDescription>
            Walk through your day on screen. Record it right here (camera and mic optional), or paste a link to a
            recording you made elsewhere. Report cut-off: {config.cutoffLabel}.
          </DialogDescription>
          */}
        </DialogHeader>

        {/* Stepper */}
        <ol className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  i < step ? "bg-success text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {i < step ? <Check size={12} /> : i + 1}
              </span>
              <span className={cn("text-xs font-semibold", i === step ? "text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>

        {lateNow && (
          <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
            It&apos;s past the {config.cutoffLabel} cut-off — this report will be marked <strong>Late</strong>.
          </p>
        )}

        {/* Step 1: choose how to provide the recording */}
        <div className={cn("flex flex-col gap-3", step !== 0 && "hidden")}>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {([
              ["record", "Record here", MonitorUp],
              ["link", "Paste a link", Link2],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold transition-colors",
                  mode === value ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {/* The recorder itself is on the report page ("Screen Recording" card), not in this popup, so
              it never covers the screen being recorded and closing the popup can't stop a recording. */}
          {mode === "record" && recordingFile && (
            <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                <CheckCircle2 size={14} /> Your recording is saved in WinOS. No link needed.
              </p>
              <video
                src={`/api/report-recordings/${recordingFile}`}
                controls
                preload="metadata"
                className="max-h-48 w-full rounded-lg border bg-black"
              />
              <button
                type="button"
                onClick={onRecordNow}
                className="w-fit text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
              >
                Record again
              </button>
            </div>
          )}

          {mode === "link" && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Video size={13} /> Recording link (Zoho Cliq / WorkDrive) <span className="text-destructive">*</span>
              </label>
              <input
                type="url"
                value={recordingUrl}
                onChange={(e) => onRecordingUrl(e.target.value)}
                onBlur={() => setTouchedLink(true)}
                placeholder="https://cliq.zoho.in/…"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {(touchedLink || recordingUrl) && !linkCheck.ok && (
                <p className="text-xs text-destructive">{linkCheck.error}</p>
              )}
              {linkCheck.ok && (
                <a
                  href={linkCheck.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-fit items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open link to check it <ExternalLink size={11} />
                </a>
              )}
              <p className="text-xs text-muted-foreground">
                Didn&apos;t record here? Then the link is required to submit.
              </p>
            </div>
          )}

          {mode === "record" && !recordingFile && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-5 text-center">
              <p className="text-sm text-muted-foreground">
                No recording yet. Record on the report page so this popup doesn&apos;t cover your screen.
                Then click Submit Report again. No link needed.
              </p>
              <button
                type="button"
                onClick={onRecordNow}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <MonitorUp size={15} /> Go to recorder
              </button>
            </div>
          )}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-3">
            {/* "How was the day?" is hidden for now — kept (with the dayFeedback field) so it can be re-enabled.
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                How was the day?
              </label>
              <textarea
                value={dayFeedback}
                onChange={(e) => onDayFeedback(e.target.value)}
                rows={3}
                placeholder="Productive, stuck on X, lots of meetings…"
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Any feedback or suggestions?
              </label>
              <textarea
                value={suggestions}
                onChange={(e) => onSuggestions(e.target.value)}
                rows={3}
                placeholder="Process, tools, team, anything"
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <dt className="text-muted-foreground">Tasks</dt>
            <dd className="font-medium">{completedCount}/{totalCount} done</dd>
            <dt className="text-muted-foreground">Time logged</dt>
            <dd className="font-medium">{formatMinutes(totalLoggedMinutes)}</dd>
            <dt className="text-muted-foreground">Outcome</dt>
            <dd className={cn("font-medium", outcomeMissing && "text-destructive")}>
              {outcomeMissing ? "Missing. Close this and fill Outcome of the Day." : resultOfDay}
            </dd>
            <dt className="text-muted-foreground">Recording</dt>
            <dd className="truncate font-medium">
              {mode === "record" && recordingFile ? (
                <span className="flex items-center gap-1 text-success"><CheckCircle2 size={13} /> Saved in WinOS</span>
              ) : mode === "link" && linkCheck.ok ? (
                linkCheck.url
              ) : (
                <span className="text-destructive">Missing</span>
              )}
            </dd>
            {/* {dayFeedback.trim() && (
              <>
                <dt className="text-muted-foreground">How was the day</dt>
                <dd>{dayFeedback}</dd>
              </>
            )} */}
            {suggestions.trim() && (
              <>
                <dt className="text-muted-foreground">Suggestions</dt>
                <dd>{suggestions}</dd>
              </>
            )}
          </dl>
        )}

        {serverError && <p className="text-xs text-destructive">{serverError}</p>}

        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <button
            type="button"
            disabled={step === 0 || pending}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-40"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => {
                if (step === 0) setTouchedLink(true);
                setStep((s) => s + 1);
              }}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={!canNext || pending}
              onClick={() => onSubmit(mode)}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              {pending ? "Submitting…" : isEdit ? "Save & Re-post" : "Submit Report"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
