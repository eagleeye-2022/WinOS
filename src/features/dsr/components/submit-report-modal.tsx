"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { validateRecordingUrl, isReportLate, formatMinutes, type ReportConfig } from "../reporting";

export type { ReportConfig };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateStr: string;
  config: ReportConfig;
  /** True when editing an already-submitted report (lateness is then fixed by the first submit). */
  isEdit: boolean;
  completedCount: number;
  totalCount: number;
  totalLoggedMinutes: number;
  /** Zoho Cliq / WorkDrive link to the member's recording — required to submit. */
  recordingUrl: string;
  onRecordingUrl: (v: string) => void;
  dayFeedback: string;
  onDayFeedback: (v: string) => void;
  suggestions: string;
  onSuggestions: (v: string) => void;
  resultOfDay: string;
  onSubmit: () => void;
  pending: boolean;
  serverError?: string;
};

const STEPS = ["Zoho Cliq Link", "Feedback", "Confirm"] as const;

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
  // dayFeedback / onDayFeedback are still accepted but unused while "How was the day?" is hidden.
  suggestions,
  onSuggestions,
  resultOfDay,
  onSubmit,
  pending,
  serverError,
}: Props) {
  const [step, setStep] = useState(0);
  const [touchedLink, setTouchedLink] = useState(false);

  const linkCheck = validateRecordingUrl(recordingUrl, config.allowedHosts);
  const lateNow = !isEdit && isReportLate(dateStr, new Date(), config.cutoff, config.cutoffDayOffset);
  const outcomeMissing = !resultOfDay.trim();

  const canNext = step === 0 ? linkCheck.ok : step === 1 ? true : linkCheck.ok && !outcomeMissing;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"
        // No description while the instructions text is hidden (silences Radix's a11y warning).
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Update End-of-Day Report" : "Submit End-of-Day Report"}</DialogTitle>
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

        {step === 0 && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Video size={13} /> Zoho Cliq link <span className="text-destructive">*</span>
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
              // Zoho links are the only thing that opens in a new tab.
              <a
                href={linkCheck.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit items-center gap-1 text-xs text-primary hover:underline"
              >
                Open link to check it <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

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
            <dt className="text-muted-foreground">Zoho Cliq link</dt>
            <dd className="truncate font-medium">
              {linkCheck.ok ? linkCheck.url : <span className="text-destructive">Missing</span>}
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
              onClick={onSubmit}
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
