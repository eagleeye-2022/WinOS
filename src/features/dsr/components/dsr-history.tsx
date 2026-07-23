import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { weekOfMonth, getWeekRange, relativeDayLabel } from "@/features/dsm/utils";
import { DsrHistoryCard } from "./dsr-history-card";
import type { DsrEntryData } from "../queries";

type Props = {
  entries: DsrEntryData[];
  weekOffset: number;
  basePath?: string;
};

export function DsrHistory({ entries, weekOffset, basePath = "/dsr" }: Props) {
  const { start } = getWeekRange(weekOffset);
  const weekLabel = `Week ${weekOfMonth(start)}`;
  const canGoForward = weekOffset < 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">This Week&apos;s Standups</h2>
          <p className="text-sm text-muted-foreground">Review Daily Status Updates and Progress.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full border bg-card px-1 py-1 shadow-sm">
          <Link
            href={`${basePath}?w=${weekOffset - 1}`}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="min-w-16 text-center text-sm font-medium">{weekLabel}</span>
          <Link
            href={canGoForward ? `${basePath}?w=${weekOffset + 1}` : basePath}
            className={cn(
              "rounded p-1 text-muted-foreground transition-colors hover:bg-accent",
              !canGoForward && "pointer-events-none opacity-30"
            )}
            aria-disabled={!canGoForward}
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No DSR Entries Recorded for This Week.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <DsrHistoryCard
              key={entry.id}
              entry={entry}
              defaultOpen={relativeDayLabel(entry.date) === "Today" && entry.status !== "MISSED"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
