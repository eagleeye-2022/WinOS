"use client";

/**
 * Re-opens the "Timer stopped" modal for a stopped timer whose effort log was never saved or
 * discarded (page refreshed / tab closed / navigated away / save failed). Mounted once in the
 * dashboard layout. See utils/pending-timer-log.ts.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TimerStoppedModal } from "./modals/timer-stopped-modal";
import { createTimeLogAction } from "../actions/project-actions";
import { formatTimePeriodRange } from "../utils/time-helpers";
import {
  PENDING_TIMER_LOG_EVENT,
  clearPendingTimerLog,
  readPendingTimerLog,
  setCurrentTimerUserId,
  type PendingTimerLog,
} from "../utils/pending-timer-log";
import { toast } from "@/components/shared/toast";
import type { TimeLogEntry } from "../types";

export function PendingTimerLogRecovery({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingTimerLog | null>(null);
  const isSavingRef = useRef(false);

  const check = useCallback(() => {
    const log = readPendingTimerLog();
    if (!log) return;
    if (log.userId && log.userId !== userId) {
      // Parked by someone else who used this browser — never show or log it as this user.
      clearPendingTimerLog();
      return;
    }
    setPending(log);
  }, [userId]);

  useEffect(() => {
    setCurrentTimerUserId(userId);
  }, [userId]);

  // On first load and on every navigation (the page that owned the modal is gone by then).
  useEffect(() => {
    check();
  }, [check, pathname]);

  useEffect(() => {
    window.addEventListener(PENDING_TIMER_LOG_EVENT, check);
    return () => window.removeEventListener(PENDING_TIMER_LOG_EVENT, check);
  }, [check]);

  const handleSaveLog = async (data: {
    duration: string;
    date: string;
    startTime: string;
    endTime: string;
    isBillable: boolean;
    notes: string;
  }) => {
    if (!pending || isSavingRef.current) return;
    isSavingRef.current = true;
    const log = pending;
    try {
      const payload: Partial<TimeLogEntry> = {
        taskCode: log.taskCode || log.taskId,
        projectId: log.projectId,
        duration: data.duration,
        billingType: data.isBillable ? "BILLABLE" : "NON BILLABLE",
        remarks: data.notes,
        timePeriod: formatTimePeriodRange(data.startTime, data.endTime),
        date: data.date,
      };
      await createTimeLogAction(payload, log.projectId);
      clearPendingTimerLog();
      toast.success(`Time logged on "${log.taskTitle || log.taskCode || "task"}".`);
    } catch (err) {
      console.error("[PendingTimerLogRecovery] createTimeLogAction failed:", err);
      toast.error("Couldn't save the time log. Please try again.");
      setPending(log); // keep it parked and show the modal again
    } finally {
      isSavingRef.current = false;
    }
  };

  return (
    <TimerStoppedModal
      isOpen={!!pending}
      onClose={() => {
        // Closing with X counts as dismissing, same as the regular stop modal — but never while
        // a save is in flight (the modal calls onClose right after onSaveLog).
        if (!isSavingRef.current) clearPendingTimerLog();
        setPending(null);
      }}
      initialStartTime={pending ? new Date(pending.startedAt) : undefined}
      initialEndTime={pending ? new Date(pending.endedAt) : undefined}
      elapsedSeconds={pending?.elapsedSeconds ?? 0}
      taskTitle={pending?.taskTitle}
      taskCode={pending?.taskCode}
      onSaveLog={handleSaveLog}
      onDiscardLog={() => {
        clearPendingTimerLog();
        setPending(null);
      }}
    />
  );
}
