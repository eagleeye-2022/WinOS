"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  MoreVertical,
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
import { AssigneeCell, CalendarCell, LinksCell, NotesCell, TimelineCell } from "../project-table-cells";
import { ProjectTimelineDrawer } from "../modals/project-timeline-drawer";
import { BulkProjectActionsBar } from "../bulk-project-actions-bar";
import { getInitials, getAvatarColor } from "../assignee-picker-popover";
import { useConfirm } from "@/components/shared/confirm-dialog";

const ASSIGNEE_ROLE_TO_PROJECT_KEY: Record<ProjectAssigneeField, keyof Project> = {
  PROJECT_LEAD: "projectLead",
  TECH_LEAD: "techLead",
  TECH_ASSIGNEE: "techAssignee",
  CREATIVE_ASSIGNEE: "creativeAssignee",
  CREATIVE_UIUX_LEAD: "creativeUiuxLead",
  CREATIVE_UIUX_ASSIGNEE: "creativeUiuxAssignee",
  CREATIVE_GRAPHIC_LEAD: "creativeGraphicLead",
  CREATIVE_GRAPHIC_ASSIGNEE: "creativeGraphicAssignee",
  MARKETING_LEAD: "marketingLead",
  MARKETING_SEO: "marketingSeo",
  MARKETING_CONTENT: "marketingContent",
  MARKETING_PM: "marketingPm",
};

/** Leaf-column ids for the collapsible Tech/Creative/Marketing table columns, grouped by the
 *  header group they belong to. Collapsing a group collapses all of its leaf ids at once;
 *  each leaf can also be collapsed/expanded on its own. */
type CollapsibleColId =
  | "projectId"
  | "projectName"
  | "projectLead"
  | "projectNotes"
  | "techLead"
  | "techAssignee"
  | "creativeUiuxLead"
  | "creativeUiuxAssignee"
  | "creativeGraphicLead"
  | "creativeGraphicAssignee"
  | "marketingLead"
  | "marketingSeo"
  | "marketingContent"
  | "projectCalendar"
  | "assetLink"
  | "projectTimeline";

const TECH_COLS: CollapsibleColId[] = ["techLead", "techAssignee"];
const CREATIVE_UIUX_COLS: CollapsibleColId[] = ["creativeUiuxLead", "creativeUiuxAssignee"];
const CREATIVE_GRAPHIC_COLS: CollapsibleColId[] = ["creativeGraphicLead", "creativeGraphicAssignee"];
const CREATIVE_COLS: CollapsibleColId[] = [...CREATIVE_UIUX_COLS, ...CREATIVE_GRAPHIC_COLS];
const MARKETING_COLS: CollapsibleColId[] = ["marketingLead", "marketingSeo", "marketingContent"];

/** Every leaf column in body-row order — drives the <colgroup> so column widths are fixed
 *  (not content-driven) and stay in sync with which columns are collapsed. */
const LEAF_COL_ORDER: CollapsibleColId[] = [
  "projectId",
  "projectName",
  "projectLead",
  "projectNotes",
  "techLead",
  "techAssignee",
  "creativeUiuxLead",
  "creativeUiuxAssignee",
  "creativeGraphicLead",
  "creativeGraphicAssignee",
  "marketingLead",
  "marketingSeo",
  "marketingContent",
  "projectCalendar",
  "assetLink",
  "projectTimeline",
];

const EXPANDED_COL_WIDTH: Record<CollapsibleColId, number> = {
  projectId: 110,
  projectName: 200,
  projectLead: 160,
  projectNotes: 220,
  techLead: 120,
  techAssignee: 120,
  creativeUiuxLead: 110,
  creativeUiuxAssignee: 110,
  creativeGraphicLead: 110,
  creativeGraphicAssignee: 110,
  marketingLead: 120,
  marketingSeo: 130,
  marketingContent: 140,
  projectCalendar: 210,
  assetLink: 190,
  projectTimeline: 130,
};

