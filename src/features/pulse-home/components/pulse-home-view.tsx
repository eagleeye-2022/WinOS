"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  Search,
  TreePalm,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { UserName } from "@/components/shared/user-card";
import {
  CountTile,
  DateTile,
  PulseCard,
  PulseCardLink,
  PulsePage,
  PulseTabs,
  StatusPill,
  TONE_DOT,
  TONE_TEXT,
  type PulseTone,
} from "@/components/pulse/pulse-ui";
import { checkInAction, checkOutAction } from "@/features/attendance/actions/attendance-actions";
import { ApplyLeaveModal } from "@/features/attendance/components/apply-leave-modal";
import { CheckInCaptureModal } from "@/features/attendance/components/check-in-capture-modal";
import { CHECKIN_CHANGED_EVENT } from "@/features/attendance/components/check-in-chip";
import type { ActionRequiredItem } from "@/features/attendance/types";
import { SHIFT_END, SHIFT_START } from "@/features/attendance/utils";
import { ROUTES } from "@/constants/routes";
import { getActiveTimerAction } from "@/features/projects/actions/active-timer-actions";
import { projectTaskHref } from "@/lib/project-task-href";
import { cn } from "@/lib/utils";
import { usePageViewState } from "@/lib/navigation/use-url-state";
import type { PulseHomeData, PulsePerson } from "../queries";
import type { DayTone } from "../utils";

