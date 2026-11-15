"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { loadAttendanceRange } from "@/features/attendance/attendance-data";
import { addDaysToKey, employeeCode, formatShortDate, fullDayName, istDateKey } from "@/features/attendance/utils";
import { accruedAllocation, checkEligibility } from "../leave-rules";
import { effectiveAvailable } from "../balance";
import { canManageAttendance } from "@/features/attendance/utils";
import { canManageUser, managedUserIds, scopeWhere } from "@/features/attendance/team-scope";
import { approverIdsFor, loadRequester, type ApproverRole } from "../approval-flow";

/** Fresh role data for the signed-in user (the JWT may be stale). */
async function currentViewer(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, profileRole: true, isActive: true },
  });
  return user?.isActive ? user : null;
}

/** Manager-only reads: the viewer plus the people they're responsible for (null = everyone). */
async function requireLeaveManager() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const viewer = await currentViewer(session.user.id);
  if (!viewer || !canManageAttendance(viewer)) throw new Error("Forbidden");
  return { viewer, scope: await managedUserIds(viewer) };
}

/**
 * A manager's approval queue: the people they manage, minus their own requests (those go to
 * someone else — nobody approves their own).
 */
function teamQueueWhere(viewerId: string, scope: Set<string> | null) {
  return { userId: scope === null ? { not: viewerId } : { in: [...scope].filter((id) => id !== viewerId) } };
}

/**
 * Who a still-pending step is waiting on, by name — "Asha Rao", "Asha Rao, Vikram S" or
 * "Any manager" — instead of just the role. One lookup per role per requester.
 */
function pendingApproverNames(userId: string) {
  const cache = new Map<string, Promise<string | null>>();
  return (role: string | null): Promise<string | null> => {
    const key = role || "Reporting Manager";
    if (!cache.has(key)) {
      cache.set(
        key,
        (async () => {
          const requester = await loadRequester(userId);
          if (!requester) return null;
          const ids = await approverIdsFor(key as ApproverRole, requester);
          if (ids.length === 0) return null;
          if (ids.length > 2) return key === "HR Admin" ? "Any admin" : "Any manager";
          const users = await db.user.findMany({ where: { id: { in: ids } }, select: { name: true, email: true } });
          return users.map((u) => u.name || u.email).join(", ") || null;
        })().catch(() => null)
      );
    }
    return cache.get(key)!;
  };
}

const ACTION_LOOKBACK_DAYS = 30;

/** Older rows point at a placeholder link because no file was ever saved for them — nothing to show. */
function realAttachments<T extends { fileUrl: string }>(attachments: T[]): T[] {
  return attachments.filter((a) => !a.fileUrl.startsWith("/placeholder-"));
}

