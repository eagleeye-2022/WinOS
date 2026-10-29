"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, LogIn, MapPin, RefreshCw, X } from "lucide-react";
import { lookupPlaceAction, type CheckInLocation } from "../actions/attendance-actions";
import { cn } from "@/lib/utils";

export interface CheckInCapture {
  location: CheckInLocation;
  /** URL from POST /api/uploads. */
  photo: string;
}

interface CheckInCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the uploaded selfie and the GPS fix; should run checkInAction / checkOutAction. Return an error message to show it. */
  onConfirm: (capture: CheckInCapture) => Promise<string | null | void>;
  title?: string;
  /** Wording only — both capture the same photo + location. */
  mode?: "check-in" | "check-out";
}

type Place = { name: string; address: string };

type LocationState =
  /** `best` is the most accurate reading so far, while waiting for a better one. */
  | { status: "locating"; best?: CheckInLocation }
  /** `place`: undefined while looking up the area name, null when none was found. */
  | { status: "ready"; location: CheckInLocation; place?: Place | null }
  | { status: "error"; message: string };

/** Stop waiting as soon as a reading is this good (metres). */
const GOOD_ACCURACY_M = 100;
/** Worst reading accepted — keep in sync with MAX_LOCATION_ACCURACY_M in checkInAction. */
const MAX_ACCURACY_M = 1000;
/** How long to wait for the device to improve its fix. */
const LOCATE_TIMEOUT_MS = 20_000;

function formatDistance(m: number): string {
  return m >= 1000 ? `${Math.round(m / 1000).toLocaleString("en-IN")} km` : `${Math.round(m)} m`;
}

function impreciseMessage(best: CheckInLocation | null): string {
  const rough = best?.accuracy ? `Your location is only accurate to ±${formatDistance(best.accuracy)} — ` : "";
  return (
    `${rough}that's a rough guess, not a real location. On a computer, turn on Location services ` +
    `(Windows: Settings → Privacy & security → Location) and allow precise location for this browser, ` +
    `then try again — or check in from your phone.`
  );
}

function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was blocked. Allow the camera for this site in your browser settings, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  return "Couldn't start the camera.";
}

function locationErrorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) {
    return "Location access was blocked. Allow location for this site in your browser settings, then try again.";
  }
  if (err.code === err.TIMEOUT) return "Getting your location took too long. Try again.";
  return "Couldn't get your location. Check that location services are on.";
}

async function uploadSelfie(blob: Blob): Promise<string> {
  const body = new FormData();
  body.append("file", new File([blob], `checkin-selfie.jpg`, { type: "image/jpeg" }));
  const res = await fetch("/api/uploads", { method: "POST", body });
  const json = (await res.json().catch(() => null)) as { fileUrl?: string; error?: string } | null;
  if (!res.ok || !json?.fileUrl) throw new Error(json?.error || "Couldn't upload the photo.");
  return json.fileUrl;
}

/**
 * Check-in capture: a live selfie from the front camera plus the browser's GPS fix.
 * Both are required — the server refuses a check-in without them.
 * Camera and location only work on HTTPS (or localhost).
 */
