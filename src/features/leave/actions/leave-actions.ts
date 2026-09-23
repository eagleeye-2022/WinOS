"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── 1. APPLY FOR LEAVE ───────────────────────────────────────────────────────

export async function applyLeaveAction(formData: {
  leaveTypeCode: string;
  durationType: "FULL_DAY" | "HALF_DAY" | "EARLY_LEAVE" | "QUARTER_DAY" | "HOURLY";
  halfDayType?: "FIRST_HALF" | "SECOND_HALF";
  fromDate: string;
  toDate: string;
  fromTime?: string;
  toTime?: string;
  durationDays: number;
  durationHours?: number;
  reason: string;
  attachmentFileName?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const leaveType = await db.leaveType.findUnique({
    where: { code: formData.leaveTypeCode },
  });

  if (!leaveType) throw new Error("Invalid Leave Type");

  const currentYear = new Date(formData.fromDate).getFullYear();

  // Find or create user balance
  let balance = await db.userLeaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: {
        userId,
        leaveTypeId: leaveType.id,
        year: currentYear,
      },
    },
  });

  if (!balance) {
    balance = await db.userLeaveBalance.create({
      data: {
        userId,
        leaveTypeId: leaveType.id,
        year: currentYear,
        allocatedDays: leaveType.annualEntitlement,
      },
    });
  }

  const available =
    balance.allocatedDays + balance.carriedForward + balance.adjustedDays - balance.bookedDays;

  const isExcess = available < formData.durationDays;
  const isLossOfPay = isExcess && leaveType.exceededRule === "MARK_AS_LOP";
  const lopDays = isLossOfPay ? formData.durationDays - Math.max(0, available) : 0;

  // Create LeaveRequest
  const request = await db.leaveRequest.create({
    data: {
      userId,
      leaveTypeId: leaveType.id,
      durationType: formData.durationType as any,
      halfDayType: formData.halfDayType as any,
      fromDate: new Date(formData.fromDate),
      toDate: new Date(formData.toDate),
      fromTime: formData.fromTime,
      toTime: formData.toTime,
      durationDays: formData.durationDays,
      durationHours: formData.durationHours,
      reason: formData.reason,
      status: "PENDING",
      isLossOfPay,
      lopDaysCount: lopDays,
      approvalSteps: {
        create: [
          {
            stepOrder: 1,
            stepName: "Requested",
            approverId: userId,
            approverName: session.user.name || "Employee",
            approverRole: "Applicant",
            status: "APPROVED",
            actionDate: new Date(),
          },
          {
            stepOrder: 2,
            stepName: "Manager Approval",
            approverRole: "Reporting Manager",
            status: "PENDING",
          },
          {
            stepOrder: 3,
            stepName: "Final Approval",
            approverRole: "HR Admin",
            status: "PENDING",
          },
        ],
      },
      attachments: formData.attachmentFileName
        ? {
            create: [
              {
                fileName: formData.attachmentFileName,
                fileUrl: "/placeholder-doc.pdf",
                fileSize: "245 KB",
                fileType: "application/pdf",
                uploadedById: userId,
              },
            ],
          }
        : undefined,
    },
  });

  // Update balance (add to pendingDays)
  await db.userLeaveBalance.update({
    where: { id: balance.id },
    data: {
      pendingDays: { increment: formData.durationDays },
    },
  });

  revalidatePath("/pulse/leave");
  revalidatePath("/pulse/leave/team");

  return { success: true, requestId: request.id };
}

// ── 2. CANCEL LEAVE REQUEST ──────────────────────────────────────────────────

export async function cancelLeaveRequestAction(requestId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const request = await db.leaveRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) throw new Error("Request not found");

  await db.leaveRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED" },
  });

  // If request was pending, deduct pending days
  const year = request.fromDate.getFullYear();
  await db.userLeaveBalance.updateMany({
    where: { userId: request.userId, leaveTypeId: request.leaveTypeId, year },
    data: {
      pendingDays: { decrement: request.durationDays },
    },
  });

  revalidatePath("/pulse/leave");
  revalidatePath("/pulse/leave/team");
  return { success: true };
}

