import Link from "next/link";
import { ArrowRight, AlertCircle, BarChart2, ClipboardList, Users2, User } from "lucide-react";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { SupportNeededIcon } from "@/components/icons/support-needed-icon";
import { getTodayEntry } from "@/features/dsm/queries";
import { getCurrentDsrEntry } from "@/features/dsr/queries";
import { getMyBlockers } from "@/features/blockers/queries";
import { getMySupportNeeds } from "@/features/support-needed/queries";
import { getAllDsmStats } from "@/features/dsm/manager/queries";
import { getAllDsrStats } from "@/features/dsr/manager/queries";
import type { AllDsmStats } from "@/features/dsm/manager/queries";
import type { AllDsrStats } from "@/features/dsr/manager/queries";
import { DashboardGreeting } from "@/components/shared/dashboard-greeting";

// ── Shared helpers ────────────────────────────────────────────────────────────

type EntryStatus = "DRAFT" | "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "MISSED" | null;



function firstName(nameOrEmail: string) {
  return nameOrEmail.split(" ")[0].split("@")[0];
}

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function StatusBadge({ status }: { status: EntryStatus }) {
  if (!status) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        Not Started
      </span>
    );
  }
  const styles: Record<NonNullable<EntryStatus>, string> = {
    SUBMITTED:      "bg-success/10 text-success",
    PENDING_REVIEW: "bg-info/10 text-info",
    REVIEWED:       "bg-primary/10 text-primary",
    DRAFT:          "bg-warning/10 text-warning",
    MISSED:         "bg-danger/10 text-danger",
  };
  const labels: Record<NonNullable<EntryStatus>, string> = {
    SUBMITTED: "Submitted", PENDING_REVIEW: "Pending Review",
    REVIEWED: "Reviewed", DRAFT: "Draft", MISSED: "Missed",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", styles[status])}>
      {labels[status]}
    </span>
  );
}

function ProjectBadge({ status }: { status: "On Track" | "At Risk" | "Needs Attention" }) {
  if (status === "At Risk") return null;
  const styles = {
    "On Track":        "bg-success/10 text-success",
    "At Risk":         "bg-warning/10 text-warning",
    "Needs Attention": "bg-danger/10 text-danger",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", styles[status])}>
      {status}
    </span>
  );
}

// ── Manager dashboard ─────────────────────────────────────────────────────────