export function CheckInCaptureModal({ isOpen, onClose, onConfirm, title, mode = "check-in" }: CheckInCaptureModalProps) {
  const verb = mode === "check-out" ? "check-out" : "check-in";
  const heading = title ?? (mode === "check-out" ? "Check-out" : "Check-in");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchRef = useRef<number | null>(null);
  const locateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [locationState, setLocationState] = useState<LocationState>({ status: "locating" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser can't use the camera here. Open WinOS over HTTPS in a modern browser.");
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch (err) {
      setCameraError(cameraErrorMessage(err));
    }
  }, [stopCamera]);

  const stopLocating = useCallback(() => {
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    watchRef.current = null;
    if (locateTimerRef.current) clearTimeout(locateTimerRef.current);
    locateTimerRef.current = null;
  }, []);

  /** Accepts a fix and looks up its area name (cached server-side, so check-in reuses it). */
  const accept = useCallback(
    (location: CheckInLocation) => {
      stopLocating();
      setLocationState({ status: "ready", location });
      lookupPlaceAction(location)
        .then((place) =>
          setLocationState((s) => (s.status === "ready" && s.location === location ? { ...s, place: place ?? null } : s))
        )
        .catch(() =>
          setLocationState((s) => (s.status === "ready" && s.location === location ? { ...s, place: null } : s))
        );
    },
    [stopLocating]
  );

  // Watches the position (the first reading is often a coarse Wi-Fi/IP guess) and keeps the best one:
  // done early at ±GOOD_ACCURACY_M, otherwise after LOCATE_TIMEOUT_MS if it's within ±MAX_ACCURACY_M.
  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState({ status: "error", message: "This browser can't share your location." });
      return;
    }
    stopLocating();
    setLocationState({ status: "locating" });
    let best: CheckInLocation | null = null;

    const settle = () => {
      if (best && Number(best.accuracy) <= MAX_ACCURACY_M) accept(best);
      else {
        stopLocating();
        setLocationState({ status: "error", message: impreciseMessage(best) });
      }
    };

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const reading = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
        if (!best || reading.accuracy < Number(best.accuracy)) best = reading;
        if (reading.accuracy <= GOOD_ACCURACY_M) accept(reading);
        else setLocationState({ status: "locating", best });
      },
      (err) => {
        if (err.code === err.TIMEOUT || best) settle();
        else {
          stopLocating();
          setLocationState({ status: "error", message: locationErrorMessage(err) });
        }
      },
      { enableHighAccuracy: true, timeout: LOCATE_TIMEOUT_MS, maximumAge: 0 }
    );
    locateTimerRef.current = setTimeout(settle, LOCATE_TIMEOUT_MS);
  }, [accept, stopLocating]);

  // Start camera + location when opened; release both when closed or unmounted.
  useEffect(() => {
    if (!isOpen) return;
    setPhoto(null);
    setSubmitError(null);
    startCamera();
    locate();
    return () => {
      stopCamera();
      stopLocating();
    };
  }, [isOpen, startCamera, locate, stopCamera, stopLocating]);

  // The <video> is only mounted while there's no photo, so (re)attach the stream once it exists.
  useEffect(() => {
    const video = videoRef.current;
    if (photo || !cameraReady || !video || !streamRef.current) return;
    if (video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
  }, [photo, cameraReady]);

  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.preview) : undefined), [photo]);

  if (!isOpen) return null;

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror, so the saved photo matches the preview the person saw.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPhoto({ blob, preview: URL.createObjectURL(blob) });
        stopCamera();
      },
      "image/jpeg",
      0.85
    );
  };

  const retake = () => {
    setPhoto(null);
    startCamera();
  };

  const close = () => {
    stopCamera();
    onClose();
  };

  const confirm = async () => {
    if (!photo || locationState.status !== "ready") return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const photoUrl = await uploadSelfie(photo.blob);
      const error = await onConfirm({ photo: photoUrl, location: locationState.location });
      if (error) setSubmitError(error);
      else close();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : `The ${verb} failed. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canConfirm = Boolean(photo) && locationState.status === "ready" && !isSubmitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-foreground">{heading}</h3>
            <p className="text-xs text-muted-foreground">A photo and your location are recorded with your {verb}.</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Camera / captured photo */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.preview} alt="Your check-in photo" className="h-full w-full object-cover" />
            ) : (
              <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            )}
            {!photo && !cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center text-white/80">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white">
                <Camera className="h-6 w-6 opacity-70" />
                <p>{cameraError}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="rounded-lg border border-white/40 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            {photo ? (
              <button
                type="button"
                onClick={retake}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retake
              </button>
            ) : (
              <button
                type="button"
                onClick={capture}
                disabled={!cameraReady}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" /> Take photo
              </button>
            )}
          </div>

          {/* Location */}
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3 text-xs",
              locationState.status === "error" && "border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30"
            )}
          >
            <MapPin
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                locationState.status === "ready" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
              )}
            />
            <div className="min-w-0 flex-1">
              {locationState.status === "locating" && (
                <>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {locationState.best ? "Improving location accuracy…" : "Getting your location…"}
                  </p>
                  {locationState.best?.accuracy !== undefined && (
                    <p className="mt-0.5 text-muted-foreground">
                      Currently ±{formatDistance(locationState.best.accuracy)}
                    </p>
                  )}
                </>
              )}
              {locationState.status === "ready" && (
                <>
                  {locationState.place === undefined ? (
                    <p className="flex items-center gap-2 font-semibold text-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding your area…
                    </p>
                  ) : locationState.place ? (
                    <>
                      <p className="font-semibold text-foreground">{locationState.place.name}</p>
                      <p className="text-muted-foreground">{locationState.place.address}</p>
                    </>
                  ) : (
                    <p className="font-semibold text-foreground">Area name not found</p>
                  )}
                  <p className="mt-0.5 text-muted-foreground">
                    {locationState.location.latitude.toFixed(5)}, {locationState.location.longitude.toFixed(5)}
                    {locationState.location.accuracy !== undefined &&
                      ` · ±${formatDistance(locationState.location.accuracy)}`}
                  </p>
                </>
              )}
              {locationState.status === "error" && (
                <>
                  <p className="text-rose-700 dark:text-rose-300">{locationState.message}</p>
                  <button type="button" onClick={locate} className="mt-1 font-semibold text-rose-700 underline dark:text-rose-300">
                    Try again
                  </button>
                </>
              )}
            </div>
          </div>

          {submitError && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{submitError}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-5 py-4">
          <button
            type="button"
            onClick={close}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-600/60 disabled:hover:bg-emerald-600/60"
          >
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
            Confirm {verb}
          </button>
        </div>
      </div>
    </div>
  );
}
