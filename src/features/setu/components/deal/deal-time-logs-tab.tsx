"use client";

import { useState } from "react";
import { CircleCheck, Download, EllipsisVertical, ListFilter, Play, Timer, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { useSetuStore } from "../../provider";
import type { Deal } from "../../types";
import {
  formatClock,
  formatDate,
  formatDuration,
  formatHoursMinutes,
  formatTime,
  isoDate,
  logSeconds,
  timeLogStats,
  timeLogsCsv,
} from "../../utils";
import { SetuAvatar, SetuButton, attempt } from "../setu-ui";
import { useElapsedSeconds } from "./use-elapsed-seconds";

const REASON_SUGGESTIONS = ["Preparing Proposal", "Customer Follow-up", "Requirement Review", "Technical Review", "Pricing Analysis"];

export function DealTimeLogsTab({ deal, onStart, onStop }: { deal: Deal; onStart: () => void; onStop: () => void }) {
  const allLogs = useSetuStore((s) => s.timeLogs);
  const activeTimer = useSetuStore((s) => s.activeTimer);
  const deleteTimeLog = useSetuStore((s) => s.deleteTimeLog);
  const [employee, setEmployee] = useUrlState("employee", "");

  const dealLogs = allLogs.filter((l) => l.dealId === deal.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const employees = [...new Set(dealLogs.map((l) => l.employeeName))].sort();
  const logs = employee ? dealLogs.filter((l) => l.employeeName === employee) : dealLogs;
  const stats = timeLogStats(dealLogs, isoDate(new Date()));
  const latestId = dealLogs[0]?.id;

  const running = activeTimer?.dealId === deal.id ? activeTimer : null;
  const elapsed = useElapsedSeconds(running?.startedAt);

  const exportCsv = () => {
    if (logs.length === 0) {
      toast.info("No time logs to export");
      return;
    }
    const blob = new Blob([timeLogsCsv(logs)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deal.company.replace(/[^\w]+/g, "-")}-time-logs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Timer banner */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--setu-line)] bg-[var(--setu-well)] px-6 py-6">
        <div className="flex items-center gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--setu-accent)] text-[var(--setu-accent-ink)]">
            <Timer size={24} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-3xl font-bold leading-none tracking-tight tabular-nums">{formatClock(elapsed)}</span>
              {running ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" /> Timer Running
                </span>
              ) : (
                <span className="setu-text-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--setu-card)] px-2.5 py-0.5 text-xs font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--setu-text-3)]" /> Timer Stopped
                </span>
              )}
            </div>
            <p className="setu-text-2 mt-1.5 text-xs">
              {running ? `Started at ${formatTime(running.startedAt)} by ${running.employeeName}` : "Start a session to log time spent on this deal."}
            </p>
          </div>
        </div>
        {running ? (
          <SetuButton variant="primary" onClick={onStop} className="h-9 px-5">
            <CircleCheck /> Stop & Save Session
          </SetuButton>
        ) : (
          <SetuButton variant="primary" onClick={onStart} className="h-9 px-5">
            <Play className="fill-current" /> Start Session
          </SetuButton>
        )}
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Time" value={formatHoursMinutes(stats.totalSeconds)} hint="Overall deal effort" />
        <StatCard label="Today" value={formatHoursMinutes(stats.todaySeconds)} hint="Active sessions today" accent />
        <StatCard label="Sessions" value={String(stats.sessions)} hint="Recorded sessions" />
        <StatCard label="Employees" value={String(stats.employees)} hint="Active contributors" />
      </div>

      {/* History */}
      <section className="setu-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-lg font-semibold">Time Log History</h2>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SetuButton variant="soft" size="sm" className={cn(employee && "ring-2 ring-[var(--setu-accent-ring)]")}>
                  <ListFilter /> {employee || "Filter"}
                </SetuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuRadioGroup value={employee} onValueChange={setEmployee}>
                  <DropdownMenuRadioItem value="">All employees</DropdownMenuRadioItem>
                  {employees.map((e) => (
                    <DropdownMenuRadioItem key={e} value={e}>
                      {e}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <SetuButton variant="soft" size="sm" onClick={exportCsv} disabled={logs.length === 0}>
              <Download /> Export CSV
            </SetuButton>
          </div>
        </div>

        <div className="setu-scroll-x overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="setu-text-2 bg-[var(--setu-well)] text-left text-xs font-semibold uppercase tracking-wide">
                <th className="py-3 pl-6 pr-4 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Start Time</th>
                <th className="px-4 py-3 font-semibold">End Time</th>
                <th className="px-4 py-3 font-semibold">Duration</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--setu-line)]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="setu-text-2 px-6 py-12 text-center">
                    No time logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => {
                  const latest = l.id === latestId;
                  return (
                    <tr key={l.id} className="hover:bg-[var(--setu-soft)]/60">
                      <td className="whitespace-nowrap py-4 pl-6 pr-4 font-medium">{formatDate(l.startedAt)}</td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <SetuAvatar name={l.employeeName} /> {l.employeeName}
                        </span>
                      </td>
                      <td className={cn("px-4 py-4", latest && "font-semibold")}>
                        <span className="flex items-center gap-1.5">
                          {latest && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />}
                          {l.reason}
                        </span>
                      </td>
                      <td className="setu-text-2 whitespace-nowrap px-4 py-4 font-mono text-xs">{formatTime(l.startedAt)}</td>
                      <td className="setu-text-2 whitespace-nowrap px-4 py-4 font-mono text-xs">{formatTime(l.endedAt)}</td>
                      <td className={cn("whitespace-nowrap px-4 py-4 font-mono font-bold", latest && "setu-accent-text")}>{formatDuration(logSeconds(l))}</td>
                      <td className="px-4 py-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Time log actions"
                              className="setu-text-2 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--setu-soft)]"
                            >
                              <EllipsisVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onSelect={() => void attempt(deleteTimeLog(l.id), "Time log deleted")}
                            >
                              <Trash2 size={14} /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className="setu-card px-4 py-5">
      <p className="setu-text-2 text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className={cn("mt-2 text-2xl font-bold leading-none tracking-tight", accent && "setu-accent-text")}>{value}</p>
      <p className="mt-2 text-xs font-medium">{hint}</p>
    </div>
  );
}

/** "Stop & Save Session": asks what the time was spent on, then saves the session. */
export function StopTimerDialog({ open, onClose, elapsedSeconds }: { open: boolean; onClose: () => void; elapsedSeconds: number }) {
  const stopTimer = useSetuStore((s) => s.stopTimer);
  const discardTimer = useSetuStore((s) => s.discardTimer);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    setReason("");
    onClose();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || saving) return;
    setSaving(true);
    const log = await attempt(stopTimer(reason.trim()));
    setSaving(false);
    if (log) {
      toast.success(`Session saved (${formatDuration(logSeconds(log))})`);
      close();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="setu-scope setu-dialog max-w-md p-6">
        <form onSubmit={save} className="space-y-4">
          <div>
            <DialogTitle className="text-base font-semibold">Save Session</DialogTitle>
            <DialogDescription className="setu-text-2 mt-1 text-xs">
              <span className="font-mono font-semibold text-[var(--setu-text)]">{formatClock(elapsedSeconds)}</span> logged. What was this time spent on?
            </DialogDescription>
          </div>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Preparing Proposal" className="setu-input h-9" autoFocus />
          <div className="flex flex-wrap gap-1.5">
            {REASON_SUGGESTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  reason === r
                    ? "border-[var(--setu-accent)] bg-[var(--setu-accent-soft)] font-semibold text-[var(--setu-accent)]"
                    : "border-[var(--setu-line)] bg-[var(--setu-card)] setu-text-2 hover:bg-[var(--setu-well)]/60 hover:text-[var(--setu-text)]"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[var(--setu-line)] pt-3.5">
            <SetuButton
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-600"
              onClick={async () => {
                if (await attempt(discardTimer().then(() => true), "Timer discarded")) close();
              }}
            >
              Discard
            </SetuButton>
            <div className="flex gap-2">
              <SetuButton size="sm" onClick={close}>Keep Running</SetuButton>
              <SetuButton variant="primary" size="sm" type="submit" disabled={!reason.trim() || saving}>
                Save Session
              </SetuButton>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
