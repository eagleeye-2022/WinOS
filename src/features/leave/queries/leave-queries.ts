"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ensureLeaveDataSeeded, ensureUserBalances } from "../actions/leave-seed";

export interface FormattedBalance {
  id: string;
  leaveTypeId: string;
  code: string;
  name: string;
  remainingDays: number;
  bookedDays: number;
  allocatedDays: number;
  unit: string;
  iconBgColor: string;
  iconTextColor: string;
  category: string;
  lossOfPayDays: number;
}

export interface FormattedLeaveRequest {
  id: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  leaveTypeIcon?: string;
  fromDate: string;
  toDate: string;
  fromDateDisplay: string;
  toDateDisplay: string;
  durationText: string;
  durationDays: number;
  durationType: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  appliedOn: string;
  appliedOnDateTime?: string;
  employee?: {
    id: string;
    name: string;
    empId: string;
    role: string;
    avatarUrl?: string;
    department?: string;
  };
  attachments?: {
    id: string;
    name: string;
    size: string;
    url: string;
  }[];
}

export interface FormattedCompensatoryRequest {
  id: string;
  employeeName: string;
  designation: string;
  avatarText: string;
  workDate: string;
  workDay: string;
  hoursWorked: string;
  duration: string;
  creditedDays: number;
  reason: string;
  expiryDate: string;
  daysRemainingText: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requestedOn: string;
  attachments?: {
    id: string;
    name: string;
    size: string;
  }[];
}

// ── 1. GET TRACKER DATA FOR LOGGED-IN USER ───────────────────────────────────

