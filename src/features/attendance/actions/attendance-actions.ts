"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function formatTimeString(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? "0" + minutes : minutes;
  const hoursStr = hours < 10 ? "0" + hours : hours;
  return `${hoursStr}:${minutesStr} ${ampm}`;
}

function normalizeDate(d: Date | string): Date {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

// ── 1. CHECK-IN ACTION ────────────────────────────────────────────────────────

export async function checkInAction(payload?: {
  workMode?: "OFFICE" | "REMOTE";
  source?: string;
  locationName?: string;
  address?: string;
  photo?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const now = new Date();
  const today = normalizeDate(now);
  const timeStr = formatTimeString(now);

  const existing = await db.dailyAttendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });

  if (existing && existing.isLive) {
    return { success: true, message: "Already checked in", record: existing };
  }

  const record = await db.dailyAttendance.upsert({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    create: {
      userId,
      date: today,
      status: "WORKING_NOW",
      checkInTime: timeStr,
      checkInSource: payload?.source || "Web",
      checkInLocationName: payload?.locationName || "Corporate Office HQ",
      checkInAddress: payload?.address || "Building 4, Cyber City, Gurgaon",
      checkInPhoto: payload?.photo,
      workMode: payload?.workMode || "OFFICE",
      isLive: true,
      liveSince: now,
      workedMinutes: 0,
    },
    update: {
      status: "WORKING_NOW",
      checkInTime: existing?.checkInTime || timeStr,
      checkInSource: payload?.source || existing?.checkInSource || "Web",
      checkInLocationName: payload?.locationName || existing?.checkInLocationName || "Corporate Office HQ",
      checkInAddress: payload?.address || existing?.checkInAddress || "Building 4, Cyber City, Gurgaon",
      checkInPhoto: payload?.photo || existing?.checkInPhoto,
      workMode: payload?.workMode || existing?.workMode || "OFFICE",
      isLive: true,
      liveSince: now,
      actionRequiredType: null,
      actionRequiredReason: null,
    },
  });

  revalidatePath("/pulse/attendance");
  revalidatePath("/pulse/team-attendance");
  return { success: true, record };
}

// ── 2. CHECK-OUT ACTION ───────────────────────────────────────────────────────

export async function checkOutAction(payload?: {
  source?: string;
  locationName?: string;
  address?: string;
  photo?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const now = new Date();
  const today = normalizeDate(now);
  const timeStr = formatTimeString(now);

  const existing = await db.dailyAttendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });

  if (!existing || !existing.checkInTime) {
    throw new Error("No active check-in found for today");
  }

  let totalWorkedMins = existing.workedMinutes || 0;
  if (existing.liveSince) {
    const diffMs = now.getTime() - new Date(existing.liveSince).getTime();
    totalWorkedMins += Math.max(0, Math.floor(diffMs / (1000 * 60)));
  } else {
    // Default standard minutes if liveSince is missing
    totalWorkedMins = Math.max(totalWorkedMins, 480);
  }

  const record = await db.dailyAttendance.update({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    data: {
      status: "PRESENT",
      checkOutTime: timeStr,
      checkOutSource: payload?.source || "Web",
      checkOutLocationName: payload?.locationName || "Corporate Office HQ",
      checkOutAddress: payload?.address || "Building 4, Cyber City, Gurgaon",
      checkOutPhoto: payload?.photo || existing.checkOutPhoto,
      isLive: false,
      workedMinutes: totalWorkedMins,
      actionRequiredType: null,
      actionRequiredReason: null,
    },
  });

  revalidatePath("/pulse/attendance");
  revalidatePath("/pulse/team-attendance");
  return { success: true, record };
}

// ── 3. SUBMIT ATTENDANCE REGULARIZATION ───────────────────────────────────────