// ── 3. APPROVE LEAVE REQUEST (MANAGER ACTION) ────────────────────────────────

export async function approveLeaveRequestAction(requestId: string, comments?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const request = await db.leaveRequest.findUnique({
    where: { id: requestId },
    include: { leaveType: true },
  });

  if (!request) throw new Error("Request not found");

  await db.leaveRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED" },
  });

  // Update approval step
  await db.leaveApprovalStep.updateMany({
    where: { leaveRequestId: requestId, stepOrder: 2 },
    data: {
      status: "APPROVED",
      actionDate: new Date(),
      approverId: session.user.id,
      approverName: session.user.name || "Manager",
      comments: comments || "Approved by manager",
    },
  });

  // Deduct from available balance (increment bookedDays, decrement pendingDays)
  const year = request.fromDate.getFullYear();
  await db.userLeaveBalance.updateMany({
    where: { userId: request.userId, leaveTypeId: request.leaveTypeId, year },
    data: {
      bookedDays: { increment: request.durationDays },
      pendingDays: { decrement: request.durationDays },
      lossOfPayDays: request.isLossOfPay
        ? { increment: request.lopDaysCount }
        : undefined,
    },
  });

  revalidatePath("/pulse/leave");
  revalidatePath("/pulse/leave/team");
  return { success: true };
}

// ── 4. REJECT LEAVE REQUEST (MANAGER ACTION) ─────────────────────────────────

export async function rejectLeaveRequestAction(requestId: string, rejectionReason?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const request = await db.leaveRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) throw new Error("Request not found");

  await db.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      rejectionReason: rejectionReason || "Rejected by manager",
    },
  });

  // Update approval step
  await db.leaveApprovalStep.updateMany({
    where: { leaveRequestId: requestId, stepOrder: 2 },
    data: {
      status: "REJECTED",
      actionDate: new Date(),
      approverId: session.user.id,
      approverName: session.user.name || "Manager",
      comments: rejectionReason || "Rejected",
    },
  });

  // Release pending days back
  const year = request.fromDate.getFullYear();
  await db.userLeaveBalance.updateMany({
    where: { userId: request.userId, leaveTypeId: request.leaveTypeId, year },
    data: {
      pendingDays: { decrement: request.durationDays },
    },
  });

  revalidatePath("/pulse/leave");
  revalidatePath("/pulse/leave/team");
  return { success: true };
}

// ── 5. APPLY FOR COMPENSATORY OFF ────────────────────────────────────────────