export async function getMyLeaveTrackerDataAction(year = new Date().getFullYear()) {
  await ensureLeaveDataSeeded();
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  await ensureUserBalances(userId, year);

  // 1. Fetch balances
  const userBalances = await db.userLeaveBalance.findMany({
    where: { userId, year },
    include: { leaveType: true },
    orderBy: { leaveType: { name: "asc" } },
  });

  const balances: FormattedBalance[] = userBalances.map((b) => ({
    id: b.id,
    leaveTypeId: b.leaveTypeId,
    code: b.leaveType.code,
    name: b.leaveType.name,
    remainingDays: b.allocatedDays + b.carriedForward + b.adjustedDays - b.bookedDays,
    bookedDays: b.bookedDays,
    allocatedDays: b.allocatedDays,
    unit: b.leaveType.allowHourly ? "Hour(s)" : "Day(s)",
    iconBgColor: b.leaveType.iconBgColor || "bg-primary/10 text-primary",
    iconTextColor: b.leaveType.iconTextColor || "text-primary",
    category: b.leaveType.category,
    lossOfPayDays: b.lossOfPayDays,
  }));

  // 2. Fetch my leave requests
  const requests = await db.leaveRequest.findMany({
    where: { userId },
    include: { leaveType: true, user: true, attachments: true },
    orderBy: { createdAt: "desc" },
  });

  const formattedRequests: FormattedLeaveRequest[] = requests.map((r) => {
    const fromStr = r.fromDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const toStr = r.toDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    return {
      id: r.id,
      leaveTypeCode: r.leaveType.code,
      leaveTypeName: `${r.leaveType.name} (${r.leaveType.code})`,
      leaveTypeIcon: r.leaveType.icon,
      fromDate: r.fromDate.toISOString().split("T")[0],
      toDate: r.toDate.toISOString().split("T")[0],
      fromDateDisplay: fromStr,
      toDateDisplay: toStr,
      durationText:
        r.durationType === "HALF_DAY"
          ? `${r.durationDays} Day (${r.halfDayType === "FIRST_HALF" ? "First Half" : "Second Half"})`
          : r.durationType === "EARLY_LEAVE"
          ? `${r.fromTime || "04:30 PM"} - ${r.toTime || "06:30 PM"}`
          : `${r.durationDays} Day${r.durationDays > 1 ? "s" : ""}`,
      durationDays: r.durationDays,
      durationType: r.durationType,
      reason: r.reason,
      status: r.status as any,
      appliedOn: r.createdAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      appliedOnDateTime: `${r.createdAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })} at ${r.createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
      employee: {
        id: r.user.id,
        name: r.user.name || "Employee",
        empId: r.user.employeeId || "EMP001",
        role: r.user.title || "Team Member",
        avatarUrl: r.user.image || undefined,
        department: r.user.department || undefined,
      },
      attachments: r.attachments.map((att) => ({
        id: att.id,
        name: att.fileName,
        size: att.fileSize,
        url: att.fileUrl,
      })),
    };
  });

  // 3. Fetch my compensatory requests
  const compRequests = await db.compensatoryRequest.findMany({
    where: { userId },
    include: { user: true, attachments: true },
    orderBy: { createdAt: "desc" },
  });

  const formattedCompRequests: FormattedCompensatoryRequest[] = compRequests.map((c) => {
    const diffDays = Math.ceil(
      (c.expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      id: c.id,
      employeeName: c.user.name || "Employee",
      designation: c.user.title || "Team Member",
      avatarText: (c.user.name || "EM").slice(0, 2).toUpperCase(),
      workDate: c.workDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      workDay: c.workDate.toLocaleDateString("en-US", { weekday: "short" }),
      hoursWorked: `${c.fromTime} - ${c.toTime}\n${c.hoursWorked} Hours`,
      duration: c.duration === "FULL_DAY" ? "Full Day" : c.duration === "HALF_DAY" ? "Half Day" : "Quarter Day",
      creditedDays: c.creditedDays,
      reason: c.reason,
      expiryDate: c.expiryDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      daysRemainingText: diffDays > 0 ? `(in ${diffDays} days)` : "(Expired)",
      status: c.status as any,
      requestedOn: c.createdAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      attachments: c.attachments.map((a) => ({
        id: a.id,
        name: a.fileName,
        size: a.fileSize,
      })),
    };
  });

  // 4. Action Required items (attendance regularizations)
  const actionRequired = await db.attendanceRegularization.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { missingDate: "desc" },
  });

  const formattedActionRequired = actionRequired.map((a) => ({
    id: a.id,
    date: a.missingDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    dayOfWeek: a.missingDate.toLocaleDateString("en-US", { weekday: "long" }),
    issue: a.issueDescription,
  }));

  // Stats
  const totalBookedThisYear = userBalances.reduce((acc, b) => acc + b.bookedDays, 0);
  const totalAbsentDays = userBalances.reduce((acc, b) => acc + b.lossOfPayDays, 0);

  return {
    balances,
    requests: formattedRequests,
    compensatoryRequests: formattedCompRequests,
    actionRequiredItems: formattedActionRequired,
    stats: {
      bookedThisYear: totalBookedThisYear,
      absentDays: totalAbsentDays,
    },
  };
}

// ── 2. GET ALL TEAM REQUESTS (MANAGER VIEW) ──────────────────────────────────

export async function getTeamLeaveRequestsAction(filters?: {
  search?: string;
  status?: string;
  leaveTypeCode?: string;
  department?: string;
}) {
  await ensureLeaveDataSeeded();
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const whereClause: any = {};

  if (filters?.status && filters.status !== "ALL") {
    whereClause.status = filters.status;
  }
  if (filters?.leaveTypeCode && filters.leaveTypeCode !== "ALL") {
    whereClause.leaveType = { code: filters.leaveTypeCode };
  }
  if (filters?.department && filters.department !== "ALL") {
    whereClause.user = { department: filters.department };
  }
  if (filters?.search) {
    whereClause.user = {
      ...whereClause.user,
      name: { contains: filters.search, mode: "insensitive" },
    };
  }

  const requests = await db.leaveRequest.findMany({
    where: whereClause,
    include: { leaveType: true, user: true, attachments: true, approvalSteps: true },
    orderBy: { createdAt: "desc" },
  });

  const formattedRequests = requests.map((r) => ({
    id: r.id,
    employeeName: r.user.name || "Employee",
    department: r.user.department || "General",
    avatarText: (r.user.name || "EM").slice(0, 2).toUpperCase(),
    leaveType: `${r.leaveType.name} (${r.leaveType.code})`,
    leaveTypeCode: r.leaveType.code,
    duration:
      r.durationType === "HALF_DAY"
        ? `${r.durationDays} Day`
        : r.durationType === "EARLY_LEAVE"
        ? "-"
        : `${r.durationDays} Day${r.durationDays > 1 ? "s" : ""}`,
    dateTime:
      r.durationType === "EARLY_LEAVE"
        ? `${r.fromTime || "04:30 PM"} - ${r.toTime || "06:30 PM"}`
        : `${r.fromDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${r.toDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
    reason: r.reason,
    status: r.status as any,
    appliedOn: r.createdAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  }));

  // Counts for metric cards
  const pendingCount = await db.leaveRequest.count({ where: { status: "PENDING" } });
  const approvedCount = await db.leaveRequest.count({ where: { status: "APPROVED" } });
  const rejectedCount = await db.leaveRequest.count({ where: { status: "REJECTED" } });
  const cancelledCount = await db.leaveRequest.count({ where: { status: "CANCELLED" } });
  const totalCount = await db.leaveRequest.count();

  return {
    requests: formattedRequests,
    metrics: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      cancelled: cancelledCount,
      total: totalCount,
    },
  };
}

// ── 3. GET TEAM COMPENSATORY REQUESTS (MANAGER VIEW) ─────────────────────────

export async function getTeamCompensatoryRequestsAction(filters?: {
  search?: string;
  status?: string;
}) {
  await ensureLeaveDataSeeded();
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const whereClause: any = {};
  if (filters?.status && filters.status !== "ALL") {
    whereClause.status = filters.status;
  }
  if (filters?.search) {
    whereClause.user = {
      name: { contains: filters.search, mode: "insensitive" },
    };
  }

  const compRequests = await db.compensatoryRequest.findMany({
    where: whereClause,
    include: { user: true, attachments: true },
    orderBy: { createdAt: "desc" },
  });

  const formatted = compRequests.map((c) => ({
    id: c.id,
    employeeName: c.user.name || "Employee",
    designation: c.user.title || "Team Member",
    avatarText: (c.user.name || "EM").slice(0, 2).toUpperCase(),
    workDate: c.workDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    workDay: c.workDate.toLocaleDateString("en-US", { weekday: "short" }),
    hoursWorked: `${c.fromTime} - ${c.toTime}\n${c.hoursWorked} Hours`,
    duration: c.duration === "FULL_DAY" ? "Full Day" : c.duration === "HALF_DAY" ? "Half Day" : "Quarter Day",
    reason: c.reason,
    status: c.status as any,
    requestedOn: c.createdAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  }));

  const pending = await db.compensatoryRequest.count({ where: { status: "PENDING" } });
  const approved = await db.compensatoryRequest.count({ where: { status: "APPROVED" } });
  const rejected = await db.compensatoryRequest.count({ where: { status: "REJECTED" } });
  const cancelled = await db.compensatoryRequest.count({ where: { status: "CANCELLED" } });
  const total = await db.compensatoryRequest.count();

  return {
    requests: formatted,
    metrics: { pending, approved, rejected, cancelled, total },
  };
}

// ── 4. GET LEAVE TYPES & POLICIES ────────────────────────────────────────────

export async function getLeaveTypesAction() {
  await ensureLeaveDataSeeded();
  const types = await db.leaveType.findMany({
    orderBy: { name: "asc" },
  });

  const total = types.length;
  const active = types.filter((t) => t.isActive).length;
  const inactive = total - active;
  const paid = types.filter((t) => t.category === "PAID").length;
  const unpaid = types.filter((t) => t.category === "UNPAID").length;

  return {
    leaveTypes: types.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      description: t.description || "",
      category: t.category === "PAID" ? "Paid Leave" : "Unpaid Leave",
      unit: t.allowHourly ? "Hour(s)" : "Day(s)",
      entitlement: `${t.annualEntitlement} ${t.allowHourly ? "hours" : "days"} / ${t.allocationFrequency === "MONTHLY" ? "month" : "Year"}`,
      isActive: t.isActive,
      iconBg: t.iconBgColor || "bg-primary/10 text-primary",
      iconText: t.iconTextColor || "text-primary",
      iconEmoji: t.icon === "Calendar" ? "🗓️" : t.icon === "Heart" ? "🩺" : t.icon === "Plane" ? "🏖️" : t.icon === "Baby" ? "🤱" : "⏱️",
    })),
    metrics: { total, active, inactive, paid, unpaid },
  };
}

