export type ProjectStatus = "ACTIVE" | "INACTIVE" | "COMPLETED";

export type ProjectPriority = "None" | "Low" | "Medium" | "High" | "Urgent";

export type BillingType = "Fixed Rate" | "Hourly Rate" | "Non Billable" | "None";

export type WorkspaceRole = "ADMIN" | "TEAM_MEMBER";

// The 3-tier role shown on the Projects "Users" screen. Derived server-side from the
// global User.role (TEAM_MEMBER|MANAGER) plus an ADMIN override from User.profileRole.
export type MemberRoleTier = "TEAM_MEMBER" | "MANAGER" | "ADMIN";

// Mirrors the Prisma `ProfileRole` enum (prisma/schema.prisma) — the "Portal Profile" value.
export type ProfileRoleValue =
  | "EMPLOYEE"
  | "MANAGER"
  | "CONTRACTOR"
  | "CLIENT"
  | "GUEST"
  | "DEVELOPER"
  | "SUPPORT"
  | "ADMIN"
  | "PORTAL_OWNER";

export type UserDepartment = "SEO" | "Design" | "Content" | "Development" | "Management";

export interface ProjectPhase {
  id: string;
  code: string;
  name: string;
  isCompleted?: boolean;
  ownerId?: string; // defaults to the project owner when the phase is created
}

/**
 * `ProjectTaskList.status` of a tombstone row marking a task list (board column) a manager
 * deleted. Template-default columns are drawn even without a DB row, so a deleted one needs a
 * marker to stay hidden; creating a list with the same code again removes the marker.
 */
export const DELETED_TASK_LIST_STATUS = "Deleted";

export interface TaskList {
  id: string;
  name: string;
  flag: "internal" | "external"; // external = client-visible
  status: "Active" | "Completed";
  sequence: number;
  phaseCode: string;
}

export interface SOPTaskSeed {
  title: string;
  duration: string;
  priority: ProjectPriority;
  departmentAlias: string;
  description?: string;
}

export interface SOPTaskListTemplate {
  name: string;
  flag: "internal" | "external";
  sequence: number;
  defaultTasks: SOPTaskSeed[];
}

export interface SOPPhaseTemplate {
  code: string;
  name: string;
  departmentAlias: string;
  tasks?: SOPTaskSeed[];
  taskLists?: SOPTaskListTemplate[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  category: "Client Delivery" | "Internal Product" | "Custom";
  phases: SOPPhaseTemplate[];
}

export interface ProjectOwner {
  id: string;
  name: string;
  initials: string;
  avatarColor?: string;
  email?: string;
}

/** A single assignee slot on a project (Project Lead, Tech/Creative Assignee, Marketing SEO/Content/PM). */
export interface ProjectAssignee {
  id: string;
  name: string;
  initials: string;
  avatarColor?: string;
}

/** Lightweight team-member record used by the assignee picker popover — driven by live User rows. */
export interface TeamMemberOption {
  id: string;
  name: string;
  email: string;
  title?: string;
  department?: string;
  initials: string;
  avatarColor?: string;
}

export interface ProjectTaskInfo {
  associatedTeam?: string;
  ownerId?: string;
  ownerName?: string;
  workHours?: string;
  startDate?: string;
  dueDate?: string;
  priority?: ProjectPriority;
  tags?: string[];
  reminder?: string;
  billingType?: BillingType;
}

export type ProjectType = "CLIENT_DELIVERY" | "INTERNAL_BUILD" | "SMM";

export interface Project {
  id: string; // e.g. EEDP-81
  name: string;
  progressPercent: number; // e.g. 49%
  owner: ProjectOwner;
  status: ProjectStatus;
  projectCategory?: ProjectType; // CLIENT_DELIVERY (7-Phase SOP) or INTERNAL_BUILD (Flat)
  departmentAlias?: string; // e.g. "seo@", "digitalproducts@", "design@", "dev@"
  templateUsed?: string; // e.g. "T2T 7-Phase SOP Delivery Template"
  accessType?: "PUBLIC" | "PRIVATE";
  isClientVisible?: boolean;
  totalHours: string; // e.g. "05:07" or "00:00 h"
  billableHours: string; // e.g. "00:00 h"
  nonBillableHours: string; // e.g. "01:00 h"
  startDate: string; // e.g. "11/07/2026"
  deadline: string; // e.g. "01/01/2027"
  completedTasksCount: number; // e.g. 4
  totalTasksCount: number; // e.g. 346
  taskProgressPercent: number; // e.g. 55%
  completedPhasesCount: number; // e.g. 3
  totalPhasesCount: number; // e.g. 7
  phases?: ProjectPhase[];
  taskLists?: TaskList[];
  description?: string;
  tags?: string[];
  aiSummary?: string;
  group?: string;
  associatedTeam?: string;
  businessHours?: string;
  taskLayout?: string;
  priority?: ProjectPriority;
  billingType?: BillingType;
  createdAt: string;

