"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, TreePalm, UserRoundCheck } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { checkInAction, checkOutAction } from "@/features/attendance/actions/attendance-actions";
import { ApplyLeaveModal } from "@/features/attendance/components/apply-leave-modal";
import { CheckInCaptureModal } from "@/features/attendance/components/check-in-capture-modal";
import type { ActionRequiredItem } from "@/features/attendance/types";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { PulseHomeData, PulsePerson } from "../queries";
import type { DayTone } from "../utils";

const TONE_CLASS: Record<DayTone, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  danger: "text-rose-600 dark:text-rose-400",
  warning: "text-amber-600 dark:text-amber-400",
  muted: "text-muted-foreground",
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

function personLabel(p: Pick<PulsePerson, "employeeId" | "name">) {
  return p.employeeId ? (
    <>
      <span className="text-muted-foreground">{p.employeeId} - </span>
      {p.name}
    </>
  ) : (
    p.name
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Today's worked time as [hh, mm, ss], ticking every second while checked in. */
function useWorkedClock(bankedMinutes: number, liveSince: string | null): [string, string, string] {
  // Null until mounted, so the server render and the first client render agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (!liveSince) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [liveSince]);

  let seconds = bankedMinutes * 60;
  if (liveSince && now !== null) seconds += Math.max(0, Math.floor((now - new Date(liveSince).getTime()) / 1000));
  return [pad(Math.floor(seconds / 3600)), pad(Math.floor((seconds % 3600) / 60)), pad(seconds % 60)];
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
  const [hh, mm, ss] = useWorkedClock(today.bankedMinutes, today.liveSince);

  const busy = isRefreshing;

  return (
    <div className="relative rounded-2xl border bg-card px-5 pb-5 pt-16 text-center shadow-xs">
      <UserAvatar
        userId={me.id}
        name={me.name}
        email={me.email}
        image={me.image}
        title=""
        className="absolute -top-14 left-1/2 h-28 w-28 -translate-x-1/2 rounded-2xl border-4 border-card bg-primary/10 text-3xl font-bold text-primary shadow-md"
      >
        {initials(me.name)}
      </UserAvatar>

      <p className="text-sm font-semibold text-foreground">{personLabel(me)}</p>
      {me.title && <p className="mt-0.5 text-xs text-muted-foreground">{me.title}</p>}

      <p className={cn("mt-3 text-sm font-medium", TONE_CLASS[me.presence.tone])}>{me.presence.label}</p>

      <div className="mt-3 flex items-center justify-center gap-1.5 font-mono text-lg font-semibold text-foreground">
        {[hh, mm, ss].map((part, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-muted-foreground">:</span>}
            <span className="min-w-10 rounded-lg bg-muted px-2 py-1.5 tabular-nums">{part}</span>
          </React.Fragment>
        ))}
      </div>

      {today.isLive ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setCaptureMode("check-out")}
          className="mt-4 inline-flex min-w-32 items-center justify-center gap-2 rounded-lg border border-rose-500 px-5 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Check-out
        </button>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2.5">
          {!today.checkedIn && (
            <div className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-xs font-semibold">
              {(["OFFICE", "REMOTE"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setWorkMode(mode)}
                  className={cn(
                    "rounded-md px-3 py-1 transition-colors",
                    workMode === mode ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode === "OFFICE" ? "Office" : "Remote"}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setCaptureMode("check-in")}
            className="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
          startRefresh(() => router.refresh());
          return null;
        }}
      />
    </div>
  );
}

function PersonRow({ person, caption }: { person: PulsePerson; caption?: string }) {
  return (
    <div className="flex items-center gap-3">
      <UserAvatar
        userId={person.id}
        name={person.name}
        email={person.email}
        image={person.image}
        className="h-12 w-12 rounded-lg bg-primary/10 text-sm font-bold text-primary"
      >
        {initials(person.name)}
      </UserAvatar>
      <div className="min-w-0 text-sm">
        {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
        <p className="truncate font-semibold text-foreground">{personLabel(person)}</p>
        <p className={cn("text-xs font-medium", TONE_CLASS[person.presence.tone])}>{person.presence.label}</p>
      </div>
    </div>
  );
}

// ── Right column cards ───────────────────────────────────────────────────────

function CardIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
      {children}
    </div>
  );
}

function Card({ icon, children, className }: { icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex gap-4 rounded-2xl border bg-card p-5 shadow-xs", className)}>
      {icon && <CardIcon>{icon}</CardIcon>}
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

function GreetingCard({ data }: { data: PulseHomeData }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-xs">
      <p className="text-base font-semibold text-foreground">
        {data.greeting} <span className="ml-1">{data.me.name}</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{data.todayLabel}</p>
      <p className={cn("mt-1 text-sm font-medium", TONE_CLASS[data.me.presence.tone])}>{data.todaySummary}</p>
    </section>
  );
}

function LossOfPayCard({ lop }: { lop: PulseHomeData["lossOfPay"] }) {
  return (
    <Card icon={<TreePalm className="h-5 w-5" />}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Loss of Pay Summary</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{lop.rangeLabel}</p>
        </div>
        <span className="rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          Total loss of pay{" "}
          <span className={cn("font-semibold", lop.totalDays > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
            {lop.totalDays} {lop.totalDays === 1 ? "day" : "days"}
          </span>
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        {lop.breakdown.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {lop.breakdown.map((b) => (
              <div key={b.label} className="rounded-lg border border-l-4 border-l-rose-500 px-4 py-2">
                <p className="text-sm font-semibold text-foreground">{b.label}</p>
                <p className="text-xs text-muted-foreground">
                  {b.days} {b.days === 1 ? "day" : "days"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No loss of pay for this period.</p>
        )}
        <Link
          href={`${ROUTES.pulseReports}?report=my-payroll`}
          className="text-sm font-semibold text-primary hover:underline"
        >
          View Details
        </Link>
      </div>
    </Card>
  );
}

function WorkScheduleCard({ schedule }: { schedule: PulseHomeData["schedule"] }) {
  return (
    <Card icon={<CalendarClock className="h-5 w-5" />}>
      <h2 className="text-base font-semibold text-foreground">Work Schedule</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{schedule.rangeLabel}</p>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="relative grid grid-cols-7">
            <div className="absolute left-0 right-0 top-[5px] h-px bg-border" />
            {schedule.days.map((day) => (
              <div key={day.key} className="relative pr-2">
                <span
                  className={cn(
                    "relative block h-2.5 w-2.5 rounded-full",
                    day.isToday ? "bg-primary ring-4 ring-primary/20" : "bg-muted-foreground/60"
                  )}
                />
                <p className="mt-3 text-sm text-muted-foreground">
                  {day.dayShort}{" "}
                  <span
                    className={cn(
                      "font-semibold text-foreground",
                      day.isToday && "rounded bg-primary px-1 text-primary-foreground"
                    )}
                  >
                    {day.dayNum}
                  </span>
                </p>
                {day.status && (
                  <p className={cn("mt-1 text-sm font-medium", TONE_CLASS[day.status.tone])}>{day.status.label}</p>
                )}
                {day.times && (
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    <p className="whitespace-nowrap">
                      <span className="inline-block w-7">In</span>
                      {day.times.in}
                    </p>
                    <p className="whitespace-nowrap">
                      <span className="inline-block w-7">Out</span>
                      {day.times.out}
                    </p>
                  </div>
                )}
                {day.hours && <p className="mt-1 text-sm font-semibold text-foreground">{day.hours}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function HolidaysCard({ holidays }: { holidays: PulseHomeData["holidays"] }) {
  return (
    <Card icon={<TreePalm className="h-5 w-5" />}>
      <h2 className="text-base font-semibold text-foreground">Upcoming Holidays</h2>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {holidays.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming holidays.</p>
        ) : (
          holidays.map((h) => (
            <div key={h.id} className="rounded-lg border px-4 py-2">
              <p className="text-sm font-semibold text-foreground">
                {h.name}
                {h.isOptional && <span className="ml-1 text-xs font-normal text-muted-foreground">(Optional)</span>}
              </p>
              <p className="text-xs text-muted-foreground">{h.dateLabel}</p>
            </div>
          ))
        )}
        <Link
          href={`${ROUTES.pulseLeave}?tab=holidays`}
          className="text-sm font-semibold text-primary hover:underline"
        >
          View all
        </Link>
      </div>
    </Card>
  );
}

function AbsentDaysCard({ days, onApply }: { days: PulseHomeData["absentDays"]; onApply: (d: ActionRequiredItem) => void }) {
  if (days.length === 0) return null;
  return (
    <Card icon={<UserRoundCheck className="h-5 w-5" />}>
      <h2 className="text-base font-semibold text-foreground">
        Apply leave for the days on which attendance is marked as absent.
      </h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {days.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onApply(d)}
            title="Apply leave for this day"
            className="rounded-lg border border-l-4 border-l-rose-500 px-4 py-2 text-left transition-colors hover:bg-muted/50"
          >
            <p className="text-sm font-semibold text-foreground">
              {d.date.split("-").reverse().join("/")}, {d.dayName}
            </p>
            <p className="text-xs text-muted-foreground">
              {d.absentDays} {d.absentDays === 1 ? "day" : "days"} · {d.issue}
            </p>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── Cover banner: a rising sun over hills (inline SVG, no image asset) ────────

const SUN_RAYS = Array.from({ length: 13 }, (_, i) => -90 + (i - 6) * 13);

function SunriseBanner() {
  return (
    <div className="relative h-36 shrink-0 overflow-hidden" aria-hidden="true">
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

        {/* Rays */}
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

        {/* Sun, half above the horizon */}
        <circle cx="800" cy="185" r="95" fill="url(#pulse-sun)" />

        {/* Clouds */}
        <g fill="#fff7ed" fillOpacity="0.55">
          <ellipse cx="330" cy="62" rx="90" ry="14" />
          <ellipse cx="380" cy="50" rx="55" ry="14" />
          <ellipse cx="1240" cy="78" rx="110" ry="15" />
          <ellipse cx="1300" cy="64" rx="60" ry="14" />
        </g>

        {/* Hills */}
        <path d="M0 170 C 250 120, 450 150, 650 165 S 1050 125, 1300 150 S 1500 160, 1600 140 L1600 200 L0 200 Z" fill="#7c2d12" fillOpacity="0.55" />
        <path d="M0 185 C 300 150, 520 175, 800 180 S 1250 150, 1600 170 L1600 200 L0 200 Z" fill="#431407" fillOpacity="0.8" />
      </svg>
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
    ...(data.canManage ? [{ label: "Approvals", href: "/pulse/leave/team" }] : []),
    { label: "Leave", href: ROUTES.pulseLeave },
    { label: "Attendance", href: ROUTES.pulseAttendance },
    { label: "Regularization", href: ROUTES.pulseRegularization },
    { label: "Reports", href: ROUTES.pulseReports },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <SunriseBanner />

      <div className="mx-auto -mt-16 grid w-full max-w-[1600px] grid-cols-1 gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left column */}
        <aside className="space-y-4 pt-12 lg:pt-14">
          <CheckInCard data={data} />

          {data.manager && (
            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <PersonRow person={data.manager} caption="Reporting Manager" />
            </div>
          )}

          {data.members.length > 0 && (
            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <h2 className="mb-3 text-base font-semibold text-foreground">{data.departmentLabel}</h2>
              <div className="max-h-[420px] space-y-0 divide-y overflow-y-auto pr-1">
                {data.members.map((m) => (
                  <div key={m.id} className="py-3 first:pt-0 last:pb-0">
                    <PersonRow person={m} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Right column */}
        <main className="min-w-0 space-y-4">
          <nav className="flex gap-1 overflow-x-auto rounded-2xl border bg-card px-3 shadow-xs">
            {tabs.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                aria-current={t.active ? "page" : undefined}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-4 text-sm font-medium transition-colors",
                  t.active
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          <GreetingCard data={data} />
          <LossOfPayCard lop={data.lossOfPay} />
          <WorkScheduleCard schedule={data.schedule} />
          <HolidaysCard holidays={data.holidays} />
          <AbsentDaysCard days={data.absentDays} onApply={setApplyFor} />
        </main>
      </div>

      <ApplyLeaveModal
        isOpen={applyFor !== null}
        item={applyFor}
        onClose={() => setApplyFor(null)}
        onSubmitSuccess={() => router.refresh()}
      />
    </div>
  );
}
