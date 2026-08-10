"use client";

import React, { useState } from "react";
import {
  Clock,
  Settings,
  Plus,
  ChevronDown,
  Filter,
  MoreHorizontal,
  Copy,
  Check,
  ArrowUpDown,
  ListTodo,
  Layers,
  Trash2,
  Download,
  RotateCw,
  X,
} from "lucide-react";
import { Project, WorkspaceRole } from "../../types";

interface AllProjectsTableViewProps {
  projects: Project[];
  onOpenAddModal: () => void;
  onDeleteProject?: (id: string) => void;
  userRole?: WorkspaceRole;
}

export function AllProjectsTableView({
  projects,
  onOpenAddModal,
  onDeleteProject,
  userRole = "ADMIN",
}: AllProjectsTableViewProps) {
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "COMPLETED">("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Popover / Menu States
  const [showTimelinePopover, setShowTimelinePopover] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL");

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    const matchesTab =
      activeTab === "ACTIVE"
        ? project.status === "ACTIVE"
        : project.status === "COMPLETED";

    const matchesStatusDropdown =
      statusFilter === "ALL" || project.status === statusFilter;

    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.owner.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesStatusDropdown && matchesSearch;
  });

  const handleCopyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/projects/${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    const headers = "ID,Name,Owner,Status,Hours,StartDate,Deadline\n";
    const rows = filteredProjects
      .map(
        (p) =>
          `"${p.id}","${p.name}","${p.owner.name}","${p.status}","${p.totalHours}","${p.startDate}","${p.deadline}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projects-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    setShowOptionsMenu(false);
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden relative">
      {/* Top Main Bar: Title & Action Button */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">All Projects</h1>
        </div>

        <div className="flex items-center gap-2 relative">
          {userRole === "TEAM_MEMBER" ? (
            /* Team Member Mode Header Actions (matching Image 1) */
            <>
              <button
                type="button"
                onClick={onOpenAddModal}
                className="p-1.5 border rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Add New Project"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                onClick={() => setShowTimelinePopover(!showTimelinePopover)}
                className="p-1.5 border rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Project Timeline Logs"
              >
                <Clock size={16} />
              </button>
              <button
                type="button"
                onClick={() => setShowSettingsPopover(!showSettingsPopover)}
                className="p-1.5 border rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Project Settings"
              >
                <Settings size={16} />
              </button>
            </>
          ) : (
            /* Admin Mode Header Actions */
            <>
              <button
                type="button"
                onClick={() => setShowTimelinePopover(!showTimelinePopover)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-accent"
                title="Project Timeline Logs"
              >
                <Clock size={18} />
              </button>

              <button
                type="button"
                onClick={() => setShowSettingsPopover(!showSettingsPopover)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-accent"
                title="Project Settings"
              >
                <Settings size={18} />
              </button>

              <button
                type="button"
                onClick={onOpenAddModal}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
              >
                <Plus size={16} /> Add New Project
              </button>
            </>
          )}

          {/* Timeline Popover */}
          {showTimelinePopover && (
            <div className="absolute top-10 right-12 z-40 w-64 rounded-md border bg-popover p-3 shadow-lg text-xs space-y-2 animate-in fade-in duration-150">
              <div className="flex justify-between items-center font-bold border-b pb-1">
                <span>Timeline Logs</span>
                <button type="button" onClick={() => setShowTimelinePopover(false)}>
                  <X size={12} />
                </button>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Showing recent timeline events across all active projects.
              </p>
              <div className="space-y-1 text-[11px]">
                <div className="text-foreground">● Project WinOS updated by Dhruv Patidar</div>
                <div className="text-foreground">● New phase added to EED Website</div>
              </div>
            </div>
          )}

          {/* Settings Popover */}
          {showSettingsPopover && (
            <div className="absolute top-10 right-0 z-40 w-56 rounded-md border bg-popover p-3 shadow-lg text-xs space-y-2 animate-in fade-in duration-150">
              <div className="flex justify-between items-center font-bold border-b pb-1">
                <span>Project Settings</span>
                <button type="button" onClick={() => setShowSettingsPopover(false)}>
                  <X size={12} />
                </button>
              </div>
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span>Show completed phases</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span>Enable time log alerts</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Row: Active Projects / Completed Projects */}
      <div className="flex items-center justify-between border-b px-6 pt-3 pb-0 bg-background">
        <div className="flex gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("ACTIVE")}
            className={`pb-3 transition-colors relative ${
              activeTab === "ACTIVE"
                ? "text-info border-b-2 border-info"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active Projects
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("COMPLETED")}
            className={`pb-3 transition-colors relative ${
              activeTab === "COMPLETED"
                ? "text-info border-b-2 border-info"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Completed Projects
          </button>
        </div>
      </div>

      {/* Table Action Filter Bar */}
      <div className="flex items-center justify-between border-b px-6 py-2.5 bg-muted/20 relative">
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded border border-input bg-background px-2.5 py-1 text-xs font-medium text-info cursor-pointer outline-none"
          >
            <option value="ALL">All Projects</option>
            <option value="ACTIVE">Active Projects</option>
            <option value="COMPLETED">Completed Projects</option>
          </select>

          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded border border-input bg-background px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-primary w-48"
          />
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          {/* Filter Panel Toggle */}
          <button
            type="button"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="p-1.5 hover:bg-accent rounded hover:text-foreground transition-colors"
            title="Filter Columns"
          >
            <Filter size={15} />
          </button>

          {/* Options Menu Toggle */}
          <button
            type="button"
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            className="p-1.5 hover:bg-accent rounded hover:text-foreground transition-colors"
            title="More Options"
          >
            <MoreHorizontal size={15} />
          </button>

          {/* Options Dropdown */}
          {showOptionsMenu && (
            <div className="absolute right-6 top-10 z-40 w-44 rounded-md border bg-popover py-1 shadow-lg text-xs space-y-0.5 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left text-foreground font-medium"
              >
                <Download size={13} /> Export CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setShowOptionsMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left text-foreground font-medium"
              >
                <RotateCw size={13} /> Refresh List
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Responsive Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground font-medium">
              <th className="py-3 px-4 border-r whitespace-nowrap">Project ID</th>
              <th className="py-3 px-4 border-r whitespace-nowrap min-w-[180px]">
                Project Name
              </th>
              <th className="py-3 px-2 border-r text-center whitespace-nowrap w-10">
                📎
              </th>
              <th className="py-3 px-3 border-r whitespace-nowrap text-center">%</th>
              <th className="py-3 px-4 border-r whitespace-nowrap">
                <span className="flex items-center gap-1">👤 Owner</span>
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap">
                <span className="flex items-center gap-1">
                  ℹ Status <ArrowUpDown size={12} />
                </span>
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap">
                <span className="flex items-center gap-1">⏱ Total Hours</span>
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap">Billable</th>
              <th className="py-3 px-4 border-r whitespace-nowrap">Non Billable</th>
              <th className="py-3 px-4 border-r whitespace-nowrap">📅 Start Date</th>
              <th className="py-3 px-4 border-r whitespace-nowrap">📅 Deadline</th>
              <th className="py-3 px-4 border-r whitespace-nowrap min-w-[140px]">
                <span className="flex items-center gap-1">
                  <ListTodo size={13} /> Tasks
                </span>
              </th>
              <th className="py-3 px-4 border-r whitespace-nowrap min-w-[140px]">
                <span className="flex items-center gap-1">
                  <Layers size={13} /> Phases
                </span>
              </th>
              {userRole === "ADMIN" && <th className="py-3 px-3 text-center">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredProjects.length === 0 ? (
              <tr>
                <td
                  colSpan={userRole === "ADMIN" ? 14 : 13}
                  className="py-12 text-center text-muted-foreground"
                >
                  No projects found.
                </td>
              </tr>
            ) : (
              filteredProjects.map((project) => (
                <tr
                  key={project.id}
                  className="hover:bg-accent/30 transition-colors group"
                >
                  <td className="py-3 px-4 border-r font-medium text-foreground whitespace-nowrap">
                    {project.id}
                  </td>

                  <td className="py-3 px-4 border-r font-semibold text-foreground whitespace-nowrap">
                    {project.name}
                  </td>

                  <td className="py-3 px-2 border-r text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(project.id)}
                      className="p-1 text-muted-foreground hover:text-primary transition-colors rounded"
                      title="Copy Project Link"
                    >
                      {copiedId === project.id ? (
                        <Check size={14} className="text-success" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </td>

                  <td className="py-3 px-3 border-r text-center font-medium text-muted-foreground whitespace-nowrap">
                    {project.progressPercent}%
                  </td>

                  <td className="py-3 px-4 border-r whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                          project.owner.avatarColor || "bg-amber-500 text-white"
                        }`}
                      >
                        {project.owner.initials}
                      </span>
                      <span className="font-medium text-foreground">
                        {project.owner.name}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 border-r whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 rounded bg-success px-3 py-1 text-[11px] font-semibold text-success-foreground">
                      {project.status === "ACTIVE" ? "Active" : "Completed"}
                    </span>
                  </td>

                  <td className="py-3 px-4 border-r font-mono text-[11px] text-foreground whitespace-nowrap">
                    {project.totalHours}
                  </td>

                  <td className="py-3 px-4 border-r font-mono text-[11px] font-bold text-info whitespace-nowrap">
                    {project.billableHours}
                  </td>

                  <td className="py-3 px-4 border-r font-mono text-[11px] font-bold text-warning whitespace-nowrap">
                    {project.nonBillableHours}
                  </td>

                  <td className="py-3 px-4 border-r text-muted-foreground whitespace-nowrap">
                    {project.startDate}
                  </td>

                  <td className="py-3 px-4 border-r text-muted-foreground whitespace-nowrap">
                    {project.deadline}
                  </td>

                  <td className="py-3 px-4 border-r whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-right font-medium">
                        {project.completedTasksCount}
                      </span>
                      <div className="flex-1 min-w-[70px] bg-muted rounded-full h-3 overflow-hidden flex items-center p-0.5">
                        <div
                          className="bg-success h-full rounded-full transition-all duration-300 flex items-center justify-center text-[9px] text-success-foreground font-bold px-1"
                          style={{
                            width: `${Math.max(
                              project.taskProgressPercent,
                              project.completedTasksCount > 0 ? 15 : 0
                            )}%`,
                          }}
                        >
                          {project.taskProgressPercent > 0 &&
                            `${project.taskProgressPercent}%`}
                        </div>
                      </div>
                      <span className="w-7 text-muted-foreground text-[11px]">
                        {project.totalTasksCount}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 border-r whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="w-4 font-medium">
                        {project.completedPhasesCount}
                      </span>
                      <div className="flex-1 min-w-[70px] bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-success h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              (project.completedPhasesCount /
                                project.totalPhasesCount) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="w-4 text-muted-foreground text-[11px]">
                        {project.totalPhasesCount}
                      </span>
                    </div>
                  </td>

                  {/* Delete Action (Admin mode only) */}
                  {userRole === "ADMIN" && (
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onDeleteProject && onDeleteProject(project.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                        title="Delete Project"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Sprint Footer Bar (shown for Team Member view matching Image 1) */}
      {userRole === "TEAM_MEMBER" && (
        <div className="flex items-center justify-between border-t px-6 py-2 bg-background text-xs text-muted-foreground font-medium shrink-0">
          <div className="inline-flex items-center rounded-full bg-info/10 px-3 py-0.5 text-info font-semibold text-[11px]">
            • ACTIVE SPRINT: 68% COMPLETE
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>TOTAL COUNT: <strong className="text-foreground">124 TASKS</strong></span>
            <span>ASSIGNED TO ME: <strong className="text-foreground">12</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
