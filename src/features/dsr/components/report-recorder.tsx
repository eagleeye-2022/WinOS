"use client";

import { useEffect, useRef } from "react";
import { Camera, CameraOff, CheckCircle2, Circle, Download, Loader2, Mic, MicOff, MonitorUp, PictureInPicture2, RotateCcw, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { REPORT_WALKTHROUGH_PROMPTS } from "../reporting";
import { formatElapsed, savedRecordingStorageKey, useReportRecording } from "./report-recording-provider";

// Report-page UI for the screen recorder. The recording itself runs in <ReportRecordingProvider>
// (dashboard layout), so it keeps going while the member navigates to other WinOS pages; coming back
// here shows the live state, and a finished upload is handed to the form via `onUploaded`.

type Props = {
  dateStr: string;
  memberName?: string | null;
  /**
   * Called with the server storage key once a recording has uploaded, or null when the member
   * discards it to record again. A saved recording replaces the need for a pasted link.
   */
  onUploaded: (key: string | null) => void;
  /** Key of a recording already saved for this report (editing). */
  savedKey?: string | null;
  /** True while recording or uploading — the report can't be submitted until this is false. */
  onBusyChange?: (busy: boolean) => void;
};

export function ReportRecorder({ dateStr, memberName, onUploaded, savedKey, onBusyChange }: Props) {
  const rec = useReportRecording();
  const { phase, upload, hasCamera, cameraStream, session } = rec;
  const previewRef = useRef<HTMLVideoElement | null>(null);

  // Keep callbacks in refs so effects only fire on real state changes.
  const onUploadedRef = useRef(onUploaded);
  const onBusyChangeRef = useRef(onBusyChange);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
    onBusyChangeRef.current = onBusyChange;
  });

  // A recording belongs to the report date it was started from.
  const isThisReport = !session || session.dateStr === dateStr;

  // Hand a finished upload to the form — also when returning to this page after navigating away.
  useEffect(() => {
    if (upload.status === "done" && session?.dateStr === dateStr) onUploadedRef.current(upload.key);
  }, [upload, session, dateStr]);

  // After a full reload the context is empty — recover the last uploaded key for this date.
  useEffect(() => {
    if (savedKey || upload.status !== "idle") return;
    try {
      const key = localStorage.getItem(savedRecordingStorageKey(dateStr));
      if (key) onUploadedRef.current(key);
    } catch {
      // storage unavailable
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr]);

  const busy = phase === "recording" || upload.status === "uploading";
  useEffect(() => {
    onBusyChangeRef.current?.(busy);
  }, [busy]);

  // Live camera preview while getting ready / recording.
  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = cameraStream;
  }, [cameraStream, phase]);

  function reset() {
    rec.reset();
    onUploadedRef.current(null);
  }

  const fileName = `report-${(memberName ?? "member").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dateStr}.${rec.fileExt}`;

  if (!rec.supported) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
        Your browser can&apos;t record the screen. Use the latest Chrome or Edge on a desktop, or record with
        Zoho Cliq&apos;s own screen recorder and use &ldquo;Paste a link&rdquo;.
      </div>
    );
  }

  if (!isThisReport && phase !== "idle") {
    return (
      <p className="rounded-md bg-warning/10 px-3 py-2 text-xs">
        A recording for {session?.dateStr} is in progress. Finish it before recording for this report.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {savedKey && phase === "idle" && (
        <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-success">
            <CheckCircle2 size={14} /> A recording is already saved for this report. Record again only to replace it.
          </p>
          <video src={`/api/report-recordings/${savedKey}`} controls preload="metadata" className="max-h-48 w-full rounded-lg border bg-black" />
        </div>
      )}
      {phase !== "done" && (
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted">
            {!hasCamera ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                <CameraOff size={20} />
                <span className="text-xs">Camera off</span>
              </div>
            ) : (
              <video ref={previewRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
            )}
            {phase === "recording" && (
              <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-destructive px-1.5 py-0.5 text-xs font-bold text-white">
                <Circle size={8} className="fill-current" /> {formatElapsed(rec.elapsed)}
              </span>
            )}
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {REPORT_WALKTHROUGH_PROMPTS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
      )}

      {phase === "idle" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => rec.setWantCamera(!rec.wantCamera)}
              aria-pressed={rec.wantCamera}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                rec.wantCamera ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              )}
            >
              {rec.wantCamera ? <Camera size={13} /> : <CameraOff size={13} />} Camera {rec.wantCamera ? "on" : "off"}
            </button>
            <button
              type="button"
              onClick={() => rec.setWantMic(!rec.wantMic)}
              aria-pressed={rec.wantMic}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                rec.wantMic ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              )}
            >
              {rec.wantMic ? <Mic size={13} /> : <MicOff size={13} />} Microphone {rec.wantMic ? "on" : "off"}
            </button>
            <span className="self-center text-xs text-muted-foreground">Both optional</span>
          </div>
          <button
            type="button"
            onClick={() => rec.getReady({ dateStr, memberName: memberName ?? null })}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {rec.wantCamera || rec.wantMic ? (
              <>
                {rec.wantCamera ? <Camera size={16} /> : <Mic size={16} />} 1. Turn on {[rec.wantCamera && "camera", rec.wantMic && "mic"].filter(Boolean).join(" & ")}
              </>
            ) : (
              <>
                <MonitorUp size={16} /> 1. Continue with screen only
              </>
            )}
          </button>
        </div>
      )}

      {phase === "ready" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {hasCamera && (
            <button
              type="button"
              onClick={rec.openPip}
              disabled={rec.pipOpen}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold",
                rec.pipOpen ? "border-success/40 bg-success/10 text-success" : "hover:bg-accent"
              )}
            >
              <PictureInPicture2 size={16} /> {rec.pipOpen ? "Camera popped out" : "2. Pop out camera"}
            </button>
          )}
          <button
            type="button"
            onClick={rec.startRecording}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <MonitorUp size={16} /> {hasCamera ? "3." : "2."} Start screen recording
          </button>
        </div>
      )}

      {phase === "ready" && hasCamera && !rec.pipOpen && (
        <p className="text-xs text-muted-foreground">
          Pop out your camera first, then share your <strong>entire screen</strong>, so your camera is in the video.
        </p>
      )}

      {phase === "recording" && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-foreground">
          Recording… You can move between WinOS pages or use any other window; the recording keeps going.
          Stop from the floating bar in the bottom-right corner{hasCamera ? ", the camera pop-out" : ""} or your
          browser&apos;s &ldquo;Stop sharing&rdquo; button.
        </p>
      )}

      {phase === "done" && rec.videoUrl && (
        <div className="flex flex-col gap-2">
          <video src={rec.videoUrl} controls className="max-h-56 w-full rounded-lg border bg-black" />
          {upload.status === "uploading" && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Loader2 size={13} className="animate-spin" /> Saving recording to WinOS… {upload.percent}%
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${upload.percent}%` }} />
              </div>
            </div>
          )}
          {upload.status === "done" && (
            <p className="flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-2 text-xs font-medium text-success">
              <CheckCircle2 size={14} /> Recording saved in WinOS. No link needed; your manager can watch it in your report.
            </p>
          )}
          {upload.status === "error" && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <span>{upload.error}</span>
              <button
                type="button"
                onClick={rec.retryUpload}
                className="flex items-center gap-1 rounded border border-destructive/40 px-2 py-0.5 font-semibold hover:bg-destructive/10"
              >
                <UploadCloud size={12} /> Retry upload
              </button>
              <span className="text-muted-foreground">or download it and use &ldquo;Paste a link&rdquo; instead.</span>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={rec.videoUrl}
              download={fileName}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent"
            >
              <Download size={16} /> Download a copy
            </a>
            <button
              type="button"
              disabled={upload.status === "uploading"}
              onClick={reset}
              className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <RotateCcw size={14} /> Record again
            </button>
          </div>
        </div>
      )}

      {rec.warning && <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-foreground">{rec.warning}</p>}
      {rec.error && <p className="text-xs text-destructive">{rec.error}</p>}
    </div>
  );
}
