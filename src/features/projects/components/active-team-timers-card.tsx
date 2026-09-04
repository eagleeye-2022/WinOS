"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AlarmClock, RefreshCw, Play, User as UserIcon } from "lucide-react";
import { getAllActiveTimersAction } from "../actions/active-timer-actions";

export interface ActiveTeamTimerItem {
  id: string;
  userId: string;
  projectId: string;
  phaseId?: string;
  taskId: string;
  description?: string;
  billingType?: "BILLABLE" | "NON_BILLABLE";
  startedAt: string | Date;
  elapsedSeconds: number;
  formattedTime: string;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
    title?: string | null;
  };
  project?: {
    id: string;
    code?: string | null;
    name: string;
  };
  phase?: {
    id: string;
    code?: string | null;
    name: string;
  };
  task?: {
    id: string;
    code: string;
    title: string;
  };
}

interface ActiveTeamTimersCardProps {
  projectId?: string;
  className?: string;
}

function formatHMS(totalSecs: number): string {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

export function ActiveTeamTimersCard({ projectId, className = "" }: ActiveTeamTimersCardProps) {
  const [timers, setTimers] = useState<ActiveTeamTimerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchActiveTimers = useCallback(
    async (isManual = false) => {
      if (isManual) setIsRefreshing(true);
      try {
        const res = await getAllActiveTimersAction(projectId);
        if (res.success && Array.isArray(res.data)) {
          setTimers(res.data as ActiveTeamTimerItem[]);
        }
      } catch (err) {
        console.error("Failed to fetch active team timers:", err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [projectId]
  );

  // Initial fetch and 15s poll
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchActiveTimers();
    const pollInterval = setInterval(() => {
      fetchActiveTimers();
    }, 15000);
    return () => clearInterval(pollInterval);
  }, [fetchActiveTimers]);

  // 1-second live ticker for running timers
  useEffect(() => {
    if (timers.length === 0) return;

    const tickInterval = setInterval(() => {
      setTimers((prevTimers) =>
        prevTimers.map((t) => ({
          ...t,
          elapsedSeconds: t.elapsedSeconds + 1,
        }))
      );
    }, 1000);

    return () => clearInterval(tickInterval);
  }, [timers.length]);

  return (
    <div
      className={`bg-card text-card-foreground rounded-xl border border-border/60 shadow-xs overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div>
            <h3 className="font-semibold text-sm tracking-tight flex items-center gap-2">
              Active Team Timers
              {timers.length > 0 && (
                <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
                  {timers.length} Active
                </span>
              )}
            </h3>
            {/* <p className="text-xs text-muted-foreground">
              Real-time live monitoring of project team members actively working on tasks
            </p> */}
          </div>
        </div>

        <button
          onClick={() => fetchActiveTimers(true)}
          disabled={isRefreshing}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
          title="Refresh active timers"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
        </button>
      </div>

      {/* Table Content */}
      <div>
        {loading ? (
          <div className="py-8 flex items-center justify-center text-xs text-muted-foreground gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            Loading active team timers...
          </div>
        ) : timers.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <AlarmClock className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No Active Live Timers</p>
            <p className="text-[11px] mt-0.5">
              Team members will automatically appear here in real-time when they start a task timer.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-4">Team Member</th>
                  <th className="py-2.5 px-4">Project</th>
                  <th className="py-2.5 px-4">Task ID</th>
                  <th className="py-2.5 px-4">Task</th>
                  {/* <th className="py-2.5 px-4">Billing</th> */}
                  <th className="py-2.5 px-4 text-right">Live Elapsed Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {timers.map((item) => {
                  const userName = item.user?.name || item.user?.email || "Team Member";
                  const initials = userName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();

                  // const isBillable = item.billingType === "BILLABLE";

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      {/* Team Member Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                            {item.user?.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.user.image}
                                alt={userName}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              initials || <UserIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-xs">{userName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.user?.title || item.user?.email || "Team Member"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Project Column */}
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-foreground text-xs">
                            {item.project?.name || "Project"}
                          </p>
                        </div>
                      </td>

                      {/* Task ID Column */}
                      <td className="py-3 px-4">
                        {item.task?.code ? (
                          <span className="font-mono text-[11px] font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                            {item.task.code}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Task Title Column */}
                      <td className="py-3 px-4 max-w-xs">
                        <span className="font-medium text-foreground text-xs truncate block">
                          {item.task?.title || item.description || "General Task"}
                        </span>
                      </td>

                      {/* Billing Column (Commented out per request) */}
                      {/*
                      <td className="py-3 px-4">
                        {isBillable ? (
                          <span className="inline-flex items-center text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold px-2 py-0.5 rounded border border-blue-500/20">
                            Billable
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] bg-slate-500/10 text-slate-600 dark:text-slate-400 font-semibold px-2 py-0.5 rounded border border-slate-500/20">
                            Non-Billable
                          </span>
                        )}
                      </td>
                      */}

                      {/* Live Timer Clock Column */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono font-bold text-xs">
                          <Play className="w-3 h-3 fill-emerald-500 animate-pulse text-emerald-500" />
                          <span>{formatHMS(item.elapsedSeconds)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
