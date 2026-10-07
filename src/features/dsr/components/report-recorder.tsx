"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, Circle, Download, Loader2, Mic, MicOff, MonitorUp, PictureInPicture2, RotateCcw, Square, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { REPORT_WALKTHROUGH_PROMPTS } from "../reporting";

// Screen recorder for the end-of-day report, with an optional camera and microphone.
//
// The screen (+ mic, if on) is recorded directly with MediaRecorder. The camera, if on, is shown in an
// always-on-top Picture-in-Picture window, so it is captured as part of the screen when the member
// shares their *entire screen*. We deliberately don't composite onto a <canvas>: browsers throttle
// timers/rAF in background tabs, which would freeze the recording while the member presents another
// window. Each step is its own click because getUserMedia, PiP and getDisplayMedia all need a fresh
// user gesture.

type Phase = "idle" | "ready" | "recording" | "done";

// The Document Picture-in-Picture API isn't in the TS DOM lib yet.
type DocumentPip = { requestWindow: (opts: { width: number; height: number }) => Promise<Window> };

function getDocumentPip(): DocumentPip | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture ?? null;
}

function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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
};

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; percent: number }
  | { status: "done"; key: string }
  | { status: "error"; error: string };

export function ReportRecorder({ dateStr, memberName, onUploaded, savedKey }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pipOpen, setPipOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileExt, setFileExt] = useState("webm");
  // Both optional: the member can record screen only, screen + mic, screen + camera, or all three.
  const [wantCamera, setWantCamera] = useState(true);
  const [wantMic, setWantMic] = useState(true);
  const [hasCamera, setHasCamera] = useState(false);
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const blobRef = useRef<Blob | null>(null);

  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const pipTimerElRef = useRef<HTMLElement | null>(null);
  const startedAtRef = useRef<number>(0);
  const stopRef = useRef<() => void>(() => { });

  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== "undefined";

  // ── Cleanup ────────────────────────────────────────────────────────────────
  function stopTracks(stream: MediaStream | null) {
    stream?.getTracks().forEach((t) => t.stop());
  }

  function closePip() {
    try {
      pipWindowRef.current?.close();
    } catch {
      // ignore
    }
    pipWindowRef.current = null;
    if (typeof document !== "undefined" && document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => { });
    }
    setPipOpen(false);
  }

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      stopTracks(screenStreamRef.current);
      stopTracks(cameraStreamRef.current);
      closePip();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Keep the in-modal camera preview attached.
  useEffect(() => {
    if (previewRef.current && cameraStreamRef.current && phase !== "done") {
      previewRef.current.srcObject = cameraStreamRef.current;
    }
  }, [phase, hasCamera]);

  // Elapsed timer while recording (mirrored into the PiP window).
  useEffect(() => {
    if (phase !== "recording") return;
    const id = window.setInterval(() => {
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(sec);
      if (pipTimerElRef.current) pipTimerElRef.current.textContent = `● REC ${formatElapsed(sec)}`;
    }, 500);
    return () => window.clearInterval(id);
  }, [phase]);

  // ── Step 1: optional camera / mic ────────────────────────────────────────
  async function getReady() {
    setError(null);
    if (!wantCamera && !wantMic) {
      cameraStreamRef.current = null;
      setHasCamera(false);
      setPhase("ready");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: wantCamera ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
        audio: wantMic ? { echoCancellation: true, noiseSuppression: true } : false,
      });
      cameraStreamRef.current = stream;
      setHasCamera(stream.getVideoTracks().length > 0);
      setPhase("ready");
    } catch {
      const what = [wantCamera && "camera", wantMic && "microphone"].filter(Boolean).join(" and ");
      setError(
        "Couldn't access your " + what + ". Allow access in the browser address bar, or turn " +
        (wantCamera && wantMic ? "them" : "it") + " off and record your screen only."
      );
    }
  }

  // ── Step 2: pop the camera out (always-on-top bubble + talking points) ────
  async function openPip() {
    setError(null);
    const cam = cameraStreamRef.current;
    if (!cam) return;
    const docPip = getDocumentPip();
    try {
      if (docPip) {
        const win = await docPip.requestWindow({ width: 340, height: 480 });
        pipWindowRef.current = win;
        const doc = win.document;
        doc.body.style.cssText =
          "margin:0;font-family:system-ui,sans-serif;background:#0b0b0f;color:#f4f4f5;display:flex;flex-direction:column;gap:10px;padding:12px;box-sizing:border-box;";

        const video = doc.createElement("video");
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.srcObject = cam;
        video.style.cssText = "width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px;transform:scaleX(-1);background:#000;";
        doc.body.appendChild(video);

        const timer = doc.createElement("div");
        timer.textContent = "Ready — start screen recording";
        timer.style.cssText = "font-size:12px;font-weight:700;color:#f87171;letter-spacing:.04em;";
        doc.body.appendChild(timer);
        pipTimerElRef.current = timer;

        const list = doc.createElement("ol");
        list.style.cssText = "margin:0;padding-left:18px;font-size:12px;line-height:1.45;color:#d4d4d8;display:flex;flex-direction:column;gap:4px;";
        for (const p of REPORT_WALKTHROUGH_PROMPTS) {
          const li = doc.createElement("li");
          li.textContent = p;
          list.appendChild(li);
        }
        doc.body.appendChild(list);

        const stopBtn = doc.createElement("button");
        stopBtn.textContent = "Stop recording";
        stopBtn.style.cssText = "margin-top:auto;padding:8px;border-radius:8px;border:0;background:#dc2626;color:#fff;font-weight:600;cursor:pointer;";
        stopBtn.onclick = () => stopRef.current();
        doc.body.appendChild(stopBtn);

        win.addEventListener("pagehide", () => {
          pipWindowRef.current = null;
          pipTimerElRef.current = null;
          setPipOpen(false);
        });
        setPipOpen(true);
        return;
      }

      // Fallback: plain video Picture-in-Picture (camera only, no talking points).
      let v = pipVideoRef.current;
      if (!v) {
        v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        pipVideoRef.current = v;
      }
      v.srcObject = cam;
      await v.play();
      await v.requestPictureInPicture();
      v.addEventListener("leavepictureinpicture", () => setPipOpen(false), { once: true });
      setPipOpen(true);
    } catch {
      setError("Couldn't pop out the camera. Your browser may not support Picture-in-Picture — use the latest Chrome or Edge.");
    }
  }

  // ── Step 3: screen recording ─────────────────────────────────────────────
  async function startRecording() {
    setError(null);
    setWarning(null);
    const cam = cameraStreamRef.current;

    let screen: MediaStream;
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor", frameRate: { ideal: 15, max: 30 } } as MediaTrackConstraints,
        audio: false,
      });
    } catch {
      setError("Screen sharing was cancelled. Click Start screen recording and pick your entire screen.");
      return;
    }
    screenStreamRef.current = screen;

    const screenTrack = screen.getVideoTracks()[0];
    const surface = (screenTrack.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface;
    if (hasCamera && surface && surface !== "monitor") {
      setWarning("You're sharing a single window/tab — your camera bubble won't be in the video. Stop and share your entire screen to include it.");
    }

    const mixed = new MediaStream([...screen.getVideoTracks(), ...(cam?.getAudioTracks() ?? [])]);
    const mimeType = pickMimeType();
    setFileExt(mimeType.includes("mp4") ? "mp4" : "webm");
    const recorder = new MediaRecorder(mixed, {
      ...(mimeType ? { mimeType } : {}),
      // ~1 Mbps keeps a 10-minute walkthrough around 75 MB on the server.
      videoBitsPerSecond: 1_000_000,
    });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      blobRef.current = blob;
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      stopTracks(screenStreamRef.current);
      screenStreamRef.current = null;
      stopTracks(cameraStreamRef.current);
      cameraStreamRef.current = null;
      setHasCamera(false);
      closePip();
      setPhase("done");
      void uploadRecording(blob);
    };
    // If the member clicks the browser's own "Stop sharing", finish the recording.
    screenTrack.addEventListener("ended", () => stopRef.current());

    recorderRef.current = recorder;
    recorder.start(1000);
    startedAtRef.current = Date.now();
    setElapsed(0);
    setPhase("recording");
  }

  // Uploads the finished recording to our server (streamed to disk by /api/report-recordings).
  // XHR rather than fetch so we can show upload progress.
  function uploadRecording(blob: Blob) {
    const contentType = blob.type.includes("mp4") ? "video/mp4" : "video/webm";
    setUpload({ status: "uploading", percent: 0 });
    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/report-recordings?date=${encodeURIComponent(dateStr)}`);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUpload({ status: "uploading", percent: Math.round((e.loaded / e.total) * 100) });
      };
      xhr.onload = () => {
        let body: { key?: string; error?: string } = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // non-JSON error page
        }
        if (xhr.status >= 200 && xhr.status < 300 && body.key) {
          setUpload({ status: "done", key: body.key });
          onUploaded(body.key);
        } else {
          setUpload({ status: "error", error: body.error ?? `Upload failed (${xhr.status})` });
        }
        resolve();
      };
      xhr.onerror = () => {
        setUpload({ status: "error", error: "Upload failed. Check your connection and retry." });
        resolve();
      };
      xhr.send(blob);
    });
  }

  function stopRecording() {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
  }

  // The PiP "Stop" button and the browser's "Stop sharing" call through this ref.
  useEffect(() => {
    stopRef.current = stopRecording;
  });

  function reset() {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    blobRef.current = null;
    setUpload({ status: "idle" });
    onUploaded(null);
    setElapsed(0);
    setWarning(null);
    setError(null);
    setPhase("idle");
  }

  const fileName = `report-${(memberName ?? "member").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dateStr}.${fileExt}`;

  if (!supported) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
        Your browser can&apos;t record the screen. Use the latest Chrome or Edge on a desktop, or record with
        Zoho Cliq&apos;s own screen recorder and use &ldquo;Paste a link&rdquo;.
      </div>
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
                <Circle size={8} className="fill-current" /> {formatElapsed(elapsed)}
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
              onClick={() => setWantCamera((v) => !v)}
              aria-pressed={wantCamera}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                wantCamera ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              )}
            >
              {wantCamera ? <Camera size={13} /> : <CameraOff size={13} />} Camera {wantCamera ? "on" : "off"}
            </button>
            <button
              type="button"
              onClick={() => setWantMic((v) => !v)}
              aria-pressed={wantMic}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                wantMic ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              )}
            >
              {wantMic ? <Mic size={13} /> : <MicOff size={13} />} Microphone {wantMic ? "on" : "off"}
            </button>
            <span className="self-center text-xs text-muted-foreground">Both optional</span>
          </div>
          <button
            type="button"
            onClick={getReady}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {wantCamera || wantMic ? (
              <>
                {wantCamera ? <Camera size={16} /> : <Mic size={16} />} 1. Turn on {[wantCamera && "camera", wantMic && "mic"].filter(Boolean).join(" & ")}
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
              onClick={openPip}
              disabled={pipOpen}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold",
                pipOpen ? "border-success/40 bg-success/10 text-success" : "hover:bg-accent"
              )}
            >
              <PictureInPicture2 size={16} /> {pipOpen ? "Camera popped out" : "2. Pop out camera"}
            </button>
          )}
          <button
            type="button"
            onClick={startRecording}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <MonitorUp size={16} /> {hasCamera ? "3." : "2."} Start screen recording
          </button>
        </div>
      )}

      {phase === "ready" && hasCamera && !pipOpen && (
        <p className="text-xs text-muted-foreground">
          Pop out your camera first, then share your <strong>entire screen</strong>, so your camera is in the video.
        </p>
      )}

      {phase === "recording" && (
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          <Square size={14} className="fill-current" /> Stop recording ({formatElapsed(elapsed)})
        </button>
      )}

      {phase === "done" && videoUrl && (
        <div className="flex flex-col gap-2">
          <video src={videoUrl} controls className="max-h-56 w-full rounded-lg border bg-black" />
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
                onClick={() => blobRef.current && void uploadRecording(blobRef.current)}
                className="flex items-center gap-1 rounded border border-destructive/40 px-2 py-0.5 font-semibold hover:bg-destructive/10"
              >
                <UploadCloud size={12} /> Retry upload
              </button>
              <span className="text-muted-foreground">or download it and use &ldquo;Paste a link&rdquo; instead.</span>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={videoUrl}
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

      {warning && <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-foreground">{warning}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
