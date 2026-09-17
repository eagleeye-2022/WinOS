"use client";

import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { getMemberActiveTimerAction } from "@/features/projects/actions/active-timer-actions";
import { fetchDailyTimeSummaryAction } from "@/features/dsm/actions/get-user-project-tasks";

function formatTime(totalSecs: number): string {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

type MemberActiveTimerData = {
  taskId?: string;
  task?: { id: string; code?: string };
  startedAt: string | Date;
} | null;

type Listener = (data: MemberActiveTimerData) => void;

class MemberActiveTimerManager {
  private listeners = new Map<string, Set<Listener>>();
  private cache = new Map<string, MemberActiveTimerData>();
  private intervals = new Map<string, NodeJS.Timeout>();

  subscribe(memberId: string, listener: Listener) {
    if (!this.listeners.has(memberId)) {
      this.listeners.set(memberId, new Set());
    }
    const set = this.listeners.get(memberId)!;
    set.add(listener);

    if (this.cache.has(memberId)) {
      listener(this.cache.get(memberId)!);
    }

    if (set.size === 1) {
      this.fetch(memberId);
      // Poll so the manager sees the member's start/stop without a page
      // refresh — same 30s cadence as ActiveTimerProvider elsewhere in the app.
      this.intervals.set(
        memberId,
        setInterval(() => this.fetch(memberId), 30000)
      );
    }

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(memberId);
        this.cache.delete(memberId);
        const interval = this.intervals.get(memberId);
        if (interval) {
          clearInterval(interval);
          this.intervals.delete(memberId);
        }
      }
    };
  }

  async fetch(memberId: string) {
    try {
      const res = await getMemberActiveTimerAction(memberId);
      if (res?.success) {
        const data = res.data ?? null;
        this.cache.set(memberId, data);
        const set = this.listeners.get(memberId);
        if (set) {
          set.forEach((l) => l(data));
        }
      }
    } catch {
      // ignore
    }
  }

  refetch(memberId: string) {
    this.fetch(memberId);
  }
}

const memberTimerManager = new MemberActiveTimerManager();

/**
 * Read-only "is this task's timer running, and how much time has been logged today" badge for
 * the manager review screen. Matches the exact look and feel of `TimerWidget`'s live timer display.
 */
