"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarRange, Clock, FileText, FolderGit2, Users } from "lucide-react";
import { CORE_DAILY_TASKS_FALLBACK_DESCRIPTIONS } from "../core-daily-tasks";
import type { CoreDailyTask } from "../queries";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

function displayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email.split("@")[0];
}

/** Zoho-imported descriptions can be HTML — show them as plain text. */
function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** "13/05/2025" (Zoho import format) → "13 May 2025"; anything else is shown as-is. */
function formatTaskDate(value: string | null): string | null {
  if (!value || value === "--") return null;
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return value;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

const MAX_AVATARS = 8;

/** Inline, expandable details for one Daily Core Task (shown under its row in the panel). */
export function CoreTaskDetails({ task }: { task: CoreDailyTask }) {
  const description =
    (task.description && plainText(task.description)) ||
    CORE_DAILY_TASKS_FALLBACK_DESCRIPTIONS[task.title.trim()] ||
    null;
  const owners = task.owners.map((o) => o.user);
  const start = formatTaskDate(task.startDate);
  const due = formatTaskDate(task.dueDate);
  const totalLogged = task.workHours && task.workHours !== "00:00" ? `${task.workHours} h` : null;

  return (
    <div className="mt-2 flex flex-col gap-2.5 rounded-lg border bg-muted/30 p-3 text-xs animate-in fade-in-0 slide-in-from-top-1 duration-150">
      {/* What this task is */}
      <div className="flex gap-1.5">
        <FileText size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
        <p className={description ? "text-foreground" : "italic text-muted-foreground"}>
          {description ?? "No description added yet."}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <FolderGit2 size={12} className="shrink-0 text-muted-foreground" />
        <span className="truncate text-muted-foreground">
          {task.project?.name ?? "—"} · {task.taskListName ?? "—"}
        </span>
        <span className="ml-auto shrink-0 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
          {task.status}
        </span>
      </div>

      {(start || due) && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarRange size={12} className="shrink-0" />
          <span>
            {start ?? "—"} → {due ?? "—"}
          </span>
        </div>
      )}

      {totalLogged && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock size={12} className="shrink-0" />
          <span>Total effort logged by the team: {totalLogged}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Users size={12} className="shrink-0 text-muted-foreground" />
        {owners.length === 0 ? (
          <span className="text-muted-foreground">No one assigned yet.</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {owners.slice(0, MAX_AVATARS).map((u) => (
              <span
                key={u.id}
                title={displayName(u)}
                className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-[9px] font-bold text-primary ring-1 ring-primary/30"
              >
                {u.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.image} alt={displayName(u)} className="h-full w-full object-cover" />
                ) : (
                  initialsOf(displayName(u))
                )}
              </span>
            ))}
            {owners.length > MAX_AVATARS && (
              <span
                title={owners.slice(MAX_AVATARS).map(displayName).join(", ")}
                className="flex h-6 items-center rounded-full bg-muted px-1.5 text-[9px] font-bold text-muted-foreground"
              >
                +{owners.length - MAX_AVATARS}
              </span>
            )}
          </div>
        )}
      </div>

      <Link
        href={`/projects/${task.projectId}/tasks/${task.code}`}
        className="flex items-center gap-1 self-start font-semibold text-primary hover:underline"
      >
        Open Task <ArrowUpRight size={12} />
      </Link>
    </div>
  );
}
