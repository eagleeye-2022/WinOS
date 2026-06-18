"use client";

import { Calendar, Filter } from "lucide-react";
import { AllDsrStatsRow } from "./all-dsr-stats";
import { DsrTeamColumn } from "./dsr-team-column";
import type { AllDsrStats, DsrTeamGroup } from "../queries";

type Props = {
  stats: AllDsrStats | null;
  groups: DsrTeamGroup[];
};

export function AllDsrClient({ stats, groups }: Props) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">All Team DSR Submission</h1>
          <p className="text-sm text-muted-foreground">Review and track daily status reports for all departments</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="rounded-lg border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm">
            Today
          </button>
          <button type="button" className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent">
            Yesterday <Calendar size={13} />
          </button>
          <button type="button" className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent">
            <Filter size={13} /> Filters
          </button>
        </div>
      </div>

      {stats && <AllDsrStatsRow stats={stats} />}

      <div className="flex gap-5 overflow-x-auto pb-4">
        {groups.map((group, index) => (
          <DsrTeamColumn key={group.teamId} group={group} colorIndex={index} />
        ))}
      </div>
    </div>
  );
}
