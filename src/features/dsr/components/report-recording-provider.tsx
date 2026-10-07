"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Circle, Loader2, Square, UploadCloud, X } from "lucide-react";
import { REPORT_WALKTHROUGH_PROMPTS } from "../reporting";

// App-wide engine for the end-of-day report screen recording.
//
// Mounted once in the dashboard layout, so a recording keeps running while the member moves between
// WinOS pages (DSM, Projects, Tasks…) to walk through their day. A floating bar with the timer and a
// Stop button is shown on every page while recording / uploading. The recording ends only when the
// member clicks Stop (floating bar or camera pop-out) or the browser's own "Stop sharing" — not on
// navigation. The report page's <ReportRecorder> is just the UI over this context.
//
// The screen (+ mic, if on) is recorded directly with MediaRecorder. The camera, if on, is shown in an
// always-on-top Picture-in-Picture window, so it is captured as part of the screen when the member
// shares their *entire screen*. We deliberately don't composite onto a <canvas>: browsers throttle
// timers/rAF in background tabs, which would freeze the recording while the member presents another
// window. Each step is its own click because getUserMedia, PiP and getDisplayMedia all need a fresh
// user gesture.

export type RecorderPhase = "idle" | "ready" | "recording" | "done";

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; percent: number }
  | { status: "done"; key: string }
  | { status: "error"; error: string };

type RecordingSession = { dateStr: string; memberName: string | null };

type RecordingContextValue = {
  supported: boolean;
  phase: RecorderPhase;
  session: RecordingSession | null;
  error: string | null;
  warning: string | null;
  pipOpen: boolean;
  elapsed: number;
  videoUrl: string | null;
  fileExt: string;
  upload: UploadState;
  hasCamera: boolean;
  cameraStream: MediaStream | null;
  wantCamera: boolean;
  setWantCamera: (v: boolean) => void;
  wantMic: boolean;
  setWantMic: (v: boolean) => void;
  getReady: (session: RecordingSession) => Promise<void>;
  openPip: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  retryUpload: () => void;
  reset: () => void;
};

const RecordingContext = createContext<RecordingContextValue | null>(null);

export function useReportRecording(): RecordingContextValue {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("useReportRecording must be used inside <ReportRecordingProvider>");
  return ctx;
}

/** localStorage key remembering the last uploaded recording for a report date (survives reloads). */
export function savedRecordingStorageKey(dateStr: string) {
  return `winos_report_recording_${dateStr}`;
}

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

