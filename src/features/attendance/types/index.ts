export type AttendanceStatus =
  | "WORKING_NOW"
  | "PRESENT"
  | "ON_LEAVE"
  | "HALF_DAY_LEAVE"
  | "EARLY_LEAVE"
  | "ACTION_REQUIRED"
  | "WEEKEND"
  | "HOLIDAY"
  | "ABSENT";

export type WorkMode = "OFFICE" | "REMOTE";

export type AttendanceSource = "Fingerprint" | "Web" | "Mobile App";

export type ActionRequiredType =
  | "MISSING_BOTH"
  | "MISSING_CHECKIN"
  | "MISSING_CHECKOUT";

export type RegularizationStatus = "Pending" | "Approved" | "Rejected";

export interface EarlyLeaveInfo {
  leaveType: string;
  from: string;
  to: string;
  status: "Approved" | "Pending" | "Rejected";
  approvedBy: {
    name: string;
    role: string;
    avatarUrl?: string;
  };
}

export interface CompensatoryWorkInfo {
  isHolidayWork?: boolean;
  canRequestCompOff?: boolean;
  holidayName?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // "MON", "TUE", etc.
  formattedDate: string; // "15 August 2026"
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  checkInSource?: AttendanceSource;
  checkOutSource?: AttendanceSource;
  checkInLocation?: {
    name: string;
    address: string;
  };
  checkOutLocation?: {
    name: string;
    address: string;
  };
  checkInPhoto?: string;
  checkOutPhoto?: string;
  workMode?: WorkMode;
  workedDuration?: string;
  isLive?: boolean;
  liveSince?: string;
  actionRequiredType?: ActionRequiredType;
  actionRequiredReason?: string;
  leaveInfo?: {
    leaveType: string;
    duration: "Full Day" | "Half Day";
    session?: "First Half" | "Second Half";
    status: "APPROVED" | "PENDING" | "REJECTED";
    appliedOn?: string;
    approvedBy?: {
      name: string;
      role: string;
      avatarUrl?: string;
    };
  };
  earlyLeaveInfo?: EarlyLeaveInfo;
  holidayInfo?: {
    name: string;
    type: string;
    dateFormatted?: string;
    countryFlag?: string;
  };
  compensatoryWork?: CompensatoryWorkInfo;
}

export interface ActionRequiredItem {
  id: string;
  date: string;
  formattedDate: string;
  dayName: string;
  issue: string;
}

export interface MonthlySummary {
  month: string;
  totalWorkingDays: number;
  presentDays: number;
  leavesTaken: number;
  absentDays: number;
}

// ── Team Attendance & Employee Types ──────────────────────────────────────────

export interface TeamMemberAttendance {
  id: string;
  employeeId: string;
  name: string;
  avatarUrl?: string;
  designation: string;
  department: string;
  status: "Working Now" | "Completed" | "On Leave" | "Absent";
  leaveType?: string; // "Casual Leave", "Sick Leave"
  checkInTime?: string;
  checkInSource?: AttendanceSource;
  checkOutTime?: string;
  checkOutSource?: AttendanceSource;
  workedHours?: string;
  workedHoursSubtext?: string; // "Since 09:12 AM" or "Includes 1h Break"
  workMode?: "Office" | "Remote";
}

export interface EmployeeProfile {
  id: string;
  employeeId: string; // "EMP00123"
  name: string; // "Rohit Sharma"
  avatarUrl?: string;
  status: "ACTIVE" | "INACTIVE";
  designation: string; // "Senior UI/UX Designer"
  department: string; // "Design Team"
  email: string; // "rohit.sharma@winos.com"
  phone: string; // "+91 98765 43210"
}

// ── Regularization Request Types ──────────────────────────────────────────────

export interface RegularizationRequest {
  id: string;
  employee: EmployeeProfile;
  attendanceDate: string; // "15 Aug 2026"
  attendanceDay: string; // "Friday"
  existingAttendance: {
    checkIn?: string;
    checkOut?: string;
    workedDuration?: string;
  };
  requestedAttendance: {
    checkIn: string;
    checkOut: string;
    workedDuration: string;
  };
  reason: string; // "Forgot to check out"
  remarks?: string; // "I forgot to mark my check-out after leaving the office."
  status: RegularizationStatus;
  requestedOn: string; // "16 Aug 2026, 10:21 AM"
  appliedOn: string; // "12 Aug 2026"
  appliedDay: string; // "Tuesday"
  timeline: {
    title: string;
    subtitle: string;
    timestamp?: string;
    status: "completed" | "current" | "upcoming";
  }[];
}

// ── Shift & Payroll Report Types ─────────────────────────────────────────────

export interface ShiftSummaryItem {
  id: string;
  dateStr?: string; // e.g. "19/08/2026 Wed"
  employeeName?: string;
  designation?: string;
  avatarUrl?: string;
  status: "Present" | "Weekend" | "Absent" | "On Leave";
  attendanceTime?: string; // "09:56 AM → 06:47 PM"
  totalHours?: string; // "08:51"
  checkInDiff?: {
    type: "early" | "late" | "on-time";
    label: string; // "04 min Early" or "12 min Late"
  };
  checkOutDiff?: {
    type: "early" | "late" | "on-time";
    label: string; // "17 min Late" or "25 min Early" or "0 min"
  };
  netHours?: {
    type: "positive" | "negative" | "neutral";
    label: string; // "+00:21" or "-00:12"
  };
  workMode: "Remote" | "Office" | "Weekend";
}

export interface TeamPayrollItem {
  id: string;
  name: string;
  designation: string;
  avatarUrl?: string;
  companyWorkingDays: number;
  expectedPayableDays: number;
  presentDays: number;
  halfDays: number;
  paidOffs: number;
  absentDays: number;
  totalDays: number;
}

export interface MyMonthlyPayrollItem {
  id: string;
  month: string; // "May 2025"
  companyWorkingDays: number;
  expectedPayableDays: number;
  presentDays: number;
  halfDays: number;
  paidOffs: number;
  absentDays: number;
  totalDays: number;
}

export interface LeavePayrollRecord {
  id: string;
  name: string;
  avatarGradient?: string;
  totalDays: number;
  weekend: number;
  payableDays: number;
  lossOfPay: number;
  paidDays: number;
  lossOfPayBreakdown?: {
    unpaidLeave: number;
    halfDayUnpaid: number;
    lateArrival: number;
  };
}

