import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Clock, AlertTriangle, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { SendReminderButton } from "@/features/dsm/manager/components/send-reminder-button";
import type { DsrTeamGroup, DsrMemberCard } from "../queries";

const DOT_COLORS = ["bg-primary", "bg-primary", "bg-emerald-500", "bg-amber-400"];

// Deterministic avatar gradient per user, cycling through a small palette
const AVATAR_GRADIENTS = [
  "from-primary/25 to-primary/10 text-primary",
  "from-violet-400/25 to-violet-400/10 text-violet-600",
  "from-sky-400/25 to-sky-400/10 text-sky-600",
  "from-rose-400/25 to-rose-400/10 text-rose-600",
  "from-amber-400/25 to-amber-400/10 text-amber-700",
] as const;

function avatarGradientFor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function displayNameOf(card: Pick<DsrMemberCard, "name" | "email">) {
  return card.name ?? card.email.split("@")[0];
}

function initialsOf(displayName: string) {
  const parts = displayName.split(" ");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

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
  const displayName = displayNameOf(card);
  const initials = initialsOf(displayName);
  const isReviewed = card.status === "REVIEWED";
  const gradient = avatarGradientFor(card.userId);

  return (
    <Link
      href={ROUTES.dsrMember(card.userId)}
      className={cn(
        "group relative flex min-h-[132px] shrink-0 flex-col rounded-2xl border border-l-4 bg-card p-4 shadow-xs",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        isReviewed ? "border-l-indigo-400" : "border-l-emerald-400"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold ring-1 ring-black/5",
              gradient
            )}
          >
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {displayName}
            </p>
            {card.submittedAt && (
              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={10} /> {formatTime(card.submittedAt)}
              </span>
            )}
          </div>
        </div>
        {isReviewed && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            <ClipboardCheck size={11} /> Reviewed
          </span>
        )}
      </div>

      {card.resultOfDay && (
        <div className="mt-3.5 pt-3 border-t border-border/50">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Outcome of the Day
          </p>
          <p className="text-xs leading-relaxed text-foreground/80 line-clamp-3">
            {card.resultOfDay}
          </p>
        </div>
      )}

      <ChevronRight
        size={14}
        className="absolute bottom-3.5 right-3.5 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </Link>
  );
}

// ── Pending DSR member card ───────────────────────────────────────────────────

function DsrPendingMemberCard({ card, teamId }: { card: DsrMemberCard; teamId: string }) {
  const displayName = displayNameOf(card);
  const initials = initialsOf(displayName);

  return (
    <div className="flex min-h-[132px] shrink-0 flex-col justify-between rounded-2xl border border-l-4 border-dashed border-l-red-300 bg-red-50/40 p-4 dark:bg-red-950/10">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-500 ring-1 ring-black/5">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {displayName}
            </p>
            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-red-500">
              <AlertTriangle size={10} /> {card.status === "MISSED" ? "Missed" : "Not Submitted"}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3.5 pt-3 border-t border-red-200/60">
        <SendReminderButton userId={card.userId} teamId={teamId} />
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
    <div className="flex h-full min-h-[420px] w-64 shrink-0 flex-col gap-3">
      {/* Column header (fixed) */}
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", DOT_COLORS[colorIndex % DOT_COLORS.length])} />
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

      {/* Member cards (internal scroll — keeps the column height fixed) */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 dsm-columns-scrollbar">
        {submitted.map((card) => (
          <DsrSubmittedCard key={card.userId} card={card} />
        ))}

        {pending.map((card) => (
          <DsrPendingMemberCard key={card.userId} card={card} teamId={group.teamId} />
        ))}

        {group.totalMembers === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
            <p className="text-xs text-muted-foreground">No Members Yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
