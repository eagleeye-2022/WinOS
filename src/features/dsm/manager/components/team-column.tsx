import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { SendRemindersButton } from "./send-reminders-button";
import type { TeamGroup, MemberSubmissionCard } from "../queries";

// Department dot color cycles: blue, blue, green, amber
const DOT_COLORS = ["bg-primary", "bg-primary", "bg-emerald-500", "bg-amber-400"] as const;

// ── Submitted member card ─────────────────────────────────────────────────────

function SubmittedCard({ card }: { card: MemberSubmissionCard }) {
  let timeStr: string | null = null;
  let isOnTime = true;

  if (card.submittedAt) {
    timeStr = new Date(card.submittedAt).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const cutoff = new Date(card.submittedAt);
    cutoff.setHours(10, 10, 0, 0);
    isOnTime = new Date(card.submittedAt) <= cutoff;
  }

  const displayName = card.name
    ? card.name
    : card.email
      .split("@")[0]
      .split(".")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const initials = (() => {
    const parts = displayName.split(" ");
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  })();

  return (
    <Link
      href={ROUTES.dsmMember(card.userId)}
      className="block rounded-xl border bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Top row: avatar + name & time (left) | status badge (right) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {displayName}
            </p>
            {timeStr && (
              <span className="mt-0.5 text-xs text-muted-foreground">{timeStr}</span>
            )}
          </div>
        </div>
        {timeStr && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
              isOnTime ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
            )}
          >
            {isOnTime ? "On Time" : "Delayed"}
          </span>
        )}
      </div>

      {card.todayTasks.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-border/50">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Today&apos;s Task
          </p>
          <ul className="space-y-1">
            {card.todayTasks.slice(0, 3).map((task, i) => {
              const p = task.managerPriority ?? task.priority;
              return (
                <li key={i} className="flex items-center justify-between gap-1.5 text-xs text-foreground/80">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                    <span className="line-clamp-1 leading-snug">{task.text}</span>
                  </div>
                  {p && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                      {p}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Link>
  );
}

// ── Pending placeholder card ──────────────────────────────────────────────────

function PendingCard({ count, teamId }: { count: number; teamId: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 py-7 text-center">
      <div className="mb-3 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
        ))}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {count} Pending Submission{count !== 1 ? "s" : ""}
      </p>
      <div className="mt-2">
        <SendRemindersButton teamId={teamId} pendingCount={count} />
      </div>
    </div>
  );
}

// ── Team column ───────────────────────────────────────────────────────────────

type Props = { group: TeamGroup; colorIndex?: number };

export function TeamColumn({ group, colorIndex = 0 }: Props) {
  const allSubmitted = group.submittedCount === group.totalMembers && group.totalMembers > 0;
  const dotColor = DOT_COLORS[colorIndex % DOT_COLORS.length];

  const submitted = group.members.filter(
    (m) => m.status === "SUBMITTED" || m.status === "PENDING_REVIEW" || m.status === "REVIEWED"
  );
  const pending = group.members.filter(
    (m) => m.status === "DRAFT" || m.status === null || m.status === "MISSED"
  );

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3">
      {/* Column header */}
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", dotColor)} />
        <span className="text-sm font-semibold">{group.teamName}</span>
        {allSubmitted ? (
          <span className="ml-auto flex items-center gap-1 flex-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={11} /> All Submitted
          </span>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">
            {group.submittedCount}/{group.totalMembers}
          </span>
        )}
      </div>

      {/* Submitted member cards */}
      {submitted.map((card) => (

        <SubmittedCard key={card.userId} card={card} />
      ))}

      {/* Pending placeholder */}
      {pending.length > 0 && <PendingCard count={pending.length} teamId={group.teamId} />}

      {/* Empty team */}
      {group.totalMembers === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-xs text-muted-foreground">No Members Yet</p>
        </div>
      )}
    </div>
  );
}
