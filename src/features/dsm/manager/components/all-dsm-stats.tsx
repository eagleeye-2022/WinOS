import { Users, Clock, Ban, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AllDsmStats } from "../queries";

type Props = { stats: AllDsmStats };

export function AllDsmStatsRow({ stats }: Props) {
  const { totalSubmitted, totalExpected, pendingCount, highPriorityBlockerCount, projectStatus } = stats;

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
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
      </div>

      <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Clock size={18} className="text-amber-600" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold">{pendingCount}</p>
          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
            <Clock size={8} /> 10:10 AM CUTOFF
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <Ban size={18} className="text-destructive" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">Blockers</p>
          <p className={cn("text-2xl font-bold", highPriorityBlockerCount > 0 && "text-destructive")}>
            {highPriorityBlockerCount}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <span className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          projectStatus === "On Track" ? "bg-emerald-100" : "bg-amber-100"
        )}>
          <TrendingUp size={18} className={projectStatus === "On Track" ? "text-emerald-600" : "text-amber-600"} />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">Project Status</p>
          <p className={cn(
            "text-lg font-bold",
            projectStatus === "On Track" ? "text-emerald-600" : "text-amber-600"
          )}>
            {projectStatus}
          </p>
        </div>
      </div>
    </div>
  );
}
