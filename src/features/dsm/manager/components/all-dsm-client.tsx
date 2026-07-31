"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Calendar, Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toIsoDateStr, toUtcDate } from "../../utils";
import { AllDsmStatsRow, type StatMember } from "./all-dsm-stats";
import { TeamColumn } from "./team-column";
import { NewTeamModal } from "./new-team-modal";
import type { AllDsmStats, TeamGroup, TeamWithMembers, AllUser } from "../queries";

type Props = {
  stats: AllDsmStats | null;
  groups: TeamGroup[];
  teams: TeamWithMembers[];
  allUsers: AllUser[];
  selectedDateStr: string;
};

export function AllDsmClient({ stats, groups, teams, allUsers, selectedDateStr }: Props) {
  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [sortBy, setSortBy] = useState<"submissions-desc" | "submissions-asc" | "name">("submissions-desc");

  const today = new Date();
  const todayStr = toIsoDateStr(toUtcDate(today));

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toIsoDateStr(toUtcDate(yesterday));

  const handleDateChange = (dateStr: string) => {
    router.push(`/dsm/all?date=${dateStr}`);
  };

  // Convert selectedDateStr (YYYY-MM-DD) to a Date object to format it beautifully
  const dateObj = useMemo(() => {
    const [year, month, day] = selectedDateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDateStr]);

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(dateObj);
  }, [dateObj]);

  // Flatten members across all teams for the stat card dropdowns
  const submittedMembers: StatMember[] = useMemo(() => {
    return groups.flatMap((group) =>
      group.members
        .filter((m) => m.status === "SUBMITTED" || m.status === "PENDING_REVIEW" || m.status === "REVIEWED")
        .map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          teamName: group.teamName,
          meta: m.submittedAt
            ? new Date(m.submittedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            : undefined,
        }))
    );
  }, [groups]);

  const pendingMembers: StatMember[] = useMemo(() => {
    return groups.flatMap((group) =>
      group.members
        .filter((m) => m.status === "DRAFT" || m.status === null || m.status === "MISSED")
        .map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          teamName: group.teamName,
        }))
    );
  }, [groups]);

  const blockerMembers: StatMember[] = useMemo(() => {
    return groups.flatMap((group) =>
      group.members
        .filter((m) => m.blockerCount > 0)
        .map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          teamName: group.teamName,
          meta: `${m.blockerCount} blocker${m.blockerCount > 1 ? "s" : ""}`,
        }))
    );
  }, [groups]);

  // Extract unique departments for the filter dropdown
  const departments = useMemo(() => {
    const depts = new Set<string>();
    groups.forEach((g) => {
      if (g.department) depts.add(g.department);
    });
    return Array.from(depts).sort();
  }, [groups]);

  // Filter and sort groups by search query, department, and sort selection
  const filteredGroups = useMemo(() => {
    const filtered = groups.filter((group) => {
      if (selectedDept !== "all" && group.department !== selectedDept) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTeam = group.teamName.toLowerCase().includes(query);
        const matchesMember = group.members.some(
          (m) =>
            (m.name ?? "").toLowerCase().includes(query) ||
            m.email.toLowerCase().includes(query)
        );
        return matchesTeam || matchesMember;
      }
      return true;
    });

    if (sortBy === "submissions-desc") {
      return [...filtered].sort((a, b) => b.submittedCount - a.submittedCount);
    }
    if (sortBy === "submissions-asc") {
      return [...filtered].sort((a, b) => a.submittedCount - b.submittedCount);
    }
    if (sortBy === "name") {
      return [...filtered].sort((a, b) => a.teamName.localeCompare(b.teamName));
    }
    return filtered;
  }, [groups, selectedDept, searchQuery, sortBy]);

  return (
    <div className="relative flex h-full max-h-[calc(100vh-4rem)] flex-col overflow-hidden">
    <div className="flex shrink-0 flex-col gap-6 p-6 pb-8">
      {/* Page heading + date filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Team DSM Submission</h1>
          <p className="text-sm text-muted-foreground">
            Daily Status Management for All Departments • <span className="font-semibold text-foreground/80">{formattedDate}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Today Button */}
          <button
            type="button"
            onClick={() => handleDateChange(todayStr)}
            className={cn(
              "rounded-lg border px-4 py-2 text-xs font-semibold shadow-sm transition-colors",
              selectedDateStr === todayStr
                ? "bg-card border-foreground/30 text-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            Today
          </button>

          {/* Yesterday Button */}
          <button
            type="button"
            onClick={() => handleDateChange(yesterdayStr)}
            className={cn(
              "rounded-lg border px-4 py-2 text-xs font-medium transition-colors",
              selectedDateStr === yesterdayStr
                ? "bg-card border-foreground/30 text-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            Yesterday
          </button>

          {/* Calendar Picker Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker()}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                selectedDateStr !== todayStr && selectedDateStr !== yesterdayStr
                  ? "bg-card border-foreground/30 text-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
              aria-label="Select date"
            >
              <Calendar size={13} />
              {selectedDateStr !== todayStr && selectedDateStr !== yesterdayStr && (
                <span>{selectedDateStr}</span>
              )}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDateStr}
              onChange={(e) => handleDateChange(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
            />
          </div>

          {/* Filters Toggle Button */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent",
              showFilters || searchQuery || selectedDept !== "all"
                ? "bg-primary/10 border-primary text-primary hover:bg-primary/15"
                : "text-muted-foreground"
            )}
          >
            <Filter size={13} /> Filters
            {(searchQuery || selectedDept !== "all") && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {Number(!!searchQuery) + Number(selectedDept !== "all")}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Filter Panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Teams or Members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="w-48">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "submissions-desc" | "submissions-asc" | "name")}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
            >
              <option value="submissions-desc">Submissions (High to Low)</option>
              <option value="submissions-asc">Submissions (Low to High)</option>
              <option value="name">Team Name</option>
            </select>
          </div>

          {(searchQuery || selectedDept !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedDept("all");
              }}
              className="text-xs font-semibold text-primary hover:underline sm:ml-auto"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Stat cards */}
      {stats && (
        <AllDsmStatsRow
          stats={stats}
          submittedMembers={submittedMembers}
          pendingMembers={pendingMembers}
          blockerMembers={blockerMembers}
        />
      )}
    </div>

      {/* Team columns (scrollable, fills remaining space) */}
      <div className="min-h-0 flex-1 overflow-x-auto px-6 pb-6 cursor-grab dsm-columns-scrollbar">
        <div className="flex h-full items-start gap-8">
          {filteredGroups.map((group, index) => (
            <TeamColumn key={group.teamId} group={group} colorIndex={index} />
          ))}
          {filteredGroups.length === 0 && (
            <div className="flex h-48 w-full flex-col items-center justify-center rounded-xl border border-dashed text-center">
              <p className="text-sm text-muted-foreground">No Teams Match the Active Filters.</p>
            </div>
          )}
        </div>
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