const TONE: Record<DayTone, PulseTone> = {
  success: "green",
  danger: "red",
  warning: "amber",
  muted: "gray",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Active task timer (above the check-in / check-out button) ────────────────

type RunningTimer = {
  startedAt: string;
  taskTitle: string;
  taskCode: string;
  projectId: string;
  projectName: string;
};

const TIMER_POLL_MS = 30_000;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Today's total on all tasks as a boxed green clock: HH : MM : SS. */
function TodayTotalClock({ totalSeconds }: { totalSeconds: number }) {
  const parts = [Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60].map(pad2);
  return (
    <span className="flex items-center justify-center gap-1" aria-label={`Total today ${parts.join(":")}`}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-sm font-bold text-muted-foreground">:</span>}
          <span className="flex h-7 min-w-[2rem] items-center justify-center rounded-md border border-border/70 bg-muted/60 px-1.5 text-sm font-bold tabular-nums text-muted-foreground">
            {part}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

/**
 * The project-task timer the user has running (started from any task), ticking every second,
 * with today's total time on all tasks below it. With no timer running, only today's total shows.
 * Re-read every 30s and when the tab regains focus, so starting / stopping it elsewhere shows up.
 */
function ActiveTaskTimer() {
  const [timer, setTimer] = useState<RunningTimer | null>(null);
  /** Time logged today on all tasks / projects (billable + non-billable), not counting a running session. */
  const [todayMinutes, setTodayMinutes] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getActiveTimerAction()
        .then((res) => {
          if (cancelled) return;
          if (res.success && "todayLoggedMinutes" in res) setTodayMinutes(Number(res.todayLoggedMinutes) || 0);
          const t = res.success ? res.data : null;
          setTimer(
            t
              ? {
                  startedAt: new Date(t.startedAt).toISOString(),
                  taskTitle: t.task?.title ?? "Task",
                  taskCode: t.task?.code ?? "",
                  projectId: t.project?.id ?? t.projectId,
                  projectName: t.project?.name ?? "",
                }
              : null
          );
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, TIMER_POLL_MS);
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!timer) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const cardClass = "mt-3 flex w-full flex-col gap-1.5 py-1";

  // No timer running: just today's total (it doesn't tick).
  if (!timer) {
    if (todayMinutes === null) return null;
    return (
      <div title="Total time logged today on all tasks" className="mt-3 flex w-full flex-col py-1">

        <TodayTotalClock totalSeconds={todayMinutes * 60} />
      </div>
    );
  }
  if (now === null) return null;

  const seconds = Math.max(0, Math.floor((now - new Date(timer.startedAt).getTime()) / 1000));
  const elapsed = `${pad2(Math.floor(seconds / 3600))}:${pad2(Math.floor((seconds % 3600) / 60))}:${pad2(seconds % 60)}`;
  // Today's total on all tasks and projects = time logged today + the running session (ticks with it).
  const totalSeconds = (todayMinutes ?? 0) * 60 + seconds;
  const href = projectTaskHref(timer.projectId, timer.taskCode);
  const body = (
    <>
      <span className="flex w-full items-center gap-2.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-muted-foreground opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-muted-foreground" />
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-muted-foreground">
          {timer.taskCode || "Task"}
        </span>
        {/* Fixed width + tabular digits, so the time doesn't shift as it ticks. */}
        <span className="w-[8ch] shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-muted-foreground">
          {elapsed}
        </span>
      </span>
      {/* Today's total on all tasks as a big boxed clock: HH : MM : SS. */}
      <span className="flex w-full flex-col items-center border-t border-border/70 pt-2">
        <TodayTotalClock totalSeconds={totalSeconds} />
      </span>
    </>
  );
  const className = cardClass;
  const tooltip = [timer.taskTitle, timer.projectName].filter(Boolean).join(" · ");

  return href ? (
    <Link href={href} title={tooltip} className={cn(className, "hover:opacity-80")}>
      {body}
    </Link>
  ) : (
    <div title={tooltip} className={className}>
      {body}
    </div>
  );
}

// ── Left column ──────────────────────────────────────────────────────────────

function CheckInCard({ data }: { data: PulseHomeData }) {
  const router = useRouter();
  const { me, today } = data;
  const [workMode, setWorkMode] = useState<"OFFICE" | "REMOTE">(today.workMode);
  const [error, setError] = useState<string | null>(null);
  /** Which punch the camera + location dialog is open for (both check-in and check-out capture). */
  const [captureMode, setCaptureMode] = useState<"check-in" | "check-out" | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const busy = isRefreshing;

  return (
    <section className="relative rounded-lg border border-border/70 bg-card px-5 pb-5 pt-14 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <UserAvatar
        userId={me.id}
        name={me.name}
        email={me.email}
        image={me.image}
        title=""
        className="absolute -top-12 left-1/2 h-24 w-24 -translate-x-1/2 rounded-xl border-4 border-card bg-blue-50 text-2xl font-bold text-blue-700 shadow-md dark:bg-blue-500/15 dark:text-blue-300"
      >
        {initials(me.name)}
      </UserAvatar>

      <p className="text-sm font-semibold text-foreground">{me.name}</p>
      {me.title && <p className="mt-0.5 text-xs text-muted-foreground">{me.title}</p>}

      <div className="mt-2">
        <StatusPill tone={TONE[me.presence.tone]}>
          <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[TONE[me.presence.tone]])} />
          {me.presence.label}
        </StatusPill>
      </div>

      <ActiveTaskTimer />

      {today.isLive ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setCaptureMode("check-out")}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Check-out
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          {/* Shown for the first check-in and for "Check-in again" after a check-out. */}
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
          <button
            type="button"
            disabled={busy}
            onClick={() => setCaptureMode("check-in")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {today.checkedOut ? "Check-in again" : "Check-in"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

      <CheckInCaptureModal
        isOpen={captureMode !== null}
        onClose={() => setCaptureMode(null)}
        mode={captureMode ?? "check-in"}
        title={captureMode === "check-out" ? "Check-out" : today.checkedOut ? "Check-in again" : "Check-in"}
        onConfirm={async ({ photo, location }) => {
          const res =
            captureMode === "check-out"
              ? await checkOutAction({ source: "Web", photo, location })
              : await checkInAction({ workMode, source: "Web", photo, location });
          if (!res.success) return ("message" in res && res.message) || "That didn't go through. Please try again.";
          setError(null);
          // Keep the top-bar button and sidebar switch in step.
          window.dispatchEvent(new Event(CHECKIN_CHANGED_EVENT));
          const redirectTo = "redirectTo" in res ? res.redirectTo : undefined;
          if (typeof redirectTo === "string") {
            // Checked in: straight to the standup (managers: their own one).
            router.push(redirectTo);
            return null;
          }
          startRefresh(() => router.refresh());
          return null;
        }}
      />
    </section>
  );
}

function PersonRow({ person }: { person: PulsePerson }) {
  const tone = TONE[person.presence.tone];
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <UserAvatar
          userId={person.id}
          name={person.name}
          email={person.email}
          image={person.image}
          className="h-10 w-10 rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
        >
          {initials(person.name)}
        </UserAvatar>
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-card",
            // Not in yet (red) / unknown: a hollow outline instead of a coloured dot.
            tone === "red" || tone === "gray" ? "border-[1.5px] border-muted-foreground bg-card" : TONE_DOT[tone]
          )}
          title={person.presence.label}
        />
      </div>
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-muted-foreground">
          <UserName userId={person.id} name={person.name} email={person.email}>
            {person.name}
          </UserName>
        </p>
        <p className="text-xs text-muted-foreground">{person.presence.label}</p>
      </div>
    </div>
  );
}

