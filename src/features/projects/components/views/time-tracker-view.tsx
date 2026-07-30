"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { UserTimeGroup, TimeLogEntry } from "../../types";

interface TimeTrackerViewProps {
  initialGroups: UserTimeGroup[];
}

export function TimeTrackerView({ initialGroups }: TimeTrackerViewProps) {
  const [userGroups, setUserGroups] = useState<UserTimeGroup[]>(initialGroups);
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 6, 11)); // 11/07/2026
  const [groupBy, setGroupBy] = useState("Group By User");
  const [timeSheetView, setTimeSheetView] = useState("My Time Sheet");
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  // Add Time Log Modal State
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [logTitle, setLogTitle] = useState("");
  const [logProject, setLogProject] = useState("EED Core");
  const [logDuration, setLogDuration] = useState("00:30");
  const [logBillingType, setLogBillingType] = useState<"NON BILLABLE" | "BILLABLE">("NON BILLABLE");
  const [logRemarks, setLogRemarks] = useState("");

  const formattedDate = currentDate.toLocaleDateString("en-GB");

  const handlePrevDate = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    setCurrentDate(prev);
  };

  const handleNextDate = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const toggleGroupExpand = (userId: string) => {
    setUserGroups((prev) =>
      prev.map((g) =>
        g.userId === userId ? { ...g, isExpanded: !g.isExpanded } : g
      )
    );
  };

  const handleToggleSelectLog = (id: string) => {
    if (selectedLogIds.includes(id)) {
      setSelectedLogIds(selectedLogIds.filter((lId) => lId !== id));
    } else {
      setSelectedLogIds([...selectedLogIds, id]);
    }
  };

  const handleToggleApprovalStatus = (groupId: string, logId: string) => {
    setUserGroups((prev) =>
      prev.map((group) => {
        if (group.userId !== groupId) return group;
        return {
          ...group,
          timeLogs: group.timeLogs.map((log) => {
            if (log.id !== logId) return log;
            const nextStatus =
              log.approvalStatus === "Approved" ? "Pending" : "Approved";
            return { ...log, approvalStatus: nextStatus };
          }),
        };
      })
    );
  };

  const handleCreateTimeLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logTitle.trim()) return;

    const newLog: TimeLogEntry = {
      id: `tl-${Date.now()}`,
      code: `EC2-T${Math.floor(3000 + Math.random() * 900)}`,
      title: logTitle,
      project: logProject,
      duration: logDuration || "00:30",
      timePeriod: "11:00 AM - 11:30 AM",
      date: formattedDate,
      billingType: logBillingType,
      remarks: logRemarks || "Log entry added",
      approvalStatus: "Pending",
    };

    setUserGroups((prev) =>
      prev.map((g) =>
        g.userName === "Dhruv Patidar"
          ? { ...g, isExpanded: true, timeLogs: [newLog, ...g.timeLogs] }
          : g
      )
    );

    setShowAddLogModal(false);
    setLogTitle("");
    setLogRemarks("");
  };

  // Flattened entries for Group By Date mode (Matching Image 3)
  const allLogsFlat = userGroups.flatMap((g) =>
    g.timeLogs.map((l) => ({
      ...l,
      userInitials: g.userInitials,
      userName: g.userName,
      avatarColor: g.avatarColor,
    }))
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden relative">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
          Time Tracker
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent"
            title="Timer Logs"
          >
            <Clock size={18} />
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent"
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="flex flex-wrap items-center justify-between border-b px-6 py-3 bg-muted/20 gap-3">
        <div className="flex items-center gap-3 text-xs">
          {/* Group By dropdown */}
          <div className="relative">
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="rounded border border-input bg-background px-3 py-1.5 font-medium text-foreground outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 cursor-pointer"
            >
              <option value="Group By User">Group By User</option>
              <option value="Group By Date">Group By Date</option>
              <option value="Group By Project">Group By Project</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>

          {/* My Time Sheet dropdown */}
          <div className="relative">
            <select
              value={timeSheetView}
              onChange={(e) => setTimeSheetView(e.target.value)}
              className="rounded border border-input bg-background px-3 py-1.5 font-medium text-foreground outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 cursor-pointer"
            >
              <option value="My Time Sheet">My Time Sheet</option>
              <option value="All Members">All Members</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>

          {/* Date Navigator */}
          <div className="flex items-center gap-1 border rounded bg-background px-2 py-1">
            <button
              type="button"
              onClick={handlePrevDate}
              className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
              title="Previous Date"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="flex items-center gap-1.5 font-medium px-1.5 text-xs">
              <CalendarIcon size={14} className="text-blue-600 dark:text-blue-400" />
              <span>{formattedDate}</span>
            </div>
            <button
              type="button"
              onClick={handleNextDate}
              className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
              title="Next Date"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Action Buttons & Filter Icons */}
        <div className="flex items-center gap-3 text-xs">
          {/* Add Time Log Split Button */}
          <div className="inline-flex rounded-md bg-blue-600 text-white shadow-xs">
            <button
              type="button"
              onClick={() => setShowAddLogModal(true)}
              className="px-4 py-1.5 font-semibold text-xs hover:bg-blue-700 transition-colors border-r border-blue-500"
            >
              Add Time Log
            </button>
            <button
              type="button"
              onClick={() => setShowAddLogModal(true)}
              className="px-2 py-1.5 hover:bg-blue-700 transition-colors"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          <button
            type="button"
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="Filter"
          >
            <Filter size={15} />
          </button>
          <button
            type="button"
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="More Options"
          >
            <MoreVertical size={15} />
          </button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
        {groupBy === "Group By Date" ? (
          /* Mode: Group By Date (Matching Image 3) */
          <table className="w-full text-left text-xs border-collapse rounded-lg overflow-hidden border">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-3 border-r w-10 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-input text-blue-600 h-4 w-4"
                  />
                </th>
                <th className="py-3 px-4 border-r whitespace-nowrap">ID</th>
                <th className="py-3 px-4 border-r whitespace-nowrap min-w-[160px]">
                  LOG TITLE
                </th>
                <th className="py-3 px-4 border-r whitespace-nowrap min-w-[140px]">
                  PROJECT
                </th>
                <th className="py-3 px-4 border-r whitespace-nowrap">
                  DAILY LOG HOURS
                </th>
                <th className="py-3 px-4 border-r whitespace-nowrap">
                  TIME PERIOD
                </th>
                <th className="py-3 px-4 border-r whitespace-nowrap">DATE</th>
                <th className="py-3 px-4 border-r whitespace-nowrap min-w-[160px]">
                  USER
                </th>
                <th className="py-3 px-4 whitespace-nowrap">BILLING TYPE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Date Header Row */}
              <tr className="bg-slate-100/70 dark:bg-muted/30 font-medium">
                <td className="py-3 px-3 border-r text-center" />
                <td colSpan={3} className="py-3 px-4 border-r whitespace-nowrap font-bold">
                  05:07 | 01:51 | 03:16
                </td>
                <td colSpan={5} className="py-3 px-4" />
              </tr>

              <tr className="border-b bg-background">
                <td className="py-2.5 px-3 border-r text-center" />
                <td
                  colSpan={8}
                  onClick={() => setShowAddLogModal(true)}
                  className="py-2.5 px-4 italic text-muted-foreground/70 text-[11px] cursor-pointer hover:text-blue-600 hover:bg-accent/20 transition-colors"
                >
                  Add Time Log...
                </td>
              </tr>

              {allLogsFlat.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-accent/20 transition-colors border-b"
                >
                  <td className="py-3 px-3 border-r text-center">
                    <input
                      type="checkbox"
                      checked={selectedLogIds.includes(log.id)}
                      onChange={() => handleToggleSelectLog(log.id)}
                      className="rounded border-input text-blue-600 h-4 w-4"
                    />
                  </td>

                  <td className="py-3 px-4 border-r font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                    {log.code}
                  </td>

                  <td className="py-3 px-4 border-r font-semibold text-foreground whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <ClipboardList size={14} className="text-muted-foreground" />
                      <span>{log.title}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 border-r text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Folder size={14} className="text-muted-foreground" />
                      <span>{log.project}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 border-r font-mono font-bold text-foreground whitespace-nowrap">
                    {log.duration}
                  </td>

                  <td className="py-3 px-4 border-r font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {log.timePeriod}
                  </td>

                  <td className="py-3 px-4 border-r font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {log.date}
                  </td>

                  {/* USER Column (Matching Image 3) */}
                  <td className="py-3 px-4 border-r whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${log.avatarColor}`}
                      >
                        {log.userInitials}
                      </span>
                      <span className="font-semibold text-foreground">
                        {log.userName}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-block rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800/60 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      {log.billingType}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* Mode: Group By User (Matching Image 1) */
          <table className="w-full text-left text-xs border-collapse rounded-lg overflow-hidden border">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-3 border-r w-10 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-input text-blue-600 h-4 w-4"
                  />
                </th>
                <th className="py-3 px-4 border-r whitespace-nowrap">ID</th>
                <th className="py-3 px-4 border-r whitespace-nowrap min-w-[160px]">
                  LOG TITLE
                </th>
                <th className="py-3 px-4 border-r whitespace-nowrap min-w-[140px]">
                  PROJECT
                </th>
                <th className="py-3 px-4 border-r whitespace-nowrap">
                  DAILY LOG HOURS
                </th>
                <th className="py-3 px-4 border-r whitespace-nowrap">
                  TIME PERIOD
                </th>
                <th className="py-3 px-4 border-r whitespace-nowrap">DATE</th>
                <th className="py-3 px-4 border-r whitespace-nowrap">
                  BILLING TYPE
                </th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[140px]">
                  REMARKS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {userGroups.map((group) => (
                <React.Fragment key={group.userId}>
                  {/* User Row Header */}
                  <tr className="bg-slate-100/70 dark:bg-muted/30 hover:bg-accent/40 transition-colors font-medium">
                    <td className="py-3 px-3 border-r text-center">
                      <button
                        type="button"
                        onClick={() => toggleGroupExpand(group.userId)}
                        className="p-1 text-muted-foreground hover:text-foreground rounded"
                      >
                        {group.isExpanded ? (
                          <ChevronUp size={15} />
                        ) : (
                          <ChevronDown size={15} />
                        )}
                      </button>
                    </td>

                    {/* User Avatar + Name */}
                    <td colSpan={3} className="py-3 px-4 border-r whitespace-nowrap">
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

                    {/* DAILY LOG HOURS (Matching Image 1) */}
                    <td className="py-3 px-4 border-r font-mono font-bold whitespace-nowrap">
                      <span className="text-foreground">05:07</span> |{" "}
                      <span className="text-blue-600 dark:text-blue-400">01:51</span> |{" "}
                      <span className="text-amber-600 dark:text-amber-500">03:16</span>
                    </td>

                    <td colSpan={4} className="py-3 px-4" />
                  </tr>

                  {/* Expanded Time Log Sub-Rows */}
                  {group.isExpanded && (
                    <>
                      <tr className="border-b bg-background">
                        <td className="py-2.5 px-3 border-r text-center" />
                        <td
                          colSpan={8}
                          onClick={() => setShowAddLogModal(true)}
                          className="py-2.5 px-4 italic text-muted-foreground/70 text-[11px] cursor-pointer hover:text-blue-600 hover:bg-accent/20 transition-colors"
                        >
                          Add Time Log...
                        </td>
                      </tr>

                      {group.timeLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-accent/20 transition-colors border-b"
                        >
                          <td className="py-3 px-3 border-r text-center">
                            <input
                              type="checkbox"
                              checked={selectedLogIds.includes(log.id)}
                              onChange={() => handleToggleSelectLog(log.id)}
                              className="rounded border-input text-blue-600 h-4 w-4"
                            />
                          </td>

                          <td className="py-3 px-4 border-r font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                            {log.code}
                          </td>

                          <td className="py-3 px-4 border-r font-semibold text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <ClipboardList size={14} className="text-muted-foreground" />
                              <span>{log.title}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 border-r text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Folder size={14} className="text-muted-foreground" />
                              <span>{log.project}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 border-r font-mono font-bold text-foreground whitespace-nowrap">
                            {log.duration}
                          </td>

                          <td className="py-3 px-4 border-r font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {log.timePeriod}
                          </td>

                          <td className="py-3 px-4 border-r font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {log.date}
                          </td>

                          <td className="py-3 px-4 border-r whitespace-nowrap">
                            <span className="inline-block rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                              {log.billingType}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                            {log.remarks}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div className="flex items-center justify-between border-t px-6 py-3 bg-muted/20 text-xs font-semibold shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-muted-foreground font-normal">Billable</span>{" "}
            <strong className="text-blue-600 dark:text-blue-400 ml-1">
              00:00 h
            </strong>
          </div>

          <div className="h-4 w-px bg-border" />

          <div>
            <span className="text-muted-foreground font-normal">
              Non Billable
            </span>{" "}
            <strong className="text-amber-600 dark:text-amber-500 ml-1">
              01:00 h
            </strong>
          </div>

          <div className="h-4 w-px bg-border" />

          <div>
            <span className="text-muted-foreground font-normal">Total</span>{" "}
            <strong className="text-foreground ml-1">01:00 h</strong>
          </div>
        </div>

        <div className="text-muted-foreground font-normal">
          Total Count: <strong className="text-foreground font-semibold">3</strong>
        </div>
      </div>

      {/* Add Time Log Modal Dialog */}
      {showAddLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-xl space-y-4 text-xs animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm font-bold text-foreground">Add New Time Log</h3>
              <button
                type="button"
                onClick={() => setShowAddLogModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTimeLog} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">
                  Log Title *
                </label>
                <input
                  type="text"
                  required
                  value={logTitle}
                  onChange={(e) => setLogTitle(e.target.value)}
                  placeholder="e.g. DSMA / Bug fix"
                  className="w-full rounded border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">
                  Project
                </label>
                <input
                  type="text"
                  value={logProject}
                  onChange={(e) => setLogProject(e.target.value)}
                  className="w-full rounded border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">
                    Duration (hh:mm)
                  </label>
                  <input
                    type="text"
                    value={logDuration}
                    onChange={(e) => setLogDuration(e.target.value)}
                    placeholder="00:30"
                    className="w-full rounded border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">
                    Billing Type
                  </label>
                  <select
                    value={logBillingType}
                    onChange={(e) => setLogBillingType(e.target.value as any)}
                    className="w-full rounded border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="NON BILLABLE">NON BILLABLE</option>
                    <option value="BILLABLE">BILLABLE</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">
                  Remarks
                </label>
                <textarea
                  rows={2}
                  value={logRemarks}
                  onChange={(e) => setLogRemarks(e.target.value)}
                  placeholder="Notes or comments..."
                  className="w-full rounded border p-2 text-xs outline-none focus:ring-1 focus:ring-primary resize-y"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddLogModal(false)}
                  className="rounded border px-4 py-1.5 text-xs hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
