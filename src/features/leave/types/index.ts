export type LeaveTypeCode =
  | "CL" // Casual Leave
  | "SL" // Sick Leave
  | "PL" // Paid Leave
  | "AL" // Annual Leave
  | "WFH" // Work From Home
  | "EL" // Early Leave
  | "HD" // Half Day Leave
  | "EML" // Emergency Leave
  | "FFL" // Floating Festival Leave
  | "UL" // Unpaid Leave
  | "ABS" // Absent
  | "LCA" // Late Coming Absent
  | "ML" // Marriage Leave
  | "PAT" // Paternity Leave
  | "MAT" // Maternity Leave
  | "COMP"; // Compensatory Off

export interface LeaveTypeConfig {
  id: string;
  code: LeaveTypeCode;
  name: string;
  shortName?: string;
  description?: string;
  iconName?: string;
  iconBgColor: string;
  iconTextColor: string;
  totalQuota?: number;
  remainingDays: number;
  bookedDays: number;
  unit: "Days" | "Hours" | string;
  allowNegative?: boolean;
}

export type LeaveStatus = "APPROVED" | "PENDING" | "REJECTED" | "CANCELLED";

export type DayType = "FULL_DAY" | "HALF_DAY" | "MULTIPLE_DAYS" | "EARLY_LEAVE";
export type HalfDaySession = "FIRST_HALF" | "SECOND_HALF"; // FN or AN
export type CompDurationType = "FULL_DAY" | "HALF_DAY" | "QUARTER_DAY";

export interface LeaveAttachment {
  id: string;
  name: string;
  size: string;
  url?: string;
  type?: string;
}

export interface ApprovalStep {
  id: string;
  title: string;
  actorName: string;
  actorRole?: string;
  dateStr?: string;
  status: "COMPLETED" | "PENDING" | "REJECTED";
}

export interface EmployeeInfo {
  name: string;
  empId: string;
  role: string;
  avatarUrl?: string;
}

export interface LeaveRequest {
  id: string;
  leaveTypeCode: LeaveTypeCode;
  leaveTypeName: string;
  dayType: DayType;
  fromDate: string;
  toDate: string;
  fromDateDisplay: string;
  toDateDisplay: string;
  session?: HalfDaySession;
  fromTime?: string;
  toTime?: string;
  durationText: string;
  durationDays: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  appliedOnDateTime?: string;
  employee?: EmployeeInfo;
  attachments?: LeaveAttachment[];
  approverComments?: string;
  approvalFlow?: ApprovalStep[];
}

export interface ActionRequiredItem {
  id: string;
  date: string;
  dayOfWeek: string;
  issue: string;
}

export interface HolidayItem {
  id: string;
  name: string;
  date: string;
  dayOfWeek: string;
  type: "Mandatory" | "Optional" | "Gazetted";
  isPast?: boolean;
}

export interface CompensatoryRequest {
  id: string;
  workDate: string; // e.g., "18 Apr 2025"
  workDayOfWeek: string; // e.g., "Fri"
  hoursWorkedDisplay?: string; // e.g., "10:30 AM - 12:00 PM\n2h 30m"
  hoursWorked?: string;
  fromTime?: string;
  toTime?: string;
  durationHoursText?: string;
  durationType?: CompDurationType;
  durationText?: string; // "Full Day", "Half Day", "Quarter Day"
  duration?: string;
  reason: string;
  status: LeaveStatus;
  requestedOn: string; // e.g., "19 Apr 2025"
  expiryDate: string; // e.g., "18 Jun 2025 (Wed)"
  attachments?: LeaveAttachment[];
  employeeName?: string;
  designation?: string;
  avatarText?: string;
  creditedDays?: number;
}
