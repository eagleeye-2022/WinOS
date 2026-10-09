"use client";

import React, { useState, useEffect } from "react";
import { useUrlState } from "@/lib/navigation/use-url-state";

const PROJECT_LIST_TABS = ["ACTIVE", "INACTIVE", "COMPLETED", "TEMPLATES"] as const;
const PROJECT_CATEGORIES = ["DIGITAL", "SMM"] as const;
const PROJECT_LAYOUTS = ["LIST", "GRID"] as const;
const SORT_DIRS = ["", "asc", "desc"] as const;
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
  ArrowRightToLine,
  Pencil,
  History,
  Calendar,
} from "lucide-react";
import { Project, WorkspaceRole, TeamMemberOption, NewProjectFormData } from "../../types";
import { TimerWidget } from "../timer-widget";
import { NewTimeLogModal } from "../modals/new-time-log-modal";
import {
  getCurrentUserRoleAction,
  getTeamMembersForAssignmentAction,
  bulkUpdateProjectRoleAssigneesAction,
  bulkShiftProjectDatesAction,
  updateProjectDetailsAction,
  updateProjectCalendarAction,
  ProjectAssigneeField,
} from "../../actions/project-actions";
import { generateAIClientStatusReport, ClientStatusReport } from "../../manager/ai-project-assistant";
import { Sparkles, Bot, AlertTriangle } from "lucide-react";
import { DEFAULT_PROJECT_TEMPLATES } from "../../data/sop-templates";
import { AssigneeCell, CalendarCell, LinksCell, StatusCell, TimelineCell } from "../project-table-cells";
import { ProjectTimelineDrawer } from "../modals/project-timeline-drawer";
import { ProjectINotesCell } from "../project-inotes-panel";
import { CityCell, CountryCell, CountryFilterDropdown, IndustryCell, StateCell } from "../project-client-cells";
import { getProjectNoteSummariesAction, type ProjectNoteSummary } from "../../actions/project-notes-actions";
import { AddProjectDrawer } from "../modals/add-project-drawer";
import { BulkProjectActionsBar } from "../bulk-project-actions-bar";
import { getInitials, getAvatarColor } from "../assignee-picker-popover";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/components/shared/toast";

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
  | "projectStartDate"
  | "projectStatus"
  | "projectLead"
  | "projectNotes"
  | "industry"
  | "clientCountry"
  | "clientState"
  | "clientCity"
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

const CLIENT_LOCATION_COLS: CollapsibleColId[] = ["clientCountry", "clientState", "clientCity"];
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
  "projectStartDate",
  // "projectStatus",
  "projectLead",
  "projectNotes",
  "industry",
  "clientCountry",
  "clientState",
  "clientCity",
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
  // "projectTimeline",
];

// Per-column widths. The table uses auto (content-based) widths, except the columns listed in
// FIXED_WIDTH_COLS, which are pinned to these values (see the comment above the <table>).
const EXPANDED_COL_WIDTH: Record<CollapsibleColId, number> = {
  projectId: 110,
  projectName: 200,
  projectStartDate: 135,
  projectStatus: 110,
  projectLead: 160,
  projectNotes: 220,
  industry: 150,
  clientCountry: 160,
  clientState: 140,
  clientCity: 130,
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
  assetLink: 205,
  projectTimeline: 75,
};

/** Body-side label for each collapsible column's full-height collapsed strip — mirrors the
 *  label passed to that column's header at each call site below. */
const LEAF_LABELS: Record<CollapsibleColId, string> = {
  projectId: "Project ID",
  projectName: "Project Name",
  projectStartDate: "Project Start Date",
  projectStatus: "Status",
  projectLead: "Project Lead / SPOC",
  projectNotes: "Project iNotes",
  industry: "Industry",
  clientCountry: "Country",
  clientState: "State",
  clientCity: "City",
  techLead: "Lead",
  techAssignee: "Assignee",
  creativeUiuxLead: "Lead",
  creativeUiuxAssignee: "Assignee",
  creativeGraphicLead: "Lead",
  creativeGraphicAssignee: "Assignee",
  marketingLead: "Lead",
  marketingSeo: "SEO Assignee",
  marketingContent: "Content Assignee",
  projectCalendar: "Project Calendar",
  assetLink: "Asset Link",
  projectTimeline: "Timeline",
};

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return "--";
  const trimmed = dateStr.trim();
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const p2 = parseInt(parts[2], 10);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      if (p1 >= 1 && p1 <= 12 && parts[2].length === 4) {
        return `${String(p0).padStart(2, "0")} ${months[p1 - 1]} ${p2}`;
      }
    }
    return trimmed;
  }
  if (trimmed.includes("-")) {
    const parts = trimmed.split("T")[0].split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      const y = parts[0];
      const m = parseInt(parts[1], 10) - 1;
      const d = parts[2];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      if (m >= 0 && m < 12) {
        return `${d} ${months[m]} ${y}`;
      }
    }
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  return trimmed;
}

function toInputDateValue(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return "";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.includes("T")) return trimmed.split("T")[0];
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  return "";
}

