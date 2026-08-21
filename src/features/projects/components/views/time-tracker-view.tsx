"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Filter,
  MoreVertical,
  ClipboardList,
  Folder,
  X,
  Check,
  Loader2,
  Search,
  Bell,
  SlidersHorizontal,
  Sparkles,
  Grid,
  User as UserIcon,
  List,
} from "lucide-react";
import { UserTimeGroup, TimeLogEntry } from "../../types";
import { TimerWidget } from "../timer-widget";
import { NewTimeLogModal } from "../modals/new-time-log-modal";

interface TimeTrackerViewProps {
  initialGroups: UserTimeGroup[];
  projectId?: string;
  projectName?: string;
}

export function TimeTrackerView({ initialGroups, projectId, projectName }: TimeTrackerViewProps) {
  // `initialGroups` can arrive after mount (the in-board Time Logs tab fetches
  // asynchronously) — read it directly rather than mirroring it into local state,
  // since nothing here needs to mutate the group list independently of the prop.
  const userGroups = initialGroups;

  // Default views matching the user screenshot
  const [groupBy, setGroupBy] = useState<"Group By Date" | "Group By User" | "Group By Project">("Group By Date");
  const [timeSheetView, setTimeSheetView] = useState<"My Time Logs" | "All Time Logs" | "Team Time Logs">("My Time Logs");
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  // Add Time Log Modal State
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [modalTargetDate, setModalTargetDate] = useState("");
  const [modalTargetProject, setModalTargetProject] = useState("");

  // Date range navigator string
  const [dateRangeStr, setDateRangeStr] = useState("17/08/2026 to 23/08/2026 (WEEK - 34)");

  // Collapsible date sections state
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const toggleDateCollapse = (dateKey: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  const handleToggleSelectLog = (id: string) => {
    if (selectedLogIds.includes(id)) {
      setSelectedLogIds(selectedLogIds.filter((lId) => lId !== id));
    } else {
      setSelectedLogIds([...selectedLogIds, id]);
    }
  };

  const handleOpenAddModalForDate = (dateStr: string) => {
    setModalTargetDate(dateStr);
    setShowAddLogModal(true);
  };

  // Duration helpers, shared by the footer totals and the real date-grouping below.
  const parseDurationMinutes = (duration: string): number => {
    const match = duration.match(/(\d+):(\d+)/);
    if (!match) return 0;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  };
  const formatMinutes = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} h`;
  };
  const formatMinutesShort = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const allLogs = userGroups.flatMap((g) => g.timeLogs);
  const billableMinutes = allLogs
    .filter((l) => l.billingType === "BILLABLE")
    .reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);
  const nonBillableMinutes = allLogs
    .filter((l) => l.billingType !== "BILLABLE")
    .reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);

  // Real "Group By Date" data — logs from every user group, grouped by date, with
  // real per-date totals (previously a fully hardcoded mock array).
  const dateGroupsData = React.useMemo(() => {
    const byDate = new Map<
      string,
      { date: string; logs: (TimeLogEntry & { userName: string })[] }
    >();
    for (const group of userGroups) {
      for (const log of group.timeLogs) {
        if (!byDate.has(log.date)) byDate.set(log.date, { date: log.date, logs: [] });
        byDate.get(log.date)!.logs.push({ ...log, userName: group.userName });
      }
    }
    return Array.from(byDate.values())
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((g) => {
        const billable = g.logs
          .filter((l) => l.billingType === "BILLABLE")
          .reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);
        const nonBillable = g.logs
          .filter((l) => l.billingType !== "BILLABLE")
          .reduce((sum, l) => sum + parseDurationMinutes(l.duration), 0);
        return {
          date: g.date,
          totalHours: formatMinutesShort(billable + nonBillable),
          billableHours: formatMinutesShort(billable),
          nonBillableHours: formatMinutesShort(nonBillable),
          logs: g.logs,
        };
      });
  }, [userGroups]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden relative text-xs">
      {/* ── Top App Title Bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-card text-card-foreground shadow-2xs">
        <h1 className="text-base font-bold tracking-wide text-foreground">
          Time Logs
        </h1>

        {/* Top Right Action Icons */}

      </div>

      {/* ── Secondary Control Bar (Breadcrumbs, Date Range & Actions) ──────────── */}
      <div className="flex flex-wrap items-center justify-between border-b border-border px-6 py-2.5 bg-muted/40 text-foreground gap-3">
        {/* Left Sub-Nav Filters */}
        <div className="flex items-center gap-2 text-xs">
          {/* Group By Select */}
          <div className="relative inline-flex items-center gap-1 text-primary font-semibold cursor-pointer hover:underline">
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
              className="bg-transparent text-primary font-semibold outline-none cursor-pointer appearance-none pr-4"
            >
              <option value="Group By Date" className="bg-card text-foreground">Group By Date</option>
              <option value="Group By User" className="bg-card text-foreground">Group By User</option>
              <option value="Group By Project" className="bg-card text-foreground">Group By Project</option>
            </select>
            <ChevronDown size={14} className="text-primary pointer-events-none -ml-3" />
          </div>

          <span className="text-muted-foreground font-bold">&gt;</span>

          {/* Time Sheet View Select */}
          <div className="relative inline-flex items-center gap-1 text-primary font-semibold cursor-pointer hover:underline">
            <select
              value={timeSheetView}
              onChange={(e) => setTimeSheetView(e.target.value as typeof timeSheetView)}
              className="bg-transparent text-primary font-semibold outline-none cursor-pointer appearance-none pr-4"
            >
              <option value="My Time Logs" className="bg-card text-foreground">My Time Logs</option>
              <option value="All Time Logs" className="bg-card text-foreground">All Time Logs</option>
              <option value="Team Time Logs" className="bg-card text-foreground">Team Time Logs</option>
            </select>
            <ChevronDown size={14} className="text-primary pointer-events-none -ml-3" />
          </div>
        </div>

        {/* Center Date Range Navigator */}
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground bg-card border border-border px-3 py-1 rounded-md shadow-2xs">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Previous Week"
          >
            <ChevronLeft size={14} />
          </button>
          <CalendarIcon size={13} className="text-primary" />
          <span>{dateRangeStr}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Next Week"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* List Layout Dropdown Button */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-card text-foreground font-medium cursor-pointer hover:bg-accent shadow-2xs">
            <List size={14} className="text-primary" />
            <span>List</span>
            <Sparkles size={12} className="text-warning ml-0.5" />
          </div>

          {/* Add Time Log Split Button */}
          <div className="inline-flex rounded bg-primary text-primary-foreground shadow-xs font-semibold overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAddLogModal(true)}
              className="px-3.5 py-1 text-xs hover:bg-primary/90 transition-colors border-r border-primary-foreground/20"
            >
              Add Time Log
            </button>
            <button
              type="button"
              onClick={() => setShowAddLogModal(true)}
              className="px-2 py-1 hover:bg-primary/90 transition-colors"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Filter Icon */}
          <button
            type="button"
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Filter"
          >
            <Filter size={15} />
          </button>

          {/* More Options */}
          <button
            type="button"
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
            title="More Options"
          >
            <MoreVertical size={15} />
          </button>
        </div>
      </div>

      {/* ── Main Data Table (Group By Date View) ─────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
        {groupBy === "Group By Date" ? (
          <table className="w-full text-left text-xs border-collapse rounded-lg overflow-hidden border border-border bg-card shadow-2xs">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-muted-foreground font-semibold">
                <th className="py-2.5 px-3 border-r border-border w-10 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <ChevronDown size={13} className="text-muted-foreground" />
                    <input
                      type="checkbox"
                      className="rounded border-input bg-background text-primary h-3.5 w-3.5"
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap text-foreground font-bold">
                  ID
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap min-w-[170px] text-foreground font-bold">
                  Log Title
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap min-w-[140px] text-foreground font-bold">
                  <div className="flex items-center gap-1.5">
                    <Folder size={13} className="text-muted-foreground" />
                    <span>Project</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap text-foreground font-bold">
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-muted-foreground" />
                    <span>Daily Log Hours</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap text-foreground font-bold">
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-muted-foreground" />
                    <span>Time Period</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap min-w-[140px] text-foreground font-bold">
                  <div className="flex items-center gap-1.5">
                    <UserIcon size={13} className="text-muted-foreground" />
                    <span>User</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 border-r border-border whitespace-nowrap text-foreground font-bold">
                  Billing Type
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap text-foreground font-bold">
                  Approval Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {dateGroupsData.map((group) => {
                const isCollapsed = collapsedDates[group.date];

                return (
                  <React.Fragment key={group.date}>
                    {/* Date Header Row - Adaptive Theme Styling */}
                    <tr className="bg-muted/80 font-bold border-b border-border text-foreground hover:bg-muted transition-colors">
                      <td className="py-2.5 px-3 border-r border-border text-center">
                        <button
                          type="button"
                          onClick={() => toggleDateCollapse(group.date)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isCollapsed ? (
                            <ChevronRight size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                      </td>
                      <td colSpan={3} className="py-2.5 px-4 border-r border-border font-bold text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CalendarIcon size={14} className="text-muted-foreground" />
                          <span className="text-foreground font-bold">{group.date}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 border-r border-border font-mono font-bold whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-foreground font-bold">{group.totalHours}</span>
                          <span className="text-info font-bold">{group.billableHours}</span>
                          <span className="text-warning font-bold">{group.nonBillableHours}</span>
                        </div>
                      </td>
                      <td colSpan={4} className="py-2.5 px-4" />
                    </tr>

                    {!isCollapsed && (
                      <>
                        {/* Quick Add Time Log Row Under Date */}
                        <tr className="border-b border-border bg-muted/20 hover:bg-accent/40 transition-colors">
                          <td className="py-2 px-3 border-r border-border text-center" />
                          <td
                            colSpan={8}
                            onClick={() => handleOpenAddModalForDate(group.date)}
                            className="py-2 px-4 text-muted-foreground text-[11px] font-medium cursor-pointer hover:text-primary transition-colors flex items-center justify-between"
                          >
                            <span>Add Time Log</span>
                            <Plus size={14} className="text-primary" />
                          </td>
                        </tr>

                        {/* Log Rows */}
                        {group.logs.map((log) => (
                          <tr
                            key={log.id}
                            className="hover:bg-accent/20 transition-colors border-b border-border bg-card text-foreground"
                          >
                            <td className="py-2.5 px-3 border-r border-border text-center">
                              <input
                                type="checkbox"
                                checked={selectedLogIds.includes(log.id)}
                                onChange={() => handleToggleSelectLog(log.id)}
                                className="rounded border-input bg-background text-primary h-3.5 w-3.5"
                              />
                            </td>

                            <td className="py-2.5 px-4 border-r border-border font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                              {log.code}
                            </td>

                            <td className="py-2.5 px-4 border-r border-border font-semibold text-foreground whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <ClipboardList size={14} className="text-muted-foreground shrink-0" />
                                <span>{log.title}</span>
                              </div>
                            </td>

                            <td className="py-2.5 px-4 border-r border-border text-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Folder size={14} className="text-muted-foreground shrink-0" />
                                <span>{log.project}</span>
                              </div>
                            </td>

                            <td className="py-2.5 px-4 border-r border-border font-mono font-bold text-foreground whitespace-nowrap">
                              {log.duration}
                            </td>

                            <td className="py-2.5 px-4 border-r border-border font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                              {log.timePeriod}
                            </td>

                            {/* User Column */}
                            <td className="py-2.5 px-4 border-r border-border whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground text-[11px]">↑</span>
                                <span className="font-semibold text-foreground">
                                  {log.userName}
                                </span>
                              </div>
                            </td>

                            {/* Billing Type Column */}
                            <td className="py-2.5 px-4 border-r border-border whitespace-nowrap">
                              <span
                                className={`font-semibold ${log.billingType === "BILLABLE"
                                    ? "text-info"
                                    : "text-warning"
                                  }`}
                              >
                                {log.billingType}
                              </span>
                            </td>

                            {/* Approval Status Column */}
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <span className="inline-block rounded-md bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground border border-border">
                                {log.approvalStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* Mode: Group By User */
          <table className="w-full text-left text-xs border-collapse rounded-lg overflow-hidden border border-border bg-card shadow-2xs">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-muted-foreground font-semibold">
                <th className="py-3 px-3 border-r border-border w-10 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-input text-primary h-3.5 w-3.5"
                  />
                </th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap">ID</th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap min-w-[160px]">
                  LOG TITLE
                </th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap min-w-[140px]">
                  PROJECT
                </th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap">
                  DAILY LOG HOURS
                </th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap">
                  TIME PERIOD
                </th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap">DATE</th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap">
                  BILLING TYPE
                </th>
                <th className="py-3 px-4 border-r border-border whitespace-nowrap min-w-[140px]">
                  APPROVAL STATUS
                </th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[160px]">REMARKS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {userGroups.map((group) => {
                const [totalStr, billableStr, nonBillableStr] = group.dailyLogHours.split(" | ");
                return (
                <React.Fragment key={group.userId}>
                  <tr className="bg-muted/80 hover:bg-muted transition-colors font-medium">
                    <td className="py-3 px-3 border-r border-border text-center">
                      <button
                        type="button"
                        onClick={() => toggleDateCollapse(group.userId)}
                        className="p-1 text-muted-foreground hover:text-foreground rounded"
                      >
                        {collapsedDates[group.userId] ? (
                          <ChevronDown size={15} />
                        ) : (
                          <ChevronUp size={15} />
                        )}
                      </button>
                    </td>

                    <td colSpan={3} className="py-3 px-4 border-r border-border whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${group.avatarColor}`}
                        >
                          {group.userInitials}
                        </span>
                        <span className="font-bold text-foreground">
                          {group.userName}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 border-r border-border font-mono font-bold whitespace-nowrap">
                      <span className="text-foreground">{totalStr}</span> |{" "}
                      <span className="text-info">{billableStr}</span> |{" "}
                      <span className="text-warning">{nonBillableStr}</span>
                    </td>

                    <td colSpan={5} className="py-3 px-4" />
                  </tr>

                  {!collapsedDates[group.userId] && (
                    <>
                      {group.timeLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-accent/30 transition-colors border-b border-border text-foreground"
                        >
                          <td className="py-3 px-3 border-r border-border text-center">
                            <input
                              type="checkbox"
                              checked={selectedLogIds.includes(log.id)}
                              onChange={() => handleToggleSelectLog(log.id)}
                              className="rounded border-input text-primary h-3.5 w-3.5"
                            />
                          </td>

                          <td className="py-3 px-4 border-r border-border font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                            {log.code}
                          </td>

                          <td className="py-3 px-4 border-r border-border font-semibold text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <ClipboardList size={14} className="text-muted-foreground" />
                              <span>{log.title}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 border-r border-border text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Folder size={14} className="text-muted-foreground" />
                              <span>{log.project}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 border-r border-border font-mono font-bold text-foreground whitespace-nowrap">
                            {log.duration}
                          </td>

                          <td className="py-3 px-4 border-r border-border font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {log.timePeriod}
                          </td>

                          <td className="py-3 px-4 border-r border-border font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {log.date}
                          </td>

                          <td className="py-3 px-4 border-r border-border whitespace-nowrap">
                            <span className="font-semibold text-info">
                              {log.billingType}
                            </span>
                          </td>

                          <td className="py-3 px-4 border-r border-border whitespace-nowrap">
                            <span className="inline-block rounded-md bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground border border-border">
                              {log.approvalStatus || "Pending"}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap max-w-[220px] truncate" title={log.remarks}>
                            {log.remarks || "—"}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Bottom Summary Footer Bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-border px-6 py-2.5 bg-muted/40 text-xs font-semibold shrink-0 text-foreground">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-muted-foreground font-normal">Billable</span>{" "}
            <strong className="text-info ml-1 font-bold">{formatMinutes(billableMinutes)}</strong>
          </div>

          <div className="h-4 w-px bg-border" />

          <div>
            <span className="text-muted-foreground font-normal">Non Billable</span>{" "}
            <strong className="text-warning ml-1 font-bold">{formatMinutes(nonBillableMinutes)}</strong>
          </div>

          <div className="h-4 w-px bg-border" />

          <div>
            <span className="text-muted-foreground font-normal">Total</span>{" "}
            <strong className="text-foreground ml-1 font-bold">{formatMinutes(billableMinutes + nonBillableMinutes)}</strong>
          </div>
        </div>

        <div className="text-muted-foreground font-normal">
          Total Count: <strong className="text-foreground font-semibold">{allLogs.length}</strong>
        </div>
      </div>

      {/* Add Time Log Modal Dialog */}
      <NewTimeLogModal
        isOpen={showAddLogModal}
        onClose={() => setShowAddLogModal(false)}
        initialProject={modalTargetProject}
        projectId={projectId}
        projectName={projectName}
        onLogAdded={(newLog) => {
          console.log("New Log Added:", newLog);
        }}
      />
    </div>
  );
}