export function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function ReportRecordingProvider({ children, reportPath }: { children: React.ReactNode; reportPath: string }) {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [session, setSession] = useState<RecordingSession | null>(null);
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
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [stopping, setStopping] = useState(false);
  const [savedBarDismissed, setSavedBarDismissed] = useState(false);
  const [supported, setSupported] = useState(false);

  const sessionRef = useRef<RecordingSession | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const pipTimerElRef = useRef<HTMLElement | null>(null);
  const startedAtRef = useRef<number>(0);
  const stopRef = useRef<() => void>(() => { });

  const pathname = usePathname();
  const onReportPage = pathname === "/report" || pathname === "/report/my";

  // Feature-detect after mount (navigator isn't available during SSR).
  useEffect(() => {
    setSupported(
      !!navigator.mediaDevices?.getUserMedia &&
      !!navigator.mediaDevices?.getDisplayMedia &&
      typeof MediaRecorder !== "undefined"
    );
  }, []);

  const closePip = useCallback(() => {
    try {
      pipWindowRef.current?.close();
    } catch {
      // ignore
    }
    pipWindowRef.current = null;
    pipTimerElRef.current = null;
    if (typeof document !== "undefined" && document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => { });
    }
    setPipOpen(false);
  }, []);

  // Only on leaving the dashboard entirely (logout, etc.) — never on in-app navigation.
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      stopTracks(screenStreamRef.current);
      stopTracks(cameraStreamRef.current);
      closePip();
    };
  }, [closePip]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // A full page reload / tab close would lose the recording — warn first.
  const busy = phase === "recording" || upload.status === "uploading";
  useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy]);

  useEffect(() => {
    if (phase !== "recording") setStopping(false);
  }, [phase]);

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
  async function getReady(next: RecordingSession) {
    setError(null);
    sessionRef.current = next;
    setSession(next);
    if (!wantCamera && !wantMic) {
      cameraStreamRef.current = null;
      setCameraStream(null);
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
      setCameraStream(stream);
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

  // Uploads the finished recording to our server (streamed to disk by /api/report-recordings).
  // XHR rather than fetch so we can show upload progress.
  function uploadRecording(blob: Blob) {
    const dateStr = sessionRef.current?.dateStr ?? "";
    const contentType = blob.type.includes("mp4") ? "video/mp4" : "video/webm";
    setUpload({ status: "uploading", percent: 0 });
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
        try {
          localStorage.setItem(savedRecordingStorageKey(dateStr), body.key);
        } catch {
          // storage unavailable — the report page still gets the key from context
        }
      } else {
        setUpload({ status: "error", error: body.error ?? `Upload failed (${xhr.status})` });
      }
    };
    xhr.onerror = () => setUpload({ status: "error", error: "Upload failed. Check your connection and retry." });
    xhr.send(blob);
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
      setError("Screen sharing was cancelled. Click Start screen recording and pick what to share.");
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
      setCameraStream(null);
      setHasCamera(false);
      closePip();
      setPhase("done");
      setSavedBarDismissed(false);
      uploadRecording(blob);
    };
    // If the member clicks the browser's own "Stop sharing", finish the recording.
    screenTrack.addEventListener("ended", () => stopRef.current());

    recorderRef.current = recorder;
    recorder.start(1000);
    startedAtRef.current = Date.now();
    setElapsed(0);
    setPhase("recording");
  }

  function stopRecording() {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
  }

  // The PiP "Stop" button and the browser's "Stop sharing" call through this ref.
  useEffect(() => {
    stopRef.current = stopRecording;
  });

  function retryUpload() {
    if (blobRef.current) uploadRecording(blobRef.current);
  }

  function reset() {
    const dateStr = sessionRef.current?.dateStr;
    if (dateStr) {
      try {
        localStorage.removeItem(savedRecordingStorageKey(dateStr));
      } catch {
        // ignore
      }
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    blobRef.current = null;
    setUpload({ status: "idle" });
    setElapsed(0);
    setWarning(null);
    setError(null);
    setPhase("idle");
  }

  const value: RecordingContextValue = {
    supported,
    phase,
    session,
    error,
    warning,
    pipOpen,
    elapsed,
    videoUrl,
    fileExt,
    upload,
    hasCamera,
    cameraStream,
    wantCamera,
    setWantCamera,
    wantMic,
    setWantMic,
    getReady,
    openPip,
    startRecording,
    stopRecording,
    retryUpload,
    reset,
  };

  // ── Floating bar (every page) ────────────────────────────────────────────
  let bar: React.ReactNode = null;
  if (phase === "recording") {
    bar = (
      <>
        <span className="flex items-center gap-1.5 text-xs font-bold text-destructive">
          <Circle size={9} className="animate-pulse fill-current" /> REC {formatElapsed(elapsed)}
        </span>
        <button
          type="button"
          disabled={stopping}
          onClick={() => {
            setStopping(true);
            stopRecording();
          }}
          className="flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          <Square size={11} className="fill-current" /> Stop
        </button>
      </>
    );
  } else if (upload.status === "uploading") {
    bar = (
      <span className="flex items-center gap-1.5 pr-2.5 text-xs font-medium">
        <Loader2 size={13} className="animate-spin" /> Saving recording… {upload.percent}%
      </span>
    );
  } else if (upload.status === "error") {
    bar = (
      <>
        <span className="text-xs font-medium text-destructive">Recording not saved</span>
        <button
          type="button"
          onClick={retryUpload}
          className="flex items-center gap-1 rounded-full border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
        >
          <UploadCloud size={12} /> Retry
        </button>
      </>
    );
  } else if (upload.status === "done" && !onReportPage && !savedBarDismissed) {
    bar = (
      <>
        <span className="flex items-center gap-1.5 text-xs font-medium text-success">
          <CheckCircle2 size={13} /> Recording saved
        </span>
        <Link
          href={reportPath}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Back to report
        </Link>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setSavedBarDismissed(true)}
          className="rounded-full p-1 text-muted-foreground hover:bg-accent"
        >
          <X size={13} />
        </button>
      </>
    );
  }

  return (
    <RecordingContext.Provider value={value}>
      {children}
      {/* Portalled to <body> so no popup or page layout covers the controls. */}
      {bar && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-3 rounded-full border bg-background/95 py-1.5 pl-4 pr-1.5 shadow-lg backdrop-blur">
            {bar}
          </div>,
          document.body
        )}
    </RecordingContext.Provider>
  );
}
