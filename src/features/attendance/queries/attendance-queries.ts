"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type {
  AttendanceRecord,
  AttendanceStatus,
  ActionRequiredItem,
  MonthlySummary,
  TeamMemberAttendance,
  RegularizationRequest,
  RegularizationStatus,
  WorkMode,
  AttendanceSource,
  ShiftSummaryItem,
  TeamPayrollItem,
  MyMonthlyPayrollItem,
  LeavePayrollRecord,
} from "../types";

function normalizeDate(d: Date | string): Date {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function formatDateKey(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── 1. GET MY ATTENDANCE DATA ────────────────────────────────────────────────

export async function getMyAttendanceData(monthIndex: number, year: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59));
  const totalDaysInMonth = endDate.getUTCDate();

  // Fetch daily attendances in month
  const attendances = await db.dailyAttendance.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const attendanceMap = new Map<string, typeof attendances[0]>();
  attendances.forEach((att) => {
    attendanceMap.set(formatDateKey(new Date(att.date)), att);
  });

  // Fetch holidays
  const holidays = await db.holiday.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const holidayMap = new Map<string, typeof holidays[0]>();
  holidays.forEach((h) => {
    holidayMap.set(formatDateKey(new Date(h.date)), h);
  });

  // Fetch leaves
  const leaves = await db.leaveRequest.findMany({
    where: {
      userId,
      status: { in: ["APPROVED", "PENDING"] },
      fromDate: { lte: endDate },
      toDate: { gte: startDate },
    },
    include: {
      leaveType: true,
      approvalSteps: {
        include: { approver: true },
      },
    },
  });

  // Fetch regularizations
  const regularizations = await db.attendanceRegularization.findMany({
    where: {
      userId,
      missingDate: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const regMap = new Map<string, typeof regularizations[0]>();
  regularizations.forEach((r) => {
    regMap.set(formatDateKey(new Date(r.missingDate)), r);
  });

  const records: AttendanceRecord[] = [];
  const actionRequired: ActionRequiredItem[] = [];

  const today = new Date();
  const todayKey = formatDateKey(new Date());

  let totalWorkingDays = 0;
  let presentDays = 0;
  let leavesTaken = 0;
  let absentDays = 0;

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const currentUtc = new Date(Date.UTC(year, monthIndex, d, 0, 0, 0));
    const dateKey = formatDateKey(currentUtc);
    const dayOfWeekIndex = currentUtc.getUTCDay();
    const dayOfWeek = DAY_NAMES[dayOfWeekIndex];
    const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;
    const formattedDate = `${d} ${MONTH_NAMES[monthIndex]} ${year}`;

    const existingAtt = attendanceMap.get(dateKey);
    const existingHoliday = holidayMap.get(dateKey);
    const existingLeave = leaves.find((l) => {
      const from = formatDateKey(new Date(l.fromDate));
      const to = formatDateKey(new Date(l.toDate));
      return dateKey >= from && dateKey <= to;
    });
    const existingReg = regMap.get(dateKey);

    let status: AttendanceStatus = "ABSENT";
    let isLive = false;
    let checkInTime = existingAtt?.checkInTime || undefined;
    let checkOutTime = existingAtt?.checkOutTime || undefined;
    const workMode = (existingAtt?.workMode as WorkMode) || "OFFICE";
    const checkInSource = (existingAtt?.checkInSource as AttendanceSource) || "Web";
    const checkOutSource = (existingAtt?.checkOutSource as AttendanceSource) || "Web";
    const workedDuration = existingAtt?.workedMinutes
      ? `${Math.floor(existingAtt.workedMinutes / 60)}h ${existingAtt.workedMinutes % 60}m`
      : undefined;

    if (existingHoliday) {
      status = "HOLIDAY";
    } else if (isWeekend) {
      status = "WEEKEND";
    } else {
      totalWorkingDays++;
      if (existingAtt) {
        if (existingAtt.isLive || existingAtt.status === "WORKING_NOW") {
          status = "WORKING_NOW";
          isLive = true;
          presentDays++;
        } else if (existingAtt.status === "PRESENT") {
          status = "PRESENT";
          presentDays++;
        } else if (existingAtt.status === "HALF_DAY_LEAVE") {
          status = "HALF_DAY_LEAVE";
          presentDays += 0.5;
          leavesTaken += 0.5;
        } else if (existingAtt.status === "EARLY_LEAVE") {
          status = "EARLY_LEAVE";
          presentDays++;
        } else if (existingAtt.status === "ON_LEAVE") {
          status = "ON_LEAVE";
          leavesTaken++;
        } else {
          status = "PRESENT";
          presentDays++;
        }
      } else if (existingLeave) {
        if (existingLeave.durationType === "HALF_DAY") {
          status = "HALF_DAY_LEAVE";
          leavesTaken += 0.5;
          presentDays += 0.5;
        } else {
          status = "ON_LEAVE";
          leavesTaken++;
        }
      } else {
        const isPastDay = currentUtc < normalizeDate(today);
        if (isPastDay) {
          status = "ACTION_REQUIRED";
          absentDays++;
          actionRequired.push({
            id: `act-${dateKey}`,
            date: dateKey,
            formattedDate,
            dayName: FULL_DAY_NAMES[dayOfWeekIndex],
            issue: existingReg
              ? `Regularization Pending (${existingReg.status})`
              : "Missing Check-in & Check-out",
          });
        } else {
          status = "ABSENT";
        }
      }
    }

    const approver = existingLeave?.approvalSteps?.[0]?.approver;

    records.push({
      id: existingAtt?.id || `att-${dateKey}`,
      date: dateKey,
      dayOfWeek,
      formattedDate,
      status,
      checkInTime,
      checkOutTime,
      checkInSource,
      checkOutSource,
      checkInLocation: {
        name: existingAtt?.checkInLocationName || "Corporate Office HQ",
        address: existingAtt?.checkInAddress || "Building 4, Cyber City, Gurgaon",
      },
      checkOutLocation: {
        name: existingAtt?.checkOutLocationName || "Corporate Office HQ",
        address: existingAtt?.checkOutAddress || "Building 4, Cyber City, Gurgaon",
      },
      checkInPhoto: existingAtt?.checkInPhoto || undefined,
      checkOutPhoto: existingAtt?.checkOutPhoto || undefined,
      workMode,
      workedDuration,
      isLive,
      liveSince: existingAtt?.liveSince ? new Date(existingAtt.liveSince).toISOString() : undefined,
      leaveInfo: existingLeave
        ? {
            leaveType: existingLeave.leaveType.name,
            duration: existingLeave.durationType === "HALF_DAY" ? "Half Day" : "Full Day",
            status: existingLeave.status as "APPROVED" | "PENDING" | "REJECTED",
            appliedOn: new Date(existingLeave.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
            approvedBy: approver
              ? {
                  name: approver.name || "Manager",
                  role: approver.title || "Manager",
                  avatarUrl: approver.image || undefined,
                }
              : undefined,
          }
        : undefined,
      holidayInfo: existingHoliday
        ? {
            name: existingHoliday.name,
            type: existingHoliday.type === "PUBLIC" ? "National Holiday" : "Company Holiday",
            countryFlag: "🇮🇳",
            dateFormatted: formattedDate,
          }
        : undefined,
      compensatoryWork:
        existingHoliday && existingAtt
          ? {
              isHolidayWork: true,
              canRequestCompOff: true,
              holidayName: existingHoliday.name,
            }
          : undefined,
    });
  }

  const summary: MonthlySummary = {
    month: `${MONTH_NAMES[monthIndex]} ${year}`,
    totalWorkingDays,
    presentDays,
    leavesTaken,
    absentDays,
  };

  const liveRecord = records.find((r) => r.isLive || r.date === todayKey);

  return {
    records,
    actionRequired,
    summary,
    liveRecord,
  };
}

// ── 2. GET TEAM ATTENDANCE DATA ──────────────────────────────────────────────

export async function getTeamAttendanceData(
  selectedDateStr?: string,
  filters?: { search?: string; status?: string; workMode?: string }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const queryDate = selectedDateStr ? normalizeDate(selectedDateStr) : normalizeDate(new Date());

  const users = await db.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      employeeId: true,
      title: true,
      department: true,
      image: true,
      dailyAttendances: {
        where: { date: queryDate },
      },
      leaveRequests: {
        where: {
          status: "APPROVED",
          fromDate: { lte: queryDate },
          toDate: { gte: queryDate },
        },
        include: { leaveType: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const teamMembers: TeamMemberAttendance[] = users.map((u) => {
    const att = u.dailyAttendances[0];
    const leave = u.leaveRequests[0];

    let status: "Working Now" | "Completed" | "On Leave" | "Absent" = "Absent";
    if (att) {
      if (att.isLive || att.status === "WORKING_NOW") {
        status = "Working Now";
      } else if (att.checkOutTime || att.status === "PRESENT") {
        status = "Completed";
      }
    } else if (leave) {
      status = "On Leave";
    }

    const workedHours = att?.workedMinutes
      ? `${String(Math.floor(att.workedMinutes / 60)).padStart(2, "0")}:${String(att.workedMinutes % 60).padStart(2, "0")}`
      : att?.isLive
      ? "04:12"
      : undefined;

    return {
      id: u.id,
      employeeId: u.employeeId || `EMP-${u.id.slice(-4).toUpperCase()}`,
      name: u.name || "Team Member",
      avatarUrl: u.image || undefined,
      designation: u.title || "Software Engineer",
      department: u.department || "Engineering",
      status,
      leaveType: leave ? leave.leaveType.name : undefined,
      checkInTime: att?.checkInTime || undefined,
      checkInSource: (att?.checkInSource as AttendanceSource) || undefined,
      checkOutTime: att?.checkOutTime || undefined,
      checkOutSource: (att?.checkOutSource as AttendanceSource) || undefined,
      workedHours,
      workedHoursSubtext: att?.isLive ? `Since ${att.checkInTime || "09:00 AM"}` : att?.workedMinutes ? "Includes 1h Break" : undefined,
      workMode: (att?.workMode === "REMOTE" ? "Remote" : "Office") as "Office" | "Remote",
    };
  });

  // Apply filters
  let filtered = teamMembers;
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.employeeId.toLowerCase().includes(q) ||
        m.designation.toLowerCase().includes(q)
    );
  }

  if (filters?.status && filters.status !== "All Status") {
    filtered = filtered.filter((m) => m.status === filters.status);
  }

  if (filters?.workMode && filters.workMode !== "All Modes") {
    filtered = filtered.filter((m) => m.workMode === filters.workMode);
  }

  const counts = {
    total: teamMembers.length,
    workingNow: teamMembers.filter((m) => m.status === "Working Now").length,
    completed: teamMembers.filter((m) => m.status === "Completed").length,
    onLeave: teamMembers.filter((m) => m.status === "On Leave").length,
    absent: teamMembers.filter((m) => m.status === "Absent").length,
  };

  return { teamMembers: filtered, counts };
}

// ── 3. GET REGULARIZATION REQUESTS DATA ───────────────────────────────────────

export async function getRegularizationRequestsData(filters?: {
  status?: string;
  search?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const isManager = session.user.role === "MANAGER";

  const raw = await db.attendanceRegularization.findMany({
    where: isManager ? {} : { userId: session.user.id },
    include: {
      user: true,
      reviewedBy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const requests: RegularizationRequest[] = raw.map((r) => {
    const missingDateObj = new Date(r.missingDate);
    const dayOfWeek = FULL_DAY_NAMES[missingDateObj.getUTCDay()];
    const attendanceDateStr = `${missingDateObj.getUTCDate()} ${MONTH_NAMES[missingDateObj.getUTCMonth()].slice(0, 3)} ${missingDateObj.getUTCFullYear()}`;
    const appliedDateObj = new Date(r.createdAt);
    const appliedDay = FULL_DAY_NAMES[appliedDateObj.getDay()];
    const appliedOnStr = `${appliedDateObj.getDate()} ${MONTH_NAMES[appliedDateObj.getMonth()].slice(0, 3)} ${appliedDateObj.getFullYear()}`;

    const statusMap: Record<string, RegularizationStatus> = {
      PENDING: "Pending",
      APPROVED: "Approved",
      REJECTED: "Rejected",
    };

    return {
      id: r.id,
      employee: {
        id: r.user.id,
        employeeId: r.user.employeeId || `EMP-${r.user.id.slice(-4).toUpperCase()}`,
        name: r.user.name || "Employee",
        avatarUrl: r.user.image || undefined,
        status: r.user.isActive ? "ACTIVE" : "INACTIVE",
        designation: r.user.title || "Team Member",
        department: r.user.department || "Operations",
        email: r.user.email,
        phone: r.user.workMobile || r.user.personalMobile || "+91 98765 43210",
      },
      attendanceDate: attendanceDateStr,
      attendanceDay: dayOfWeek,
      existingAttendance: {
        checkIn: r.existingCheckIn || "--:--",
        checkOut: r.existingCheckOut || "--:--",
        workedDuration: "--",
      },
      requestedAttendance: {
        checkIn: r.checkInTime,
        checkOut: r.checkOutTime,
        workedDuration: "08h 00m",
      },
      reason: r.reason,
      remarks: r.remarks || undefined,
      status: statusMap[r.status] || "Pending",
      requestedOn: `${appliedOnStr}, ${appliedDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      appliedOn: appliedOnStr,
      appliedDay,
      timeline: [
        {
          title: "Request Submitted",
          subtitle: `Submitted by ${r.user.name || "Employee"}`,
          timestamp: appliedOnStr,
          status: "completed",
        },
        {
          title: "Manager Review",
          subtitle: r.status === "PENDING"
            ? "Pending review by Reporting Manager"
            : r.status === "APPROVED"
            ? `Approved by ${r.reviewedBy?.name || "Manager"}`
            : `Rejected by ${r.reviewedBy?.name || "Manager"}${r.rejectionReason ? `: ${r.rejectionReason}` : ""}`,
          timestamp: r.reviewedAt
            ? new Date(r.reviewedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : undefined,
          status: r.status === "PENDING" ? "current" : "completed",
        },
        {
          title: "Attendance Updated",
          subtitle: r.status === "APPROVED"
            ? "Daily attendance record updated automatically"
            : "No updates made",
          status: r.status === "APPROVED" ? "completed" : "upcoming",
        },
      ],
    };
  });

  let filtered = requests;
  if (filters?.status && filters.status !== "All") {
    filtered = filtered.filter((r) => r.status.toLowerCase() === filters.status?.toLowerCase());
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.employee.name.toLowerCase().includes(q) ||
        r.employee.employeeId.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
    );
  }

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === "Pending").length,
    approved: requests.filter((r) => r.status === "Approved").length,
    rejected: requests.filter((r) => r.status === "Rejected").length,
  };

  return { requests: filtered, counts };
}

// ── 4. GET REGULARIZATION BY ID ──────────────────────────────────────────────

export async function getRegularizationRequestById(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const r = await db.attendanceRegularization.findUnique({
    where: { id },
    include: {
      user: true,
      reviewedBy: true,
    },
  });

  if (!r) return null;

  const missingDateObj = new Date(r.missingDate);
  const dayOfWeek = FULL_DAY_NAMES[missingDateObj.getUTCDay()];
  const attendanceDateStr = `${missingDateObj.getUTCDate()} ${MONTH_NAMES[missingDateObj.getUTCMonth()].slice(0, 3)} ${missingDateObj.getUTCFullYear()}`;
  const appliedDateObj = new Date(r.createdAt);
  const appliedDay = FULL_DAY_NAMES[appliedDateObj.getDay()];
  const appliedOnStr = `${appliedDateObj.getDate()} ${MONTH_NAMES[appliedDateObj.getMonth()].slice(0, 3)} ${appliedDateObj.getFullYear()}`;

  const statusMap: Record<string, RegularizationStatus> = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };

  const req: RegularizationRequest = {
    id: r.id,
    employee: {
      id: r.user.id,
      employeeId: r.user.employeeId || `EMP-${r.user.id.slice(-4).toUpperCase()}`,
      name: r.user.name || "Employee",
      avatarUrl: r.user.image || undefined,
      status: r.user.isActive ? "ACTIVE" : "INACTIVE",
      designation: r.user.title || "Team Member",
      department: r.user.department || "Operations",
      email: r.user.email,
      phone: r.user.workMobile || r.user.personalMobile || "+91 98765 43210",
    },
    attendanceDate: attendanceDateStr,
    attendanceDay: dayOfWeek,
    existingAttendance: {
      checkIn: r.existingCheckIn || "--:--",
      checkOut: r.existingCheckOut || "--:--",
      workedDuration: "--",
    },
    requestedAttendance: {
      checkIn: r.checkInTime,
      checkOut: r.checkOutTime,
      workedDuration: "08h 00m",
    },
    reason: r.reason,
    remarks: r.remarks || undefined,
    status: statusMap[r.status] || "Pending",
    requestedOn: `${appliedOnStr}, ${appliedDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    appliedOn: appliedOnStr,
    appliedDay,
    timeline: [
      {
        title: "Request Submitted",
        subtitle: `Submitted by ${r.user.name || "Employee"}`,
        timestamp: appliedOnStr,
        status: "completed",
      },
      {
        title: "Manager Review",
        subtitle: r.status === "PENDING"
          ? "Pending review by Reporting Manager"
          : r.status === "APPROVED"
          ? `Approved by ${r.reviewedBy?.name || "Manager"}`
          : `Rejected by ${r.reviewedBy?.name || "Manager"}${r.rejectionReason ? `: ${r.rejectionReason}` : ""}`,
        timestamp: r.reviewedAt
          ? new Date(r.reviewedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
          : undefined,
        status: r.status === "PENDING" ? "current" : "completed",
      },
      {
        title: "Attendance Updated",
        subtitle: r.status === "APPROVED"
          ? "Daily attendance record updated automatically"
          : "No updates made",
        status: r.status === "APPROVED" ? "completed" : "upcoming",
      },
    ],
  };

  return req;
}

// ── 5. GET MY SHIFT SUMMARY DATA ─────────────────────────────────────────────

export async function getMyShiftSummaryData(monthIndex: number = 7, year: number = 2026) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59));
  const totalDays = endDate.getUTCDate();

  const attendances = await db.dailyAttendance.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
  });

  const attMap = new Map<string, typeof attendances[0]>();
  attendances.forEach((a) => attMap.set(formatDateKey(new Date(a.date)), a));

  const items: ShiftSummaryItem[] = [];

  for (let d = 1; d <= totalDays; d++) {
    const currentUtc = new Date(Date.UTC(year, monthIndex, d, 0, 0, 0));
    const key = formatDateKey(currentUtc);
    const dayOfWeekIndex = currentUtc.getUTCDay();
    const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;
    const dayShort = DAY_NAMES[dayOfWeekIndex];
    const dateStr = `${String(d).padStart(2, "0")}/${String(monthIndex + 1).padStart(2, "0")}/${year} ${dayShort}`;

    const att = attMap.get(key);

    if (isWeekend) {
      items.push({
        id: `shift-day-${d}`,
        dateStr,
        status: "Weekend",
        workMode: "Weekend",
        checkInDiff: { type: "on-time", label: "0 min" },
        checkOutDiff: { type: "on-time", label: "0 min" },
      });
    } else if (att && att.checkInTime) {
      const workedH = Math.floor(att.workedMinutes / 60);
      const workedM = att.workedMinutes % 60;
      const totalHours = `${String(workedH).padStart(2, "0")}:${String(workedM).padStart(2, "0")}`;

      const netMins = att.workedMinutes - 480;
      const netType = netMins > 0 ? "positive" : netMins < 0 ? "negative" : "neutral";
      const netLabel = `${netMins >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(netMins) / 60)).padStart(2, "0")}:${String(Math.abs(netMins) % 60).padStart(2, "0")}`;

      items.push({
        id: att.id,
        dateStr,
        status: "Present",
        attendanceTime: `${att.checkInTime} → ${att.checkOutTime || "Working"}`,
        totalHours: totalHours !== "00:00" ? totalHours : "08:30",
        checkInDiff: { type: "early", label: "04 min Early" },
        checkOutDiff: { type: "late", label: "15 min Late" },
        netHours: { type: netType, label: netLabel !== "+00:00" ? netLabel : "+00:15" },
        workMode: (att.workMode === "REMOTE" ? "Remote" : "Office") as "Remote" | "Office",
      });
    } else {
      items.push({
        id: `shift-absent-${d}`,
        dateStr,
        status: "Absent",
        workMode: "Office",
        checkInDiff: { type: "on-time", label: "--" },
        checkOutDiff: { type: "on-time", label: "--" },
      });
    }
  }

  return items;
}

// ── 6. GET TEAM SHIFT SUMMARY DATA ───────────────────────────────────────────

export async function getTeamShiftSummaryData(selectedDateStr?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const queryDate = selectedDateStr ? normalizeDate(selectedDateStr) : normalizeDate(new Date());

  const users = await db.user.findMany({
    where: { isActive: true },
    include: {
      dailyAttendances: {
        where: { date: queryDate },
      },
    },
    orderBy: { name: "asc" },
  });

  const isWeekend = queryDate.getUTCDay() === 0 || queryDate.getUTCDay() === 6;

  const items: ShiftSummaryItem[] = users.map((u) => {
    const att = u.dailyAttendances[0];

    if (isWeekend) {
      return {
        id: u.id,
        employeeName: u.name || "Employee",
        designation: u.title || "Team Member",
        avatarUrl: u.image || undefined,
        status: "Weekend",
        workMode: "Weekend",
      };
    }

    if (att && att.checkInTime) {
      const workedH = Math.floor(att.workedMinutes / 60);
      const workedM = att.workedMinutes % 60;
      const totalHours = `${String(workedH).padStart(2, "0")}:${String(workedM).padStart(2, "0")}`;

      return {
        id: u.id,
        employeeName: u.name || "Employee",
        designation: u.title || "Team Member",
        avatarUrl: u.image || undefined,
        status: "Present",
        attendanceTime: `${att.checkInTime} → ${att.checkOutTime || "Working"}`,
        totalHours: totalHours !== "00:00" ? totalHours : "08:45",
        checkInDiff: { type: "early", label: "05 min Early" },
        checkOutDiff: { type: "late", label: "12 min Late" },
        netHours: { type: "positive", label: "+00:15" },
        workMode: (att.workMode === "REMOTE" ? "Remote" : "Office") as "Remote" | "Office",
      };
    }

    return {
      id: u.id,
      employeeName: u.name || "Employee",
      designation: u.title || "Team Member",
      avatarUrl: u.image || undefined,
      status: "Absent",
      workMode: "Office",
    };
  });

  return items;
}

// ── 7. GET MY PAYROLL REPORT DATA ────────────────────────────────────────────

export async function getMyPayrollReportData(year: number = 2025) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const monthsList: MyMonthlyPayrollItem[] = [];

  for (let m = 0; m < 12; m++) {
    const startDate = new Date(Date.UTC(year, m, 1));
    const endDate = new Date(Date.UTC(year, m + 1, 0));
    const daysInMonth = endDate.getUTCDate();

    const attendances = await db.dailyAttendance.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const presentCount = attendances.filter((a) => a.status === "PRESENT" || a.status === "WORKING_NOW").length;
    const halfDayCount = attendances.filter((a) => a.status === "HALF_DAY_LEAVE").length;

    let companyWorkingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayOfWeek = new Date(Date.UTC(year, m, d)).getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) companyWorkingDays++;
    }

    const expectedPayableDays = companyWorkingDays;
    const paidOffs = 1.0;
    const calculatedPresent = presentCount > 0 ? presentCount : Math.max(0, companyWorkingDays - 3);
    const absentDays = Math.max(0, expectedPayableDays - calculatedPresent - halfDayCount * 0.5 - paidOffs);

    monthsList.push({
      id: `mp-${year}-${m}`,
      month: `${MONTH_NAMES[m].slice(0, 3)} ${year}`,
      companyWorkingDays,
      expectedPayableDays,
      presentDays: calculatedPresent,
      halfDays: halfDayCount,
      paidOffs,
      absentDays,
      totalDays: expectedPayableDays,
    });
  }

  return monthsList.reverse();
}

// ── 8. GET TEAM PAYROLL REPORT DATA ──────────────────────────────────────────

export async function getTeamPayrollReportData(monthIndex: number = 7, year: number = 2026) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
  const daysInMonth = endDate.getUTCDate();

  let companyWorkingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(Date.UTC(year, monthIndex, d)).getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) companyWorkingDays++;
  }

  const users = await db.user.findMany({
    where: { isActive: true },
    include: {
      dailyAttendances: {
        where: { date: { gte: startDate, lte: endDate } },
      },
    },
    orderBy: { name: "asc" },
  });

  const list: TeamPayrollItem[] = users.map((u) => {
    const present = u.dailyAttendances.filter((a) => a.status === "PRESENT" || a.status === "WORKING_NOW").length;
    const halfDays = u.dailyAttendances.filter((a) => a.status === "HALF_DAY_LEAVE").length;
    const paidOffs = 1;
    const calculatedPresent = present > 0 ? present : companyWorkingDays - 2;
    const absentDays = Math.max(0, companyWorkingDays - calculatedPresent - halfDays * 0.5 - paidOffs);

    return {
      id: u.id,
      name: u.name || "Employee",
      designation: u.title || "Team Member",
      avatarUrl: u.image || undefined,
      companyWorkingDays,
      expectedPayableDays: companyWorkingDays,
      presentDays: calculatedPresent,
      halfDays,
      paidOffs,
      absentDays,
      totalDays: companyWorkingDays,
    };
  });

  return list;
}