const COLLAPSED_COL_WIDTH = 28;
const CHECKBOX_COL_WIDTH = 40;
const ACTIONS_COL_WIDTH = 90;

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

  const [activeTab, setActiveTab] = useState<"ACTIVE" | "INACTIVE" | "COMPLETED" | "TEMPLATES">("ACTIVE");
  const [viewLayout, setViewLayout] = useState<"LIST" | "GRID">("LIST");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Project ID column sort — cycles ascending -> descending -> unsorted on each header click.
  const [projectIdSort, setProjectIdSort] = useState<"asc" | "desc" | null>(null);
  const toggleProjectIdSort = () => {
    setProjectIdSort((prev) => (prev === null ? "asc" : prev === "asc" ? "desc" : null));
  };

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
  const [timeLogProjectName, setTimeLogProjectName] = useState("EED Core");

  // Per-row Actions kebab menu
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [timelineDrawerProject, setTimelineDrawerProject] = useState<Project | null>(null);

  // Collapsible Tech/Creative/Marketing columns — a leaf column collapses to a thin chevron
  // strip; collapsing a group's header collapses/expands every leaf column under it at once.
  const [collapsedCols, setCollapsedCols] = useState<Set<CollapsibleColId>>(new Set());
  const isColCollapsed = (id: CollapsibleColId) => collapsedCols.has(id);
  const toggleCol = (id: CollapsibleColId) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const isGroupCollapsed = (ids: CollapsibleColId[]) => ids.every((id) => collapsedCols.has(id));
  const toggleGroup = (ids: CollapsibleColId[]) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      const allCollapsed = ids.every((id) => next.has(id));
      ids.forEach((id) => (allCollapsed ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const allColsCollapsed = LEAF_COL_ORDER.every((id) => collapsedCols.has(id));
  const toggleCollapseAllCols = () => {
    if (allColsCollapsed) {
      setCollapsedCols(new Set());
    } else {
      setCollapsedCols(new Set(LEAF_COL_ORDER));
    }
  };

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
    const statusUpper = (project.status || "").toUpperCase();
    const matchesTab =
      activeTab === "ACTIVE"
        ? statusUpper === "ACTIVE"
        : activeTab === "INACTIVE"
        ? statusUpper === "INACTIVE" || statusUpper === "ARCHIVED" || statusUpper === "PAUSED"
        : activeTab === "COMPLETED"
        ? statusUpper === "COMPLETED"
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

  const sortedProjects = projectIdSort
    ? [...filteredProjects].sort((a, b) => {
        const cmp = a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" });
        return projectIdSort === "asc" ? cmp : -cmp;
      })
    : filteredProjects;

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

  /** Vertical (bottom-to-top) label used inside a collapsed column's header strip — same
   *  writing-mode trick as the collapsed Kanban phase columns on the task board. */
  const renderVerticalLabel = (label: string) => (
    <span
      className="font-extrabold text-[9px] text-muted-foreground uppercase tracking-wider whitespace-nowrap"
      style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
    >
      {label}
    </span>
  );

  /** Group header cell (Tech / Creative / UI/UX / Graphic / Marketing) — click toggles every
   *  leaf column under it at once. */
  const renderGroupHeader = (label: string, ids: CollapsibleColId[], colSpan: number) => {
    const collapsed = isGroupCollapsed(ids);
    return (
      <th colSpan={colSpan} className="py-2 px-2 border-r whitespace-nowrap overflow-hidden text-center border-b">
        <button
          type="button"
          onClick={() => toggleGroup(ids)}
          className="inline-flex items-center justify-center gap-1 hover:text-foreground transition-colors max-w-full"
          title={collapsed ? `Expand ${label}` : `Collapse ${label}`}
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
          {label}
        </button>
      </th>
    );
  };

  /** Leaf column header (Lead / Assignee / SEO Assignee / Project ID / etc.) — click collapses
   *  just this column to a thin chevron strip, independent of its parent group (if any). */
  const renderLeafHeader = (id: CollapsibleColId, label: string, rowSpan?: number) => {
    const collapsed = isColCollapsed(id);
    if (collapsed) {
      return (
        <th
          key={id}
          rowSpan={rowSpan}
          onClick={() => toggleCol(id)}
          className="py-2 px-1 border-r text-center align-middle w-6 cursor-pointer hover:bg-accent overflow-hidden"
          title={`Expand ${label}`}
        >
          <div className="flex flex-col items-center justify-center gap-1.5">
            <ChevronRight size={10} className="text-muted-foreground shrink-0" />
            {renderVerticalLabel(label)}
          </div>
        </th>
      );
    }
    return (
      <th
        key={id}
        rowSpan={rowSpan}
        className="py-2 px-3 border-r whitespace-nowrap overflow-hidden text-center align-middle"
      >
        <button
          type="button"
          onClick={() => toggleCol(id)}
          className="inline-flex w-full max-w-full items-center justify-center gap-1 hover:text-foreground transition-colors text-center"
          title={`Collapse ${label}`}
        >
          <span className="truncate">{label}</span>
          <ChevronLeft size={10} className="text-muted-foreground shrink-0" />
        </button>
      </th>
    );
  };

  /** "Project ID" header — collapsible like every other column, plus a sort toggle
   *  (ascending -> descending -> unsorted) that reorders the whole table by id. */
  const renderProjectIdHeader = () => {
    const collapsed = isColCollapsed("projectId");
    if (collapsed) {
      return (
        <th
          rowSpan={3}
          onClick={() => toggleCol("projectId")}
          className="py-2 px-1 border-r text-center align-middle w-6 cursor-pointer hover:bg-accent overflow-hidden"
          title="Expand Project ID"
        >
          <div className="flex flex-col items-center justify-center gap-1.5">
            <ChevronRight size={10} className="text-muted-foreground shrink-0" />
            {renderVerticalLabel("Project ID")}
          </div>
        </th>
      );
    }
    return (
      <th
        rowSpan={3}
        className="py-2 px-3 border-r whitespace-nowrap overflow-hidden text-center align-middle"
      >
        <div className="inline-flex w-full max-w-full items-center justify-center gap-1">
          <button
            type="button"
            onClick={toggleProjectIdSort}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            title={
              projectIdSort === "asc"
                ? "Sorted ascending — click for descending"
                : projectIdSort === "desc"
                ? "Sorted descending — click to clear"
                : "Sort by Project ID"
            }
          >
            <span>Project ID</span>
            {projectIdSort === "asc" ? (
              <ArrowUp size={11} className="text-primary" />
            ) : projectIdSort === "desc" ? (
              <ArrowDown size={11} className="text-primary" />
            ) : (
              <ArrowUpDown size={11} className="text-muted-foreground" />
            )}
          </button>
          <button
            type="button"
            onClick={() => toggleCol("projectId")}
            className="hover:text-foreground transition-colors"
            title="Collapse Project ID"
          >
            <ChevronLeft size={10} className="text-muted-foreground shrink-0" />
          </button>
        </div>
      </th>
    );
  };

  /** Body cell for a collapsible leaf column — collapsed columns render as a thin placeholder
   *  instead of the actual cell content, matching the header's chevron strip width. */
  const renderLeafCell = (id: CollapsibleColId, content: React.ReactNode) => {
    if (isColCollapsed(id)) {
      return (
        <td className="py-3 px-1 border-r text-center w-6 text-muted-foreground/30 select-none">
          ···
        </td>
      );
    }
    return (
      <td className="py-3 px-3 border-r overflow-hidden text-left">
        <div className="flex justify-start w-full min-w-0">{content}</div>
      </td>
    );
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

      {/* Integrated Single Toolbar Row: Active Projects | Inactive | Completed Projects | Search Box | Collapse All Columns */}
      <div className="flex flex-wrap items-center justify-between border-b px-6 py-2.5 bg-background gap-3 relative">
        {/* Left Side: Tabs */}
        <div className="flex items-center gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("ACTIVE")}
            className={`pb-1 transition-colors relative border-b-2 ${
              activeTab === "ACTIVE"
                ? "text-primary border-primary font-bold"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            Active Projects
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("INACTIVE")}
            className={`pb-1 transition-colors relative border-b-2 ${
              activeTab === "INACTIVE"
                ? "text-primary border-primary font-bold"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            Inactive
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("COMPLETED")}
            className={`pb-1 transition-colors relative border-b-2 ${
              activeTab === "COMPLETED"
                ? "text-primary border-primary font-bold"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            Completed Projects
          </button>
        </div>

        {/* Right Side: Search Box & Collapse All Columns Button */}
        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary w-52 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Collapse All Columns Button */}
          <button
            type="button"
            onClick={toggleCollapseAllCols}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors shrink-0 shadow-2xs"
            title={allColsCollapsed ? "Expand all columns" : "Collapse all columns"}
          >
            {allColsCollapsed ? (
              <>
                <ChevronsRight size={14} className="text-primary shrink-0" />
                <span>Expand All Columns</span>
              </>
            ) : (
              <>
                <ChevronsLeft size={14} className="text-muted-foreground shrink-0" />
                <span>Collapse All Columns</span>
              </>
            )}
          </button>

          {/* Reset Filters button if search/filters active */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 rounded bg-muted hover:bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              title="Reset search & filters"
            >
              <RotateCw size={11} /> Reset
            </button>
          )}

          {/* Options Dropdown Toggle */}
          <button
            type="button"
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            className="p-1.5 border border-input hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title="More Options"
          >
            <MoreHorizontal size={15} />
          </button>

          {/* Options Dropdown Menu */}
          {showOptionsMenu && (
            <div className="absolute right-6 top-11 z-40 w-44 rounded-md border bg-popover py-1 shadow-lg text-xs space-y-0.5 animate-in fade-in duration-150">
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
            {sortedProjects.map((project) => (
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
          <table
            className="table-fixed text-left text-xs border-collapse"
            style={{
              width:
                (canEditAssignments ? CHECKBOX_COL_WIDTH : 0) +
                LEAF_COL_ORDER.reduce(
                  (sum, id) => sum + (isColCollapsed(id) ? COLLAPSED_COL_WIDTH : EXPANDED_COL_WIDTH[id]),
                  0
                ) +
                ACTIONS_COL_WIDTH,
            }}
          >
            <colgroup>
              {canEditAssignments && <col style={{ width: CHECKBOX_COL_WIDTH }} />}
              {LEAF_COL_ORDER.map((id) => (
                <col key={id} style={{ width: isColCollapsed(id) ? COLLAPSED_COL_WIDTH : EXPANDED_COL_WIDTH[id] }} />
              ))}
              <col style={{ width: ACTIONS_COL_WIDTH }} />
            </colgroup>
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground font-medium text-center">
                {canEditAssignments && (
                  <th rowSpan={3} className="py-3 px-3 border-r text-center align-middle w-8">
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
                {renderProjectIdHeader()}
                {renderLeafHeader("projectName", "Project Name", 3)}
                {renderLeafHeader("projectLead", "Project Lead / SPOC", 3)}
                {renderLeafHeader("projectNotes", "Project iNotes", 3)}
                {renderGroupHeader("Tech", TECH_COLS, 2)}
                {renderGroupHeader("Creative", CREATIVE_COLS, 4)}
                {renderGroupHeader("Marketing", MARKETING_COLS, 3)}
                {renderLeafHeader("projectCalendar", "Project Calendar", 3)}
                {renderLeafHeader("assetLink", "Asset Link", 3)}
                {renderLeafHeader("projectTimeline", "Timeline", 3)}
                <th rowSpan={3} className="py-3 px-3 text-center align-middle">Actions</th>
              </tr>
              <tr className="border-b bg-muted/40 text-muted-foreground font-medium text-center">
                {renderLeafHeader("techLead", "Lead", 2)}
                {renderLeafHeader("techAssignee", "Assignee", 2)}
                {renderGroupHeader("UI/UX", CREATIVE_UIUX_COLS, 2)}
                {renderGroupHeader("Graphic", CREATIVE_GRAPHIC_COLS, 2)}
                {renderLeafHeader("marketingLead", "Lead", 2)}
                {renderLeafHeader("marketingSeo", "SEO Assignee", 2)}
                {renderLeafHeader("marketingContent", "Content Assignee", 2)}
              </tr>
              <tr className="border-b bg-muted/40 text-muted-foreground font-medium text-center">
                {renderLeafHeader("creativeUiuxLead", "Lead")}
                {renderLeafHeader("creativeUiuxAssignee", "Assignee")}
                {renderLeafHeader("creativeGraphicLead", "Lead")}
                {renderLeafHeader("creativeGraphicAssignee", "Assignee")}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={canEditAssignments ? 18 : 17} className="py-12 text-center text-muted-foreground">
                    No projects found matching current department or status filter.
                  </td>
                </tr>
              ) : (
                sortedProjects.map((project) => (
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
                    {renderLeafCell(
                      "projectId",
                      <div className="flex items-center justify-start gap-1">
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
                    )}

                    {renderLeafCell(
                      "projectName",
                      <div className="flex flex-col gap-1 items-start">
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
                    )}

                    {renderLeafCell(
                      "projectLead",
                      <AssigneeCell
                        project={project}
                        field="PROJECT_LEAD"
                        assignees={project.projectLead}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "projectNotes",
                      <NotesCell
                        project={project}
                        field="description"
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "techLead",
                      <AssigneeCell
                        project={project}
                        field="TECH_LEAD"
                        assignees={project.techLead}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "techAssignee",
                      <AssigneeCell
                        project={project}
                        field="TECH_ASSIGNEE"
                        assignees={project.techAssignee}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "creativeUiuxLead",
                      <AssigneeCell
                        project={project}
                        field="CREATIVE_UIUX_LEAD"
                        assignees={project.creativeUiuxLead}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "creativeUiuxAssignee",
                      <AssigneeCell
                        project={project}
                        field="CREATIVE_UIUX_ASSIGNEE"
                        assignees={project.creativeUiuxAssignee}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "creativeGraphicLead",
                      <AssigneeCell
                        project={project}
                        field="CREATIVE_GRAPHIC_LEAD"
                        assignees={project.creativeGraphicLead}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "creativeGraphicAssignee",
                      <AssigneeCell
                        project={project}
                        field="CREATIVE_GRAPHIC_ASSIGNEE"
                        assignees={project.creativeGraphicAssignee}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "marketingLead",
                      <AssigneeCell
                        project={project}
                        field="MARKETING_LEAD"
                        assignees={project.marketingLead}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "marketingSeo",
                      <AssigneeCell
                        project={project}
                        field="MARKETING_SEO"
                        assignees={project.marketingSeo}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "marketingContent",
                      <AssigneeCell
                        project={project}
                        field="MARKETING_CONTENT"
                        assignees={project.marketingContent}
                        members={teamMembers}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "projectCalendar",
                      <CalendarCell
                        project={project}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "assetLink",
                      <LinksCell
                        project={project}
                        editable={canEditAssignments}
                        onUpdated={(patch) => patchProject(project.id, patch)}
                      />
                    )}

                    {renderLeafCell(
                      "projectTimeline",
                      <TimelineCell
                        project={project}
                        onOpen={() => setTimelineDrawerProject(project)}
                      />
                    )}

                    <td className="py-3 px-3 text-left whitespace-nowrap">
                      <div className="relative inline-flex items-center justify-start gap-1">
                        {/* <button
                          type="button"
                          onClick={() => {
                            setTimeLogProjectName(project.name);
                            setIsTimeLogModalOpen(true);
                          }}
                          className="p-1 text-muted-foreground hover:text-primary transition-colors rounded"
                          title="Log Time"
                        >
                          <Clock size={14} />
                        </button> */}

                        <button
                          type="button"
                          onClick={() => setOpenRowMenuId((v) => (v === project.id ? null : project.id))}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                          title="More Actions"
                        >
                          <MoreVertical size={14} />
                        </button>

                        {openRowMenuId === project.id && (
                          <div className="absolute right-0 top-full mt-1 z-30 w-40 rounded-md border bg-popover py-1 shadow-lg text-xs animate-in fade-in duration-150">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenRowMenuId(null);
                                handleCopyLink(project.id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left text-foreground font-medium"
                            >
                              <Copy size={12} /> Copy Link
                            </button>
                            {canEditAssignments && (
                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenRowMenuId(null);
                                  const ok = await confirm({
                                    title: "Delete project?",
                                    description: `Delete project "${project.name}" (${project.id})? This cannot be undone.`,
                                  });
                                  if (!ok) return;
                                  onDeleteProject && onDeleteProject(project.id);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left text-destructive font-medium"
                              >
                                <Trash2 size={12} /> Delete Project
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
        initialProject={timeLogProjectName}
      />

      {/* Project Timeline Drawer */}
      <ProjectTimelineDrawer
        isOpen={!!timelineDrawerProject}
        onClose={() => setTimelineDrawerProject(null)}
        projectId={timelineDrawerProject?.id ?? null}
        projectCode={timelineDrawerProject?.id}
        projectName={timelineDrawerProject?.name}
      />

      {ConfirmDialog}
    </div>
  );
}