function ManagerDashboard({
  name,
  dsmStats,
  dsrStats,
}: {
  name: string;
  dsmStats: AllDsmStats | null;
  dsrStats: AllDsrStats | null;
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <DashboardGreeting name={firstName(name)} />
        <p className="mt-0.5 text-sm text-muted-foreground">{todayLabel()}</p>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={ROUTES.dsmAll}
          className="group rounded-lg border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-accent/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ClipboardList size={15} strokeWidth={1.75} />
              Today&apos;s Team DSM
            </div>
            {dsmStats && <ProjectBadge status={dsmStats.projectStatus} />}
          </div>
          <div className="mt-3">
            {dsmStats ? (
              <>
                <p className="text-3xl font-bold tabular-nums">
                  {dsmStats.totalSubmitted}
                  <span className="text-lg font-normal text-muted-foreground">
                    /{dsmStats.totalExpected}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dsmStats.pendingCount === 0
                    ? "All Members Submitted"
                    : `${dsmStats.pendingCount} Member${dsmStats.pendingCount !== 1 ? "s" : ""} Yet to Submit`}
                  {dsmStats.blockerCount > 0 &&
                    ` · ${dsmStats.blockerCount} Active Blocker${dsmStats.blockerCount !== 1 ? "s" : ""}`}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No Data</p>
            )}
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
            View All DSM <ArrowRight size={12} />
          </div>
        </Link>

        <Link
          href={ROUTES.dsrManage}
          className="group rounded-lg border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-accent/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BarChart2 size={15} strokeWidth={1.75} />
              Evening Reviews (DSR)
            </div>
            {dsrStats && <ProjectBadge status={dsrStats.projectStatus} />}
          </div>
          <div className="mt-3">
            {dsrStats ? (
              <>
                <p className="text-3xl font-bold tabular-nums">
                  {dsrStats.totalSubmitted}
                  <span className="text-lg font-normal text-muted-foreground">
                    /{dsrStats.totalExpected}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dsrStats.pendingCount === 0
                    ? "All Members Submitted"
                    : `${dsrStats.pendingCount} Pending Submission${dsrStats.pendingCount !== 1 ? "s" : ""}`}
                  {dsrStats.highPriorityBlockers > 0 &&
                    ` · ${dsrStats.highPriorityBlockers} High-Priority Blocker${dsrStats.highPriorityBlockers !== 1 ? "s" : ""}`}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No Data</p>
            )}
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Review DSR Submissions <ArrowRight size={12} />
          </div>
        </Link>
      </div>

      {/* Quick-action links */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Quick Actions
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              { label: "My DSM",         desc: "My Daily Standup",         icon: User,          href: ROUTES.dsmMy },
              { label: "All DSM",        desc: "Team Standup Overview",    icon: ClipboardList, href: ROUTES.dsmAll },
              { label: "DSR Reviews",    desc: "Evening Review Queue",     icon: BarChart2,     href: ROUTES.dsrManage },
              { label: "Blockers",       desc: "Team Blockers & Issues",   icon: AlertCircle,   href: ROUTES.blockers },
              { label: "Support Needed", desc: "Pending Support Requests", icon: SupportNeededIcon, href: ROUTES.support },
            ] as const
          ).map(({ label, desc, icon: Icon, href }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/30"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
                <Icon size={label === "Support Needed" ? 17 : 15} strokeWidth={1.75} className="text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold">{label}</p>
                <p className="truncate text-sm text-muted-foreground">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Team-member dashboard ─────────────────────────────────────────────────────

function MemberDashboard({
  name,
  dsmStatus,
  dsrStatus,
  unresolvedBlockers,
  pendingSupports,
}: {
  name: string;
  dsmStatus: EntryStatus;
  dsrStatus: EntryStatus;
  unresolvedBlockers: number;
  pendingSupports: number;
}) {
  const dsmNeedsAction = !dsmStatus || dsmStatus === "DRAFT";
  const dsrNeedsAction = !dsrStatus || dsrStatus === "DRAFT";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <DashboardGreeting name={firstName(name)} />
        <p className="mt-0.5 text-sm text-muted-foreground">{todayLabel()}</p>
      </div>

      {/* Today's status cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={ROUTES.dsm}
          className="group rounded-lg border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-accent/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ClipboardList size={15} strokeWidth={1.75} />
              Today&apos;s DSM
            </div>
            <StatusBadge status={dsmStatus} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {dsmStatus === "DRAFT"
              ? "You Have a Saved Draft — Continue and Submit."
              : dsmNeedsAction
              ? "You Haven't Submitted Your Standup Yet."
              : "Standup Submitted for Today."}
          </p>
          <div
            className={cn(
              "mt-4 flex items-center gap-1 text-xs font-medium transition-opacity",
              dsmNeedsAction
                ? "text-primary"
                : "text-muted-foreground opacity-0 group-hover:opacity-100",
            )}
          >
            {dsmStatus === "DRAFT"
              ? "Continue Draft"
              : dsmNeedsAction
              ? "Submit Now"
              : "View Standup"}
            <ArrowRight size={12} />
          </div>
        </Link>

        <Link
          href={ROUTES.dsr}
          className="group rounded-lg border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-accent/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BarChart2 size={15} strokeWidth={1.75} />
              Today&apos;s DSR
            </div>
            <StatusBadge status={dsrStatus} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {dsrStatus === "DRAFT"
              ? "Evening Review Is in Draft — Complete and Submit."
              : dsrNeedsAction
              ? "Complete Your Evening Status Review."
              : "Evening Review Submitted."}
          </p>
          <div
            className={cn(
              "mt-4 flex items-center gap-1 text-xs font-medium transition-opacity",
              dsrNeedsAction
                ? "text-primary"
                : "text-muted-foreground opacity-0 group-hover:opacity-100",
            )}
          >
            {dsrStatus === "DRAFT"
              ? "Complete Review"
              : dsrNeedsAction
              ? "Start Review"
              : "View Review"}
            <ArrowRight size={12} />
          </div>
        </Link>
      </div>

      {/* Blockers + support */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={ROUTES.blockers}
          className="group flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/30"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
              <AlertCircle
                size={15}
                strokeWidth={1.75}
                className={unresolvedBlockers > 0 ? "text-warning" : "text-muted-foreground"}
              />
            </span>
            <div>
              <p className="text-sm font-medium">My Blockers</p>
              <p className="text-xs text-muted-foreground">
                {unresolvedBlockers === 0 ? "No Open Blockers" : `${unresolvedBlockers} Unresolved`}
              </p>
            </div>
          </div>
          <ArrowRight
            size={14}
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          />
        </Link>

        <Link
          href={ROUTES.support}
          className="group flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/30"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
              <SupportNeededIcon
                size={17}
                strokeWidth={1.75}
                className={pendingSupports > 0 ? "text-info" : "text-muted-foreground"}
              />
            </span>
            <div>
              <p className="text-sm font-medium">Support Needed</p>
              <p className="text-xs text-muted-foreground">
                {pendingSupports === 0
                  ? "No Open Requests"
                  : `${pendingSupports} Open Request${pendingSupports !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <ArrowRight
            size={14}
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          />
        </Link>
      </div>
    </div>
  );
}

// ── Page (role-aware data fetch) ──────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();
  const isManager = session?.user?.role === "MANAGER";
  const name = session?.user?.name ?? session?.user?.email ?? "";

  if (isManager) {
    const [dsmStats, dsrStats] = await Promise.all([getAllDsmStats(), getAllDsrStats()]);
    return <ManagerDashboard name={name} dsmStats={dsmStats} dsrStats={dsrStats} />;
  }

  const [todayDsm, todayDsr, blockers, supports] = await Promise.all([
    getTodayEntry(),
    getCurrentDsrEntry(),
    getMyBlockers(),
    getMySupportNeeds(),
  ]);

  return (
    <MemberDashboard
      name={name}
      dsmStatus={todayDsm?.status ?? null}
      dsrStatus={todayDsr?.status ?? null}
      unresolvedBlockers={blockers.filter((b) => !b.resolved).length}
      pendingSupports={supports.filter((s) => !s.resolved).length}
    />
  );
}