export async function applyCompensatoryAction(data: {
  workDate: string;
  fromTime: string;
  toTime: string;
  hoursWorked: number;
  duration: "FULL_DAY" | "HALF_DAY" | "QUARTER_DAY";
  reason: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const workDate = new Date(data.workDate);
  const expiryDate = new Date(workDate);
  expiryDate.setDate(expiryDate.getDate() + 30); // 30-day expiration

  const creditedDays = data.duration === "FULL_DAY" ? 1.0 : data.duration === "HALF_DAY" ? 0.5 : 0.25;

  const comp = await db.compensatoryRequest.create({
    data: {
      userId,
      workDate,
      fromTime: data.fromTime,
      toTime: data.toTime,
      hoursWorked: data.hoursWorked,
      duration: data.duration as any,
      creditedDays,
      reason: data.reason,
      expiryDate,
      status: "PENDING",
      approvalSteps: {
        create: [
          {
            stepOrder: 1,
            stepName: "Requested",
            approverId: userId,
            approverName: session.user.name || "Employee",
            approverRole: "Applicant",
            status: "APPROVED",
            actionDate: new Date(),
          },
          {
            stepOrder: 2,
            stepName: "Manager Approval",
            approverRole: "Reporting Manager",
            status: "PENDING",
          },
        ],
      },
      attachments: {
        create: [
          {
            fileName: "Doctor_Appointment_Proof.pdf",
            fileUrl: "/placeholder-proof.pdf",
            fileSize: "245 KB",
            fileType: "application/pdf",
            uploadedById: userId,
          },
        ],
      },
    },
  });

  revalidatePath("/pulse/leave");
  revalidatePath("/pulse/leave/team");
  return { success: true, id: comp.id };
}

// ── 6. APPROVE COMPENSATORY OFF ──────────────────────────────────────────────

export async function approveCompensatoryAction(requestId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const comp = await db.compensatoryRequest.findUnique({
    where: { id: requestId },
  });

  if (!comp) throw new Error("Compensatory request not found");

  await db.compensatoryRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED" },
  });

  // Credit into UserLeaveBalance under COMP code
  const compLeaveType = await db.leaveType.findUnique({
    where: { code: "COMP" },
  });

  if (compLeaveType) {
    const year = comp.workDate.getFullYear();
    await db.userLeaveBalance.upsert({
      where: {
        userId_leaveTypeId_year: {
          userId: comp.userId,
          leaveTypeId: compLeaveType.id,
          year,
        },
      },
      update: {
        allocatedDays: { increment: comp.creditedDays },
      },
      create: {
        userId: comp.userId,
        leaveTypeId: compLeaveType.id,
        year,
        allocatedDays: comp.creditedDays,
      },
    });
  }

  revalidatePath("/pulse/leave");
  revalidatePath("/pulse/leave/team");
  return { success: true };
}

// ── 7. REJECT COMPENSATORY OFF ──────────────────────────────────────────────

export async function rejectCompensatoryAction(requestId: string, reason?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db.compensatoryRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      rejectionReason: reason || "Rejected by manager",
    },
  });

  revalidatePath("/pulse/leave");
  revalidatePath("/pulse/leave/team");
  return { success: true };
}

// ── 8. ADJUST EMPLOYEE LEAVE BALANCE ────────────────────────────────────────

export async function adjustLeaveBalanceAction(data: {
  employeeId: string;
  leaveTypeId: string;
  adjustmentDays: number; // e.g. +3 or -1
  reason: "YEARLY_CORRECTION" | "SPECIAL_AWARD" | "POLICY_REVISION" | "LOSS_OF_PAY_REVERSAL" | "JOINING_PRORATION" | "OTHER";
  remarks?: string;
  year?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const adjustedById = session.user.id;
  const year = data.year || new Date().getFullYear();

  // Fetch current balance
  const balance = await db.userLeaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: {
        userId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        year,
      },
    },
  });

  const previousBalance = balance
    ? balance.allocatedDays + balance.carriedForward + balance.adjustedDays - balance.bookedDays
    : 0;
  const newBalance = previousBalance + data.adjustmentDays;

  // Insert audit record
  await db.leaveBalanceAdjustment.create({
    data: {
      userId: data.employeeId,
      adjustedById,
      leaveTypeId: data.leaveTypeId,
      previousBalance,
      adjustmentDays: data.adjustmentDays,
      newBalance,
      reason: data.reason,
      remarks: data.remarks,
    },
  });

  // Update user leave balance
  await db.userLeaveBalance.upsert({
    where: {
      userId_leaveTypeId_year: {
        userId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        year,
      },
    },
    update: {
      adjustedDays: { increment: data.adjustmentDays },
    },
    create: {
      userId: data.employeeId,
      leaveTypeId: data.leaveTypeId,
      year,
      allocatedDays: 0,
      adjustedDays: data.adjustmentDays,
    },
  });

  revalidatePath("/pulse/leave");
  revalidatePath("/pulse/leave/team");
  return { success: true, newBalance };
}

// ── 9. CREATE NEW LEAVE TYPE (WIZARD 6 STEPS) ────────────────────────────────

