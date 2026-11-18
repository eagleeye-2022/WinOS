"use client";

// A manager's view of ONE team member's leave (like Zoho People's employee leave page):
// Leave Summary, Leave Requests, Compensatory Request, Customize Balance and Customize Policy.
// Everything is that person's data; applying / adjusting is done on their behalf.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PULSE_PAGE_BG, PulseStickyTabs, PulseTabs, StatusPill } from "@/components/pulse/pulse-ui";
import { usePulseCrumbs } from "@/components/pulse/pulse-breadcrumbs";
import { EmployeeSwitcherHeader, type SwitcherEmployee } from "@/components/pulse/employee-switcher-header";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { toast } from "@/components/shared/toast";
import { istYear } from "@/features/attendance/utils";
import type { CompensatoryRequest, LeaveRequest, LeaveTypeConfig } from "../types";
import { LeaveBalanceGrid } from "./leave-balance-grid";
import { LeaveRequestsTable } from "./leave-requests-table";
import { CompensatoryRequestsTable } from "./compensatory-requests-table";
import { CustomizeBalanceTable } from "./customize-balance-table";
import { ApplyLeaveForm } from "./apply-leave-form";
import { leaveTypeIcon } from "./leave-balance-card";
import {
  getEmployeeLeavePolicyAction,
  getLeaveApplicantOptionsAction,
  getMyLeaveTrackerDataAction,
} from "../queries/leave-queries";

// "policy" (Customize Policy) is hidden for now — add it back to TABS to show the tab again.
const TABS = ["summary", "requests", "compensatory", "balance" /* , "policy" */] as const;
type Tab = (typeof TABS)[number] | "policy";
const TAB_LABEL: Record<Tab, string> = {
  summary: "Leave Summary",
  requests: "Leave Requests",
  compensatory: "Compensatory Request",
  balance: "Customize Balance",
  policy: "Customize Policy",
};

type TrackerData = Awaited<ReturnType<typeof getMyLeaveTrackerDataAction>>;
type PolicyData = Awaited<ReturnType<typeof getEmployeeLeavePolicyAction>>;

const dmy = (key: string) => key.split("-").reverse().join("/");

/**
 * `embedded`: shown as a tab inside the member's profile — no page frame, no breadcrumb, and no
 * member switcher (the profile header already says who this is).
 */
