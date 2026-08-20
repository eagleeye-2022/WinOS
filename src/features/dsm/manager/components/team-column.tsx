import Link from "next/link";
import { CheckCircle2, ClipboardCheck, ListChecks, AlertTriangle, ChevronRight } from "lucide-react";
import { cn, toTitleCase } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { SendReminderButton } from "./send-reminder-button";
import type { TeamGroup, MemberSubmissionCard } from "../queries";

// Department dot color cycles: blue, blue, green, amber
const DOT_COLORS = ["bg-primary", "bg-primary", "bg-success", "bg-warning"] as const;

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

function displayNameOf(card: Pick<MemberSubmissionCard, "name" | "email">) {
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

// ── Submitted member card ─────────────────────────────────────────────────────

function SubmittedCard({ card }: { card: MemberSubmissionCard }) {
  let timeStr: string | null = null;
  let isOnTime = true;

  if (card.submittedAt) {
    timeStr = new Date(card.submittedAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const cutoff = new Date(card.submittedAt);
    cutoff.setHours(10, 10, 0, 0);
    isOnTime = new Date(card.submittedAt) <= cutoff;
  }

  const displayName = displayNameOf(card);
  const initials = initialsOf(displayName);
  const isReviewed = card.status === "REVIEWED";
  const gradient = avatarGradientFor(card.userId);

  return (
    <Link
      href={ROUTES.dsmMember(card.userId)}
      className={cn(
        "group relative flex min-h-[132px] shrink-0 flex-col rounded-2xl border bg-card p-4 shadow-xs",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      )}
    >
      {/* Top row: avatar + name & time (left) | status badges (right) */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-border dark:ring-white/10 overflow-hidden",
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
            {timeStr && (
              <span className="mt-0.5 text-xs text-muted-foreground">
                {timeStr}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {timeStr && (
            <span
              className={cn(
                "rounded-full border bg-transparent px-2 py-0.5 text-xs font-semibold shadow-2xs",
                isOnTime
                  ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
                  : "border-rose-500/50 text-rose-600 dark:text-rose-400"
              )}
            >
              {isOnTime ? "On Time" : "Delayed"}
            </span>
          )}

        </div>
      </div>

      {card.todayTasks.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <ListChecks size={11} /> Today&apos;s Task
            </p>
            <p>
              {isReviewed && (
                <span className="flex items-center gap-1 rounded-full border border-indigo-500/50 bg-transparent px-2  text-xs font-semibold text-indigo-600 dark:text-indigo-400 shadow-2xs">
                  <ClipboardCheck size={11} className="text-indigo-600 dark:text-indigo-400" /> Reviewed
                </span>
              )}
            </p>

          </div>
          <ul className="space-y-1 pt-2">
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

      {card.todayTasks.length === 0 && (
        <div className="mt-3.5 pt-3 border-t border-border/50 flex items-center justify-between">
          {isReviewed ? (
            <span className="flex items-center gap-1 rounded-full border border-indigo-500/50 bg-transparent px-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 shadow-2xs">
              <ClipboardCheck size={11} className="text-indigo-600 dark:text-indigo-400" /> Reviewed
            </span>
          ) : (
            <span />
          )}
          <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground flex items-center gap-0.5 dark:text-[#3B82F6] dark:group-hover:text-[#2563EB]">
            Add Task <ChevronRight size={13} className="dark:text-[#93C5FD]" />
          </span>
        </div>
      )}

      <ChevronRight
        size={14}
        className="absolute bottom-3.5 right-3.5 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </Link>
  );
}

// ── Pending member card ───────────────────────────────────────────────────────

function PendingMemberCard({ card, teamId }: { card: MemberSubmissionCard; teamId: string }) {
  const displayName = displayNameOf(card);
  const initials = initialsOf(displayName);

  return (
    <Link
      href={ROUTES.dsmMember(card.userId)}
      className="group relative flex min-h-[132px] shrink-0 flex-col justify-between rounded-2xl border border-dashed border-border bg-transparent p-4 transition-all duration-200 hover:border-foreground/30 hover:bg-muted/30 hover:shadow-md cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold ring-1 ring-border overflow-hidden">
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
      <div className="mt-3.5 pt-3 border-t border-border/50 flex items-center justify-between">
        <SendReminderButton userId={card.userId} teamId={teamId} />
        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground flex items-center gap-0.5">
          Add Task <ChevronRight size={13} />
        </span>
      </div>
    </Link>
  );
}

// ── Team column ───────────────────────────────────────────────────────────────

type Props = { group: TeamGroup; colorIndex?: number };

export function TeamColumn({ group, colorIndex = 0 }: Props) {
  const allSubmitted = group.submittedCount === group.totalMembers && group.totalMembers > 0;
  const dotColor = DOT_COLORS[colorIndex % DOT_COLORS.length];

  return (
    <div className="flex h-full min-h-[420px] w-80 md:w-96 min-w-[320px] shrink-0 flex-col gap-3">
      {/* Column header (fixed) */}
      <div className="flex shrink-0 items-center gap-2 pr-3">
        <span className={cn("h-2 w-2 rounded-full", dotColor)} />
        <span className="text-sm font-semibold">{group.teamName}</span>
        {allSubmitted ? (
          <span className="ml-auto flex items-center gap-1 flex-nowrap rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
            <CheckCircle2 size={11} /> All Submitted
          </span>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">
            {group.submittedCount}/{group.totalMembers}
          </span>
        )}
      </div>

      {/* Member cards (internal scroll — keeps the column height fixed) */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-3 dsm-columns-scrollbar">
        {group.members.map((card) => {
          const isSubmitted =
            card.status === "SUBMITTED" ||
            card.status === "PENDING_REVIEW" ||
            card.status === "REVIEWED";

          return isSubmitted ? (
            <SubmittedCard key={card.userId} card={card} />
          ) : (
            <PendingMemberCard key={card.userId} card={card} teamId={group.teamId} />
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
