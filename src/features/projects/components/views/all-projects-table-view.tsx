"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
  LayoutGrid,
  List,
} from "lucide-react";
import { Project, WorkspaceRole, TeamMemberOption } from "../../types";
import { TimerWidget } from "../timer-widget";
import { NewTimeLogModal } from "../modals/new-time-log-modal";
import {
  getCurrentUserRoleAction,
  getTeamMembersForAssignmentAction,
  bulkUpdateProjectRoleAssigneesAction,
  bulkShiftProjectDatesAction,
  ProjectAssigneeField,
} from "../../actions/project-actions";
import { generateAIClientStatusReport, ClientStatusReport } from "../../manager/ai-project-assistant";
import { Sparkles, Bot, AlertTriangle } from "lucide-react";
import { DEFAULT_PROJECT_TEMPLATES } from "../../data/sop-templates";
import { AssigneeCell, CalendarCell, LinksCell, NotesCell } from "../project-table-cells";
import { BulkProjectActionsBar } from "../bulk-project-actions-bar";
import { getInitials, getAvatarColor } from "../assignee-picker-popover";
import { useConfirm } from "@/components/shared/confirm-dialog";

const ASSIGNEE_ROLE_TO_PROJECT_KEY: Record<ProjectAssigneeField, keyof Project> = {
  PROJECT_LEAD: "projectLead",
  TECH_ASSIGNEE: "techAssignee",
  CREATIVE_ASSIGNEE: "creativeAssignee",
  MARKETING_SEO: "marketingSeo",
  MARKETING_CONTENT: "marketingContent",
  MARKETING_PM: "marketingPm",
};

interface AllProjectsTableViewProps {
  projects: Project[];
  onOpenAddModal: () => void;
  onDeleteProject?: (id: string) => void;
  userRole?: WorkspaceRole;
  assignedToMeCount?: number;
  onOpenTemplatesModal?: () => void;
}

