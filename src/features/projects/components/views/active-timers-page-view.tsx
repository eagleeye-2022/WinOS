"use client";

import React from "react";
import { AlarmClock, ClockFading, ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ActiveTeamTimersCard } from "../active-team-timers-card";

export function ActiveTimersPageView() {
  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground overflow-y-auto p-6 space-y-6">
      {/* Top Title & Header */}
      {/* <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Active Team Timers
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time live monitoring of all team members actively tracking work across projects.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/projects/time-tracker"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors border border-border/50"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Effort Logs</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </Link>
        </div>
      </div> */}

      {/* Main Active Team Timers Table Card */}
      <div className="w-full">
        <ActiveTeamTimersCard className="w-full shadow-xs" />
      </div>
    </div>
  );
}