// ── 5. GET HOLIDAYS ──────────────────────────────────────────────────────────

export async function getHolidaysAction(year = 2025) {
  await ensureLeaveDataSeeded();
  const holidays = await db.holiday.findMany({
    where: { year },
    orderBy: { date: "asc" },
  });

  const now = new Date();
  const total = holidays.length;
  const upcoming = holidays.filter((h) => h.date >= now).length;
  const passed = holidays.filter((h) => h.date < now).length;
  const special = holidays.filter((h) => h.type === "COMPANY_SPECIAL" || h.type === "OPTIONAL").length;

  return {
    holidays: holidays.map((h) => ({
      id: h.id,
      name: h.name,
      date: h.date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      dayOfWeek: h.dayOfWeek,
      type: h.type as any,
      description: h.description || "",
    })),
    metrics: { total, upcoming, passed, special },
  };
}

// ── 6. GET EMPLOYEES FOR BALANCE ADJUSTMENT ──────────────────────────────────

export async function getEmployeesForAdjustmentAction() {
  await ensureLeaveDataSeeded();
  const users = await db.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      employeeId: true,
      department: true,
      title: true,
      image: true,
      userLeaveBalances: {
        include: { leaveType: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name || "Employee",
    empId: u.employeeId || "EMP001",
    role: u.title || "Team Member",
    department: u.department || "General",
    avatarUrl: u.image || undefined,
    balances: u.userLeaveBalances.map((b) => ({
      id: b.id,
      leaveTypeId: b.leaveTypeId,
      leaveTypeCode: b.leaveType.code,
      leaveTypeName: b.leaveType.name,
      allocated: b.allocatedDays,
      booked: b.bookedDays,
      adjusted: b.adjustedDays,
      available: b.allocatedDays + b.carriedForward + b.adjustedDays - b.bookedDays,
      unit: "Days",
    })),
  }));
}