// ── Right column cards ───────────────────────────────────────────────────────

/** Small sun-and-cloud illustration for the greeting card (inline SVG, no asset). */
function GreetingArt() {
  return (
    <svg viewBox="0 0 120 80" className="hidden h-20 w-32 shrink-0 sm:block" aria-hidden="true">
      <circle cx="74" cy="34" r="20" className="fill-amber-300 dark:fill-amber-400/80" />
      <g className="stroke-amber-300 dark:stroke-amber-400/80" strokeWidth="3" strokeLinecap="round">
        <line x1="74" y1="4" x2="74" y2="9" />
        <line x1="96" y1="12" x2="92" y2="16" />
        <line x1="104" y1="34" x2="99" y2="34" />
        <line x1="52" y1="12" x2="56" y2="16" />
      </g>
      <path
        d="M30 66 a14 14 0 0 1 4 -27 a18 18 0 0 1 34 4 a12 12 0 0 1 2 23 Z"
        className="fill-blue-100 dark:fill-blue-500/25"
      />
    </svg>
  );
}

function GreetingCard({ data }: { data: PulseHomeData }) {
  return (
    <PulseCard bodyClassName="flex items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="text-lg font-semibold text-foreground">
          {data.greeting}, <span className="text-blue-600 dark:text-blue-400">{data.me.name}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {data.todayLabel}
          </span>        </div>
      </div>
      <GreetingArt />
    </PulseCard>
  );
}

/** Absent days shown before "Show all". */
const ABSENT_PREVIEW = 6;

function AbsentDaysCard({ days, onApply }: { days: PulseHomeData["absentDays"]; onApply: (d: ActionRequiredItem) => void }) {
  const [showAll, setShowAll] = usePageViewState("PulseHome:absentShowAll", false);
  if (days.length === 0) return null;
  // Latest first; only the latest few until expanded.
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));
  const hidden = sorted.length - ABSENT_PREVIEW;
  const visible = showAll ? sorted : sorted.slice(0, ABSENT_PREVIEW);
  return (
    <PulseCard
      icon={<AlertTriangle className="h-4 w-4" />}
      iconTone="red"
      title="Attendance needs your attention"
      action={
        hidden > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            aria-expanded={showAll}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            {showAll ? "Show less" : `Show all (${days.length})`}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} />
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-2.5">
        {visible.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onApply(d)}
            title="Apply leave for this day"
            className="flex items-center gap-3 rounded-md border border-border/70 py-2 pl-2 pr-3.5 text-left transition-colors hover:bg-muted/60"
          >
            <DateTile date={d.date} tone="red" stripClassName="bg-rose-400" />
            <span>
              <span className="block text-[13px] font-semibold text-foreground">
                {/* {d.date.split("-").reverse().join("/")},{" "} */}
                {d.dayName}
              </span>
              <span className="block text-xs text-muted-foreground">
                {d.absentDays} {d.absentDays === 1 ? "day" : "days"}
              </span>
            </span>
          </button>
        ))}
      </div>
    </PulseCard>
  );
}

