"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Play, Pause, Square, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimerStoppedModal } from "./modals/timer-stopped-modal";
import {
  createActiveTimerAction,
  endActiveTimerAction,
  getActiveTimerAction,
} from "../actions/active-timer-actions";
import { createTimeLogAction } from "../actions/project-actions";
import { formatTimePeriodRange } from "../utils/time-helpers";
import { useActiveTimerContext, type ActiveTimerData } from "../context/active-timer-context";
import type { TimeLogEntry } from "../types";

/** Parses a "HH:MM:SS" string into total seconds, or null if malformed. */
function parseHms(value: string): number | null {
  const match = value.trim().match(/^(\d{1,3}):([0-5]?\d):([0-5]?\d)$/);
  if (!match) return null;
  const [, h, m, s] = match;
  return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
}

interface TimerWidgetProps {
  onStopTimer?: (elapsedSeconds: number, formattedTime: string) => void;
  onSaveLog?: (data: {
    duration: string;
    startTime: string;
    endTime: string;
    isBillable: boolean;
    notes: string;
  }) => void;
  className?: string;
  taskTitle?: string;
  taskCode?: string;
  taskId?: string;
  projectId?: string;
  /** When false, the Start control is disabled — e.g. only a task's owner may start its timer. */
  canStart?: boolean;
  disabledReason?: string;
  /** Shows the full "00:00:00 ▶" chip immediately instead of the collapsed clock icon — use on
   *  the single-task workspace header, where there's room and the timer is the focal control. */
  defaultExpanded?: boolean;
}