export async function createLeaveTypeAction(data: {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
  effectiveDate: string;
  expiryDate?: string;
  category?: "PAID" | "UNPAID" | "PARTIALLY_PAID";
  allocationFrequency?: "YEARLY" | "MONTHLY" | "QUARTERLY" | "ON_DEMAND";
  annualEntitlement: number;
  allowCarryForward?: boolean;
  carryForwardLimit?: number;
  balanceResetRule?: "CARRY_FORWARD_UP_TO_LIMIT" | "ENCASH_UNUSED" | "LAPSE_ALL";
  exceededRule?: "DO_NOT_ALLOW" | "ALLOW_WITHOUT_LIMIT" | "ALLOW_UNTIL_YEAR_END" | "MARK_AS_LOP";
  applicableTo?: "ALL_EMPLOYEES" | "FULL_TIME_ONLY" | "PROBATIONARY" | "CONTRACTORS" | "CUSTOM_DEPARTMENT";
  departments?: string[];
  employmentTypes?: string[];
  allowFullDay?: boolean;
  allowHalfDay?: boolean;
  allowQuarterDay?: boolean;
  allowHourly?: boolean;
  allowPastDays?: boolean;
  pastDaysLimit?: number;
  allowAdvanceDays?: boolean;
  advanceDaysLimit?: number;
  minAdvanceNotice?: number;
  minLeavePerRequest?: number;
  maxLeavePerRequest?: number;
  maxConsecutiveDays?: number;
  minGapBetweenRequests?: number;
  applicableDays?: string[];
  sandwichPolicy?: boolean;
  sandwichWeekends?: boolean;
  sandwichHolidays?: boolean;
  clubbingRestrictedCodes?: string[];
  supportingDocPolicy?: "NOT_REQUIRED" | "ALWAYS_REQUIRED" | "REQUIRED_WHEN_EXCEEDS";
  docExceedsDays?: number;
  acceptedFileTypes?: string[];
  maxFileSizeMb?: number;
  managerApprovalRequired?: boolean;
  approvalFlow?: "DIRECT_MANAGER" | "DEPARTMENT_HEAD" | "HR_ADMIN" | "CUSTOM_TWO_STEP";
  allowAdminApplyOnBehalf?: boolean;
  employeeVisibility?: "COMPLETE_LEAVE_SUMMARY" | "REMAINING_BALANCE_ONLY" | "HIDE_IN_SELF_SERVICE";
  balanceDisplayPref?: "LEAVE_REQUEST_START_DATE" | "CURRENT_DATE" | "YEAR_END_PROJECTION";
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const newType = await db.leaveType.create({
    data: {
      name: data.name,
      code: data.code.toUpperCase(),
      description: data.description,
      icon: data.icon || "Thermometer",
      isActive: data.isActive ?? true,
      effectiveDate: new Date(data.effectiveDate),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      category: (data.category as any) || "PAID",
      allocationFrequency: (data.allocationFrequency as any) || "YEARLY",
      annualEntitlement: data.annualEntitlement,
      allowCarryForward: data.allowCarryForward ?? true,
      carryForwardLimit: data.carryForwardLimit ?? 5,
      balanceResetRule: (data.balanceResetRule as any) || "CARRY_FORWARD_UP_TO_LIMIT",
      exceededRule: (data.exceededRule as any) || "MARK_AS_LOP",
      applicableTo: (data.applicableTo as any) || "ALL_EMPLOYEES",
      departments: data.departments || [],
      employmentTypes: data.employmentTypes || [],
      allowFullDay: data.allowFullDay ?? true,
      allowHalfDay: data.allowHalfDay ?? true,
      allowQuarterDay: data.allowQuarterDay ?? false,
      allowHourly: data.allowHourly ?? true,
      allowPastDays: data.allowPastDays ?? true,
      pastDaysLimit: data.pastDaysLimit ?? 7,
      allowAdvanceDays: data.allowAdvanceDays ?? true,
      advanceDaysLimit: data.advanceDaysLimit ?? 90,
      minAdvanceNotice: data.minAdvanceNotice ?? 2,
      minLeavePerRequest: data.minLeavePerRequest ?? 0.5,
      maxLeavePerRequest: data.maxLeavePerRequest ?? 10,
      maxConsecutiveDays: data.maxConsecutiveDays ?? 15,
      minGapBetweenRequests: data.minGapBetweenRequests ?? 2,
      applicableDays: data.applicableDays || ["Mon", "Tue", "Wed", "Thu", "Fri"],
      sandwichPolicy: data.sandwichPolicy ?? true,
      sandwichWeekends: data.sandwichWeekends ?? true,
      sandwichHolidays: data.sandwichHolidays ?? true,
      clubbingRestrictedCodes: data.clubbingRestrictedCodes || [],
      supportingDocPolicy: (data.supportingDocPolicy as any) || "REQUIRED_WHEN_EXCEEDS",
      docExceedsDays: data.docExceedsDays ?? 3,
      acceptedFileTypes: data.acceptedFileTypes || ["PDF", "JPG", "PNG"],
      maxFileSizeMb: data.maxFileSizeMb ?? 5,
      managerApprovalRequired: data.managerApprovalRequired ?? true,
      approvalFlow: (data.approvalFlow as any) || "DIRECT_MANAGER",
      allowAdminApplyOnBehalf: data.allowAdminApplyOnBehalf ?? true,
      employeeVisibility: (data.employeeVisibility as any) || "COMPLETE_LEAVE_SUMMARY",
      balanceDisplayPref: (data.balanceDisplayPref as any) || "LEAVE_REQUEST_START_DATE",
    },
  });

  // Provision balance for all active users
  const users = await db.user.findMany({ where: { isActive: true } });
  const year = new Date().getFullYear();
  for (const u of users) {
    await db.userLeaveBalance.create({
      data: {
        userId: u.id,
        leaveTypeId: newType.id,
        year,
        allocatedDays: newType.annualEntitlement,
      },
    });
  }

  revalidatePath("/pulse/leave");
  revalidatePath("/pulse/leave/team");
  return { success: true, id: newType.id };
}

// ── 10. TOGGLE LEAVE TYPE STATUS ─────────────────────────────────────────────

export async function toggleLeaveTypeStatusAction(id: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db.leaveType.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath("/pulse/leave/team");
  return { success: true };
}

// ── 11. HOLIDAYS CRUD ────────────────────────────────────────────────────────

export async function createHolidayAction(data: {
  name: string;
  date: string;
  type: "PUBLIC" | "OPTIONAL" | "COMPANY_SPECIAL";
  description?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const holidayDate = new Date(data.date);
  const dayOfWeek = holidayDate.toLocaleDateString("en-US", { weekday: "long" });
  const year = holidayDate.getFullYear();

  await db.holiday.create({
    data: {
      name: data.name,
      date: holidayDate,
      dayOfWeek,
      year,
      type: data.type as any,
      description: data.description,
      createdById: session.user.id,
    },
  });

  revalidatePath("/pulse/leave");
  revalidatePath("/pulse/leave/team");
  return { success: true };
}

export async function deleteHolidayAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db.holiday.delete({ where: { id } });

  revalidatePath("/pulse/leave");
  revalidatePath("/pulse/leave/team");
  return { success: true };
}

// ── 12. ATTENDANCE REGULARIZATION ────────────────────────────────────────────

export async function submitRegularizationAction(data: {
  id: string;
  checkIn: string;
  checkOut: string;
  reason: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db.attendanceRegularization.update({
    where: { id: data.id },
    data: {
      checkInTime: data.checkIn,
      checkOutTime: data.checkOut,
      reason: data.reason,
      status: "APPROVED",
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/pulse/leave");
  return { success: true };
}
