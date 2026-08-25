"use client";

import React, { useState, useEffect, useRef } from "react";
import { Timer, Play, Pause, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimerStoppedModal } from "./modals/timer-stopped-modal";

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
  /** When false, the Start control is disabled — e.g. only a task's owner may start its timer. */
  canStart?: boolean;
  disabledReason?: string;
}

export function TimerWidget({
  onStopTimer,
  onSaveLog,
  className = "",
  taskTitle,
  taskCode,
  canStart = true,
  disabledReason = "Only the task owner can start this timer",
}: TimerWidgetProps) {
  const [seconds, setSeconds] = useState<number>(0);
  const [timerState, setTimerState] = useState<"IDLE" | "RUNNING" | "PAUSED">("IDLE");
  const [startTimeRef, setStartTimeRef] = useState<Date | undefined>(undefined);
  const [stoppedSeconds, setStoppedSeconds] = useState<number>(0);
  const [isStoppedModalOpen, setIsStoppedModalOpen] = useState<boolean>(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer interval handling
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

  const handleStart = () => {
    if (timerState === "IDLE") {
      setStartTimeRef(new Date());
    }
    setTimerState("RUNNING");
  };

  const handlePause = () => {
    setTimerState("PAUSED");
  };

  const handleStop = () => {
    const elapsed = seconds;
    const formatted = formatTime(elapsed);
    setTimerState("IDLE");
    setStoppedSeconds(elapsed > 0 ? elapsed : 60);
    setIsStoppedModalOpen(true);
    setSeconds(0);
    if (onStopTimer && elapsed > 0) {
      onStopTimer(elapsed, formatted);
    }
  };

  const formatTime = (totalSecs: number): string => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  return (
    <div
      className={cn("inline-flex items-center gap-1.5", className)}
      title={
        timerState === "RUNNING"
          ? "Timer is running"
          : timerState === "PAUSED"
            ? "Timer is paused"
            : "Click play to start timer"
      }
    >
      {/* Stopwatch icon + formatted time display container */}
      <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 dark:bg-[#121316] dark:border-white/10">
        <Timer size={13} className="text-info shrink-0" />
        <span className="font-mono text-xs font-bold tracking-tight text-foreground dark:text-neutral-100">
          {formatTime(seconds)}
        </span>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-1">
        {timerState === "RUNNING" ? (
          <>
            {/* Pause Button (Amber/Yellow circle) */}
            <button
              type="button"
              onClick={handlePause}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-warning text-warning-foreground dark:bg-[#f59e0b] dark:text-neutral-950 transition-all hover:scale-105 hover:bg-warning/90 active:scale-95 shadow-2xs"
              title="Pause Timer"
            >
              <Pause size={10} fill="currentColor" />
            </button>

            {/* Stop Button (Red circle) */}
            <button
              type="button"
              onClick={handleStop}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground dark:bg-[#ef4444] dark:text-white transition-all hover:scale-105 hover:bg-destructive/90 active:scale-95 shadow-2xs"
              title="Stop Timer"
            >
              <Square size={8} fill="currentColor" />
            </button>
          </>
        ) : timerState === "PAUSED" ? (
          <>
            {/* Resume / Play Button (Green circle) */}
            <button
              type="button"
              onClick={handleStart}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-success-foreground dark:bg-[#22c55e] dark:text-white transition-all hover:scale-105 hover:bg-success/90 active:scale-95 shadow-2xs"
              title="Resume Timer"
            >
              <Play size={10} fill="currentColor" className="ml-0.5" />
            </button>

            {/* Stop Button (Red circle) */}
            <button
              type="button"
              onClick={handleStop}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground dark:bg-[#ef4444] dark:text-white transition-all hover:scale-105 hover:bg-destructive/90 active:scale-95 shadow-2xs"
              title="Stop Timer"
            >
              <Square size={8} fill="currentColor" />
            </button>
          </>
        ) : canStart ? (
          /* Start / Play Button when Idle (Green circle) */
          <button
            type="button"
            onClick={handleStart}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-success-foreground dark:bg-[#22c55e] dark:text-white transition-all hover:scale-105 hover:bg-success/90 active:scale-95 shadow-2xs"
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
        onClose={() => setIsStoppedModalOpen(false)}
        initialStartTime={startTimeRef}
        elapsedSeconds={stoppedSeconds}
        taskTitle={taskTitle}
        taskCode={taskCode}
        onSaveLog={onSaveLog}
      />
    </div>
  );
}