function StartDateCell({
  project,
  editable,
  onUpdated,
}: {
  project: Project;
  editable: boolean;
  onUpdated: (patch: Partial<Project>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(toInputDateValue(project.startDate));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVal(toInputDateValue(project.startDate));
  }, [project.startDate]);

  const handleSave = async (newDate: string) => {
    setIsEditing(false);
    if (!newDate || newDate === toInputDateValue(project.startDate)) return;
    setSaving(true);
    const prev = project.startDate;
    onUpdated({ startDate: newDate });
    const result = await updateProjectCalendarAction(project.id, newDate, project.deadline || "");
    setSaving(false);
    if (!result.success) {
      onUpdated({ startDate: prev });
      toast.error(result.error || "Failed to update start date");
    } else {
      toast.success("Project start date updated");
    }
  };

  if (editable && isEditing) {
    return (
      <div className="flex items-center gap-1 w-full min-w-0">
        <input
          type="date"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => handleSave(val)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave(val);
            if (e.key === "Escape") {
              setVal(toInputDateValue(project.startDate));
              setIsEditing(false);
            }
          }}
          className="rounded border border-primary/50 bg-background px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!editable}
      onClick={() => editable && setIsEditing(true)}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors group/date w-full text-left truncate ${editable ? "hover:bg-accent/60 cursor-pointer" : "cursor-default"
        } ${saving ? "opacity-50" : ""}`}
      title={editable ? "Click to edit start date" : undefined}
    >
      <Calendar size={13} className="text-muted-foreground shrink-0 group-hover/date:text-primary transition-colors" />
      <span className={project.startDate ? "font-medium text-foreground truncate" : "text-muted-foreground/70 italic truncate"}>
        {formatDisplayDate(project.startDate)}
      </span>
    </button>
  );
}

/** Columns kept at a fixed width (EXPANDED_COL_WIDTH) while every other column sizes to content. */
const FIXED_WIDTH_COLS = new Set<CollapsibleColId>(["projectName", "projectNotes"]);
/** Horizontal padding of a body cell (px-3 on both sides) — subtracted so the column is exactly the fixed width. */
const CELL_PADDING_X = 24;

/** Columns pinned to the left while the table scrolls horizontally (after the checkbox column). */
const STICKY_LEFT_COL: CollapsibleColId = "projectId";
/** Sticky cells need an opaque background so scrolled cells pass underneath; these layer the
 *  row/header tints (muted/40, accent/30 hover, primary/5 selected) over the page background. */
const STICKY_HEADER_BG = "bg-background bg-linear-to-r from-muted/40 to-muted/40";
const STICKY_BODY_BG =
  "bg-background group-hover:bg-linear-to-r group-hover:from-accent/30 group-hover:to-accent/30";
const STICKY_BODY_SELECTED_BG = "bg-background bg-linear-to-r from-primary/5 to-primary/5";
/** Right-edge divider + soft shadow so the pinned column reads as floating over the scroll. */
const STICKY_EDGE = "shadow-[inset_-1px_0_0_var(--border),6px_0_8px_-6px_rgba(0,0,0,0.35)]";

const COLLAPSED_COL_WIDTH = 34;
const CHECKBOX_COL_WIDTH = 40;
const ACTIONS_COL_WIDTH = 56;

interface AllProjectsTableViewProps {
  projects: Project[];
  onOpenAddModal: () => void;
  onDeleteProject?: (id: string) => void;
  userRole?: WorkspaceRole;
  assignedToMeCount?: number;
  onOpenTemplatesModal?: () => void;
  /** Called with the table's local project list after inline edits, so the parent can cache it. */
  onProjectsChange?: (projects: Project[]) => void;
}

export function AllProjectsTableView({
  projects,
  onOpenAddModal,
  onDeleteProject,
  userRole: propUserRole,
  assignedToMeCount = 0,
  onOpenTemplatesModal,
  onProjectsChange,
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

  useEffect(() => {
    onProjectsChange?.(localProjects);
  }, [localProjects, onProjectsChange]);

  const patchProject = (projectId: string, patch: Partial<Project>) => {
    setLocalProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...patch } : p)));
  };

  // Project iNotes: latest shared card title + count per project (only projects the viewer can read).
  const [noteSummaries, setNoteSummaries] = useState<Record<string, ProjectNoteSummary>>({});
  const [noteSummariesLoaded, setNoteSummariesLoaded] = useState(false);
  const [noteSummariesVersion, setNoteSummariesVersion] = useState(0);
  const projectIdsKey = projects.map((p) => p.id).join(",");
  useEffect(() => {
    const ids = projectIdsKey ? projectIdsKey.split(",") : [];
    if (ids.length === 0) return;
    let cancelled = false;
    getProjectNoteSummariesAction(ids)
      .then((summaries) => {
        if (!cancelled) setNoteSummaries(summaries);
      })
      .catch(() => {
        // Leave the column empty on failure; it never blocks the table.
      })
      .finally(() => {
        if (!cancelled) setNoteSummariesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectIdsKey, noteSummariesVersion]);

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
  /** Left offset of the pinned Project ID column. The checkbox column is not pinned (it scrolls
   *  away), so Project ID pins to the very left edge once it reaches it. */
  const stickyLeftOffset = 0;
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
      toast.error(result.error || "Some projects could not be updated.");
    } else {
      toast.success(`Updated assignees for ${ids.length} project${ids.length > 1 ? "s" : ""}`);
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

  // Tab / layout / search / sort live in the URL so the list is restored when returning to Srijan.
  const [activeTab, setActiveTab] = useUrlState<"ACTIVE" | "INACTIVE" | "COMPLETED" | "TEMPLATES">("tab", "ACTIVE", {
    allowed: PROJECT_LIST_TABS,
    history: "push",
  });
  const [categoryTab, setCategoryTab] = useUrlState<"DIGITAL" | "SMM">("category", "DIGITAL", {
    allowed: PROJECT_CATEGORIES,
  });
  const [viewLayout, setViewLayout] = useUrlState<"LIST" | "GRID">("layout", "LIST", { allowed: PROJECT_LAYOUTS });
  const [searchQuery, setSearchQuery] = useUrlState("q", "");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Column sorting state — cycles ascending -> descending -> unsorted on header click.
  const [sortParam, setSortParam] = useUrlState("sort", "");
  const [sortDirParam, setSortDirParam] = useUrlState<"" | "asc" | "desc">("dir", "", { allowed: SORT_DIRS });
  const sortField = (sortParam || null) as CollapsibleColId | null;
  const sortDirection = sortDirParam || null;
  const setSortField = (field: CollapsibleColId | null) => setSortParam(field ?? "");
  const setSortDirection = (dir: "asc" | "desc" | null) => setSortDirParam(dir ?? "");

  const toggleSort = (id: CollapsibleColId) => {
    if (sortField === id) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortField(id);
      setSortDirection("asc");
    }
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
  /** Client country filter: "ALL", "NONE" (no country set) or a country name. */
  const [countryFilter, setCountryFilter] = useState<string>("ALL");

  // AI Client Report Modal State
  const [activeAIReport, setActiveAIReport] = useState<ClientStatusReport | null>(null);
  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);
  const [timeLogProjectName, setTimeLogProjectName] = useState("EED Core");

  // Per-row Actions kebab menu & Edit Drawer
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [timelineDrawerProject, setTimelineDrawerProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Auto-close open menus (top "More Options" dropdown and row 3-dots action menus) when clicking anywhere else
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (openRowMenuId && !target.closest("[data-row-menu-container]")) {
        setOpenRowMenuId(null);
      }

      if (showOptionsMenu && !target.closest("[data-options-menu-container]")) {
        setShowOptionsMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openRowMenuId, showOptionsMenu]);

  const handleUpdateProjectDetails = async (id: string, data: NewProjectFormData) => {
    const result = await updateProjectDetailsAction(id, data);
    if (!result.success) {
      toast.error(result.error || "Failed to update project details.");
    } else {
      toast.success("Project details updated successfully");
      patchProject(id, {
        name: data.name,
        startDate: data.startDate,
        deadline: data.dueDate,
        description: data.description,
        priority: data.priority,
        billingType: data.billingType,
        group: data.group,
        businessHours: data.businessHours,
        taskLayout: data.taskLayout,
        accessType: data.accessType,
        projectCategory: data.projectCategory,
      });
      setEditingProject(null);
    }
  };

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

  /** Countries actually used by projects (name → ISO code if known), for the Country filter. */
  const countryFilterOptions = Array.from(
    localProjects.reduce((map, p) => {
      const name = (p.clientCountry || "").trim();
      if (name && !map.has(name)) map.set(name, p.clientCountryCode || "");
      return map;
    }, new Map<string, string>())
  )
    .map(([name, code]) => ({ name, code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasActiveFilters =
    categoryFilter !== "ALL" ||
    countryFilter !== "ALL" ||
    ownerFilter !== "ALL" ||
    departmentFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    searchQuery.trim() !== "" ||
    sortField !== null;

  const handleResetFilters = () => {
    setCategoryFilter("ALL");
    setCountryFilter("ALL");
    setOwnerFilter("ALL");
    setDepartmentFilter("ALL");
    setStatusFilter("ALL");
    setSearchQuery("");
    setSortField(null);
    setSortDirection(null);
  };

  // SMM vs Digital categorization
  const isSMM = (project: Project): boolean => {
    const cat = (project.projectCategory || "").toUpperCase();
    const dept = (project.departmentAlias || "").toLowerCase();
    const grp = (project.group || "").toLowerCase();
    const team = (project.associatedTeam || "").toLowerCase();
    const name = (project.name || "").toLowerCase();
    const template = (project.templateUsed || "").toLowerCase();
    const tags = (project.tags || []).map((t) => t.toLowerCase());

    return (
      cat === "SMM" ||
      cat === "SMM_PROJECT" ||
      cat === "SMM_PROJECTS" ||
      cat === "SMM DELIVERY" ||
      dept.includes("smm") ||
      dept.includes("social") ||
      grp.includes("smm") ||
      grp.includes("social") ||
      team.includes("smm") ||
      team.includes("social") ||
      template.includes("smm") ||
      template.includes("social") ||
      tags.some((t) => t.includes("smm") || t.includes("social")) ||
      name.includes("smm") ||
      name.includes("social media")
    );
  };

  const digitalProjects = localProjects.filter((p) => !isSMM(p));
  const smmProjects = localProjects.filter((p) => isSMM(p));
  const digitalProjectsCount = digitalProjects.length;
  const smmProjectsCount = smmProjects.length;

  const currentCategoryProjects = categoryTab === "DIGITAL" ? digitalProjects : smmProjects;
  const activeCount = currentCategoryProjects.filter((p) => (p.status || "").toUpperCase() === "ACTIVE").length;
  const inactiveCount = currentCategoryProjects.filter((p) => (p.status || "").toUpperCase() === "INACTIVE").length;
  const completedCount = currentCategoryProjects.filter((p) => (p.status || "").toUpperCase() === "COMPLETED").length;

  // Filter projects
  const filteredProjects = localProjects.filter((project) => {
    const isProjectSmm = isSMM(project);
    const matchesCategoryTab = categoryTab === "DIGITAL" ? !isProjectSmm : isProjectSmm;
    if (!matchesCategoryTab) return false;

    const statusUpper = (project.status || "").toUpperCase();
    const matchesTab =
      activeTab === "ACTIVE"
        ? statusUpper === "ACTIVE"
        : activeTab === "INACTIVE"
          ? statusUpper === "INACTIVE"
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

    const matchesCountry =
      countryFilter === "ALL" ||
      (countryFilter === "NONE"
        ? !(project.clientCountry || "").trim()
        : (project.clientCountry || "").trim() === countryFilter);

    const matchesSearch =
      searchQuery.trim() === "" ||
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.owner?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.departmentAlias || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      [project.industry, project.clientCountry, project.clientState, project.clientCity]
        .some((v) => (v || "").toLowerCase().includes(searchQuery.toLowerCase()));

    return (
      matchesCountry &&
      matchesTab &&
      matchesStatusDropdown &&
      matchesDepartment &&
      matchesCategory &&
      matchesOwner &&
      matchesSearch
    );
  });

  const parseDateToTimestamp = (dateStr?: string): number => {
    if (!dateStr || typeof dateStr !== "string") return 0;
    const trimmed = dateStr.trim();
    if (!trimmed) return 0;
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) return parsed;
    const parts = trimmed.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const ts = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        if (!isNaN(ts)) return ts;
      } else if (parts[2].length === 4) {
        const ts = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1])).getTime();
        if (!isNaN(ts)) return ts;
      }
    }
    return 0;
  };

  const getProjectSortValue = (project: Project, field: CollapsibleColId): string | number => {
    switch (field) {
      case "projectId":
        return project.id || "";
      case "projectName":
        return (project.name || "").trim().toLowerCase();
      case "projectStartDate":
        return parseDateToTimestamp(project.startDate);
      case "projectStatus":
        return (project.status || "").trim().toLowerCase();
      case "projectLead":
        return (project.projectLead?.map((a) => a.name).filter(Boolean).join(", ") || "").trim().toLowerCase();
      case "industry":
        return (project.industry || "").trim().toLowerCase();
      case "clientCountry":
        return (project.clientCountry || "").trim().toLowerCase();
      case "clientState":
        return (project.clientState || "").trim().toLowerCase();
      case "clientCity":
        return (project.clientCity || "").trim().toLowerCase();
      case "projectNotes": {
        // Sort by what the column shows: the latest shared card title ("" when nothing is shared).
        const s = noteSummaries[project.id];
        return s && s.count > 0 ? (s.latestTitle || "Untitled Note").trim().toLowerCase() : "";
      }
      case "techLead":
        return (project.techLead?.map((a) => a.name).filter(Boolean).join(", ") || "").trim().toLowerCase();
      case "techAssignee":
        return (project.techAssignee?.map((a) => a.name).filter(Boolean).join(", ") || "").trim().toLowerCase();
      case "creativeUiuxLead":
        return (project.creativeUiuxLead?.map((a) => a.name).filter(Boolean).join(", ") || "").trim().toLowerCase();
      case "creativeUiuxAssignee":
        return (project.creativeUiuxAssignee?.map((a) => a.name).filter(Boolean).join(", ") || "").trim().toLowerCase();
      case "creativeGraphicLead":
        return (project.creativeGraphicLead?.map((a) => a.name).filter(Boolean).join(", ") || "").trim().toLowerCase();
      case "creativeGraphicAssignee":
        return (project.creativeGraphicAssignee?.map((a) => a.name).filter(Boolean).join(", ") || "").trim().toLowerCase();
      case "marketingLead":
        return (project.marketingLead?.map((a) => a.name).filter(Boolean).join(", ") || "").trim().toLowerCase();
      case "marketingSeo":
        return (project.marketingSeo?.map((a) => a.name).filter(Boolean).join(", ") || "").trim().toLowerCase();
      case "marketingContent":
        return (project.marketingContent?.map((a) => a.name).filter(Boolean).join(", ") || "").trim().toLowerCase();
      case "projectCalendar": {
        const startTs = parseDateToTimestamp(project.startDate);
        const endTs = parseDateToTimestamp(project.deadline);
        return startTs || endTs || 0;
      }
      case "assetLink": {
        const links = [project.driveLink, project.webLink, project.designLink].filter(Boolean).join(" ");
        return links.trim().toLowerCase();
      }
      case "projectTimeline":
        return project.progressPercent || 0;
      default:
        return "";
    }
  };

  const sortedProjects = React.useMemo(() => {
    if (!sortField || !sortDirection) {
      return filteredProjects;
    }

    return [...filteredProjects].sort((a, b) => {
      const valA = getProjectSortValue(a, sortField);
      const valB = getProjectSortValue(b, sortField);

      const isEmptyA = valA === "" || valA === 0;
      const isEmptyB = valB === "" || valB === 0;
      if (isEmptyA && !isEmptyB) return 1;
      if (!isEmptyA && isEmptyB) return -1;
      if (isEmptyA && isEmptyB) return 0;

      let cmp = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }

      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredProjects, sortField, sortDirection, noteSummaries]);

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

  /** Vertical (bottom-to-top) label used inside a collapsed column's dark strip — same
   *  writing-mode trick as the collapsed Kanban phase columns on the task board. */
  const renderVerticalLabel = (label: string) => (
    <span
      className="font-extrabold text-[10px] text-slate-100 uppercase tracking-wider whitespace-nowrap"
      style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
    >
      {label}
    </span>
  );

  /** Collapsed leaf column's header box — icon-only toggle, rounded on top so it reads as the
   *  cap of the same dark bar that continues down through every body row below it. */
  const renderCollapsedHeaderBox = (id: CollapsibleColId, label: string, rowSpan?: number) => (
    <th key={id} rowSpan={rowSpan} className="p-0 align-top w-8">
      <button
        type="button"
        onClick={() => toggleCol(id)}
        title={`Expand ${label}`}
        className="flex h-full w-full min-h-9 items-center justify-center rounded-t-lg bg-slate-900 dark:bg-neutral-900 hover:bg-slate-800 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
      >
        <ArrowRightToLine size={12} className="text-primary shrink-0" />
      </button>
    </th>
  );

  /** Collapsed leaf column's body — rendered once per table (rowSpan across every visible row)
   *  so the whole column becomes a single continuous full-height dark bar with the column name
   *  running vertically and centered along it, matching the collapsed Kanban phase columns. */
  const renderCollapsedBodyBox = (id: CollapsibleColId, label: string, rowIndex: number, totalRows: number) => {
    if (rowIndex !== 0) return null;
    return (
      <td rowSpan={totalRows} className="p-0 align-top">
        <button
          type="button"
          onClick={() => toggleCol(id)}
          title={`Expand ${label}`}
          className="flex h-full w-full min-h-full flex-col items-center justify-center gap-2 rounded-b-lg bg-slate-900 dark:bg-neutral-900 hover:bg-slate-800 dark:hover:bg-neutral-800 transition-colors cursor-pointer py-3"
        >
          {renderVerticalLabel(label)}
        </button>
      </td>
    );
  };

  /** Group header cell (Tech / Creative / UI/UX / Graphic / Marketing) */
  const renderGroupHeader = (label: string, ids: CollapsibleColId[], colSpan: number) => {
    return (
      <th colSpan={colSpan} className="py-2 px-2 border-r whitespace-nowrap overflow-hidden text-center border-b font-semibold text-muted-foreground text-xs">
        {label}
      </th>
    );
  };

  /** Leaf column header (Project ID / Project Name / Status / Lead / Assignee / etc.) —
   *  features sort toggle (ascending -> descending -> unsorted). */
  const renderLeafHeader = (id: CollapsibleColId, label: string, rowSpan?: number) => {
    const collapsed = isColCollapsed(id);
    if (collapsed) {
      return renderCollapsedHeaderBox(id, label, rowSpan);
    }
    const isSorted = sortField === id;
    const isSticky = id === STICKY_LEFT_COL;
    return (
      <th
        key={id}
        rowSpan={rowSpan}
        className={`py-2 px-2.5 border-r whitespace-nowrap overflow-hidden text-center align-middle ${isSticky ? `sticky z-20 ${STICKY_HEADER_BG} ${STICKY_EDGE}` : ""
          }`}
        style={isSticky ? { left: stickyLeftOffset } : undefined}
      >
        <div className="inline-flex w-full max-w-full items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => toggleSort(id)}
            className={`inline-flex items-center gap-1 hover:text-foreground transition-colors min-w-0 max-w-full group cursor-pointer ${isSorted ? "text-primary font-bold" : "text-muted-foreground"
              }`}
            title={
              isSorted
                ? sortDirection === "asc"
                  ? `${label}: Sorted ascending — click for descending`
                  : `${label}: Sorted descending — click to clear sort`
                : `Sort by ${label}`
            }
          >
            <span className="truncate">{label}</span>
            {isSorted ? (
              sortDirection === "asc" ? (
                <ArrowUp size={11} className="text-primary shrink-0" />
              ) : (
                <ArrowDown size={11} className="text-primary shrink-0" />
              )
            ) : (
              <ArrowUpDown size={11} className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
            )}
          </button>
        </div>
      </th>
    );
  };

  /** Status cell wrapper — a full-cell colored box (via `StatusCell`), clickable to change
   *  status for managers only. Collapses into the same full-height dark bar as other columns. */
  const renderStatusCell = (project: Project, rowIndex: number, totalRows: number) => {
    if (isColCollapsed("projectStatus")) {
      return renderCollapsedBodyBox("projectStatus", LEAF_LABELS.projectStatus, rowIndex, totalRows);
    }
    return (
      <td className="border-r p-0 overflow-hidden">
        <StatusCell
          project={project}
          editable={canEditAssignments}
          onUpdated={(patch) => patchProject(project.id, patch)}
        />
      </td>
    );
  };

  /** Body cell for a collapsible leaf column — a collapsed column renders once as a single
   *  full-height dark bar spanning every visible row (via rowSpan on the first row only). */
  const renderLeafCell = (
    id: CollapsibleColId,
    content: React.ReactNode,
    rowIndex: number,
    totalRows: number,
    rowSelected = false
  ) => {
    if (isColCollapsed(id)) {
      return renderCollapsedBodyBox(id, LEAF_LABELS[id], rowIndex, totalRows);
    }
    const isSticky = id === STICKY_LEFT_COL;
    return (
      <td
        className={`py-3 px-3 border-r overflow-hidden text-left ${isSticky
          ? `sticky z-10 ${rowSelected ? STICKY_BODY_SELECTED_BG : STICKY_BODY_BG} ${STICKY_EDGE}`
          : ""
          }`}
        style={isSticky ? { left: stickyLeftOffset } : undefined}
      >
        {/* Fixed-width columns are pinned to their width; others are auto, capped so one very long
            value can't stretch the column across the screen. */}
        {FIXED_WIDTH_COLS.has(id) ? (
          <div
            className="flex justify-start min-w-0"
            style={{
              width: EXPANDED_COL_WIDTH[id] - CELL_PADDING_X,
              maxWidth: EXPANDED_COL_WIDTH[id] - CELL_PADDING_X,
            }}
          >
            {content}
          </div>
        ) : (
          <div className="flex justify-start w-full min-w-0 max-w-[360px]">{content}</div>
        )}
      </td>
    );
  };

  return (
    <div className="flex flex-col h-full min-w-0 bg-background text-foreground overflow-hidden relative">
      {/* Top Main Bar: Title, Category Tabs & Action Button */}
      <div className="flex flex-col gap-3.5 border-b px-6 py-4 bg-background">
        <div className="flex items-center justify-between">
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
            <span>Effort Log</span>
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
                    <span>Enable effort log alerts</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Primary Project Category Tabs: Digital Projects | SMM Projects */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setCategoryTab("DIGITAL")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border ${categoryTab === "DIGITAL"
                ? "bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/30"
                : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
              }`}
          >
            <span>Digital Projects</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${categoryTab === "DIGITAL"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
                }`}
            >
              {digitalProjectsCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryTab("SMM")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border ${categoryTab === "SMM"
                ? "bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/30"
                : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
              }`}
          >
            <span>SMM Projects</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${categoryTab === "SMM"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
                }`}
            >
              {smmProjectsCount}
            </span>
          </button>
        </div>
      </div>

      {/* Integrated Single Toolbar Row: Active Projects | Inactive | Completed Projects | Search Box | Collapse All Columns */}
      <div className="flex flex-wrap items-center justify-between border-b px-6 py-2.5 bg-background gap-3 relative">
        {/* Left Side: Tabs */}
        <div className="flex items-center gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("ACTIVE")}
            className={`pb-1 transition-colors relative border-b-2 flex items-center gap-1.5 ${activeTab === "ACTIVE"
                ? "text-primary border-primary font-bold"
                : "text-muted-foreground hover:text-foreground border-transparent"
              }`}
          >
            <span>Active Projects</span>
            <span className="text-[10px] opacity-75 font-mono">({activeCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("INACTIVE")}
            className={`pb-1 transition-colors relative border-b-2 flex items-center gap-1.5 ${activeTab === "INACTIVE"
                ? "text-primary border-primary font-bold"
                : "text-muted-foreground hover:text-foreground border-transparent"
              }`}
          >
            <span>Inactive</span>
            <span className="text-[10px] opacity-75 font-mono">({inactiveCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("COMPLETED")}
            className={`pb-1 transition-colors relative border-b-2 flex items-center gap-1.5 ${activeTab === "COMPLETED"
                ? "text-primary border-primary font-bold"
                : "text-muted-foreground hover:text-foreground border-transparent"
              }`}
          >
            <span>Completed Projects</span>
            <span className="text-[10px] opacity-75 font-mono">({completedCount})</span>
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

          {/* Client Country filter (shows flags) */}
          <CountryFilterDropdown value={countryFilter} options={countryFilterOptions} onChange={setCountryFilter} />

          {/* Collapse All Columns Button */}
          <button
            type="button"
            onClick={toggleCollapseAllCols}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors shrink-0 shadow-2xs cursor-pointer"
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

          {/* Options Dropdown Toggle & Menu */}
          <div data-options-menu-container className="relative">
            <button
              type="button"
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className={`p-1.5 border border-input hover:bg-accent rounded-md transition-colors ${showOptionsMenu ? "bg-accent text-foreground ring-1 ring-primary/40" : "text-muted-foreground hover:text-foreground"
                }`}
              title="More Options"
            >
              <MoreHorizontal size={15} />
            </button>

            {/* Options Dropdown Menu */}
            {showOptionsMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-40 w-44 rounded-md border bg-popover py-1 shadow-lg text-xs space-y-0.5 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => {
                    handleExportCSV();
                    setShowOptionsMenu(false);
                  }}
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

                    <div data-row-menu-container className="relative inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => setOpenRowMenuId((v) => (v === project.id ? null : project.id))}
                        className={`p-1 transition-colors rounded hover:bg-accent ${openRowMenuId === project.id ? "text-primary bg-accent" : "text-muted-foreground hover:text-foreground"
                          }`}
                        title="More Actions"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {openRowMenuId === project.id && (
                        <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-md border bg-popover py-1 shadow-lg text-xs animate-in fade-in duration-150">
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
                          <button
                            type="button"
                            onClick={() => {
                              setOpenRowMenuId(null);
                              setTimelineDrawerProject(project);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left text-foreground font-medium"
                          >
                            <History size={12} /> View Timeline
                          </button>
                          {canEditAssignments && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenRowMenuId(null);
                                setEditingProject(project);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left text-foreground font-medium"
                            >
                              <Pencil size={12} /> Edit Details
                            </button>
                          )}
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
          {/* Column widths follow their content (auto layout). Collapsed columns, the checkbox and the
              actions column keep fixed widths. Previous fixed-width layout, kept for easy revert:
              className="table-fixed ..." style={{ width: CHECKBOX + Σ EXPANDED_COL_WIDTH[id] + ACTIONS }}
              with <col style={{ width: EXPANDED_COL_WIDTH[id] }} /> per leaf column. */}
          <table className="table-auto w-max min-w-full text-left text-xs border-collapse">
            <colgroup>
              {canEditAssignments && <col style={{ width: CHECKBOX_COL_WIDTH }} />}
              {LEAF_COL_ORDER.map((id) => (
                <col
                  key={id}
                  style={
                    isColCollapsed(id)
                      ? { width: COLLAPSED_COL_WIDTH }
                      : FIXED_WIDTH_COLS.has(id)
                        ? { width: EXPANDED_COL_WIDTH[id] }
                        : undefined
                  }
                />
              ))}
              <col style={{ width: ACTIONS_COL_WIDTH }} />
            </colgroup>
            {/* Header stays pinned while the rows scroll vertically. Opaque background so rows pass
                underneath; the bottom shadow replaces the border that sticky cells lose. */}
            <thead className="sticky top-0 z-30 bg-background shadow-[0_1px_0_var(--border)]">
              <tr className="border-b bg-muted/40 text-muted-foreground font-medium text-center">
                {canEditAssignments && (
                  <th
                    rowSpan={3}
                    className="py-3 px-3 border-r text-center align-middle"
                    style={{ width: CHECKBOX_COL_WIDTH, minWidth: CHECKBOX_COL_WIDTH, maxWidth: CHECKBOX_COL_WIDTH }}
                  >
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
                {renderLeafHeader("projectId", "Project ID", 3)}
                {renderLeafHeader("projectName", "Project Name", 3)}
                {renderLeafHeader("projectStartDate", "Project Start Date", 3)}
                {/* {renderLeafHeader("projectStatus", "Status", 3)} */}
                {renderLeafHeader("projectLead", "Project Lead / SPOC", 3)}
                {renderLeafHeader("projectNotes", "Project iNotes", 3)}
                {renderLeafHeader("industry", "Industry", 3)}
                {renderGroupHeader("Client Location", CLIENT_LOCATION_COLS, 3)}
                {renderGroupHeader("Tech", TECH_COLS, 2)}
                {renderGroupHeader("Creative", CREATIVE_COLS, 4)}
                {renderGroupHeader("Marketing", MARKETING_COLS, 3)}
                {renderLeafHeader("projectCalendar", "Project Calendar", 3)}
                {renderLeafHeader("assetLink", "Asset Link", 3)}
                {/* {renderLeafHeader("projectTimeline", "Timeline", 3)} */}
                <th rowSpan={3} className="py-2.5 px-2 text-center align-middle">Controls</th>
              </tr>
              <tr className="border-b bg-muted/40 text-muted-foreground font-medium text-center">
                {renderLeafHeader("clientCountry", "Country", 2)}
                {renderLeafHeader("clientState", "State", 2)}
                {renderLeafHeader("clientCity", "City", 2)}
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
                  <td colSpan={LEAF_COL_ORDER.length + (canEditAssignments ? 2 : 1)} className="py-12 text-center text-muted-foreground">
                    No {categoryTab === "SMM" ? "SMM" : "Digital"} projects found matching current filter.
                  </td>
                </tr>
              ) : (
                sortedProjects.map((project, rowIndex) => {
                  const rowSelected = selectedProjectIds.has(project.id);
                  const cell = (id: CollapsibleColId, content: React.ReactNode) =>
                    renderLeafCell(id, content, rowIndex, sortedProjects.length, rowSelected);
                  // Status column hidden — restore together with "projectStatus" in LEAF_COL_ORDER and its header.
                  // const statusCell = () => renderStatusCell(project, rowIndex, sortedProjects.length);
                  return (
                    <tr
                      key={project.id}
                      className={`hover:bg-accent/30 transition-colors group ${selectedProjectIds.has(project.id) ? "bg-primary/5" : ""
                        }`}
                    >
                      {canEditAssignments && (
                        <td
                          className="py-3 px-3 border-r text-center"
                          style={{ width: CHECKBOX_COL_WIDTH, minWidth: CHECKBOX_COL_WIDTH, maxWidth: CHECKBOX_COL_WIDTH }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedProjectIds.has(project.id)}
                            onChange={() => toggleProjectSelected(project.id)}
                            className="cursor-pointer"
                          />
                        </td>
                      )}
                      {cell(
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

                      {cell(
                        "projectName",
                        <div className="flex flex-col gap-1 items-start">
                          <Link
                            href={`/projects/${project.id}`}
                            className="font-semibold text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-1.5"
                          >
                            {project.name}
                          </Link>
                          {/* <span
                          className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${project.projectCategory === "INTERNAL_BUILD"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                            }`}
                        >
                          {project.projectCategory === "INTERNAL_BUILD"
                            ? "Internal Build"
                            : "7-Phase SOP"}
                        </span> */}
                        </div>
                      )}

                      {cell(
                        "projectStartDate",
                        <StartDateCell
                          project={project}
                          editable={canEditAssignments}
                          onUpdated={(patch) => patchProject(project.id, patch)}
                        />
                      )}

                      {/* {statusCell()} */}

                      {cell(
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

                      {cell(
                        "projectNotes",
                        <ProjectINotesCell
                          projectId={project.id}
                          projectName={project.name}
                          summary={noteSummaries[project.id]}
                          loaded={noteSummariesLoaded}
                          onClosed={() => setNoteSummariesVersion((v) => v + 1)}
                        />
                      )}

                      {cell(
                        "industry",
                        <IndustryCell
                          project={project}
                          editable={canEditAssignments}
                          onUpdated={(patch) => patchProject(project.id, patch)}
                        />
                      )}

                      {cell(
                        "clientCountry",
                        <CountryCell
                          project={project}
                          editable={canEditAssignments}
                          onUpdated={(patch) => patchProject(project.id, patch)}
                        />
                      )}

                      {cell(
                        "clientState",
                        <StateCell
                          project={project}
                          editable={canEditAssignments}
                          onUpdated={(patch) => patchProject(project.id, patch)}
                        />
                      )}

                      {cell(
                        "clientCity",
                        <CityCell
                          project={project}
                          editable={canEditAssignments}
                          onUpdated={(patch) => patchProject(project.id, patch)}
                        />
                      )}

                      {cell(
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

                      {cell(
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

                      {cell(
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

                      {cell(
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

                      {cell(
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

                      {cell(
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

                      {cell(
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

                      {cell(
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

                      {cell(
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

                      {cell(
                        "projectCalendar",
                        <CalendarCell
                          project={project}
                          editable={canEditAssignments}
                          onUpdated={(patch) => patchProject(project.id, patch)}
                        />
                      )}

                      {cell(
                        "assetLink",
                        <LinksCell
                          project={project}
                          editable={canEditAssignments}
                          onUpdated={(patch) => patchProject(project.id, patch)}
                        />
                      )}

                      {/* {cell(
                      "projectTimeline",
                      <TimelineCell
                        project={project}
                        onOpen={() => setTimelineDrawerProject(project)}
                      />
                    )} */}

                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <div className="relative inline-flex items-center justify-center">
                          {/* Edit Project Details icon button commented out per UI request */}
                          {/* {canEditAssignments && (
                          <button
                            type="button"
                            onClick={() => setEditingProject(project)}
                            className="p-1 text-muted-foreground hover:text-primary transition-colors rounded hover:bg-accent"
                            title="Edit Project Details"
                          >
                            <Pencil size={13} />
                          </button>
                        )} */}

                          {/* View Timeline icon button commented out per UI request */}
                          {/* <button
                          type="button"
                          onClick={() => setTimelineDrawerProject(project)}
                          className="p-1 text-muted-foreground hover:text-primary transition-colors rounded hover:bg-accent"
                          title="View Timeline"
                        >
                          <History size={13} />
                        </button> */}

                          <div data-row-menu-container className="relative inline-flex items-center">
                            <button
                              type="button"
                              onClick={() => setOpenRowMenuId((v) => (v === project.id ? null : project.id))}
                              className={`p-1 transition-colors rounded hover:bg-accent ${openRowMenuId === project.id ? "text-primary bg-accent" : "text-muted-foreground hover:text-foreground"
                                }`}
                              title="More Actions"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {openRowMenuId === project.id && (
                              <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-md border bg-popover py-1 shadow-lg text-xs animate-in fade-in duration-150 text-left">
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
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenRowMenuId(null);
                                    setTimelineDrawerProject(project);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left text-foreground font-medium"
                                >
                                  <History size={12} /> View Timeline
                                </button>
                                {canEditAssignments && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenRowMenuId(null);
                                      setEditingProject(project);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left text-foreground font-medium"
                                  >
                                    <Pencil size={12} /> Edit Details
                                  </button>
                                )}
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
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* Edit Project Details Drawer */}
      {editingProject && (
        <AddProjectDrawer
          isOpen={Boolean(editingProject)}
          onClose={() => setEditingProject(null)}
          onAddProject={async () => { }}
          projects={localProjects}
          projectToEdit={editingProject}
          onUpdateProject={handleUpdateProjectDetails}
        />
      )}

      {ConfirmDialog}
    </div>
  );
}