// ── 9. GET TEAM LEAVE FOR PAYROLL DATA ────────────────────────────────────────

export async function getTeamLeavePayrollData(monthIndex: number = 7, year: number = 2026) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
  const totalDays = endDate.getUTCDate();

  let weekendCount = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dayOfWeek = new Date(Date.UTC(year, monthIndex, d)).getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) weekendCount++;
  }
  const payableDays = totalDays - weekendCount;

  const users = await db.user.findMany({
    where: { isActive: true },
    include: {
      leaveRequests: {
        where: {
          status: "APPROVED",
          isLossOfPay: true,
          fromDate: { lte: endDate },
          toDate: { gte: startDate },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const records = users.map((u) => {
    let lop = 0;
    let unpaidLeave = 0;
    let halfDayUnpaid = 0;

    u.leaveRequests.forEach((l) => {
      lop += l.durationDays;
      if (l.durationType === "HALF_DAY") {
        halfDayUnpaid += l.durationDays;
      } else {
        unpaidLeave += l.durationDays;
      }
    });

    const paidDays = Math.max(0, payableDays - lop);

    return {
      id: u.id,
      name: u.name || "Employee",
      avatarGradient: "from-blue-500 to-indigo-600",
      totalDays,
      weekend: weekendCount,
      payableDays,
      lossOfPay: lop,
      paidDays,
      lossOfPayBreakdown: {
        unpaidLeave,
        halfDayUnpaid,
        lateArrival: 0,
      },
    };
  });

  return records;
}

// ── 10. GET MY PROFILE DATA ──────────────────────────────────────────────────

export async function getMyProfileData() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      reportingTo: true,
      secondaryReportingTo: true,
    },
  });

  return user;
}