export function EmployeeLeaveWorkspace({ userId, embedded = false }: { userId: string; embedded?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useUrlState<Tab>("tab", "summary", { allowed: TABS, history: "push" });
  const thisYear = istYear();
  const [yearParam, setYearParam] = useUrlState("year", String(thisYear));
  const year = Number(yearParam) || thisYear;

  const [data, setData] = useState<TrackerData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  /** Apply Leave form, optionally for one absent day. */
  const [applyFor, setApplyFor] = useState<{ date?: string } | null>(null);

  const load = useCallback(() => {
    getMyLeaveTrackerDataAction(year, userId)
      .then((d) => {
        setData(d);
        setLoadError(null);
      })
      .catch(() => setLoadError("Couldn't load this team member's leave. You may not manage them."));
  }, [year, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getLeaveApplicantOptionsAction().then(setOptions).catch(() => setOptions([]));
  }, []);

  const name = data?.profile.name ?? "Team Member";
  usePulseCrumbs(
    useMemo(
      () =>
        embedded
          ? null
          : [
              { label: name, onClick: () => { setApplyFor(null); setTab("summary"); } },
              { label: applyFor ? "Apply Leave" : TAB_LABEL[tab] },
            ],
      [name, tab, applyFor, setTab, embedded]
    )
  );

  useEffect(() => {
    if (!embedded) document.title = `${name} · ${TAB_LABEL[tab]} | WinOS`;
  }, [name, tab, embedded]);

  const leaveTypes: LeaveTypeConfig[] = useMemo(
    () =>
      (data?.balances ?? []).map((b) => ({
        id: b.id,
        code: b.code as LeaveTypeConfig["code"],
        name: b.name,
        remainingDays: b.remainingDays,
        bookedDays: b.bookedDays,
        unit: b.unit,
        iconName: b.iconName,
        iconBgColor: b.iconBgColor,
        iconTextColor: b.iconTextColor,
      })),
    [data]
  );
  const requests = (data?.requests ?? []) as unknown as LeaveRequest[];
  const yearRequests = requests.filter((r) => r.fromDate.startsWith(String(year)) || r.toDate.startsWith(String(year)));

  const switchEmployee = (id: string) => {
    const qs = tab === "summary" ? "" : `?tab=${tab}`;
    router.push(`/pulse/leave/employee/${id}${qs}`);
  };

  if (!data && !loadError) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn("h-full p-6", PULSE_PAGE_BG)}>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {loadError}
        </div>
      </div>
    );
  }

  const employee: SwitcherEmployee = {
    id: data.profile.id,
    name: data.profile.name,
    image: data.profile.image,
    title: data.profile.title,
    department: data.profile.department,
    employeeCode: data.profile.employeeCode,
  };

  return (
    <div
      className={cn(
        "flex select-none flex-col space-y-4",
        // Embedded: the host page already scrolls and has its own background and padding.
        !embedded && "h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-6",
        !embedded && PULSE_PAGE_BG
      )}
    >
      {applyFor ? (
        <ApplyLeaveForm
          leaveTypes={leaveTypes}
          initialForUserId={userId}
          initialDate={applyFor.date}
          onSubmitLeave={(req) => {
            toast.success(`Leave applied for ${name}: ${req.durationText}.`);
            setApplyFor(null);
            load();
          }}
          onCancel={() => setApplyFor(null)}
        />
      ) : (
        <>
          {embedded ? (
            <PulseTabs tabs={TABS.map((t) => ({ label: TAB_LABEL[t], active: tab === t, onClick: () => setTab(t) }))} />
          ) : (
            <>
              <EmployeeSwitcherHeader
                employee={employee}
                options={options}
                onSwitch={switchEmployee}
                actions={
                  <Button asChild variant="outline" className="h-8 gap-1.5 rounded-md px-3 text-xs font-semibold">
                    <Link href={`/pulse/team-attendance/${userId}`}>
                      <CalendarDays className="h-3.5 w-3.5" />
                      Attendance
                    </Link>
                  </Button>
                }
              />

              {/* Under the header (not at the very top), so cancel the sticky bar's top bleed. */}
              <PulseStickyTabs
                className="mt-0 pt-0 sm:mt-0 sm:pt-0"
                tabs={TABS.map((t) => ({ label: TAB_LABEL[t], active: tab === t, onClick: () => setTab(t) }))}
              />
            </>
          )}

          {tab === "summary" && (
            <SummaryTab
              year={year}
              thisYear={thisYear}
              onYear={(y) => setYearParam(String(y))}
              data={data}
              leaveTypes={leaveTypes}
              requests={yearRequests}
              onApply={(date) => setApplyFor({ date })}
              onViewRequest={(r) => router.push(`/pulse/leave/team/requests/${r.id}`)}
            />
          )}

          {tab === "requests" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-lg font-semibold text-foreground">Leave Requests</h1>
                <ApplyButton onClick={() => setApplyFor({})} />
              </div>
              <LeaveRequestsTable
                requests={requests}
                onViewRequest={(r) => router.push(`/pulse/leave/team/requests/${r.id}`)}
                showFilters
                showDateRangeNav={false}
                title=""
              />
            </div>
          )}

          {tab === "compensatory" && (
            <CompensatoryRequestsTable
              requests={(data.compensatoryRequests ?? []) as unknown as CompensatoryRequest[]}
              onViewRequest={(r) => router.push(`/pulse/leave/team/compensatory/${r.id}`)}
            />
          )}

          {tab === "balance" && <CustomizeBalanceTable userId={userId} onSaved={load} />}

          {tab === "policy" && <PolicyTab userId={userId} name={name} />}
        </>
      )}
    </div>
  );
}

function ApplyButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className="h-9 self-start rounded-md bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 sm:self-auto"
    >
      <Plus className="h-4 w-4" />
      Apply Leave
    </Button>
  );
}

// ── Leave Summary ────────────────────────────────────────────────────────────

