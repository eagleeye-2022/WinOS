import Link from "next/link";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { SendRemindersButton } from "@/features/dsm/manager/components/send-reminders-button";
import type { DsrTeamGroup, DsrMemberCard } from "../queries";

const DOT_COLORS = ["bg-primary", "bg-primary", "bg-emerald-500", "bg-amber-400"];

// ── Submission time helper ────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

// ── Submitted DSR member card ─────────────────────────────────────────────────

function DsrSubmittedCard({ card }: { card: DsrMemberCard }) {
  return (
    <Link
      href={ROUTES.dsrMember(card.userId)}
      className="block rounded-xl border bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-2 ring-background ring-offset-1 ring-offset-primary/10">
          {(card.name ?? card.email).slice(0, 2).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{card.name ?? card.email.split("@")[0]}</p>
          {card.submittedAt && (
            <p className="text-xs text-muted-foreground">{formatTime(card.submittedAt)}</p>
          )}
        </div>
      </div>

      {card.resultOfDay && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Outcome of the Day
          </p>
          <p className="text-xs leading-relaxed text-foreground/80 line-clamp-3">
            {card.resultOfDay}
          </p>
        </div>
      )}
    </Link>
  );
}

// ── Pending placeholder card ──────────────────────────────────────────────────

function DsrPendingCard({ count, teamId }: { count: number; teamId: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 py-7 text-center">
      <div className="mb-3 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-muted-foreground/25" />
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

export function DsrTeamColumn({ group, colorIndex = 0 }: { group: DsrTeamGroup; colorIndex?: number }) {
  const allSubmitted = group.submittedCount === group.totalMembers && group.totalMembers > 0;
  const submitted = group.members.filter(
    (m) => m.status === "SUBMITTED" || m.status === "PENDING_REVIEW" || m.status === "REVIEWED"
  );
  const pending = group.members.filter(
    (m) => !m.status || m.status === "DRAFT" || m.status === "MISSED"
  );

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", DOT_COLORS[colorIndex % DOT_COLORS.length])} />
        <span className="text-sm font-semibold">{group.teamName}</span>
        {allSubmitted ? (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              All Submitted
            </span>
            <span className="text-xs text-muted-foreground">
              {group.submittedCount}/{group.totalMembers}
            </span>
          </div>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">
            {group.submittedCount}/{group.totalMembers}
          </span>
        )}
      </div>

      {submitted.map((card) => (
        <DsrSubmittedCard key={card.userId} card={card} />
      ))}

      {pending.length > 0 && (
        <DsrPendingCard count={pending.length} teamId={group.teamId} />
      )}

      {group.totalMembers === 0 && (
        <div className="flex items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6">
          <p className="text-xs text-muted-foreground">No Members Yet</p>
        </div>
      )}
    </div>
  );
}
