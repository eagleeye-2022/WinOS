"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlarmClock, LogIn, LogOut, X } from "lucide-react";
import {
  checkInAction,
  checkOutAction,
  getMyCheckInStatusAction,
  type MyCheckInStatus,
} from "../actions/attendance-actions";
import { CheckInCaptureModal } from "./check-in-capture-modal";
import { cn } from "@/lib/utils";

/** How often the "you haven't checked in" reminder comes back. */
const REMINDER_INTERVAL_MS = 5 * 60_000;
/** How often to check whether the reminder is due. */
const REMINDER_TICK_MS = 30_000;
/** Shared by every open WinOS tab, so the reminder shows once per interval, not once per tab. */
const REMINDER_LAST_SHOWN_KEY = "winos:checkin-reminder:last-shown";

function readLastShown(): number {
  try {
    return Number(localStorage.getItem(REMINDER_LAST_SHOWN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastShown(at: number) {
  try {
    localStorage.setItem(REMINDER_LAST_SHOWN_KEY, String(at));
  } catch {
    // Private mode / blocked storage: the reminder still works in this tab.
  }
}

/**
 * Check-in / check-out from the top bar, on every module (Standup, Pulse, Srijan…). Uses the same
 * selfie capture and actions as Pulse Home, so all attendance views stay in sync. On a working day,
 * until the person has checked in, a reminder pops up every 5 minutes.
 */
export function CheckInChip() {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<MyCheckInStatus | null>(null);
  const [captureMode, setCaptureMode] = useState<"check-in" | "check-out" | null>(null);
  const [workMode, setWorkMode] = useState<"OFFICE" | "REMOTE">("REMOTE");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [, startRefresh] = useTransition();

  const loadStatus = useCallback(async () => {
    const next = await getMyCheckInStatusAction().catch(() => null);
    setStatus(next);
    if (next && !next.isLive) setWorkMode(next.workMode);
    return next;
  }, []);

  // Fresh on every page change and when the tab comes back into focus — a check-in made on Pulse
  // Home or in another tab shows up here too.
  useEffect(() => {
    void loadStatus();
  }, [loadStatus, pathname]);
  useEffect(() => {
    const onFocus = () => void loadStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadStatus]);

  // Reminder: re-checked every 30 s; shown when 5 minutes have passed since it last showed (in any tab).
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = captureMode !== null || reminderOpen;
  }, [captureMode, reminderOpen]);
  useEffect(() => {
    if (!status || status.checkedIn || !status.isWorkday) return;
    let cancelled = false;
    const maybeRemind = async () => {
      if (busyRef.current || document.visibilityState !== "visible") return;
      if (Date.now() - readLastShown() < REMINDER_INTERVAL_MS) return;
      // Re-read first: they may have checked in elsewhere since the last load.
      const fresh = await loadStatus();
      if (cancelled || !fresh || fresh.checkedIn || !fresh.isWorkday || busyRef.current) return;
      writeLastShown(Date.now());
      setReminderOpen(true);
    };
    void maybeRemind();
    const id = setInterval(maybeRemind, REMINDER_TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status, loadStatus]);

  // Esc dismisses the reminder.
  useEffect(() => {
    if (!reminderOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setReminderOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reminderOpen]);

  if (!status) return null;

  const live = status.isLive;
  const openCheckIn = () => {
    setReminderOpen(false);
    setCaptureMode("check-in");
  };

  return (
    <>
      {live ? (
        <button
          type="button"
          onClick={() => setCaptureMode("check-out")}
          title="Check out"
          // Checked in: just the Check-out button, sized to its label, in a light tint.
          className="flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Check-out</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openCheckIn}
          title={status.checkedOut ? "Check in again" : "Check in"}
          className="flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
        >
          <LogIn className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{status.checkedOut ? "Check-in again" : "Check-in"}</span>
        </button>
      )}

      <CheckInCaptureModal
        isOpen={captureMode !== null}
        onClose={() => setCaptureMode(null)}
        mode={captureMode ?? "check-in"}
        title={captureMode === "check-out" ? "Check-out" : status.checkedOut ? "Check-in again" : "Check-in"}
        extra={
          // First check-in and "Check-in again" both pick Remote / Office.
          captureMode === "check-in" ? (
            <div className="grid grid-cols-2 rounded-md border border-border/70 bg-muted/50 p-0.5 text-xs font-semibold">
              {(["REMOTE", "OFFICE"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setWorkMode(mode)}
                  className={cn(
                    "rounded px-3 py-1.5 transition-colors",
                    workMode === mode ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode === "OFFICE" ? "Office" : "Remote"}
                </button>
              ))}
            </div>
          ) : null
        }
        onConfirm={async ({ photo, location }) => {
          const res =
            captureMode === "check-out"
              ? await checkOutAction({ source: "Web", photo, location })
              : await checkInAction({ workMode, source: "Web", photo, location });
          if (!res.success) return ("message" in res && res.message) || "That didn't go through. Please try again.";
          await loadStatus();
          const redirectTo = "redirectTo" in res ? res.redirectTo : undefined;
          if (typeof redirectTo === "string") {
            // Checked in: straight to the standup (managers: their own one).
            router.push(redirectTo);
            return null;
          }
          // Refresh whatever page is open (Pulse Home, attendance…) so it shows the new punch.
          startRefresh(() => router.refresh());
          return null;
        }}
      />

      {reminderOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkin-reminder-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                <AlarmClock className="h-5 w-5" />
              </span>
              <button
                type="button"
                onClick={() => setReminderOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1 px-5 pb-5 pt-3">
              <h3 id="checkin-reminder-title" className="text-base font-bold text-foreground">
                You haven&apos;t checked in yet
              </h3>
              <p className="text-sm text-muted-foreground">Check in now to start today&apos;s attendance.</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
              <button
                type="button"
                onClick={() => setReminderOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Remind me in 5 min
              </button>
              <button
                type="button"
                onClick={openCheckIn}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <LogIn className="h-3.5 w-3.5" />
                Check-in now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
