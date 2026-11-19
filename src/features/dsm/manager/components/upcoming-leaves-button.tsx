"use client";

import Link from "next/link";
import { CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { getInitials } from "@/lib/avatar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { UpcomingLeave } from "../queries";
import { leavePartLabel } from "../leave-utils";

/** "20 Nov" from "YYYY-MM-DD" (dates are calendar days — formatted in UTC so they don't shift). */
function shortDate(key: string): string {
  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function dateRange(l: UpcomingLeave): string {
  return l.fromDate === l.toDate ? shortDate(l.fromDate) : `${shortDate(l.fromDate)} – ${shortDate(l.toDate)}`;
}

/**
 * All DSM header: team members' approved and pending leave from today over the next 30 days.
 * Leave covering today is marked "Today".
 */
export function UpcomingLeavesButton({ leaves, todayStr }: { leaves: UpcomingLeave[]; todayStr: string }) {
  const onLeaveToday = leaves.filter((l) => l.fromDate <= todayStr && l.toDate >= todayStr).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
          title="Approved and pending leave over the next 30 days"
        >
          <CalendarOff size={14} />
          Upcoming Leaves
          {leaves.length > 0 && (
            <span className="rounded-full bg-amber-500/15 px-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
              {leaves.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 text-xs">
        <div className="border-b px-3.5 py-2.5">
          <p className="text-sm font-bold text-foreground">Upcoming Leaves</p>
          <p className="text-muted-foreground">
            Next 30 days{onLeaveToday > 0 ? ` · ${onLeaveToday} on leave today` : ""}
          </p>
        </div>
        {leaves.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-muted-foreground">No one has leave coming up.</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {leaves.map((l) => {
              const isToday = l.fromDate <= todayStr && l.toDate >= todayStr;
              const part = leavePartLabel(l);
              const name = l.name || l.email.split("@")[0];
              return (
                <li key={l.id}>
                  <Link
                    href={ROUTES.dsmMember(l.userId)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-accent/60"
                  >
                    <UserAvatar
                      userId={l.userId}
                      name={l.name}
                      email={l.email}
                      image={l.image}
                      title=""
                      className="h-7 w-7 shrink-0 bg-muted text-[10px] font-bold text-muted-foreground ring-1 ring-border"
                    >
                      {getInitials(name)}
                    </UserAvatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{name}</p>
                      <p className="truncate text-muted-foreground">
                        {l.typeName} · {dateRange(l)}
                        {part ? ` · ${part}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {isToday && (
                        <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                          Today
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          l.status === "APPROVED"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {l.status === "APPROVED" ? "Approved" : "Pending"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
