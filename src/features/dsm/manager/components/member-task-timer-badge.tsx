"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, CircleDot } from "lucide-react";
import { getAllActiveTimersAction } from "@/features/projects/actions/active-timer-actions";
import { fetchDailyTimeSummaryAction } from "@/features/dsm/actions/get-user-project-tasks";

function formatTime(totalSecs: number): string {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

/**
 * Read-only "is this task's timer running, and how much time has been logged today" badge for
 * the manager review screen. Unlike `TimerWidget` (which only ever reflects the *current
 * session user's* own ActiveTimer), this reads the reviewed member's timer via
 * `getAllActiveTimersAction` — manager/admin-gated server-side — so it can show another user's
 * live status without granting any control over it.
 */
export function MemberTaskTimerBadge({
  taskId,
  memberId,
  dateStr,
}: {
  taskId: string;
  memberId: string;
  dateStr: string; // "YYYY-MM-DD"
}) {
  const [runningSince, setRunningSince] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<{ totalMinutes: number; firstStart: string | null; lastStop: string | null } | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await getAllActiveTimersAction();
        if (cancelled || !res.success) return;
        const match = (res.data || []).find(
          (t: { userId: string; taskId: string; startedAt: string | Date }) => t.userId === memberId && t.taskId === taskId
        );
        setRunningSince(match ? new Date(match.startedAt) : null);
      } catch {
        // ignore transient poll failures
      }
    };

    const fetchSummary = async () => {
      const res = await fetchDailyTimeSummaryAction([taskId], dateStr, memberId);
      if (!cancelled && res) setSummary(res[taskId] ?? null);
    };

    poll();
    fetchSummary();
    const pollInterval = setInterval(() => {
      poll();
      fetchSummary();
    }, 20000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [taskId, memberId, dateStr]);

  useEffect(() => {
    if (!runningSince) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - runningSince.getTime()) / 1000)));
    update();
    tickRef.current = setInterval(update, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [runningSince]);

  if (!runningSince && !summary) return null;

  if (runningSince) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-success/10 border border-success/30 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-success">
        <CircleDot size={10} className="animate-pulse" />
        {formatTime(elapsed)} running
      </span>
    );
  }

  if (summary && summary.totalMinutes > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
        <Clock size={10} />
        {Math.floor(summary.totalMinutes / 60)}h {summary.totalMinutes % 60}m logged
        {summary.firstStart && summary.lastStop && <> · {summary.firstStart} – {summary.lastStop}</>}
      </span>
    );
  }

  return null;
}
