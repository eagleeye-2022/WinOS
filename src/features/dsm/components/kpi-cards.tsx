import type { KpiStats } from "../queries";

type KpiCardsProps = {
  stats: KpiStats;
};

export function KpiCards({ stats }: KpiCardsProps) {
  const { submissionRate, submissionRateDelta, supportMeetingsCount, resolvedBlockers } = stats;

  const deltaText =
    submissionRateDelta > 0
      ? `+${submissionRateDelta}% from last week`
      : submissionRateDelta < 0
        ? `${submissionRateDelta}% from last week`
        : "Same as last week";

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-xl border bg-card p-5">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Submission Rate</p>
        <p className="text-3xl font-bold text-primary">{submissionRate}%</p>
        <p className="mt-1 text-xs text-muted-foreground">{deltaText}</p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          Support Meeting&apos;s Completed
        </p>
        <p className="text-3xl font-bold">{supportMeetingsCount}</p>
        <p className="mt-1 text-xs text-muted-foreground">this week</p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Resolved Blockers</p>
        <p className="text-3xl font-bold">{resolvedBlockers}</p>
        <p className="mt-1 text-xs text-muted-foreground">this week</p>
      </div>
    </div>
  );
}