export function TimerWidget({
  onStopTimer,
  onSaveLog,
  className = "",
  taskTitle,
  taskCode,
  taskId,
  projectId,
  canStart = true,
  disabledReason = "Only the task owner can start this timer",
  defaultExpanded = false,
}: TimerWidgetProps) {
  const [seconds, setSeconds] = useState<number>(0);
  const [timerState, setTimerState] = useState<"IDLE" | "RUNNING" | "PAUSED">("IDLE");
  const [startTimeRef, setStartTimeRef] = useState<Date | undefined>(undefined);
  const [stoppedSeconds, setStoppedSeconds] = useState<number>(0);
  const [isStoppedModalOpen, setIsStoppedModalOpen] = useState<boolean>(false);
  // Collapsed-by-default: the card shows just a clock icon until clicked, then
  // reveals the full timer chip (matches the Zoho-style reference design). Callers with more
  // room (e.g. the task workspace header) can opt into showing the full chip immediately.
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeDraft, setTimeDraft] = useState("00:00:00");
  const isTimerExpanded = isExpanded || timerState !== "IDLE";

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppingRef = useRef<boolean>(false);
  const originalTitleRef = useRef<string | null>(null);
  // Context captured from the DB ActiveTimer row at the moment Stop is clicked
  // (it's deleted immediately at that point) — used to create the real time log
  // once the user confirms details in the stopped-timer modal.
  const stoppedContextRef = useRef<{
    projectId?: string;
    phaseId?: string;
    taskId?: string;
    taskCode?: string;
    billingType?: string;
    startedAt?: string;
    elapsedSeconds?: number;
  } | null>(null);

  // Preferred path: read the current user's active timer from the shared
  // ActiveTimerProvider — one DB poll per page, shared by every task card's
  // TimerWidget, instead of each widget polling independently (which used to
  // fire one getActiveTimerAction() call per visible task card every 30s).
  const activeTimerCtx = useActiveTimerContext();

  const applyDbTimer = useCallback(
    (dbTimer: Pick<ActiveTimerData, "startedAt" | "elapsedSeconds" | "taskId" | "task"> | null) => {
      if (isStoppingRef.current || !dbTimer) return;
      const isCurrentTask =
        !taskCode && !taskId
          ? true
          : dbTimer.task?.code === taskCode ||
            dbTimer.taskId === taskId ||
            dbTimer.taskId === taskCode;

      if (isCurrentTask) {
        setStartTimeRef(new Date(dbTimer.startedAt));
        setSeconds(dbTimer.elapsedSeconds || 0);
        setTimerState("RUNNING");
      }
    },
    [taskCode, taskId]
  );

  useEffect(() => {
    if (!activeTimerCtx) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyDbTimer(activeTimerCtx.activeTimer);
  }, [activeTimerCtx, applyDbTimer]);

  // Fallback: only polls on its own when no ActiveTimerProvider is mounted
  // above this widget.
  useEffect(() => {
    if (activeTimerCtx) return;
    let cancelled = false;

    const syncWithDbActiveTimer = async () => {
      if (isStoppingRef.current || cancelled) return;
      try {
        const res = await getActiveTimerAction();
        if (!cancelled && res.success) {
          applyDbTimer((res.data as ActiveTimerData) ?? null);
        }
      } catch (err) {
        console.error("[TimerWidget] Failed to sync DB active timer:", err);
      }
    };

    syncWithDbActiveTimer();
    pollIntervalRef.current = setInterval(syncWithDbActiveTimer, 30000);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [activeTimerCtx, applyDbTimer]);

  // Local 1-second interval handling when RUNNING
  useEffect(() => {
    if (timerState === "RUNNING") {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState]);

  const handleExpandTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
    if (canStart && timerState === "IDLE") {
      setTimeDraft(formatTime(seconds));
      setIsEditingTime(true);
    }
  };

  const handleStartTimeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerState !== "IDLE") return;
    setTimeDraft(formatTime(seconds));
    setIsEditingTime(true);
  };

  const commitTimeEdit = () => {
    const parsed = parseHms(timeDraft);
    if (parsed !== null) {
      setSeconds(parsed);
    }
    setIsEditingTime(false);
  };

  const handleStart = async () => {
    if (!canStart) return;
    setIsEditingTime(false);
    setIsExpanded(true);

    // A manually-set starting point (via the editable time field) is only
    // meaningful while idle; carry it forward as the local baseline so the
    // display doesn't jump back to 0 the moment Start is pressed.
    const manualSeconds = timerState === "IDLE" ? seconds : 0;

    const startTask = taskCode || taskId;
    if (startTask) {
      const res = await createActiveTimerAction({
        taskId: startTask,
        projectId,
      });

      if (res.success && res.data) {
        const baselineSeconds = manualSeconds > 0 ? manualSeconds : res.data.elapsedSeconds || 0;
        setStartTimeRef(
          manualSeconds > 0
            ? new Date(Date.now() - manualSeconds * 1000)
            : new Date(res.data.startedAt)
        );
        setSeconds(baselineSeconds);
        setTimerState("RUNNING");
        activeTimerCtx?.setLocalActiveTimer(res.data as ActiveTimerData);
        return;
      }
    }

    // Fallback local start
    if (timerState === "IDLE" && manualSeconds === 0) {
      setStartTimeRef(new Date());
    }
    setTimerState("RUNNING");
  };

  const handlePause = () => {
    setTimerState("PAUSED");
  };

  const handleStop = async () => {
    const elapsed = seconds;
    const formatted = formatTime(elapsed);
    isStoppingRef.current = true;
    setTimerState("IDLE");
    setSeconds(0);
    setIsExpanded(false);
    setIsEditingTime(false);
    stoppedContextRef.current = null;

    // Stop the timer everywhere the instant Stop is clicked: delete the DB
    // ActiveTimer row right now rather than waiting on the follow-up modal —
    // whatever happens to that modal (saved, discarded, or just closed with X),
    // the backend/DB no longer has a running timer for this task.
    try {
      const res = await endActiveTimerAction();
      if (res.success && res.data) {
        stoppedContextRef.current = res.data;
      }
    } catch (err) {
      console.error("[TimerWidget] endActiveTimerAction failed:", err);
    } finally {
      activeTimerCtx?.setLocalActiveTimer(null);
    }

    const finalElapsed = stoppedContextRef.current?.elapsedSeconds ?? elapsed;
    setStoppedSeconds(finalElapsed > 0 ? finalElapsed : 60);
    setIsStoppedModalOpen(true);

    if (onStopTimer && elapsed > 0) {
      onStopTimer(elapsed, formatted);
    }
  };

  const handleModalSaveLog = async (data: {
    duration: string;
    startTime: string;
    endTime: string;
    isBillable: boolean;
    notes: string;
  }) => {
    const ctx = stoppedContextRef.current;
    // createTimeLogAction resolves the task by id OR code from this one field,
    // so either identifier works here even though it's typed as `taskCode`.
    const targetTaskCode = ctx?.taskCode || ctx?.taskId || taskCode || taskId;
    const targetProjectId = ctx?.projectId || projectId;

    if (targetTaskCode) {
      try {
        // The ActiveTimer row is already gone (deleted in handleStop) — create
        // the actual ProjectTimeLog now, using the details the user confirmed.
        const payload: Partial<TimeLogEntry> = {
          taskCode: targetTaskCode,
          projectId: targetProjectId,
          duration: data.duration,
          billingType: data.isBillable ? "BILLABLE" : "NON BILLABLE",
          remarks: data.notes,
          timePeriod: formatTimePeriodRange(data.startTime, data.endTime),
          date: (ctx?.startedAt ? new Date(ctx.startedAt) : new Date())
            .toISOString()
            .split("T")[0],
        };
        await createTimeLogAction(payload, targetProjectId);
      } catch (err) {
        console.error("[TimerWidget] createTimeLogAction failed:", err);
      }
    }

    isStoppingRef.current = false;
    stoppedContextRef.current = null;
    setTimerState("IDLE");
    setSeconds(0);

    if (onSaveLog) {
      onSaveLog(data);
    }
  };

  const handleModalDiscardLog = async () => {
    // Nothing left to delete server-side — the ActiveTimer was already removed
    // when Stop was clicked. Discarding here just means "don't log this time".
    isStoppingRef.current = false;
    stoppedContextRef.current = null;
    setTimerState("IDLE");
    setSeconds(0);
    setIsStoppedModalOpen(false);
  };

  const formatTime = (totalSecs: number): string => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  // Live browser tab title while this task's timer is running, matching Zoho Projects'
  // "HH:MM:SS - Task Name" tab behavior. Captures/restores the original title only on
  // start/stop transitions; the per-second tick below keeps the displayed time current.
  useEffect(() => {
    if (timerState !== "RUNNING") return;

    originalTitleRef.current = document.title;
    document.title = `${formatTime(seconds)} - ${taskTitle || taskCode || "Task"}`;

    return () => {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
        originalTitleRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerState]);

  useEffect(() => {
    if (timerState !== "RUNNING") return;
    document.title = `${formatTime(seconds)} - ${taskTitle || taskCode || "Task"}`;
  }, [seconds, timerState, taskTitle, taskCode]);

  if (!isTimerExpanded) {
    return (
      <div className={cn("inline-flex items-center", className)}>
        <button
          type="button"
          onClick={handleExpandTimer}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-muted-foreground hover:text-info hover:bg-muted hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer dark:bg-[#121316] dark:border-white/10"
          title={canStart ? "Show timer" : disabledReason}
        >
          <Clock size={13} />
        </button>

        <TimerStoppedModal
          isOpen={isStoppedModalOpen}
          onClose={() => {
            isStoppingRef.current = false;
            setIsStoppedModalOpen(false);
          }}
          initialStartTime={startTimeRef}
          elapsedSeconds={stoppedSeconds}
          taskTitle={taskTitle}
          taskCode={taskCode}
          onSaveLog={handleModalSaveLog}
          onDiscardLog={handleModalDiscardLog}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("inline-flex items-center gap-1.5 animate-in fade-in-0 zoom-in-95 duration-150", className)}
      title={
        timerState === "RUNNING"
          ? "Timer is running (saved in DB)"
          : timerState === "PAUSED"
            ? "Timer is paused"
            : "Click play to start timer"
      }
    >
      {/* Stopwatch icon + formatted time display container */}
      <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 dark:bg-[#121316] dark:border-white/10">
        <Timer size={13} className="text-info shrink-0" />
        {isEditingTime && timerState === "IDLE" ? (
          <input
            type="text"
            autoFocus
            value={timeDraft}
            onChange={(e) => setTimeDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={commitTimeEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setIsEditingTime(false);
            }}
            placeholder="HH:MM:SS"
            className="w-14 bg-transparent font-mono text-xs font-bold tracking-tight text-foreground outline-none dark:text-neutral-100"
          />
        ) : (
          <span
            onClick={timerState === "IDLE" ? handleStartTimeClick : undefined}
            className={cn(
              "font-mono text-xs font-bold tracking-tight text-foreground dark:text-neutral-100",
              timerState === "IDLE" && "cursor-pointer hover:text-primary transition-colors"
            )}
            title={timerState === "IDLE" ? "Click to set a starting time" : undefined}
          >
            {formatTime(seconds)}
          </span>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-1">
        {timerState === "RUNNING" ? (
          <>
            {/* Pause Button */}
            <button
              type="button"
              onClick={handlePause}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-warning text-warning-foreground dark:bg-[#f59e0b] dark:text-neutral-950 transition-all hover:scale-105 hover:bg-warning/90 active:scale-95 shadow-2xs cursor-pointer"
              title="Pause Timer"
            >
              <Pause size={10} fill="currentColor" />
            </button>

            {/* Stop Button */}
            <button
              type="button"
              onClick={handleStop}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground dark:bg-[#ef4444] dark:text-white transition-all hover:scale-105 hover:bg-destructive/90 active:scale-95 shadow-2xs cursor-pointer"
              title="Stop Timer"
            >
              <Square size={8} fill="currentColor" />
            </button>
          </>
        ) : timerState === "PAUSED" ? (
          <>
            {/* Resume / Play Button */}
            <button
              type="button"
              onClick={handleStart}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-success-foreground dark:bg-[#22c55e] dark:text-white transition-all hover:scale-105 hover:bg-success/90 active:scale-95 shadow-2xs cursor-pointer"
              title="Resume Timer"
            >
              <Play size={10} fill="currentColor" className="ml-0.5" />
            </button>

            {/* Stop Button */}
            <button
              type="button"
              onClick={handleStop}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground dark:bg-[#ef4444] dark:text-white transition-all hover:scale-105 hover:bg-destructive/90 active:scale-95 shadow-2xs cursor-pointer"
              title="Stop Timer"
            >
              <Square size={8} fill="currentColor" />
            </button>
          </>
        ) : canStart ? (
          /* Start / Play Button when Idle */
          <button
            type="button"
            onClick={handleStart}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-success-foreground dark:bg-[#22c55e] dark:text-white transition-all hover:scale-105 hover:bg-success/90 active:scale-95 shadow-2xs cursor-pointer"
            title="Start Timer"
          >
            <Play size={10} fill="currentColor" className="ml-0.5" />
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground cursor-not-allowed shadow-2xs"
            title={disabledReason}
          >
            <Play size={10} fill="currentColor" className="ml-0.5" />
          </button>
        )}
      </div>

      <TimerStoppedModal
        isOpen={isStoppedModalOpen}
        onClose={() => {
          isStoppingRef.current = false;
          setIsStoppedModalOpen(false);
        }}
        initialStartTime={startTimeRef}
        elapsedSeconds={stoppedSeconds}
        taskTitle={taskTitle}
        taskCode={taskCode}
        onSaveLog={handleModalSaveLog}
        onDiscardLog={handleModalDiscardLog}
      />
    </div>
  );
}