export function AllProjectsTableView({
  projects,
  onOpenAddModal,
  onDeleteProject,
  userRole: propUserRole,
  assignedToMeCount = 0,
  onOpenTemplatesModal,
}: AllProjectsTableViewProps) {
  const [effectiveUserRole, setEffectiveUserRole] = useState<WorkspaceRole>(
    propUserRole || "TEAM_MEMBER"
  );

  useEffect(() => {
    if (!propUserRole) {
      async function fetchRole() {
        try {
          const role = await getCurrentUserRoleAction();
          setEffectiveUserRole(role);
        } catch (err) {
          console.error("Failed to fetch user role from DB:", err);
        }
      }
      fetchRole();
    }
  }, [propUserRole]);

  const userRole = propUserRole || effectiveUserRole;

  // Local mutable copy of the projects list so assignee/calendar/link/notes edits made through
  // the table cells below can render optimistically without waiting on a full page revalidation.
  const [localProjects, setLocalProjects] = useState<Project[]>(projects);
  const [prevProjectsProp, setPrevProjectsProp] = useState(projects);
  if (projects !== prevProjectsProp) {
    setPrevProjectsProp(projects);
    setLocalProjects(projects);
  }

  const patchProject = (projectId: string, patch: Partial<Project>) => {
    setLocalProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...patch } : p)));
  };

  // Live team member roster for the assignee picker popovers — never hardcoded.
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  useEffect(() => {
    async function fetchMembers() {
      try {
        const members = await getTeamMembersForAssignmentAction();
        setTeamMembers(
          members.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            title: m.title,
            department: m.department,
            initials: m.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase(),
          }))
        );
      } catch (err) {
        console.error("Failed to fetch team members:", err);
      }
    }
    fetchMembers();
  }, []);

  const canEditAssignments = userRole !== "TEAM_MEMBER";
  const { confirm, ConfirmDialog } = useConfirm();

  // Bulk-select state for the "select multiple projects, assign a role / shift dates" toolbar.
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const toggleProjectSelected = (id: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedProjectIds(new Set());

  const handleBulkApplyAssignees = async (role: ProjectAssigneeField, memberIds: string[]) => {
    const ids = Array.from(selectedProjectIds);
    const selectedMembers = teamMembers.filter((m) => memberIds.includes(m.id));
    const projectKey = ASSIGNEE_ROLE_TO_PROJECT_KEY[role];
    const nextAssignees =
      selectedMembers.length > 0
        ? selectedMembers.map((m) => ({
            id: m.id,
            name: m.name,
            initials: getInitials(m.name),
            avatarColor: getAvatarColor(m.name),
          }))
        : undefined;

    setLocalProjects((prev) =>
      prev.map((p) => (ids.includes(p.id) ? { ...p, [projectKey]: nextAssignees } : p))
    );

    const result = await bulkUpdateProjectRoleAssigneesAction(ids, role, memberIds);
    if (!result.success) {
      alert(result.error || "Some projects could not be updated.");
    }
    clearSelection();
  };

  const handleBulkApplyDateShift = async (deltaDays: number) => {
    const ids = Array.from(selectedProjectIds);
    const shiftMs = deltaDays * 86400000;

    setLocalProjects((prev) =>
      prev.map((p) => {
        if (!ids.includes(p.id)) return p;
        const start = p.startDate ? new Date(p.startDate) : null;
        const end = p.deadline ? new Date(p.deadline) : null;
        if (!start || isNaN(start.getTime()) || !end || isNaN(end.getTime())) return p;
        return {
          ...p,
          startDate: new Date(start.getTime() + shiftMs).toISOString().split("T")[0],
          deadline: new Date(end.getTime() + shiftMs).toISOString().split("T")[0],
        };
      })
    );

    const result = await bulkShiftProjectDatesAction(ids, deltaDays);
    if (!result.success) {
      alert(result.error || "Some projects could not be shifted.");
    }
    clearSelection();
  };

  const [activeTab, setActiveTab] = useState<"ACTIVE" | "COMPLETED" | "TEMPLATES">("ACTIVE");
  const [viewLayout, setViewLayout] = useState<"LIST" | "GRID">("LIST");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Popover / Menu States
  const [showTimelinePopover, setShowTimelinePopover] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");

  // AI Client Report Modal State
  const [activeAIReport, setActiveAIReport] = useState<ClientStatusReport | null>(null);
  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);

  // Dynamic filter options derived from current projects list
  const uniqueOwners = Array.from(
    new Set(localProjects.map((p) => p.owner?.name).filter(Boolean))
  ) as string[];

  const uniqueDepartments = Array.from(
    new Set(localProjects.map((p) => p.departmentAlias).filter(Boolean))
  ) as string[];

  const hasActiveFilters =
    categoryFilter !== "ALL" ||
    ownerFilter !== "ALL" ||
    departmentFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    searchQuery.trim() !== "";

  const handleResetFilters = () => {
    setCategoryFilter("ALL");
    setOwnerFilter("ALL");
    setDepartmentFilter("ALL");
    setStatusFilter("ALL");
    setSearchQuery("");
  };

  // Filter projects
  const filteredProjects = localProjects.filter((project) => {
    const matchesTab =
      activeTab === "ACTIVE"
        ? project.status === "ACTIVE"
        : activeTab === "COMPLETED"
        ? project.status === "COMPLETED"
        : true;

    const matchesStatusDropdown =
      statusFilter === "ALL" || project.status === statusFilter;

    const matchesDepartment =
      departmentFilter === "ALL" ||
      (project.departmentAlias || "").toLowerCase() === departmentFilter.toLowerCase();

    const matchesCategory =
      categoryFilter === "ALL" || project.projectCategory === categoryFilter;

    const matchesOwner =
      ownerFilter === "ALL" || (project.owner?.name || "") === ownerFilter;

    const matchesSearch =
      searchQuery.trim() === "" ||
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.owner?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.departmentAlias || "").toLowerCase().includes(searchQuery.toLowerCase());

    return (
      matchesTab &&
      matchesStatusDropdown &&
      matchesDepartment &&
      matchesCategory &&
      matchesOwner &&
      matchesSearch
    );
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
    <div className="flex flex-col h-full min-w-0 bg-background text-foreground overflow-hidden relative">
      {/* Top Main Bar: Title & Action Button */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {userRole === "TEAM_MEMBER" ? "My Assigned Projects" : "All Projects"}
          </h1>
          {userRole === "TEAM_MEMBER" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              Assigned to you
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 relative">
          {/* <TimerWidget
            onStopTimer={() => setIsTimeLogModalOpen(true)}
          />
          <button
            type="button"
            onClick={() => setIsTimeLogModalOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-[#0088ff] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0077ee] transition-colors"
          >
            <Plus size={14} />
            <span>Time Log</span>
          </button> */}
          {userRole === "TEAM_MEMBER" ? (
            /* Team Member Mode Header Actions (matching Image 1) — project creation is
               manager-only, so no "Add New Project" trigger is rendered here. */
            <>
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
              {/* <button
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
              </button> */}

              <button
                type="button"
                onClick={activeTab === "TEMPLATES" ? onOpenTemplatesModal : onOpenAddModal}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
              >
                <Plus size={16} /> {activeTab === "TEMPLATES" ? "Add New Template" : "Add New Project"}
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
            className={`pb-3 transition-colors relative ${activeTab === "ACTIVE"
              ? "text-info border-b-2 border-info"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Active Projects
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("COMPLETED")}
            className={`pb-3 transition-colors relative ${activeTab === "COMPLETED"
              ? "text-info border-b-2 border-info"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Completed Projects
          </button>
          {/* <button
            type="button"
            onClick={() => setActiveTab("TEMPLATES")}
            className={`pb-3 transition-colors relative ${activeTab === "TEMPLATES"
              ? "text-info border-b-2 border-info"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Project Templates
          </button> */}
        </div>
      </div>

      {activeTab === "TEMPLATES" ? (
        /* Project Templates Tab */
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground font-medium">
                <th className="py-3 px-4 border-r whitespace-nowrap">Project ID</th>
                <th className="py-3 px-4 border-r whitespace-nowrap">Project Name</th>
                <th className="py-3 px-4 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {DEFAULT_PROJECT_TEMPLATES.map((template, idx) => (
                <tr key={template.id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-3 px-4 border-r font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    EEDP-{81 + idx}
                  </td>
                  <td className="py-3 px-4 border-r whitespace-nowrap">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Layers size={14} className="text-primary" />
                      {template.name}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-block rounded bg-success/10 px-2.5 py-0.5 text-[10px] font-bold text-success">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
      <>
      {/* Table Action Filter Bar */}
      <div className="flex flex-wrap items-center justify-between border-b px-6 py-2.5 bg-muted/20 gap-3 relative">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded border border-input bg-background px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-primary w-44"
          />

          {/* Category Filter */}
          {/* <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1 text-xs font-medium text-foreground cursor-pointer outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Categories</option>
            <option value="INTERNAL_BUILD">Internal Build</option>
            <option value="SOP_7_PHASE">7-Phase SOP</option>
          </select> */}

          {/* Owner Filter */}
          {/* <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1 text-xs font-medium text-foreground cursor-pointer outline-none focus:ring-1 focus:ring-primary max-w-[140px] truncate"
          >
            <option value="ALL">All Owners</option>
            {uniqueOwners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select> */}

          {/* Department Filter */}
          {/* <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1 text-xs font-medium text-foreground cursor-pointer outline-none focus:ring-1 focus:ring-primary max-w-[140px] truncate"
          >
            <option value="ALL">All Departments</option>
            {uniqueDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
            {!uniqueDepartments.includes("digitalproducts@") && (
              <option value="digitalproducts@">digitalproducts@</option>
            )}
            {!uniqueDepartments.includes("design@") && (
              <option value="design@">design@</option>
            )}
            {!uniqueDepartments.includes("dev@") && <option value="dev@">dev@</option>}
            {!uniqueDepartments.includes("seo@") && <option value="seo@">seo@</option>}
          </select> */}

          {/* Reset button if any filter is active */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              title="Reset all filters"
            >
              <RotateCw size={11} /> Reset Filters
            </button>
          )}
        </div>

        {false && (
        <div className="flex items-center gap-2 text-muted-foreground">
          {/* List / Grid Toggle */}
          <div className="inline-flex rounded-md border p-0.5 bg-background">
            <button
              type="button"
              onClick={() => setViewLayout("LIST")}
              className={`p-1 rounded transition-colors ${viewLayout === "LIST"
                ? "bg-primary/10 text-primary font-bold"
                : "hover:bg-accent text-muted-foreground"
                }`}
              title="Table List View"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewLayout("GRID")}
              className={`p-1 rounded transition-colors ${viewLayout === "GRID"
                ? "bg-primary/10 text-primary font-bold"
                : "hover:bg-accent text-muted-foreground"
                }`}
              title="Card Grid View"
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          {/* Filter Panel Toggle */}
          {/* <button
            type="button"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`p-1.5 rounded transition-colors relative ${showFilterPanel || hasActiveFilters
              ? "bg-primary/15 text-primary font-bold border border-primary/30"
              : "hover:bg-accent hover:text-foreground"
              }`}
            title="Filter Panel"
          >
            <Filter size={15} />
            {hasActiveFilters && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
            )}
          </button> */}

          {/* Options Menu Toggle */}
          <button
            type="button"
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            className="p-1.5 hover:bg-accent rounded hover:text-foreground transition-colors"
            title="More Options"
          >
            <MoreHorizontal size={15} />
          </button>

          {/* Filter Panel Popover */}
          {/* {showFilterPanel && (
            <div className="absolute right-12 top-11 z-40 w-72 rounded-lg border bg-popover p-4 shadow-xl text-xs space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Filter size={14} className="text-primary" /> Filter Projects
                </span>
                <button
                  type="button"
                  onClick={() => setShowFilterPanel(false)}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-accent"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="ALL">All Categories</option>
                  <option value="INTERNAL_BUILD">Internal Build</option>
                  <option value="SOP_7_PHASE">7-Phase SOP</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Owner
                </label>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="ALL">All Owners</option>
                  {uniqueOwners.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Department
                </label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="ALL">All Departments</option>
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                  {!uniqueDepartments.includes("digitalproducts@") && (
                    <option value="digitalproducts@">digitalproducts@</option>
                  )}
                  {!uniqueDepartments.includes("design@") && (
                    <option value="design@">design@</option>
                  )}
                  {!uniqueDepartments.includes("dev@") && <option value="dev@">dev@</option>}
                  {!uniqueDepartments.includes("seo@") && <option value="seo@">seo@</option>}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Status
                </label>
                <select
                  value={statusFilter}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Projects</option>
                  <option value="COMPLETED">Completed Projects</option>
                </select>
              </div>

              {hasActiveFilters && (
                <div className="pt-2 border-t flex justify-end">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <RotateCw size={12} /> Reset all filters
                  </button>
                </div>
              )}
            </div>
          )} */}

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
                  handleResetFilters();
                  setShowOptionsMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left text-foreground font-medium"
              >
                <RotateCw size={13} /> Refresh List
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {canEditAssignments && selectedProjectIds.size > 0 && (
        <BulkProjectActionsBar
          selectedCount={selectedProjectIds.size}
          members={teamMembers}
          onApplyAssignees={handleBulkApplyAssignees}
          onApplyDateShift={handleBulkApplyDateShift}
          onClear={clearSelection}
        />
      )}

      {viewLayout === "GRID" ? (
        /* Card Grid Layout */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="rounded-lg border bg-card p-4 space-y-3 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-muted-foreground">
                      {project.id}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${project.projectCategory === "INTERNAL_BUILD"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                        }`}
                    >
                      {project.projectCategory === "INTERNAL_BUILD"
                        ? "Internal Build"
                        : "7-Phase SOP"}
                    </span>
                  </div>

                  <Link
                    href={`/projects/${project.id}`}
                    className="text-base font-bold text-foreground hover:text-primary hover:underline line-clamp-1"
                  >
                    {project.name}
                  </Link>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px]">
                      {project.departmentAlias || "digitalproducts@"}
                    </span>
                    {project.templateUsed && (
                      <span className="truncate text-[10px] opacity-75">
                        • {project.templateUsed}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Task Counts */}
                <div className="space-y-1.5 pt-2 border-t">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-foreground">{project.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${project.progressPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Tasks: <strong className="text-foreground">{project.completedTasksCount}/{project.totalTasksCount}</strong>
                    </span>
                    <span>
                      Phases: <strong className="text-foreground">{project.completedPhasesCount}/{project.totalPhasesCount || 7}</strong>
                    </span>
                  </div>
                </div>

                {/* Footer Owner & AI Report */}
                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${project.owner.avatarColor || "bg-amber-500 text-white"
                        }`}
                    >
                      {project.owner.initials}
                    </span>
                    <span className="font-medium text-foreground truncate max-w-[100px]">
                      {project.owner.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const report = generateAIClientStatusReport(project, []);
                      setActiveAIReport(report);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Sparkles size={11} className="text-amber-500 animate-pulse" /> AI Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Main Responsive Table */
        <div className="flex-1 min-w-0 overflow-x-auto overflow-y-auto dsm-columns-scrollbar">
          <table className="w-full min-w-[1950px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground font-medium text-center">
                {canEditAssignments && (
                  <th rowSpan={2} className="py-3 px-3 border-r text-center align-middle w-8">
                    <input
                      type="checkbox"
                      checked={filteredProjects.length > 0 && filteredProjects.every((p) => selectedProjectIds.has(p.id))}
                      onChange={(e) => {
                        setSelectedProjectIds(
                          e.target.checked ? new Set(filteredProjects.map((p) => p.id)) : new Set()
                        );
                      }}
                      className="cursor-pointer"
                    />
                  </th>
                )}
                <th rowSpan={2} className="py-3 px-4 border-r whitespace-nowrap text-center align-middle">Project ID</th>
                <th rowSpan={2} className="py-3 px-4 border-r whitespace-nowrap min-w-[200px] text-left align-middle">Project Name</th>
                <th rowSpan={2} className="py-3 px-4 border-r whitespace-nowrap min-w-[130px] text-left align-middle">Project Lead</th>
                <th rowSpan={2} className="py-3 px-4 border-r whitespace-nowrap min-w-[130px] text-left align-middle">Tech Assignee</th>
                <th rowSpan={2} className="py-3 px-4 border-r whitespace-nowrap min-w-[140px] text-left align-middle">Creative Assignee</th>
                <th colSpan={3} className="py-2 px-4 border-r whitespace-nowrap text-center border-b">Marketing</th>
                <th rowSpan={2} className="py-3 px-4 border-r whitespace-nowrap min-w-[210px] text-left align-middle">Project Calendar</th>
                <th rowSpan={2} className="py-3 px-4 border-r whitespace-nowrap min-w-[190px] text-left align-middle">Asset Link</th>
                <th rowSpan={2} className="py-3 px-4 border-r whitespace-nowrap min-w-[160px] text-left align-middle">Tech Notes</th>
                <th rowSpan={2} className="py-3 px-4 border-r whitespace-nowrap min-w-[160px] text-left align-middle">Creative Notes</th>
                <th rowSpan={2} className="py-3 px-4 border-r whitespace-nowrap min-w-[160px] text-left align-middle">Marketing Notes</th>
                <th rowSpan={2} className="py-3 px-3 text-center align-middle">Actions</th>
              </tr>
              <tr className="border-b bg-muted/40 text-muted-foreground font-medium text-center">
                <th className="py-2 px-3 border-r whitespace-nowrap min-w-[120px] text-left">SEO</th>
                <th className="py-2 px-3 border-r whitespace-nowrap min-w-[120px] text-left">Content</th>
                <th className="py-2 px-3 border-r whitespace-nowrap min-w-[120px] text-left">PM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={canEditAssignments ? 14 : 13} className="py-12 text-center text-muted-foreground">
                    No projects found matching current department or status filter.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    className={`hover:bg-accent/30 transition-colors group ${
                      selectedProjectIds.has(project.id) ? "bg-primary/5" : ""
                    }`}
                  >
                    {canEditAssignments && (
                      <td className="py-3 px-3 border-r text-center">
                        <input
                          type="checkbox"
                          checked={selectedProjectIds.has(project.id)}
                          onChange={() => toggleProjectSelected(project.id)}
                          className="cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="py-3 px-4 border-r font-medium text-foreground whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/projects/${project.id}`}
                          className="hover:text-primary hover:underline transition-colors"
                        >
                          {project.id}
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(project.id)}
                          className="p-1 text-muted-foreground hover:text-primary transition-colors rounded opacity-0 group-hover:opacity-100"
                          title="Copy Project Link"
                        >
                          {copiedId === project.id ? (
                            <Check size={12} className="text-success" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4 border-r whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-semibold text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-1.5"
                        >
                          {project.name}
                        </Link>
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${project.projectCategory === "INTERNAL_BUILD"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                            }`}
                        >
                          {project.projectCategory === "INTERNAL_BUILD"
                            ? "Internal Build"
                            : "7-Phase SOP"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 border-r whitespace-nowrap">
                      <AssigneeCell
                        project={project}
                        field="PROJECT_LEAD"
                        assignees={project.projectLead}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    </td>

                    <td className="py-3 px-4 border-r whitespace-nowrap">
                      <AssigneeCell
                        project={project}
                        field="TECH_ASSIGNEE"
                        assignees={project.techAssignee}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    </td>

                    <td className="py-3 px-4 border-r whitespace-nowrap">
                      <AssigneeCell
                        project={project}
                        field="CREATIVE_ASSIGNEE"
                        assignees={project.creativeAssignee}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    </td>

                    <td className="py-3 px-3 border-r whitespace-nowrap">
                      <AssigneeCell
                        project={project}
                        field="MARKETING_SEO"
                        assignees={project.marketingSeo}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    </td>

                    <td className="py-3 px-3 border-r whitespace-nowrap">
                      <AssigneeCell
                        project={project}
                        field="MARKETING_CONTENT"
                        assignees={project.marketingContent}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    </td>

                    <td className="py-3 px-3 border-r whitespace-nowrap">
                      <AssigneeCell
                        project={project}
                        field="MARKETING_PM"
                        assignees={project.marketingPm}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    </td>

                    <td className="py-3 px-4 border-r whitespace-nowrap">
                      <CalendarCell
                        project={project}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    </td>

                    <td className="py-3 px-4 border-r whitespace-nowrap">
                      <LinksCell
                        project={project}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    </td>

                    <td className="py-3 px-4 border-r">
                      <NotesCell
                        project={project}
                        field="techNotes"
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    </td>

                    <td className="py-3 px-4 border-r">
                      <NotesCell
                        project={project}
                        field="creativeNotes"
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    </td>

                    <td className="py-3 px-4 border-r">
                      <NotesCell
                        project={project}
                        field="marketingNotes"
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {canEditAssignments ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Delete project?",
                              description: `Delete project "${project.name}" (${project.id})? This cannot be undone.`,
                            });
                            if (!ok) return;
                            onDeleteProject && onDeleteProject(project.id);
                          }}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                          title="Delete Project"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}

      {/* AI Client Report Modal */}
      {activeAIReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-lg border bg-background shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3.5 bg-primary/5">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Bot size={18} className="text-primary" />
                <span>AI Client Status Report Generator</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveAIReport(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="rounded-md border bg-muted/30 p-3 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                {activeAIReport.markdownReport}
              </div>
            </div>

            <div className="flex items-center justify-between border-t px-5 py-3 bg-muted/20">
              <span className="text-[11px] text-muted-foreground">
                Ready to copy and email/slack to client.
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeAIReport.markdownReport);
                  setActiveAIReport(null);
                }}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Copy size={13} /> Copy Markdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Stats Footer Bar */}
      {userRole === "TEAM_MEMBER" && (() => {
        const activeProjects = localProjects.filter((p) => p.status === "ACTIVE");
        const avgCompletion =
          activeProjects.length > 0
            ? Math.round(
                activeProjects.reduce((sum, p) => sum + p.taskProgressPercent, 0) /
                  activeProjects.length
              )
            : 0;
        const totalTaskCount = localProjects.reduce((sum, p) => sum + p.totalTasksCount, 0);

        return (
          <div className="flex items-center justify-between border-t px-6 py-2 bg-background text-xs text-muted-foreground font-medium shrink-0">
            <div className="inline-flex items-center rounded-full bg-info/10 px-3 py-0.5 text-info font-semibold text-[11px]">
              • PROJECTS: {avgCompletion}% COMPLETE
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>TOTAL COUNT: <strong className="text-foreground">{totalTaskCount} TASKS</strong></span>
              <span>ASSIGNED TO ME: <strong className="text-foreground">{assignedToMeCount}</strong></span>
            </div>
          </div>
        );
      })()}

      {/* New Time Log Modal */}
      <NewTimeLogModal
        isOpen={isTimeLogModalOpen}
        onClose={() => setIsTimeLogModalOpen(false)}
        initialProject="EED Core"
      />

      {ConfirmDialog}
    </div>
  );
}