  // Table-view assignment/tracking columns (see all-projects-table-view.tsx) — each role can
  // hold multiple people at once (backed by the ProjectRoleAssignment join table).
  projectLead?: ProjectAssignee[];
  techLead?: ProjectAssignee[];
  techAssignee?: ProjectAssignee[];
  creativeAssignee?: ProjectAssignee[];
  creativeUiuxLead?: ProjectAssignee[];
  creativeUiuxAssignee?: ProjectAssignee[];
  creativeGraphicLead?: ProjectAssignee[];
  creativeGraphicAssignee?: ProjectAssignee[];
  marketingLead?: ProjectAssignee[];
  marketingSeo?: ProjectAssignee[];
  marketingContent?: ProjectAssignee[];
  marketingPm?: ProjectAssignee[];
  driveLink?: string;
  webLink?: string;
  designLink?: string;
  techNotes?: string;
  creativeNotes?: string;
  marketingNotes?: string;

  // Client info columns. Codes are set only when the value was picked from the list.
  industry?: string;
  clientCountry?: string;
  clientCountryCode?: string;
  clientState?: string;
  clientStateCode?: string;
  clientCity?: string;
}

export interface NewProjectFormData {
  name: string;
  projectCategory?: ProjectType;
  templateUsed?: string;
  templateId?: string;
  phases: ProjectPhase[];
  associatedTeam: string;
  owner: string;
  workHours: string;
  startDate: string;
  dueDate: string;
  priority: ProjectPriority;
  tags: string;
  reminder: string;
  billingType: BillingType;
  description: string;
  attachments?: File[];
  group?: string;
  businessHours?: string;
  taskLayout?: string;
  accessType?: "PUBLIC" | "PRIVATE";
  isClientVisible?: boolean;
  notifyAddedUsers?: boolean;
}

export type UserType = "PORTAL" | "CLIENT";

export interface ProjectUser {
  id: string;
  name: string;
  email: string;
  userType: UserType;
  role: MemberRoleTier;
  profileRole: ProfileRoleValue;
  department?: UserDepartment;
  departmentAlias?: string; // e.g. "seo@", "digitalproducts@", "design@", "dev@"
  title?: string;
  portalProfile?: string;
  projects?: string;
  statusText?: string;
  initials: string;
  avatarColor?: string;
  avatarUrl?: string;
}

export const PROJECT_TASK_STATUSES = [
  "Open",
  "In Progress",
  "In Review",
  "Done",
  "Follow Up 1",
  "Follow Up 2",
  "Pending from Client",
  "On Hold",
  "Delayed",
] as const;

export type TaskStatus =
  | (typeof PROJECT_TASK_STATUSES)[number]
  | "Under Review"
  | "Approved"
  | "Closed";

export function isTaskDone(
  status?: string | null,
  completed?: boolean,
  completionPercentage?: number
): boolean {
  if (completed) return true;
  if (completionPercentage !== undefined && completionPercentage >= 100) return true;
  if (!status) return false;
  const s = status.trim().toUpperCase();
  return s === "DONE" || s === "CLOSED" || s === "APPROVED";
}

export function getTaskStatusBadgeClasses(status?: string | null): string {
  switch (status) {
    case "Done":
    case "Closed":
    case "Approved":
      return "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400";
    case "In Progress":
      return "bg-amber-500/15 text-amber-600 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300";
    case "In Review":
    case "Under Review":
      return "bg-purple-500/15 text-purple-600 border border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-300";
    case "Follow Up 1":
      return "bg-cyan-500/15 text-cyan-600 border border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-300";
    case "Follow Up 2":
      return "bg-blue-500/15 text-blue-600 border border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300";
    case "Pending from Client":
      return "bg-orange-500/15 text-orange-600 border border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-300";
    case "On Hold":
      return "bg-slate-500/15 text-slate-600 border border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300";
    case "Delayed":
      return "bg-rose-500/15 text-rose-600 border border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-300";
    case "Open":
    default:
      return "bg-sky-500/15 text-sky-600 border border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-300";
  }
}

export function getTaskStatusSelectClasses(status?: string | null): string {
  switch (status) {
    case "Done":
    case "Closed":
    case "Approved":
      return "border-emerald-500/40 text-emerald-600 dark:text-emerald-400";
    case "In Progress":
      return "border-amber-500/40 text-amber-600 dark:text-amber-400";
    case "In Review":
    case "Under Review":
      return "border-purple-500/40 text-purple-600 dark:text-purple-400";
    case "Follow Up 1":
      return "border-cyan-500/40 text-cyan-600 dark:text-cyan-400";
    case "Follow Up 2":
      return "border-blue-500/40 text-blue-600 dark:text-blue-400";
    case "Pending from Client":
      return "border-orange-500/40 text-orange-600 dark:text-orange-400";
    case "On Hold":
      return "border-slate-500/40 text-slate-600 dark:text-slate-400";
    case "Delayed":
      return "border-rose-500/40 text-rose-600 dark:text-rose-400";
    case "Open":
    default:
      return "border-sky-500/40 text-sky-600 dark:text-sky-400";
  }
}

export interface TaskRemark {
  id: string;
  authorName: string;
  authorInitials: string;
  authorAvatarColor?: string;
  content: string;
  createdAt: string;
}

export interface TaskActivityLog {
  id: string;
  date: string;
  time: string;
  userAvatarUrl?: string;
  userName: string;
  userInitials?: string;
  actionText: string;
}

export interface TaskSubtask {
  id: string;
  code: string; // e.g. WI1-T11, WI1-T14
  title: string;
  status: TaskStatus;
  ownerName?: string; // e.g. "Unassigned" or "Vaishnavi Shivhare"
  startDate?: string;
  dueDate?: string;
  completed: boolean;
  hasLink?: boolean;
}

export interface TaskItem {
  id: string;
  code: string; // e.g. WI1-T11
  title: string;
  parentTaskId?: string; // set when this task is really a subtask of another ProjectTask
  projectId?: string; // the owning Project's id — needed to build /projects/:projectId links from cross-project views
  projectName?: string; // the owning Project's name — used by cross-project views like "My Tasks"
  phaseCode: string; // e.g. "2.1"
  phaseName: string; // e.g. "IDEATION & CONCEPTUALIZATION" or "UI/UX DESIGNING"
  taskListId?: string;
  taskListName?: string;
  isExternal?: boolean; // Client visible flag
  status: TaskStatus;
  authorName: string; // e.g. "Dhruv Patidar"
  authorId?: string;
  associatedTeam?: string;
  departmentAlias?: string; // e.g. "seo@", "digitalproducts@", "design@", "dev@"
  owner?: string;
  ownerId?: string;
  owners?: string[];
  ownerIds?: string[]; // resolved user IDs matching `owners` — the reliable way to check ownership
  workHours?: string;
  startDate?: string;
  duration?: string; // e.g. "2 days/hrs"
  completionPercentage?: number; // e.g. 0
  order?: number; // manual drag-reorder position within its Kanban phase column
  recurrence?: string;
  dueDate?: string;
  priority?: ProjectPriority;
  tags?: string[];
  reminder?: string;
  billingType?: BillingType;
  description?: string;
  subtasks?: TaskSubtask[];
  remarks?: TaskRemark[];
  activities?: TaskActivityLog[];
  assignees?: { id: string; name: string; initials: string; avatarColor?: string }[];
  isWarning?: boolean;
  staleAlert?: boolean;
  lastActivityDate?: string;
  hasAttachments?: boolean;
  hasComments?: boolean;
  hasReminder?: boolean;
  hasRecurrence?: boolean;
}

export interface ProjectIssue {
  id: string;
  title: string;
  description: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  assignee?: string;
  reporter: string;
  createdAt: string;
}

export interface TimeLogEntry {
  id: string;
  code: string; // e.g. EC2-T3312
  title: string; // e.g. DSMA
  project: string; // e.g. EED Core
  projectId?: string;
  taskCode?: string; // e.g. WI1-T70 — links the log to a specific ProjectTask
  duration: string; // e.g. 00:08
  timePeriod: string; // e.g. 10:52 AM - 11:00 AM
  startTime?: string;
  endTime?: string;
  date: string; // e.g. 11/07/2026
  billingType: "NON BILLABLE" | "BILLABLE";
  remarks: string;
  approvalStatus?: "Pending" | "Approved" | "Rejected";
  rejectionReason?: string;
  approvedBy?: string;
  userName?: string;
  userInitials?: string;
  userId?: string;
  createdAt?: string;
}

export interface UserTimeGroup {
  userId: string;
  userName: string;
  userInitials: string;
  avatarColor: string;
  dailyLogHours: string; // e.g. "05:07 | 01:51 | 03:16" or "Total: 01:00"
  isExpanded?: boolean;
  timeLogs: TimeLogEntry[];
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  fileUrl: string;
  sizeBytes: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
}

export interface ProjectTimelineEvent {
  id: string;
  projectId: string;
  type: "CREATED" | "UPDATED" | "STATUS_CHANGE" | "TASK_ADDED" | "PHASE_COMPLETED" | "USER_ASSIGNED" | "DOCUMENT_UPLOADED" | "ACTIVITY";
  title: string;
  description: string;
  actorName: string;
  actorAvatarColor?: string;
  timestamp: string;
  oldValue?: string;
  newValue?: string;
  actionText?: string;
  fieldName?: string;
}
