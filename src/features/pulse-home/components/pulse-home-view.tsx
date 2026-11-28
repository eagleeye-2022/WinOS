"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock, Loader2, LogIn, LogOut, Search, UserPlus } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { UserName } from "@/components/shared/user-card";
import {
  DateTile,
  PulseCardLink,
  PulsePage,
  PulseTabs,
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

// ── Minimal building blocks (home page only for now) ─────────────────────────

const AVATAR_CLS = "rounded-full bg-muted font-semibold text-muted-foreground";

/** Flat card: a quiet title row (title · meta · action) over the content. */
function Panel({
  title,
  meta,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border/60 bg-card", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <div className="flex min-w-0 items-baseline gap-2">
            {title && <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>}
            {meta && <span className="truncate text-xs text-muted-foreground">{meta}</span>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("px-5 pb-5 pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}

// ── Active task timer (inside the check-in card) ─────────────────────────────

type RunningTimer = {
  startedAt: string;
  taskTitle: string;
  taskCode: string;
  projectId: string;
  projectName: string;
};

const TIMER_POLL_MS = 30_000;
const pad2 = (n: number) => String(n).padStart(2, "0");
const hms = (s: number) => `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;

/**
 * "HH:MM:SS" that never changes width as it ticks: every character sits in its own fixed-width
 * slot (the app font's digits aren't all the same width, so tabular-nums alone isn't enough).
 */
function StableClock({ seconds }: { seconds: number }) {
  return (
    <span className="inline-flex shrink-0 font-semibold text-foreground" aria-label={hms(seconds)}>
      {hms(seconds)
        .split("")
        .map((ch, i) => (
          <span key={i} aria-hidden className={cn("inline-block text-center", ch === ":" ? "w-[0.4em]" : "w-[0.65em]")}>
            {ch}
          </span>
        ))}
    </span>
  );
}

/**
 * Just two things: the running task's ID with its timer (when one is running), and today's total
 * on all tasks. Re-read every 30s and when the tab regains focus, so starting / stopping a timer
 * elsewhere shows up; the running timer ticks every second.
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

  if (todayMinutes === null) return null;
  if (timer && now === null) return null;

  const session = timer && now !== null ? Math.max(0, Math.floor((now - new Date(timer.startedAt).getTime()) / 1000)) : 0;
  // Today's total on all tasks = time logged today + the running timer (ticks with it).
  const totalSeconds = todayMinutes * 60 + session;
  const href = timer ? projectTaskHref(timer.projectId, timer.taskCode) : null;
  const tooltip = timer ? [timer.taskTitle, timer.projectName].filter(Boolean).join(" · ") : undefined;

  return (
    <div className="mt-4 w-full space-y-2 rounded-lg bg-muted/50 px-3.5 py-3 text-left text-xs">
      {/* Running task: its ID and its timer. */}
      {timer && (
        <p className="flex items-center justify-between gap-2">
          {href ? (
            <Link href={href} title={tooltip} className="min-w-0 truncate font-medium text-foreground hover:underline">
              {timer.taskCode || "Task"}
            </Link>
          ) : (
            <span title={tooltip} className="min-w-0 truncate font-medium text-foreground">
              {timer.taskCode || "Task"}
            </span>
          )}
          {/* Fixed-width digit slots, so the time doesn't shift as it ticks. */}
          <StableClock seconds={session} />
        </p>
      )}
      {/* Total on all tasks today. */}
      <p className="flex items-center justify-between gap-2" title="Total time logged today on all tasks">
        <span className="min-w-0 truncate text-muted-foreground">Total today</span>
        <StableClock seconds={totalSeconds} />
      </p>
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
    <section className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-3">
        <UserAvatar
          userId={me.id}
          name={me.name}
          email={me.email}
          image={me.image}
          title=""
          className={cn("h-11 w-11 text-sm", AVATAR_CLS)}
        >
          {initials(me.name)}
        </UserAvatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{me.name}</p>
          {me.title && <p className="truncate text-xs text-muted-foreground">{me.title}</p>}
        </div>
      </div>

      <p className="mt-4 text-xs font-medium text-foreground">{me.presence.label}</p>

      <ActiveTaskTimer />

      {today.isLive ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setCaptureMode("check-out")}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border/70 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Check-out
        </button>
      ) : (
        <div className="mt-4 space-y-2">
          {/* Shown for the first check-in and for "Check-in again" after a check-out. */}
          <div className="grid grid-cols-2 rounded-lg bg-muted/60 p-0.5 text-xs font-medium">
            {(["REMOTE", "OFFICE"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setWorkMode(mode)}
                aria-pressed={workMode === mode}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
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
          className={cn("h-8 w-8 text-[11px]", AVATAR_CLS)}
        >
          {initials(person.name)}
        </UserAvatar>
        <span
          className={cn(
            "absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full ring-2 ring-card",
            // Not in yet (red) / unknown: a hollow outline instead of a coloured dot.
            tone === "red" || tone === "gray" ? "border-[1.5px] border-muted-foreground/60 bg-card" : TONE_DOT[tone]
          )}
          title={person.presence.label}
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-foreground">
          <UserName userId={person.id} name={person.name} email={person.email}>
            {person.name}
          </UserName>
        </p>
        <p className="truncate text-xs text-muted-foreground">{person.presence.label}</p>
      </div>
    </div>
  );
}

/** Reporting manager and the department in one card. */
function PeopleCard({ data }: { data: PulseHomeData }) {
  if (!data.manager && data.members.length === 0) return null;
  const label = "mb-3 text-xs font-medium text-muted-foreground";
  return (
    <section className="rounded-xl border border-border/60 bg-card p-5">
      {data.manager && (
        <div>
          <p className={label}>Reporting to</p>
          <PersonRow person={data.manager} />
        </div>
      )}
      {data.members.length > 0 && (
        <div className={cn(data.manager && "mt-5 border-t border-border/60 pt-5")}>
          <p className={cn(label, "flex items-baseline justify-between gap-2")}>
            <span className="truncate">{data.departmentLabel}</span>
            <span className="shrink-0 tabular-nums">{data.members.length}</span>
          </p>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {data.members.map((m) => (
              <PersonRow key={m.id} person={m} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Right column cards ───────────────────────────────────────────────────────

/** Absent days shown before "Show all". */
const ABSENT_PREVIEW = 6;

// Not shown at the moment (commented out in PulseHomeView), kept to switch back on.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AbsentDaysCard({ days, onApply }: { days: PulseHomeData["absentDays"]; onApply: (d: ActionRequiredItem) => void }) {
  const [showAll, setShowAll] = usePageViewState("PulseHome:absentShowAll", false);
  if (days.length === 0) return null;
  // Latest first; only the latest few until expanded.
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));
  const hidden = sorted.length - ABSENT_PREVIEW;
  const visible = showAll ? sorted : sorted.slice(0, ABSENT_PREVIEW);
  return (
    <Panel
      title="Attendance needs your attention"
      meta="Click a day to apply leave"
      action={
        hidden > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            aria-expanded={showAll}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {showAll ? "Show less" : `Show all (${days.length})`}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} />
          </button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {visible.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onApply(d)}
            title="Apply leave for this day"
            className="flex items-center gap-3 rounded-lg border border-border/60 p-2 text-left transition-colors hover:border-border hover:bg-muted/50"
          >
            <DateTile date={d.date} tone="red" stripClassName="bg-rose-400" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-foreground">{d.dayName}</span>
              <span className="block text-xs text-muted-foreground">
                {d.absentDays} {d.absentDays === 1 ? "day" : "days"}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function WorkScheduleCard({ schedule }: { schedule: PulseHomeData["schedule"] }) {
  return (
    <Panel
      title="Work schedule"
      meta={schedule.rangeLabel}
      action={
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          General · {SHIFT_START} – {SHIFT_END}
        </span>
      }
      bodyClassName="pt-5"
    >
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] grid-cols-7 gap-2">
          {schedule.days.map((day) => {
            const tone = day.status ? TONE[day.status.tone] : "gray";
            return (
              <div
                key={day.key}
                className={cn(
                  "flex min-w-0 flex-col items-center rounded-lg px-1.5 py-3 text-center",
                  day.isToday ? "bg-muted ring-1 ring-border" : "bg-muted/40"
                )}
              >
                <p
                  className={cn(
                    "text-[11px]",
                    day.isToday ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                  )}
                >
                  {day.isToday ? "Today" : day.dayShort}
                </p>
                {/* Same calendar tile as the holidays / absent days: month strip over the day. */}
                {/* Today's month strip is blue; other days follow their status. */}
                <DateTile date={day.key} tone={day.isToday ? "blue" : tone} className="mt-2 bg-card" />
                {day.status ? (
                  // Check labels always take two lines: "Missing / Check-out", "Yet to / Check-in".
                  <p className="mt-2 w-full whitespace-pre-line break-words text-[11px] font-medium leading-snug text-foreground">
                    {day.status.label.replace(/\s+(check)/i, "\n$1")}
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground/60">—</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function HolidaysCard({ holidays }: { holidays: PulseHomeData["holidays"] }) {
  return (
    <Panel title="Upcoming holidays" action={<PulseCardLink href={ROUTES.pulseLeaveHolidays}>View all</PulseCardLink>}>
      {holidays.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming holidays.</p>
      ) : (
        <ul className="space-y-3">
          {holidays.map((h) => {
            // dateLabel is "dd/mm/yyyy, Weekday".
            const [dmy, weekday = ""] = h.dateLabel.split(", ");
            return (
              <li key={h.id} className="flex items-center gap-3">
                <DateTile date={dmy} tone={h.isOptional ? "violet" : "blue"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{weekday}</p>
                </div>
                {h.isOptional && <span className="shrink-0 text-[11px] font-medium text-violet-600 dark:text-violet-400">Optional</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function LossOfPayCard({ lop }: { lop: PulseHomeData["lossOfPay"] }) {
  const hasLop = lop.totalDays > 0;
  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  return (
    <Panel
      title="Loss of pay"
      meta={lop.rangeLabel}
      action={<PulseCardLink href={`${ROUTES.pulseReports}?report=my-payroll`}>View details</PulseCardLink>}
    >
      {hasLop && lop.breakdown.length > 0 ? (
        <ul className="text-[13px]">
          {lop.breakdown.map((b) => (
            <li key={b.label} className="flex items-center justify-between gap-3 py-2 first:pt-0">
              <span className="min-w-0 truncate text-foreground">{b.label}</span>
              <span className="shrink-0 tabular-nums text-rose-600 dark:text-rose-400">{days(b.days)}</span>
            </li>
          ))}
          {lop.breakdown.length > 1 && (
            <li className="mt-1 flex items-center justify-between gap-3 border-t border-border/60 pt-3 font-semibold">
              <span className="text-foreground">Total</span>
              <span className="tabular-nums text-foreground">{days(lop.totalDays)}</span>
            </li>
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No loss of pay for this period.</p>
      )}
    </Panel>
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
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
    <div className="relative w-48 shrink-0 sm:w-64">
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
        className="h-9 w-full rounded-lg border border-border/70 bg-card pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />

      {open && q && (
        <ul
          id="pulse-member-search-results"
          role="listbox"
          className="absolute right-0 z-30 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-border/70 bg-popover p-1 shadow-lg"
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
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                    i === highlight ? "bg-accent" : "hover:bg-accent/60"
                  )}
                >
                  <UserAvatar name={m.name} email={m.email} image={m.image} className={cn("h-8 w-8 text-[11px]", AVATAR_CLS)}>
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

  const firstName = data.me.name.split(" ")[0] || data.me.name;

  return (
    <PulsePage>
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6">
        {/* Greeting · date, with the managers' search and Add member on the right. */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{data.todayLabel}</p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">
              {data.greeting}, {firstName}
            </h1>
          </div>
          {data.canManage && (
            <div className="flex items-center gap-2">
              <MemberSearch members={data.members} />
              <Link
                href={ROUTES.pulseAddMember}
                title="Add team member"
                aria-label="Add team member"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Add member</span>
              </Link>
            </div>
          )}
        </header>

        <PulseTabs
          tabs={tabs}
          className="mt-5 rounded-none border-0 border-b border-border/70 bg-transparent px-0 shadow-none"
        />

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Left column */}
          <aside className="space-y-4">
            <CheckInCard data={data} />
            <PeopleCard data={data} />
          </aside>

          {/* Right column */}
          <main className="min-w-0 space-y-4">
            {/* Hidden for now (by request) — put back to show the absent days again. */}
            {/* <AbsentDaysCard days={data.absentDays} onApply={setApplyFor} /> */}
            <WorkScheduleCard schedule={data.schedule} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <HolidaysCard holidays={data.holidays} />
              <LossOfPayCard lop={data.lossOfPay} />
            </div>
          </main>
        </div>
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
