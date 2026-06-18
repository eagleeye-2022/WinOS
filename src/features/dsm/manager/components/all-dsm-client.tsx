"use client";

import { useState } from "react";
import { Plus, Calendar, Filter } from "lucide-react";
import { AllDsmStatsRow } from "./all-dsm-stats";
import { TeamColumn } from "./team-column";
import { NewTeamModal } from "./new-team-modal";
import type { AllDsmStats, TeamGroup, TeamWithMembers, AllUser } from "../queries";

type Props = {
  stats: AllDsmStats | null;
  groups: TeamGroup[];
  teams: TeamWithMembers[];
  allUsers: AllUser[];
};

export function AllDsmClient({ stats, groups, teams, allUsers }: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="relative flex h-full flex-col gap-6 overflow-y-auto p-6">
      {/* Page heading + date filters */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Team DSM Submission</h1>
          <p className="text-sm text-muted-foreground">Daily Status Management for all departments</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="rounded-lg border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm">
            Today
          </button>
          <button type="button" className="rounded-lg border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent">
            Yesterday
          </button>
          <button type="button" className="flex items-center justify-center rounded-lg border px-3 py-2 text-muted-foreground hover:bg-accent">
            <Calendar size={13} />
          </button>
          <button type="button" className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent">
            <Filter size={13} /> Filters
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {stats && <AllDsmStatsRow stats={stats} />}

      {/* Team columns */}
      <div className="flex gap-5 overflow-x-auto pb-4">
        {groups.map((group, index) => (
          <TeamColumn key={group.teamId} group={group} colorIndex={index} />
        ))}
      </div>

      {/* Floating + button */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="Create new team"
      >
        <Plus size={24} />
      </button>

      {showModal && (
        <NewTeamModal
          teams={teams}
          allUsers={allUsers}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
