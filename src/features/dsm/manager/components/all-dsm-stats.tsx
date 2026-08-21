"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Users, Clock, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn, toTitleCase } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import type { AllDsmStats } from "../queries";

export type StatMember = {
  userId: string;
  name: string | null;
  email: string;
  teamName: string;
  meta?: string;
};

type Props = {
  stats: AllDsmStats;
  submittedMembers?: StatMember[];
  pendingMembers?: StatMember[];
  blockerMembers?: StatMember[];
  supportNeededMembers?: StatMember[];
  pendingReviewMembers?: StatMember[];
};

function displayNameOf(member: Pick<StatMember, "name" | "email">) {
  const raw = member.name ?? member.email.split("@")[0];
  return toTitleCase(raw);
}

// ── Shared member-list dropdown ────────────────────────────────────────────────

function MemberListDropdown({
  title,
  members,
  emptyLabel,
  icon,
  iconClassName,
  alignRight = false,
}: {
  title: string;
  members: StatMember[];
  emptyLabel: string;
  icon: React.ElementType;
  iconClassName: string;
  alignRight?: boolean;
}) {
  const Icon = icon;
  return (
    <div
      className={cn(
        "absolute top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border bg-card p-2 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150",
        alignRight ? "right-0" : "left-0"
      )}
    >
      <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 leading-snug">
        {title}
      </p>
      <div className="max-h-72 overflow-y-auto space-y-1">
        {members.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          members.map((m) => (
            <Link
              key={m.userId}
              href={ROUTES.dsmMember(m.userId)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-accent min-w-0"
            >
              <Icon size={14} className={cn("shrink-0", iconClassName)} />
              <span className="shrink-0 font-semibold text-foreground">
                {displayNameOf(m)}
              </span>
              {m.meta && (
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground font-normal" title={m.meta}>
                  {m.meta}
                </span>
              )}
              <span className="shrink-0 text-[11px] text-muted-foreground/70 font-medium">
                {m.teamName}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

// ── Stats row ─────────────────────────────────────────────────────────────────

// DSM Status card is commented out below — kept for re-enabling later.
// type DsmStatusLabel = "Pending Submission" | "Pending Review" | "Support Needed (Meeting)" | "Pending OT";
//
// function primaryDsmStatus(stats: AllDsmStats): DsmStatusLabel {
//   if (stats.pendingCount > 0) return "Pending Submission";
//   if (stats.pendingReviewCount > 0) return "Pending Review";
//   if (stats.supportNeededCount > 0) return "Support Needed (Meeting)";
//   return "Pending OT";
// }

export function AllDsmStatsRow({
  stats,
  submittedMembers = [],
  pendingMembers = [],
  blockerMembers = [],
  supportNeededMembers = [],
  pendingReviewMembers = [],
}: Props) {
  const { totalSubmitted, totalExpected, blockerCount, pendingCount, pendingReviewCount, supportNeededCount } = stats;

  const [openCard, setOpenCard] = useState<"submitted" | "pending" | "blockers" | "supportNeeded" | "pendingReview" | "status" | null>(null);
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

  const toggle = (card: "submitted" | "pending" | "blockers" | "supportNeeded" | "pendingReview" | "status") =>
    setOpenCard((v) => (v === card ? null : card));

  return (
    <div ref={containerRef} className="grid grid-cols-3 lg:grid-cols-5 gap-4 items-stretch">
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
            title="Submitted"
            members={submittedMembers}
            emptyLabel="No Submissions Yet."
            icon={CheckCircle2}
            iconClassName="text-success"
          />
        )}
      </div>

      {/* Pending Submission */}
      <div className="relative flex">
        <button
          type="button"
          onClick={() => toggle("pending")}
          className="flex h-full w-full items-center gap-4 rounded-xl border bg-card p-4 shadow-sm text-left transition-colors hover:bg-accent cursor-pointer"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
            <Clock size={18} className="text-warning" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Pending Submission</p>
            <p className="text-2xl font-bold">{pendingCount}</p>
            {/* <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
              <Clock size={8} /> 10:10 AM CUTOFF
            </span> */}
          </div>
        </button>
        {openCard === "pending" && (
          <MemberListDropdown
            title="Pending Submissions"
            members={pendingMembers}
            emptyLabel="No Pending Members."
            icon={AlertTriangle}
            iconClassName="text-warning"
          />
        )}
      </div>

      {/* Pending Review */}
      <div className="relative flex">
        <button
          type="button"
          onClick={() => toggle("pendingReview")}
          className="flex h-full w-full items-center gap-4 rounded-xl border bg-card p-4 shadow-sm text-left transition-colors hover:bg-accent cursor-pointer"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
            <Clock size={18} className="text-warning" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Pending Review</p>
            <p className="text-2xl font-bold">{pendingReviewCount}</p>
          </div>
        </button>
        {openCard === "pendingReview" && (
          <MemberListDropdown
            title="Pending Review"
            members={pendingReviewMembers}
            emptyLabel="No Submissions Awaiting Review."
            icon={Clock}
            iconClassName="text-warning"
          />
        )}
      </div>

      {/* Support Needed (Meeting) */}
      <div className="relative flex">
        <button
          type="button"
          onClick={() => toggle("supportNeeded")}
          className="flex h-full w-full items-center gap-4 rounded-xl border bg-card p-4 shadow-sm text-left transition-colors hover:bg-accent cursor-pointer"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info/10">
            <AlertTriangle size={18} className="text-info" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Support Needed (Meeting)</p>
            <p className="text-2xl font-bold">{supportNeededCount}</p>
          </div>
        </button>
        {openCard === "supportNeeded" && (
          <MemberListDropdown
            title="Support Needed (Meeting)"
            members={supportNeededMembers}
            emptyLabel="No Open Support Requests."
            icon={AlertTriangle}
            iconClassName="text-info"
            alignRight
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
            <AlertCircle size={18} className="text-destructive" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Blockers (Dependencies)</p>
            <p className={cn("text-2xl font-bold", blockerCount > 0 && "text-destructive")}>
              {blockerCount}
            </p>
          </div>
        </button>
        {openCard === "blockers" && (
          <MemberListDropdown
            title="Members with Blockers (Dependencies)"
            members={blockerMembers}
            emptyLabel="No Active Blockers."
            icon={AlertCircle}
            iconClassName="text-destructive"
            alignRight
          />
        )}
      </div>

      {/* DSM status — commented out
      <div className="relative flex">
        <button
          type="button"
          onClick={() => toggle("status")}
          className="flex h-full w-full items-center gap-4 rounded-xl border bg-card p-4 shadow-sm text-left transition-colors hover:bg-accent cursor-pointer"
        >
          <span className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            status === "Pending OT" ? "bg-success/10" : "bg-warning/10"
          )}>
            <TrendingUp size={18} className={status === "Pending OT" ? "text-success" : "text-warning"} />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">DSM Status</p>
            <p className={cn(
              "text-lg font-bold",
              status === "Pending OT" ? "text-success" : "text-warning"
            )}>
              {status}
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
                <span className="text-muted-foreground">Pending Submission</span>
                <span className="font-semibold">{pendingCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending Review</span>
                <span className="font-semibold">{pendingReviewCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Support Needed (Meeting)</span>
                <span className="font-semibold">{supportNeededCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending OT</span>
                <span className="font-semibold">{pendingOtCount}</span>
              </div>
            </div>
            <p className="mt-2.5 border-t pt-2.5 text-xs leading-relaxed text-muted-foreground">
              {blockerCount > 1
                ? "Multiple open blockers are affecting delivery — needs attention."
                : blockerCount === 1
                  ? "One open blocker is putting progress at risk."
                  : pendingCount > 0
                    ? "Some team members haven't submitted their DSM yet."
                    : "All submissions are in and there are no open blockers."}
            </p>
          </div>
        )}
      </div>
      */}
    </div>
  );
}
