import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Clock, AlertTriangle, ChevronRight } from "lucide-react";

import { cn, toTitleCase } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { SendReminderButton } from "@/features/dsm/manager/components/send-reminder-button";
import type { DsrTeamGroup, DsrMemberCard } from "../queries";

const DOT_COLORS = ["bg-primary", "bg-primary", "bg-success", "bg-warning"];

// Deterministic avatar gradient per user, cycling through a small palette
const AVATAR_GRADIENTS = [
  "from-primary/25 to-primary/10 text-primary",
  "from-violet-400/25 dark:from-violet-400/20 to-violet-400/10 text-violet-600 dark:text-violet-300",
  "from-sky-400/25 dark:from-sky-400/20 to-sky-400/10 text-sky-600 dark:text-sky-300",
  "from-rose-400/25 dark:from-rose-400/20 to-rose-400/10 text-rose-600 dark:text-rose-300",
  "from-amber-400/25 dark:from-amber-400/20 to-amber-400/10 text-amber-700 dark:text-amber-300",
] as const;

function avatarGradientFor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function displayNameOf(card: Pick<DsrMemberCard, "name" | "email">) {
  const raw = card.name ?? card.email.split("@")[0];
  return toTitleCase(raw);
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
        "group relative flex min-h-[104px] shrink-0 flex-col rounded-xl border bg-card p-3 shadow-2xs",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              "flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-border dark:ring-white/10 overflow-hidden",
              !card.image && "bg-gradient-to-br",
              !card.image && gradient
            )}
          >
            {card.image ? (
              <img src={card.image} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
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
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-indigo-300 dark:bg-indigo-200 px-2 py-0.5 text-xs font-semibold text-indigo-900 dark:text-indigo-950">
            <ClipboardCheck size={11} /> Reviewed
          </span>
        )}
      </div>

      {card.resultOfDay && (
        <div className="mt-2.5 pt-2 border-t border-border/50">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Outcome of the Day
          </p>
          <p className="text-xs leading-relaxed text-foreground/80 line-clamp-2">
            {card.resultOfDay}
          </p>
        </div>
      )}

      <ChevronRight
        size={13}
        className="absolute bottom-2.5 right-2.5 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </Link>
  );
}

// ── Pending DSR member card ───────────────────────────────────────────────────

function DsrPendingMemberCard({ card, teamId }: { card: DsrMemberCard; teamId: string }) {
  const displayName = displayNameOf(card);
  const initials = initialsOf(displayName);

  return (
    <Link
      href={ROUTES.dsrMember(card.userId)}
      className="group relative flex min-h-[104px] shrink-0 flex-col justify-between rounded-xl border border-dashed border-border bg-transparent p-3 transition-all duration-200 hover:border-foreground/30 hover:bg-muted/30 hover:shadow-md cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold ring-1 ring-border overflow-hidden">
            {card.image ? (
              <img src={card.image} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
              {displayName}
            </p>
            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <AlertTriangle size={10} /> {card.status === "MISSED" ? "Missed" : "Not Submitted"}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between">
        <SendReminderButton userId={card.userId} teamId={teamId} />
        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground flex items-center gap-0.5">
          Review <ChevronRight size={13} />
        </span>
      </div>
    </Link>
  );
}

// ── Team column ───────────────────────────────────────────────────────────────

export function DsrTeamColumn({ group, colorIndex = 0 }: { group: DsrTeamGroup; colorIndex?: number }) {
  const allSubmitted = group.submittedCount === group.totalMembers && group.totalMembers > 0;

  return (
    <div className="flex h-full min-h-[420px] flex-1 min-w-[230px] max-w-[440px] flex-col gap-2.5">
      {/* Column header (fixed) */}
      <div className="flex shrink-0 items-center gap-2 pr-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", DOT_COLORS[colorIndex % DOT_COLORS.length])} />
        <span className="text-sm font-bold truncate">{group.teamName}</span>
        {allSubmitted ? (
          <span className="ml-auto flex items-center gap-1 flex-nowrap rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
            <CheckCircle2 size={11} /> All Submitted
          </span>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground font-semibold">
            {group.submittedCount}/{group.totalMembers}
          </span>
        )}
      </div>

      {/* Member cards (internal scroll — keeps the column height fixed) */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1.5 dsm-columns-scrollbar">
        {group.members.map((card) => {
          const isSubmitted =
            card.status === "SUBMITTED" ||
            card.status === "PENDING_REVIEW" ||
            card.status === "REVIEWED";

          return isSubmitted ? (
            <DsrSubmittedCard key={card.userId} card={card} />
          ) : (
            <DsrPendingMemberCard key={card.userId} card={card} teamId={group.teamId} />
          );
        })}

        {group.totalMembers === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
            <p className="text-xs text-muted-foreground">No Members Yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