export function MemberTaskTimerBadge({
  taskId,
  taskCode,
  memberId,
  dateStr,
  liveOnly = false,
}: {
  taskId: string;
  taskCode?: string;
  memberId?: string;
  dateStr: string; // "YYYY-MM-DD"
  /** Manager live-monitoring mode: shows only the currently running session
   *  (or "No active timer") and never the day's accumulated/historical total.
   *  Historical daily totals belong to the DSR pages, not this DSM view. */
  liveOnly?: boolean;
}) {
  const [runningSince, setRunningSince] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<{ totalMinutes: number; firstStart: string | null; lastStop: string | null } | null>(null);
  const runningSinceRef = useRef<Date | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // Check if this badge is for "Today"
  const isViewingToday = (() => {
    const todayUtc = new Date().toISOString().slice(0, 10);
    const todayLocal = new Date().toLocaleDateString("en-CA");
    return dateStr === todayUtc || dateStr === todayLocal;
  })();

  // Fetch summary once on mount or when props change for this specific day.
  // Skipped entirely in liveOnly mode — the manager DSM view never shows the
  // historical/accumulated total, so there's no need to fetch it.
  useEffect(() => {
    if (liveOnly) return;
    let cancelled = false;
    fetchDailyTimeSummaryAction([taskId], dateStr, memberId || undefined).then((res) => {
      if (!cancelled && res) {
        setSummary(res[taskId] ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, dateStr, memberId, liveOnly]);

  // Subscribe to member's active timer only if viewing Today and memberId is present
  useEffect(() => {
    if (!isViewingToday || !memberId) {
      setRunningSince(null);
      runningSinceRef.current = null;
      return;
    }

    let cancelled = false;

    const unsubscribe = memberTimerManager.subscribe(memberId, (activeData) => {
      if (cancelled) return;
      if (activeData) {
        const isMatch =
          activeData.taskId === taskId ||
          activeData.task?.id === taskId ||
          (taskCode && (activeData.task?.code === taskCode || activeData.taskId === taskCode));
        const newDate = isMatch ? new Date(activeData.startedAt) : null;
        const currentMs = runningSinceRef.current?.getTime() ?? null;
        const newMs = newDate?.getTime() ?? null;
        if (currentMs !== newMs) {
          runningSinceRef.current = newDate;
          setRunningSince(newDate);
        }
      } else if (runningSinceRef.current !== null) {
        runningSinceRef.current = null;
        setRunningSince(null);
        if (!liveOnly) {
          fetchDailyTimeSummaryAction([taskId], dateStr, memberId).then((res) => {
            if (!cancelled && res) setSummary(res[taskId] ?? null);
          });
        }
      }
    });

    const onFocus = () => memberTimerManager.refetch(memberId);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [taskId, taskCode, memberId, dateStr, isViewingToday, liveOnly]);

  // Smooth local 1-second tick when running
  useEffect(() => {
    if (!runningSince) {
      if (tickRef.current) clearInterval(tickRef.current);
      setElapsed(0);
      return;
    }
    const startedMs = runningSince.getTime();
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedMs) / 1000)));
    update();
    tickRef.current = setInterval(update, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [runningSince]);

  const priorSecondsToday = (summary?.totalMinutes ?? 0) * 60;
  // liveOnly (manager DSM view): show only this session's elapsed time, never
  // accumulated with prior completed sessions — those belong on DSR.
  const totalDaySeconds = runningSince ? (liveOnly ? elapsed : priorSecondsToday + elapsed) : priorSecondsToday;

  if (runningSince) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 select-none pointer-events-none transition-all border border-sky-500/40 bg-sky-500/10 dark:bg-sky-500/20 dark:border-sky-500/40"
        title={
          liveOnly
            ? `● Running — started at ${new Date(runningSince).toLocaleTimeString()}`
            : `Live timer is running (started at ${new Date(runningSince).toLocaleTimeString()}). Total for ${dateStr}: ${formatTime(totalDaySeconds)}`
        }
      >
        <Timer
          size={13}
          className="shrink-0 text-sky-500 dark:text-sky-400 animate-pulse"
        />
        <span className="font-mono text-xs font-bold tracking-tight select-none cursor-default text-sky-600 dark:text-sky-300">
          {formatTime(totalDaySeconds)}
        </span>
      </div>
    );
  }

  if (liveOnly) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 select-none pointer-events-none transition-all border border-border/60 bg-muted/60 dark:bg-[#121316] dark:border-white/10"
        title="No active timer"
      >
        <Timer size={13} className="shrink-0 text-muted-foreground/60" />
        <span className="text-xs font-medium select-none cursor-default text-muted-foreground/60">
          No active timer
        </span>
      </div>
    );
  }

  if (summary && summary.totalMinutes > 0) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 select-none pointer-events-none transition-all border border-border/60 bg-muted/60 dark:bg-[#121316] dark:border-white/10"
        title={summary.firstStart && summary.lastStop ? `${summary.firstStart} – ${summary.lastStop}` : `${Math.floor(summary.totalMinutes / 60)}h ${summary.totalMinutes % 60}m logged on ${dateStr}`}
      >
        <Timer size={13} className="shrink-0 text-info" />
        <span className="font-mono text-xs font-bold tracking-tight select-none cursor-default text-foreground dark:text-neutral-100">
          {formatTime(summary.totalMinutes * 60)}
        </span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 select-none pointer-events-none transition-all border border-border/60 bg-muted/60 dark:bg-[#121316] dark:border-white/10"
      title={`No time logged for this task on ${dateStr}`}
    >
      <Timer size={13} className="shrink-0 text-muted-foreground/60" />
      <span className="font-mono text-xs font-bold tracking-tight select-none cursor-default text-muted-foreground/60">
        00:00:00
      </span>
    </div>
  );
}
