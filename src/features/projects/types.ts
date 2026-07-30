export type ProjectStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";

export type ProjectPriority = "None" | "Low" | "Medium" | "High" | "Urgent";

export type BillingType = "Fixed Rate" | "Hourly Rate" | "Non Billable" | "None";

export type WorkspaceRole = "ADMIN" | "TEAM_MEMBER";

export interface ProjectPhase {
  id: string;
  code: string;
  name: string;
  isCompleted?: boolean;
}

export interface ProjectOwner {
  id: string;
  name: string;
  initials: string;
  avatarColor?: string;
  email?: string;
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

export interface Project {
  id: string; // e.g. EEDP-81
  name: string;
  progressPercent: number; // e.g. 49%
  owner: ProjectOwner;
  status: ProjectStatus;
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
  description?: string;
  tags?: string[];
  createdAt: string;
}

export interface NewProjectFormData {
  name: string;
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
}

export type UserType = "PORTAL" | "CLIENT";

export interface ProjectUser {
  id: string;
  name: string;
  email: string;
  userType: UserType;
  role: string;
  portalProfile?: string;
  projects?: string;
  statusText?: string;
  initials: string;
  avatarColor?: string;
  avatarUrl?: string;
}

export type TaskStatus = "Open" | "In Progress" | "Closed";

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
  phaseCode: string; // e.g. "2.1"
  phaseName: string; // e.g. "IDEATION & CONCEPTUALIZATION" or "UI/UX DESIGNING"
  status: TaskStatus;
  authorName: string; // e.g. "Dhruv Patidar"
  associatedTeam?: string;
  owner?: string;
  workHours?: string;
  startDate?: string;
  duration?: string; // e.g. "2 days/hrs"
  completionPercentage?: number; // e.g. 0
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
}

export interface TimeLogEntry {
  id: string;
  code: string; // e.g. EC2-T3312
  title: string; // e.g. DSMA
  project: string; // e.g. EED Core
  duration: string; // e.g. 00:08
  timePeriod: string; // e.g. 10:52 AM - 11:00 AM
  date: string; // e.g. 11/07/2026
  billingType: "NON BILLABLE" | "BILLABLE";
  remarks: string;
  approvalStatus?: "Pending" | "Approved" | "Rejected";
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