export async function submitRegularizationAction(payload: {
  missingDate: string;
  checkInTime: string;
  checkOutTime: string;
  reason: string;
  remarks?: string;
  issueDescription?: string;
  existingCheckIn?: string;
  existingCheckOut?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const dateObj = normalizeDate(payload.missingDate);

  const request = await db.attendanceRegularization.create({
    data: {
      userId,
      missingDate: dateObj,
      checkInTime: payload.checkInTime,
      checkOutTime: payload.checkOutTime,
      reason: payload.reason,
      remarks: payload.remarks,
      issueDescription: payload.issueDescription || "Missing attendance / Check-in record",
      existingCheckIn: payload.existingCheckIn,
      existingCheckOut: payload.existingCheckOut,
      status: "PENDING",
    },
  });

  revalidatePath("/pulse/regularization");
  revalidatePath("/pulse/attendance");
  return { success: true, request };
}

// ── 4. REVIEW REGULARIZATION ACTION (APPROVE / REJECT) ────────────────────────

export async function reviewRegularizationAction(payload: {
  requestId: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const reviewerId = session.user.id;

  const current = await db.attendanceRegularization.findUnique({
    where: { id: payload.requestId },
  });

  if (!current) throw new Error("Regularization request not found");

  const updated = await db.attendanceRegularization.update({
    where: { id: payload.requestId },
    data: {
      status: payload.status,
      rejectionReason: payload.rejectionReason,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });

  // If approved, update the daily attendance record to PRESENT
  if (payload.status === "APPROVED") {
    const missingDate = normalizeDate(current.missingDate);

    await db.dailyAttendance.upsert({
      where: {
        userId_date: {
          userId: current.userId,
          date: missingDate,
        },
      },
      create: {
        userId: current.userId,
        date: missingDate,
        status: "PRESENT",
        checkInTime: current.checkInTime,
        checkOutTime: current.checkOutTime,
        checkInSource: "Web",
        checkOutSource: "Web",
        workMode: "OFFICE",
        workedMinutes: 480,
        isLive: false,
        actionRequiredType: null,
        actionRequiredReason: null,
      },
      update: {
        status: "PRESENT",
        checkInTime: current.checkInTime,
        checkOutTime: current.checkOutTime,
        actionRequiredType: null,
        actionRequiredReason: null,
        isLive: false,
      },
    });
  }

  revalidatePath("/pulse/regularization");
  revalidatePath("/pulse/attendance");
  revalidatePath("/pulse/team-attendance");
  return { success: true, updated };
}

// ── 5. CANCEL REGULARIZATION ACTION ──────────────────────────────────────────

export async function cancelRegularizationAction(requestId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const item = await db.attendanceRegularization.findUnique({
    where: { id: requestId },
  });

  if (!item) throw new Error("Request not found");
  if (item.userId !== session.user.id && session.user.role !== "MANAGER") {
    throw new Error("Forbidden");
  }

  await db.attendanceRegularization.delete({
    where: { id: requestId },
  });

  revalidatePath("/pulse/regularization");
  revalidatePath("/pulse/attendance");
  return { success: true };
}

// ── 6. COMPENSATORY OFF REQUEST FROM ATTENDANCE ──────────────────────────────

export async function submitCompOffAction(payload: {
  workDate: string;
  fromTime: string;
  toTime: string;
  hoursWorked: number;
  reason: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const dateObj = normalizeDate(payload.workDate);
  const expiryDate = new Date(dateObj);
  expiryDate.setDate(expiryDate.getDate() + 90); // 90 days validity

  const compOff = await db.compensatoryRequest.create({
    data: {
      userId,
      workDate: dateObj,
      fromTime: payload.fromTime,
      toTime: payload.toTime,
      hoursWorked: payload.hoursWorked,
      duration: payload.hoursWorked >= 7 ? "FULL_DAY" : "HALF_DAY",
      creditedDays: payload.hoursWorked >= 7 ? 1.0 : 0.5,
      reason: payload.reason,
      expiryDate,
      status: "PENDING",
    },
  });

  revalidatePath("/pulse/attendance");
  revalidatePath("/pulse/team-attendance");
  return { success: true, compOff };
}