export interface FormattedBalance {
  id: string;
  leaveTypeId: string;
  code: string;
  name: string;
  remainingDays: number;
  bookedDays: number;
  allocatedDays: number;
  unit: string;
  iconName?: string;
  iconBgColor: string;
  iconTextColor: string;
  category: string;
  lossOfPayDays: number;
  /** Leave type set to "Remaining balance only": the person sees what's left, not what's booked. */
  hideBooked?: boolean;
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
  approvalFlow?: {
    id: string;
    title: string;
    actorName: string;
    actorRole?: string;
    dateStr?: string;
    status: "COMPLETED" | "PENDING" | "REJECTED";
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

/**
 * People the signed-in user can apply leave for besides themselves: everyone they manage (managers),
 * nobody otherwise. Internal staff only, sorted by name.
 */
export async function getLeaveApplicantOptionsAction(): Promise<{ id: string; name: string }[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const viewer = await currentViewer(session.user.id);
  if (!viewer || !canManageAttendance(viewer)) return [];
  const scope = await managedUserIds(viewer);
  const users = await db.user.findMany({
    where: {
      isActive: true,
      id: { not: viewer.id },
      OR: [{ profileRole: null }, { profileRole: { not: "CLIENT" } }],
      ...scopeWhere(scope, "id"),
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.name || u.email }));
}

/** `forUserId` (managers only): another employee's balances and requests, to apply leave on their behalf. */
export async function getMyLeaveTrackerDataAction(year = new Date().getFullYear(), forUserId?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  let userId = session.user.id;
  if (forUserId && forUserId !== userId) {
    const viewer = await currentViewer(userId);
    if (!viewer || !(await canManageUser(viewer, forUserId))) throw new Error("Forbidden");
    userId = forUserId;
  }

  // Balances as of today for the current year, as of year end for a past year.
  const nowKey = istDateKey();
  const asOfKey = String(year) === nowKey.slice(0, 4) ? nowKey : `${year}-12-31`;

  // Who this is — leave types are only shown to the people they're for (department, employment
  // type, service period…), and "Hide in self service" types only when a manager applies for them.
  const facts = await db.user.findUnique({
    where: { id: userId },
    select: { department: true, employmentType: true, profileRole: true, dateOfJoining: true, dateOfConfirmation: true },
  });
  const selfView = userId === session.user.id;
  const visibleTo = (t: { employeeVisibility: string }) => !(selfView && t.employeeVisibility === "HIDE_IN_SELF_SERVICE");
  const eligible = (t: Parameters<typeof checkEligibility>[0]) => !facts || checkEligibility(t, facts, asOfKey) === null;

  // 1. Fetch balances. A balance row exists for every type at creation, so filter here too: a person
  // only sees (and can apply for) the leave types that apply to them. Requests already made on a type
  // that no longer applies still show in their request list below, where they can be viewed / cancelled.
  const userBalances = (
    await db.userLeaveBalance.findMany({
      where: { userId, year },
      include: { leaveType: true },
      orderBy: { leaveType: { name: "asc" } },
    })
  ).filter((b) => eligible(b.leaveType) && visibleTo(b.leaveType));
  const available = await Promise.all(
    userBalances.map((b) => effectiveAvailable(db, { userId, type: b.leaveType, balance: b, onKey: asOfKey }))
  );

  const balances: FormattedBalance[] = userBalances.map((b, i) => ({
    id: b.id,
    leaveTypeId: b.leaveTypeId,
    code: b.leaveType.code,
    name: b.leaveType.name,
    // What can still be applied for (accrual, pending requests, comp-off expiry) — same as applying.
    remainingDays: available[i],
    bookedDays: b.bookedDays,
    allocatedDays: b.allocatedDays,
    unit: "Day(s)", // balances are always kept in days (allowHourly only allows hourly requests)
    iconName: b.leaveType.icon,
    iconBgColor: b.leaveType.iconBgColor || "bg-primary/10 text-primary",
    iconTextColor: b.leaveType.iconTextColor || "text-primary",
    category: b.leaveType.category,
    lossOfPayDays: b.lossOfPayDays,
    // "Remaining balance only" leave types don't show the booked figure to the person themselves.
    hideBooked: selfView && b.leaveType.employeeVisibility === "REMAINING_BALANCE_ONLY",
  }));

  // Balance rows are only created on first use, so also list the active leave types this person can
  // use but hasn't touched this year — otherwise a new user has nothing to apply for.
  const unopenedTypes = await db.leaveType.findMany({
    where: { isActive: true, id: { notIn: userBalances.map((b) => b.leaveTypeId) } },
  });
  for (const t of unopenedTypes) {
    // Types filtered out of userBalances above come back in this list too; the same check skips them.
    if (!eligible(t) || !visibleTo(t)) continue;
    const isComp = t.code === "COMP"; // only credited by approved comp-offs
    balances.push({
      id: `type-${t.id}`,
      leaveTypeId: t.id,
      code: t.code,
      name: t.name,
      remainingDays: isComp ? 0 : accruedAllocation(t.allocationFrequency, t.annualEntitlement, t.annualEntitlement, asOfKey),
      bookedDays: 0,
      allocatedDays: isComp ? 0 : t.annualEntitlement,
      unit: "Day(s)",
      iconName: t.icon,
      iconBgColor: t.iconBgColor || "bg-primary/10 text-primary",
      iconTextColor: t.iconTextColor || "text-primary",
      category: t.category,
      lossOfPayDays: 0,
      hideBooked: selfView && t.employeeVisibility === "REMAINING_BALANCE_ONLY",
    });
  }
  balances.sort((a, b) => a.name.localeCompare(b.name));

  // 2. Fetch my leave requests
  const requests = await db.leaveRequest.findMany({
    where: { userId },
    include: {
      leaveType: true,
      user: true,
      attachments: true,
      approvalSteps: { orderBy: { stepOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Name the people a pending step is waiting on (one lookup per role).
  const namesFor = pendingApproverNames(userId);
  const pendingRoles = [
    ...new Set(
      requests.flatMap((r) =>
        r.approvalSteps.filter((s) => s.status === "PENDING" && !s.approverName).map((s) => s.approverRole || "Reporting Manager")
      )
    ),
  ];
  const pendingNames = new Map(await Promise.all(pendingRoles.map(async (role) => [role, await namesFor(role)] as const)));

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        name: r.user.name || "Team Member",
        empId: employeeCode(r.user.employeeId, r.user.id),
        role: r.user.title || "Team Member",
        avatarUrl: r.user.image || undefined,
        department: r.user.department || undefined,
      },
      attachments: realAttachments(r.attachments).map((att) => ({
        id: att.id,
        name: att.fileName,
        size: att.fileSize,
        url: att.fileUrl,
      })),
      approvalFlow: r.approvalSteps
        .filter((s) => s.approverRole !== "HR Admin" && !s.stepName.toLowerCase().includes("hr"))
        .map((s) => ({
          id: s.id,
          title: s.stepName,
          actorName:
            s.approverName ||
            (s.approverRole === "Applicant"
              ? r.user.name || "Team Member"
              : pendingNames.get(s.approverRole || "Reporting Manager") || s.approverRole || "Approver"),
          actorRole: s.approverRole || undefined,
          dateStr: s.actionDate
            ? `${s.actionDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at ${s.actionDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
            : undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: s.status as any,
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
      employeeName: c.user.name || "Team Member",
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: c.status as any,
      requestedOn: c.createdAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      attachments: realAttachments(c.attachments).map((a) => ({
        id: a.id,
        name: a.fileName,
        size: a.fileSize,
        url: a.fileUrl,
      })),
    };
  });

  // 4. Action Required items — the same unexplained working days the attendance page flags,
  //    over the last ACTION_LOOKBACK_DAYS, so the employee can regularize or apply leave here too.
  const todayKey = istDateKey();
  const lookbackStart = addDaysToKey(todayKey, -ACTION_LOOKBACK_DAYS);
  const lookbackKeys: string[] = [];
  for (let k = lookbackStart; k < todayKey; k = addDaysToKey(k, 1)) lookbackKeys.push(k);
  // The year's days so far (up to yesterday) — for the "Absent" figure below.
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31` < todayKey ? `${year}-12-31` : addDaysToKey(todayKey, -1);
  const yearKeys: string[] = [];
  for (let k = yearStart; k <= yearEnd; k = addDaysToKey(k, 1)) yearKeys.push(k);
  // One load covers both ranges.
  const rangeStart = yearStart < lookbackStart ? yearStart : lookbackStart;
  const attendanceRange = await loadAttendanceRange([userId], rangeStart, todayKey > yearEnd ? todayKey : yearEnd);

  const formattedActionRequired = attendanceRange
    .daysFor(userId, lookbackKeys)
    .filter((d) => d.resolved.action)
    .reverse()
    .map((d) => ({
      id: `act-${d.key}`,
      date: formatShortDate(d.key),
      dateKey: d.key,
      dayOfWeek: fullDayName(d.key),
      issue: d.resolved.action!.issue,
    }));

  // Stats
  const totalBookedThisYear = userBalances.reduce((acc, b) => acc + b.bookedDays, 0);
  // Absent = working days with no attendance and no leave, from the same day resolver Home's
  // "Loss of pay" card and payroll use (balance lossOfPayDays only covers leave over the balance,
  // so it read 0 for plain absences).
  const totalAbsentDays =
    Math.round(attendanceRange.daysFor(userId, yearKeys).reduce((acc, d) => acc + d.resolved.absent, 0) * 100) / 100;

  // A manager may review someone else's requests here (applying on their behalf) — never their own.
  const signedIn = await currentViewer(session.user.id);
  return {
    currentUserId: userId,
    canReview: canManageAttendance(signedIn) && userId !== session.user.id,
    /** The signed-in person is a manager — managers may approve their own pending leave. */
    isManager: canManageAttendance(signedIn),
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
  const { viewer, scope } = await requireLeaveManager();
  // All Leave Requests lists everyone the manager can see *and* the manager's own requests, so the
  // whole picture is in one place. Own rows come back flagged `isOwn`: a manager may approve their
  // own leave, but not reject it (they cancel it instead).
  const team = scope === null ? {} : { userId: { in: [...new Set([...scope, viewer.id])] } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = { ...team };

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
    /** The viewer's own request — they may approve it, not reject it. */
    isOwn: r.userId === viewer.id,
    employeeName: r.user.name || "Team Member",
    department: r.user.department || "General",
    avatarText: (r.user.name || "EM").slice(0, 2).toUpperCase(),
    leaveType: `${r.leaveType.name} (${r.leaveType.code})`,
    leaveTypeCode: r.leaveType.code,
    /** "YYYY-MM-DD" — for the month filter. */
    fromKey: r.fromDate.toISOString().slice(0, 10),
    toKey: r.toDate.toISOString().slice(0, 10),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: r.status as any,
    appliedOn: r.createdAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  }));

  // Counts for metric cards
  const pendingCount = await db.leaveRequest.count({ where: { ...team, status: "PENDING" } });
  const approvedCount = await db.leaveRequest.count({ where: { ...team, status: "APPROVED" } });
  const rejectedCount = await db.leaveRequest.count({ where: { ...team, status: "REJECTED" } });
  const cancelledCount = await db.leaveRequest.count({ where: { ...team, status: "CANCELLED" } });
  const totalCount = await db.leaveRequest.count({ where: team });

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
  const { viewer, scope } = await requireLeaveManager();
  const team = teamQueueWhere(viewer.id, scope);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = { ...team };
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
    employeeName: c.user.name || "Team Member",
    designation: c.user.title || "Team Member",
    avatarText: (c.user.name || "EM").slice(0, 2).toUpperCase(),
    workDate: c.workDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    workDay: c.workDate.toLocaleDateString("en-US", { weekday: "short" }),
    /** "YYYY-MM-DD" — for the month filter. */
    workKey: c.workDate.toISOString().slice(0, 10),
    department: c.user.department || "General",
    hoursWorked: `${c.fromTime} - ${c.toTime}\n${c.hoursWorked} Hours`,
    duration: c.duration === "FULL_DAY" ? "Full Day" : c.duration === "HALF_DAY" ? "Half Day" : "Quarter Day",
    reason: c.reason,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: c.status as any,
    requestedOn: c.createdAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  }));

  const pending = await db.compensatoryRequest.count({ where: { ...team, status: "PENDING" } });
  const approved = await db.compensatoryRequest.count({ where: { ...team, status: "APPROVED" } });
  const rejected = await db.compensatoryRequest.count({ where: { ...team, status: "REJECTED" } });
  const cancelled = await db.compensatoryRequest.count({ where: { ...team, status: "CANCELLED" } });
  const total = await db.compensatoryRequest.count({ where: team });

  return {
    requests: formatted,
    metrics: { pending, approved, rejected, cancelled, total },
  };
}

/**
 * One comp-off for its detail page: the requester sees it read-only; a manager responsible for
 * them can also review it. Anyone else gets null.
 */
export async function getCompensatoryRequestByIdAction(requestId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const c = await db.compensatoryRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { select: { name: true, title: true, employeeId: true } },
      attachments: true,
      approvalSteps: { orderBy: { stepOrder: "asc" } },
    },
  });
  if (!c) return null;

  // Managers review other people's comp-offs; everyone sees their own read-only (no self-approval).
  const own = c.userId === session.user.id;
  const viewer = own ? null : await currentViewer(session.user.id);
  const canReview = Boolean(viewer && (await canManageUser(viewer, c.userId)));
  if (!own && !canReview) return null;

  // Calendar dates are stored as UTC midnight; timestamps are shown in IST.
  const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const stamp = (d: Date) =>
    `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })} at ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}`;
  const daysLeft = Math.ceil((c.expiryDate.getTime() - Date.now()) / 86_400_000);

  return {
    id: c.id,
    canReview,
    employeeName: c.user.name || "Team Member",
    employeeCode: employeeCode(c.user.employeeId, c.userId),
    designation: c.user.title || "Team Member",
    avatarText: (c.user.name || "EM").slice(0, 2).toUpperCase(),
    workDate: day(c.workDate),
    workDayOfWeek: c.workDate.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    fromTime: c.fromTime,
    toTime: c.toTime,
    durationText: c.duration === "FULL_DAY" ? "Full Day" : c.duration === "HALF_DAY" ? "Half Day" : "Quarter Day",
    creditedDays: c.creditedDays,
    reason: c.reason,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: c.status as any,
    requestedOn: stamp(c.createdAt),
    expiryDate: `${day(c.expiryDate)} ${daysLeft > 0 ? `(in ${daysLeft} days)` : "(Expired)"}`,
    attachments: realAttachments(c.attachments).map((a) => ({ id: a.id, name: a.fileName, size: a.fileSize, url: a.fileUrl })),
    approvalSteps: c.approvalSteps.map((s) => ({
      id: s.id,
      title: s.stepName,
      actorName: s.approverName || s.approverRole || "",
      dateStr: s.actionDate ? stamp(s.actionDate) : undefined,
      status: s.status as string,
    })),
  };
}

// ── 4. GET LEAVE TYPES & POLICIES ────────────────────────────────────────────

/**
 * Active leave types the signed-in user can apply for on `dateKey`, with what they can still apply
 * against in that year (used by the quick Apply Leave popup on attendance / home).
 */
export async function getApplicableLeaveTypesAction(dateKey: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const year = Number((dateKey || istDateKey()).slice(0, 4)) || Number(istDateKey().slice(0, 4));

  const userId = session.user.id;
  const onKey = dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : istDateKey();
  const [types, balances, facts] = await Promise.all([
    db.leaveType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.userLeaveBalance.findMany({ where: { userId: session.user.id, year } }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { department: true, employmentType: true, profileRole: true, dateOfJoining: true, dateOfConfirmation: true },
    }),
  ]);
  const byType = new Map(balances.map((b) => [b.leaveTypeId, b]));

  // The person's own quick-apply list: eligible types only, minus "Hide in self service" ones.
  const usable = types.filter(
    (t) =>
      (t.allowFullDay || t.allowHalfDay) &&
      t.employeeVisibility !== "HIDE_IN_SELF_SERVICE" &&
      (!facts || checkEligibility(t, facts, onKey) === null)
  );
  return Promise.all(
    usable.map(async (t) => {
      const b = byType.get(t.id);
      return {
        code: t.code,
        name: t.name,
        allowFullDay: t.allowFullDay,
        allowHalfDay: t.allowHalfDay,
        // Same figure the apply action checks against (accrual, pending days, comp-off expiry).
        // No balance row yet → applying opens one with the yearly entitlement.
        available: b
          ? await effectiveAvailable(db, { userId, type: t, balance: b, onKey })
          : t.code === "COMP"
          ? 0
          : accruedAllocation(t.allocationFrequency, t.annualEntitlement, t.annualEntitlement, onKey),
      };
    })
  );
}

export async function getLeaveTypesAction() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

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
      unit: "Day(s)",
      entitlement: `${t.annualEntitlement} days / ${t.allocationFrequency === "MONTHLY" ? "month" : t.allocationFrequency === "QUARTERLY" ? "quarter" : "year"}`,
      isActive: t.isActive,
      /** Who this type is for, as saved — e.g. ["Employment: Intern", "Dept: Sales"]; empty = everyone. */
      appliesTo: [
        ...(t.employmentTypes.length ? [`Employment: ${t.employmentTypes.join(", ")}`] : []),
        ...(t.departments.length ? [`Dept: ${t.departments.join(", ")}`] : []),
        ...(t.applicableTo === "FULL_TIME_ONLY"
          ? ["Full-time only"]
          : t.applicableTo === "PROBATIONARY"
          ? ["On probation"]
          : t.applicableTo === "CONTRACTORS"
          ? ["Contractors"]
          : []),
        ...(t.minServicePeriod ? [`After ${t.minServicePeriod} ${t.minServiceUnit.toLowerCase()} of service`] : []),
        ...(t.employeeVisibility === "HIDE_IN_SELF_SERVICE" ? ["Manager applies on their behalf"] : []),
      ],
      icon: t.icon,
      iconBg: t.iconBgColor || "bg-primary/10 text-primary",
      iconText: t.iconTextColor || "text-primary",
      iconEmoji: t.icon === "Calendar" ? "🗓️" : t.icon === "Heart" ? "🩺" : t.icon === "Plane" ? "🏖️" : t.icon === "Baby" ? "🤱" : "⏱️",
    })),
    metrics: { total, active, inactive, paid, unpaid },
  };
}