function SummaryTab({
  year,
  thisYear,
  onYear,
  data,
  leaveTypes,
  requests,
  onApply,
  onViewRequest,
}: {
  year: number;
  thisYear: number;
  onYear: (year: number) => void;
  data: TrackerData;
  leaveTypes: LeaveTypeConfig[];
  requests: LeaveRequest[];
  onApply: (date?: string) => void;
  onViewRequest: (r: LeaveRequest) => void;
}) {
  const absent = data.absentList ?? [];
  return (
    <div className="space-y-4">
      {/* Toolbar: year totals, year navigation, Apply Leave */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground">
          Leave booked {year === thisYear ? "this year" : `in ${year}`}:{" "}
          <span className="font-semibold text-foreground">{data.stats.bookedThisYear} day(s)</span>
          <span className="mx-2 text-border">|</span>
          Absent: <span className={cn("font-semibold", data.stats.absentDays > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>{data.stats.absentDays} day(s)</span>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-border/80 bg-background">
            <button
              type="button"
              onClick={() => onYear(year - 1)}
              aria-label="Previous year"
              className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-semibold tabular-nums text-foreground">
              01/01/{year} – 31/12/{year}
            </span>
            <button
              type="button"
              onClick={() => onYear(year + 1)}
              disabled={year >= thisYear}
              aria-label="Next year"
              className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {year !== thisYear && (
            <button
              type="button"
              onClick={() => onYear(thisYear)}
              className="h-8 rounded-md border border-border/80 bg-background px-3 text-xs font-semibold text-foreground hover:bg-accent"
            >
              This year
            </button>
          )}
          <ApplyButton onClick={() => onApply()} />
        </div>
      </div>

      {/* Balance cards — clicking one applies leave on their behalf */}
      <LeaveBalanceGrid leaveTypes={leaveTypes} onSelectType={() => onApply()} />

      {/* Absent days — each can be covered by a leave */}
      <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 border-b border-border/70 px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Absent</h2>
          <span className="text-xs text-muted-foreground">· {data.stats.absentDays} day(s)</span>
        </div>
        {absent.length === 0 ? (
          <p className="px-5 py-6 text-center text-xs text-muted-foreground">No absent days in {year}.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/60">
                {absent.map((a) => (
                  <tr key={a.dateKey}>
                    <td className="px-5 py-2.5 text-foreground">
                      {dmy(a.dateKey)}, {a.dayName}
                    </td>
                    <td className="px-5 py-2.5 text-muted-foreground">{a.days === 1 ? "1 day" : `${a.days} day`}</td>
                    <td className="px-5 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onApply(a.dateKey)}
                        className="h-8 rounded-md border-blue-500 px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                      >
                        Apply Leave
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Their requests in this year */}
      <LeaveRequestsTable
        requests={requests}
        onViewRequest={onViewRequest}
        showFilters={false}
        showDateRangeNav={false}
        title={`REQUESTS IN ${year}`}
      />
    </div>
  );
}

// ── Customize Policy (read-only) ─────────────────────────────────────────────

function PolicyTab({ userId, name }: { userId: string; name: string }) {
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEmployeeLeavePolicyAction(userId)
      .then((p) => !cancelled && setPolicy(p))
      .catch(() => !cancelled && setError("Couldn't load leave policies."));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!policy) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const applies = policy.policies.filter((p) => p.applies).length;
  const facts = [
    ["Member type", policy.employee.employmentType || "Not set"],
    ["Department", policy.employee.department || "Not set"],
    ["Date of joining", policy.employee.dateOfJoining || "Not set"],
    ["Probation", policy.employee.confirmed ? "Confirmed" : "On probation / not confirmed"],
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/70 bg-card px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {applies} of {policy.policies.length} leave types apply to {name}
          </h2>
          <Link href="/pulse/leave/team?tab=leave-policy" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
            Edit leave types in Leave Policy →
          </Link>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Rules are set per leave type and checked against this profile from User Management. Per-person overrides aren&apos;t
          supported yet.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-md bg-muted/40 px-3 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 font-semibold text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {policy.policies.map((p) => {
          const Icon = leaveTypeIcon(p.icon);
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
                p.applies ? "border-border/70" : "border-dashed border-border opacity-80"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", p.iconBg, p.iconText)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.code} · {p.category} · {p.entitlement}
                    </p>
                  </div>
                </div>
                {p.applies ? (
                  <StatusPill tone="green">
                    <CheckCircle2 className="h-3 w-3" /> Applies
                  </StatusPill>
                ) : (
                  <StatusPill tone="gray">
                    <XCircle className="h-3 w-3" /> Not eligible
                  </StatusPill>
                )}
              </div>
              {p.blockedBy && <p className="text-xs text-rose-600 dark:text-rose-400">{p.blockedBy}</p>}
              <ul className="flex flex-wrap gap-1.5">
                {p.rules.map((r) => (
                  <li key={r} className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
