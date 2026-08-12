"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Users, Clock, Ban, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn, toTitleCase } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import type { AllDsrStats } from "../queries";

export type StatMember = {
  userId: string;
  name: string | null;
  email: string;
  teamName: string;
  meta?: string;
};

type Props = {
  stats: AllDsrStats;
  submittedMembers?: StatMember[];
  pendingMembers?: StatMember[];
  blockerMembers?: StatMember[];
};

function displayNameOf(member: Pick<StatMember, "name" | "email">) {
  const raw = member.name ?? member.email.split("@")[0];
  return toTitleCase(raw);
}

// ── Shared DSR member-list dropdown ────────────────────────────────────────────

function MemberListDropdown({
  title,
  members,
  emptyLabel,
  icon,
  iconClassName,
}: {
  title: string;
  members: StatMember[];
  emptyLabel: string;
  icon: React.ElementType;
  iconClassName: string;
}) {
  const Icon = icon;
  return (
    <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-xl border bg-card p-2 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
      <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <div className="max-h-72 overflow-y-auto">
        {members.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          members.map((m) => (
            <Link
              key={m.userId}
              href={ROUTES.dsrMember(m.userId)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent"
            >
              <Icon size={13} className={cn("shrink-0", iconClassName)} />
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                {displayNameOf(m)}
              </span>
              {m.meta && (
                <span className="shrink-0 text-xs text-muted-foreground">{m.meta}</span>
              )}
              <span className="shrink-0 text-xs text-muted-foreground/70">{m.teamName}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

// ── Stats row ─────────────────────────────────────────────────────────────────

export function AllDsrStatsRow({
  stats,
  submittedMembers = [],
  pendingMembers = [],
  blockerMembers = [],
}: Props) {
  const { totalSubmitted, totalExpected, pendingCount, highPriorityBlockers, projectStatus } = stats;

  const [openCard, setOpenCard] = useState<"submitted" | "pending" | "blockers" | "status" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openCard) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenCard(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openCard]);

  const toggle = (card: "submitted" | "pending" | "blockers" | "status") =>
    setOpenCard((v) => (v === card ? null : card));

  return (
    <div ref={containerRef} className="grid grid-cols-4 gap-4 items-stretch">
      {/* Submitted */}
      <div className="relative flex">
        <button
          type="button"
          onClick={() => toggle("submitted")}
          className="flex h-full w-full items-center gap-4 rounded-xl border bg-card p-4 shadow-sm text-left transition-colors hover:bg-accent cursor-pointer"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Users size={18} className="text-primary" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-2xl font-bold">
              {totalSubmitted}
              <span className="text-sm font-normal text-muted-foreground">/{totalExpected}</span>
            </p>
          </div>
        </button>
        {openCard === "submitted" && (
          <MemberListDropdown
            title="Submitted DSR"
            members={submittedMembers}
            emptyLabel="No Submissions Yet."
            icon={CheckCircle2}
            iconClassName="text-success"
          />
        )}
      </div>

      {/* Pending */}
      <div className="relative flex">
        <button
          type="button"
          onClick={() => toggle("pending")}
          className="flex h-full w-full items-center gap-4 rounded-xl border bg-card p-4 shadow-sm text-left transition-colors hover:bg-accent cursor-pointer"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/15">
            <Clock size={18} className="text-warning" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </div>
        </button>
        {openCard === "pending" && (
          <MemberListDropdown
            title="Pending DSR Submissions"
            members={pendingMembers}
            emptyLabel="No Pending Members."
            icon={AlertTriangle}
            iconClassName="text-warning"
          />
        )}
      </div>

      {/* Blockers */}
      <div className="relative flex">
        <button
          type="button"
          onClick={() => toggle("blockers")}
          className="flex h-full w-full items-center gap-4 rounded-xl border bg-card p-4 shadow-sm text-left transition-colors hover:bg-accent cursor-pointer"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <Ban size={18} className="text-destructive" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Blockers</p>
            <p className={cn("text-2xl font-bold", highPriorityBlockers > 0 && "text-destructive")}>
              {highPriorityBlockers}
              {highPriorityBlockers > 0 && (
                <span className="ml-1 text-xs font-semibold">High Priority</span>
              )}
            </p>
          </div>
        </button>
        {openCard === "blockers" && (
          <MemberListDropdown
            title="Members with Blockers"
            members={blockerMembers}
            emptyLabel="No Active Blockers."
            icon={Ban}
            iconClassName="text-destructive"
          />
        )}
      </div>

      {/* Project status */}
      <div className="relative flex">
        <button
          type="button"
          onClick={() => toggle("status")}
          className="flex h-full w-full items-center gap-4 rounded-xl border bg-card p-4 shadow-sm text-left transition-colors hover:bg-accent cursor-pointer"
        >
          <span className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            projectStatus === "On Track" ? "bg-success/15" : "bg-warning/15"
          )}>
            <TrendingUp size={18} className={projectStatus === "On Track" ? "text-success" : "text-warning"} />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Project Status</p>
            <p className={cn(
              "text-lg font-bold",
              projectStatus === "On Track" ? "text-success" : "text-warning"
            )}>
              {projectStatus}
            </p>
          </div>
        </button>
        {openCard === "status" && (
          <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-xl border bg-card p-3 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Status Breakdown
            </p>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending Submissions</span>
                <span className="font-semibold">{pendingCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Open Blockers</span>
                <span className="font-semibold">{highPriorityBlockers}</span>
              </div>
            </div>
            <p className="mt-2.5 border-t pt-2.5 text-xs leading-relaxed text-muted-foreground">
              {highPriorityBlockers > 1
                ? "Multiple open blockers are affecting delivery — needs attention."
                : highPriorityBlockers === 1
                  ? "One open blocker is putting progress at risk."
                  : pendingCount > 0
                    ? "Some team members haven't submitted their DSR yet."
                    : "All submissions are in and there are no open blockers."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