function WorkScheduleCard({ schedule }: { schedule: PulseHomeData["schedule"] }) {
  return (
    <PulseCard
      icon={<CalendarClock className="h-4 w-4" />}
      title="Work Schedule"
      subtitle={schedule.rangeLabel}
      action={
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">General</span>
          {SHIFT_START} – {SHIFT_END}
        </span>
      }
    >
      <div className="overflow-x-auto">
        <div className="relative grid min-w-[620px] grid-cols-7">
          {/* Timeline from the first to the last date circle (each centred in an equal-width column;
              top = day label 16px + gap 8px + half of the 32px circle). */}
          <div className="absolute left-[calc(100%/14)] right-[calc(100%/14)] top-10 h-px bg-border" />
          {schedule.days.map((day) => {
            const tone = day.status ? TONE[day.status.tone] : "gray";
            return (
              <div key={day.key} className="relative flex min-w-0 flex-col items-center px-1.5 text-center">
                <p
                  className={cn(
                    "mb-2 h-4 text-[11px] font-semibold uppercase tracking-wide",
                    day.isToday ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                  )}
                >
                  {day.dayShort}
                </p>
                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                    day.isToday
                      ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
                      : cn("bg-card text-foreground", {
                          "border-emerald-500": tone === "green",
                          "border-rose-500": tone === "red",
                          "border-amber-500": tone === "amber",
                          "border-border": tone === "gray" || tone === "blue" || tone === "violet",
                        })
                  )}
                >
                  {day.dayNum}
                </span>
                {day.status && (
                  // Check labels always take two lines: "Missing / Check-out", "Yet to / Check-in".
                  <p
                    className={cn(
                      "mt-2 w-full whitespace-pre-line break-words text-xs font-semibold leading-snug",
                      TONE_TEXT[tone]
                    )}
                  >
                    {day.status.label.replace(/\s+(check)/i, "\n$1")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PulseCard>
  );
}

function HolidaysCard({ holidays }: { holidays: PulseHomeData["holidays"] }) {
  return (
    <PulseCard
      icon={<TreePalm className="h-4 w-4" />}
      iconTone="amber"
      title="Upcoming Holidays"
      action={<PulseCardLink href={ROUTES.pulseLeaveHolidays}>View all</PulseCardLink>}
    >
      {holidays.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming holidays.</p>
      ) : (
        <ul className="divide-y divide-border/70">
          {holidays.map((h) => {
            // dateLabel is "dd/mm/yyyy, Weekday".
            const [dmy, weekday = ""] = h.dateLabel.split(", ");
            return (
              <li key={h.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <DateTile date={dmy} tone={h.isOptional ? "violet" : "blue"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{weekday}</p>
                </div>
                {h.isOptional && <StatusPill tone="violet">Optional</StatusPill>}
              </li>
            );
          })}
        </ul>
      )}
    </PulseCard>
  );
}

function LossOfPayCard({ lop }: { lop: PulseHomeData["lossOfPay"] }) {
  const hasLop = lop.totalDays > 0;
  return (
    <PulseCard
      icon={<WalletCards className="h-4 w-4" />}
      iconTone="violet"
      title="Loss of Pay"
      subtitle={lop.rangeLabel}
      action={<PulseCardLink href={`${ROUTES.pulseReports}?report=my-payroll`}>View Details</PulseCardLink>}
    >
      {/* Same list look as Upcoming Holidays: tile + label, one row per reason. */}
      {hasLop && lop.breakdown.length > 0 ? (
        <ul className="divide-y divide-border/70">
          {lop.breakdown.map((b) => (
            <li key={b.label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <CountTile value={b.days} tone="red" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">{b.label}</p>
                <p className="text-xs text-muted-foreground">
                  {b.days} {b.days === 1 ? "day" : "days"}
                </p>
              </div>
            </li>
          ))}
          {lop.breakdown.length > 1 && (
            <li className="flex items-center gap-3 py-2.5 last:pb-0">
              <CountTile value={lop.totalDays} tone="gray" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">Total</p>
                <p className="text-xs text-muted-foreground">
                  {lop.totalDays} {lop.totalDays === 1 ? "day" : "days"}
                </p>
              </div>
            </li>
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No loss of pay for this period.</p>
      )}
    </PulseCard>
  );
}

// ── Cover banner: a rising sun over hills (inline SVG, no image asset) ────────

const SUN_RAYS = Array.from({ length: 13 }, (_, i) => -90 + (i - 6) * 13);

function SunriseBanner() {
  return (
    <div className="relative h-32 shrink-0 overflow-hidden" aria-hidden="true">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 200"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="pulse-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="45%" stopColor="#c2410c" />
            <stop offset="80%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
          <radialGradient id="pulse-glow" cx="50%" cy="100%" r="55%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#fbbf24" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pulse-sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>

        <rect width="1600" height="200" fill="url(#pulse-sky)" />
        <rect width="1600" height="200" fill="url(#pulse-glow)" />

        <g stroke="#fef3c7" strokeOpacity="0.35" strokeWidth="6" strokeLinecap="round">
          {SUN_RAYS.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={800 + Math.cos(rad) * 120}
                y1={185 + Math.sin(rad) * 120}
                x2={800 + Math.cos(rad) * 210}
                y2={185 + Math.sin(rad) * 210}
              />
            );
          })}
        </g>

        <circle cx="800" cy="185" r="95" fill="url(#pulse-sun)" />

        <g fill="#fff7ed" fillOpacity="0.55">
          <ellipse cx="330" cy="62" rx="90" ry="14" />
          <ellipse cx="380" cy="50" rx="55" ry="14" />
          <ellipse cx="1240" cy="78" rx="110" ry="15" />
          <ellipse cx="1300" cy="64" rx="60" ry="14" />
        </g>

        <path d="M0 170 C 250 120, 450 150, 650 165 S 1050 125, 1300 150 S 1500 160, 1600 140 L1600 200 L0 200 Z" fill="#7c2d12" fillOpacity="0.55" />
        <path d="M0 185 C 300 150, 520 175, 800 180 S 1250 150, 1600 170 L1600 200 L0 200 Z" fill="#431407" fillOpacity="0.8" />
      </svg>
    </div>
  );
}

// ── Member search (managers) ─────────────────────────────────────────────────

const MAX_RESULTS = 8;

/**
 * Find a team member by name, member ID, email or designation and open their profile. Searches the
 * member list this page already loaded (managers get everyone), so typing makes no extra requests.
 */
function MemberSearch({ members }: { members: PulsePerson[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  /** Just a search icon until clicked; then the field appears. */
  const [expanded, setExpanded] = useState(false);

  const q = query.trim().toLowerCase();
  const results = q
    ? members
        .filter((m) =>
          [m.name, m.employeeId, m.email, m.title].some((v) => v && v.toLowerCase().includes(q))
        )
        .slice(0, MAX_RESULTS)
    : [];

  const openProfile = (m: PulsePerson) => {
    setOpen(false);
    setQuery("");
    setExpanded(false);
    router.push(`/pulse/profile/${m.id}`);
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        title="Search team members"
        aria-label="Search team members"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlight]) {
      e.preventDefault();
      openProfile(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      setExpanded(false);
    }
  };

  return (
    <div className="relative w-48 shrink-0 sm:w-60">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        autoFocus
        onFocus={() => setOpen(true)}
        // Delay so a click on a result lands before the list closes; with nothing typed, fold back to the icon.
        onBlur={() =>
          setTimeout(() => {
            setOpen(false);
            if (!query.trim()) setExpanded(false);
          }, 120)
        }
        onKeyDown={onKeyDown}
        placeholder="Search team members…"
        aria-label="Search team members"
        role="combobox"
        aria-expanded={open && q.length > 0}
        aria-controls="pulse-member-search-results"
        className="h-9 w-full rounded-md border border-border/70 bg-background pl-9 pr-3 text-sm text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />

      {open && q && (
        <ul
          id="pulse-member-search-results"
          role="listbox"
          className="absolute right-0 z-30 mt-2 max-h-96 w-80 overflow-y-auto rounded-lg border border-border/70 bg-popover p-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">No team member matches “{query.trim()}”.</li>
          ) : (
            results.map((m, i) => (
              <li key={m.id} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  // mousedown (not click) so the input's blur doesn't close the list first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    openProfile(m);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                    i === highlight ? "bg-accent" : "hover:bg-accent/60"
                  )}
                >
                  <UserAvatar
                    name={m.name}
                    email={m.email}
                    image={m.image}
                    className="h-9 w-9 rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                  >
                    {initials(m.name)}
                  </UserAvatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      {m.employeeId && <span className="text-muted-foreground">{m.employeeId} - </span>}
                      <span className="font-medium">{m.name}</span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{m.title || m.email}</span>
                  </span>
                  <span className={cn("shrink-0 text-[11px] font-medium", TONE_TEXT[TONE[m.presence.tone]])}>
                    {m.presence.label}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function PulseHomeView({ data }: { data: PulseHomeData }) {
  const router = useRouter();
  const [applyFor, setApplyFor] = useState<ActionRequiredItem | null>(null);

  const tabs = [
    { label: "Activities", href: ROUTES.pulseHome, active: true },
    { label: "Profile", href: ROUTES.pulseProfile },
    ...(data.canManage ? [{ label: "Approvals", href: ROUTES.pulseTeamLeave }] : []),
    { label: "Leave", href: ROUTES.pulseLeave },
    { label: "Attendance", href: ROUTES.pulseAttendance },
    { label: "Regularization", href: ROUTES.pulseRegularization },
    { label: "Reports", href: ROUTES.pulseReports },
  ];

  return (
    <PulsePage>
      <SunriseBanner />

      <div className="mx-auto -mt-14 grid w-full max-w-[1440px] grid-cols-1 gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Left column */}
        <aside className="space-y-4 pt-12">
          <CheckInCard data={data} />

          {data.manager && (
            <PulseCard title="Reporting To" bodyClassName="px-5 pb-4 pt-3">
              <PersonRow person={data.manager} />
            </PulseCard>
          )}

          {data.members.length > 0 && (
            <PulseCard
              icon={<Users className="h-4 w-4" />}
              title={data.departmentLabel}
              subtitle={`${data.members.length} ${data.members.length === 1 ? "member" : "members"}`}
              bodyClassName="px-5 pb-4 pt-3"
            >
              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {data.members.map((m) => (
                  <PersonRow key={m.id} person={m} />
                ))}
              </div>
            </PulseCard>
          )}
        </aside>

        {/* Right column */}
        {/* pt-16 drops the tab strip just below the banner instead of over it. */}
        <main className="min-w-0 space-y-4 pt-16">
          {data.canManage ? (
            // Managers: a search icon right after the last tab, inside the same strip.
            <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-card pr-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <PulseTabs tabs={tabs} className="min-w-0 border-0 bg-transparent shadow-none" />
              <MemberSearch members={data.members} />
              <Link
                href={ROUTES.pulseAddMember}
                title="Add team member"
                aria-label="Add team member"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden xl:inline">Add Member</span>
              </Link>
            </div>
          ) : (
            <PulseTabs tabs={tabs} />
          )}
          <GreetingCard data={data} />
          <AbsentDaysCard days={data.absentDays} onApply={setApplyFor} />
          <WorkScheduleCard schedule={data.schedule} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <HolidaysCard holidays={data.holidays} />
            <LossOfPayCard lop={data.lossOfPay} />
          </div>
        </main>
      </div>

      <ApplyLeaveModal
        isOpen={applyFor !== null}
        item={applyFor}
        onClose={() => setApplyFor(null)}
        onSubmitSuccess={() => router.refresh()}
      />
    </PulsePage>
  );
}