// ── 5. GET HOLIDAYS ──────────────────────────────────────────────────────────

export async function getHolidaysAction(year = Number(istDateKey().slice(0, 4))) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: h.type as any,
      description: h.description || "",
    })),
    metrics: { total, upcoming, passed, special },
  };
}

// ── 6. GET EMPLOYEES FOR BALANCE ADJUSTMENT ──────────────────────────────────

export async function getEmployeesForAdjustmentAction() {
  const { viewer, scope } = await requireLeaveManager();
  const year = Number(istDateKey().slice(0, 4));
  const [users, allLeaveTypes] = await Promise.all([
    db.user.findMany({
      // Nobody adjusts their own balance; project clients don't take leave.
      where: {
        isActive: true,
        id: { not: viewer.id },
        OR: [{ profileRole: null }, { profileRole: { not: "CLIENT" } }],
        ...scopeWhere(scope, "id"),
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        department: true,
        title: true,
        image: true,
        userLeaveBalances: {
          where: { year },
          include: { leaveType: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return users.map((u) => {
    const balanceMap = new Map(u.userLeaveBalances.map((b) => [b.leaveTypeId, b]));

    const balances = allLeaveTypes.map((t) => {
      const b = balanceMap.get(t.id);
      if (b) {
        return {
          id: b.id,
          leaveTypeId: t.id,
          leaveTypeCode: t.code,
          leaveTypeName: t.name,
          allocated: b.allocatedDays,
          booked: b.bookedDays,
          adjusted: b.adjustedDays,
          available: b.allocatedDays + b.carriedForward + b.adjustedDays - b.bookedDays,
          unit: "Days",
        };
      }
      // No row yet: adjusting opens one with the yearly entitlement (comp-off starts at 0).
      const opening = t.code === "COMP" ? 0 : t.annualEntitlement;
      return {
        id: `virtual-${t.id}`,
        leaveTypeId: t.id,
        leaveTypeCode: t.code,
        leaveTypeName: t.name,
        allocated: opening,
        booked: 0,
        adjusted: 0,
        available: opening,
        unit: "Days",
      };
    });

    return {
      id: u.id,
      name: u.name || "Team Member",
      empId: employeeCode(u.employeeId, u.id),
      role: u.title || "Team Member",
      department: u.department || "General",
      avatarUrl: u.image || undefined,
      balances,
    };
  });
}

// ── 7. GET SINGLE LEAVE REQUEST DETAILS BY ID ────────────────────────────────

export async function getLeaveRequestByIdAction(requestId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const request = await db.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      leaveType: true,
      user: {
        include: {
          userLeaveBalances: {
            where: { year: new Date().getFullYear() },
            include: { leaveType: true },
          },
        },
      },
      attachments: true,
      approvalSteps: {
        orderBy: { stepOrder: "asc" },
      },
    },
  });

  if (!request) return null;
  // Only the requester, or a manager responsible for them, may open a request.
  if (request.userId !== session.user.id) {
    const viewer = await currentViewer(session.user.id);
    if (!viewer || !(await canManageUser(viewer, request.userId))) return null;
  }

  const fromStr = request.fromDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const toStr = request.toDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const namesFor = pendingApproverNames(request.userId);
  const pendingRoles = [
    ...new Set(
      request.approvalSteps
        .filter((s) => s.status === "PENDING" && !s.approverName)
        .map((s) => s.approverRole || "Reporting Manager")
    ),
  ];
  const pendingNames = new Map(await Promise.all(pendingRoles.map(async (role) => [role, await namesFor(role)] as const)));

  const formattedRequest: FormattedLeaveRequest = {
    id: request.id,
    leaveTypeCode: request.leaveType.code,
    leaveTypeName: `${request.leaveType.name} (${request.leaveType.code})`,
    leaveTypeIcon: request.leaveType.icon,
    fromDate: request.fromDate.toISOString().split("T")[0],
    toDate: request.toDate.toISOString().split("T")[0],
    fromDateDisplay: fromStr,
    toDateDisplay: toStr,
    durationText:
      request.durationType === "HALF_DAY"
        ? `${request.durationDays} Day (${request.halfDayType === "FIRST_HALF" ? "First Half" : "Second Half"})`
        : request.durationType === "EARLY_LEAVE"
        ? `${request.fromTime || "04:30 PM"} - ${request.toTime || "06:30 PM"}`
        : `${request.durationDays} Day${request.durationDays > 1 ? "s" : ""}`,
    durationDays: request.durationDays,
    durationType: request.durationType,
    reason: request.reason,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: request.status as any,
    appliedOn: request.createdAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    appliedOnDateTime: `${request.createdAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })} at ${request.createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`,
    employee: {
      id: request.user.id,
      name: request.user.name || "Team Member",
      empId: employeeCode(request.user.employeeId, request.user.id),
      role: request.user.title || "Team Member",
      avatarUrl: request.user.image || undefined,
      department: request.user.department || undefined,
    },
    attachments: realAttachments(request.attachments).map((att) => ({
      id: att.id,
      name: att.fileName,
      size: att.fileSize,
      url: att.fileUrl,
    })),
    approvalFlow: request.approvalSteps
      .filter((s) => s.approverRole !== "HR Admin" && !s.stepName.toLowerCase().includes("hr"))
      .map((s) => ({
        id: s.id,
        title: s.stepName,
        actorName:
          s.approverName ||
          (s.approverRole === "Applicant"
            ? request.user.name || "Team Member"
            : pendingNames.get(s.approverRole || "Reporting Manager") || s.approverRole || "Approver"),
        actorRole: s.approverRole || undefined,
        dateStr: s.actionDate
          ? `${s.actionDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at ${s.actionDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
          : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: s.status as any,
      })),
  };

  const userBalances = request.user.userLeaveBalances.map((b) => ({
    id: b.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code: b.leaveType.code as any,
    name: b.leaveType.name,
    remainingDays: b.allocatedDays + b.carriedForward + b.adjustedDays - b.bookedDays,
    bookedDays: b.bookedDays,
    unit: "Days",
    iconName: b.leaveType.icon,
    iconBgColor: b.leaveType.iconBgColor || "bg-primary/10 text-primary",
    iconTextColor: b.leaveType.iconTextColor || "text-primary",
  }));

  return {
    request: formattedRequest,
    balances: userBalances,
  };
}

// ── 8. GET TEAM CALENDAR EVENTS (DYNAMIC FOR SELECTED MONTH/YEAR) ─────────────

export async function getTeamCalendarEventsAction(year: number, month: number) {
  // Shows leave reasons, so it's limited to the manager's own team.
  const { scope } = await requireLeaveManager();

  // Calculate start and end of month
  const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

  // Fetch all leave requests that overlap with this month
  const leaveRequests = await db.leaveRequest.findMany({
    where: {
      ...scopeWhere(scope),
      status: { in: ["APPROVED", "PENDING"] },
      fromDate: { lte: endOfMonth },
      toDate: { gte: startOfMonth },
    },
    include: {
      user: true,
      leaveType: true,
    },
    orderBy: { fromDate: "asc" },
  });

  // Fetch holidays around this month
  const holidays = await db.holiday.findMany({
    where: {
      date: {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month + 2, 0),
      },
    },
    orderBy: { date: "asc" },
  });

  const uniqueEmployeeIds = new Set(leaveRequests.map((r) => r.userId));

  const leavesByDate: Record<string, {
    id: string;
    employeeName: string;
    employeeId: string;
    avatarText: string;
    avatarUrl?: string;
    role: string;
    department: string;
    leaveType: string;
    leaveTypeCode: string;
    leaveTypeIcon?: string;
    leaveTypeColor?: string;
    status: string;
    duration: string;
    durationDays: number;
    durationType: string;
    fromDateStr: string;
    toDateStr: string;
    dateRangeDisplay: string;
    reason: string;
    isHalfDay: boolean;
    halfDaySession?: string;
    fromTime?: string;
    toTime?: string;
  }[]> = {};

  for (const r of leaveRequests) {
    const from = new Date(Math.max(r.fromDate.getTime(), startOfMonth.getTime()));
    const to = new Date(Math.min(r.toDate.getTime(), endOfMonth.getTime()));

    const cur = new Date(from);
    while (cur <= to) {
      const dateKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      if (!leavesByDate[dateKey]) leavesByDate[dateKey] = [];

      const fromStr = r.fromDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const toStr = r.toDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const dateRangeDisplay = r.durationType === "HALF_DAY"
        ? `${fromStr} (${r.halfDayType === "FIRST_HALF" ? "First Half" : "Second Half"})`
        : r.durationType === "EARLY_LEAVE"
        ? `${fromStr} (${r.fromTime || "04:30 PM"} - ${r.toTime || "06:30 PM"})`
        : r.durationDays === 1
        ? `${fromStr} (1 Day)`
        : `${fromStr} - ${toStr} (${r.durationDays} Days)`;

      leavesByDate[dateKey].push({
        id: r.id,
        employeeName: r.user.name || "Team Member",
        employeeId: employeeCode(r.user.employeeId, r.user.id),
        avatarText: (r.user.name || "EM").slice(0, 2).toUpperCase(),
        avatarUrl: r.user.image || undefined,
        role: r.user.title || "Team Member",
        department: r.user.department || "General",
        leaveType: r.leaveType.name,
        leaveTypeCode: r.leaveType.code,
        leaveTypeIcon: r.leaveType.icon,
        leaveTypeColor: r.leaveType.iconBgColor || "bg-primary/10 text-primary",
        status: r.status,
        duration: `${r.durationDays} Day${r.durationDays > 1 ? "s" : ""}`,
        durationDays: r.durationDays,
        durationType: r.durationType,
        fromDateStr: r.fromDate.toISOString().split("T")[0],
        toDateStr: r.toDate.toISOString().split("T")[0],
        dateRangeDisplay,
        reason: r.reason,
        isHalfDay: r.durationType === "HALF_DAY",
        halfDaySession: r.halfDayType || undefined,
        fromTime: r.fromTime || undefined,
        toTime: r.toTime || undefined,
      });

      cur.setDate(cur.getDate() + 1);
    }
  }

  const holidaysByDate: Record<string, {
    id: string;
    name: string;
    type: "PUBLIC" | "OPTIONAL" | "COMPANY_SPECIAL";
    dayOfWeek: string;
    description?: string;
  }[]> = {};

  for (const h of holidays) {
    const d = new Date(h.date);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!holidaysByDate[dateKey]) holidaysByDate[dateKey] = [];
    holidaysByDate[dateKey].push({
      id: h.id,
      name: h.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: h.type as any,
      dayOfWeek: h.dayOfWeek,
      description: h.description || undefined,
    });
  }

  const monthHolidays = holidays.filter((h) => h.date >= startOfMonth && h.date <= endOfMonth);
  const publicHolidaysCount = monthHolidays.filter((h) => h.type === "PUBLIC").length;
  const specialHolidaysCount = monthHolidays.filter((h) => h.type === "COMPANY_SPECIAL" || h.type === "OPTIONAL").length;

  return {
    leavesByDate,
    holidaysByDate,
    metrics: {
      totalOnLeave: uniqueEmployeeIds.size,
      totalHolidays: publicHolidaysCount,
      totalSpecialHolidays: specialHolidaysCount,
    },
  };
}
