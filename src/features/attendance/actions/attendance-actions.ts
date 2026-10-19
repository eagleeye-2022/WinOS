"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { MANDATORY_HOLIDAY } from "../attendance-data";
import {
  canManageAttendance,
  dateFromKey,
  dateKeyFromUtc,
  isWeekendKey,
  istDateKey,
  istTimeString,
  leaveFractionOnDay,
  normalizeTime,
  workedMinutesBetween,
} from "../utils";

type ActionResult<T = object> = ({ success: true } & T) | { success: false; message: string };

const fail = (message: string): { success: false; message: string } => ({ success: false, message });

function revalidateAttendance() {
  revalidatePath("/pulse/attendance");
  revalidatePath("/pulse/team-attendance");
  revalidatePath("/pulse/regularization");
  revalidatePath("/pulse/leave");
}

/** Session + a fresh User row (guards against a stale JWT after a DB reset). */
async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, profileRole: true, isActive: true },
  });
  return user?.isActive ? user : null;
}

// ── 1. CHECK-IN ACTION ────────────────────────────────────────────────────────

export async function checkInAction(payload?: {
  workMode?: "OFFICE" | "REMOTE";
  source?: string;
  locationName?: string;
  address?: string;
  photo?: string;
}) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized");

  const now = new Date();
  const today = dateFromKey(istDateKey(now))!;
  const timeStr = istTimeString(now);

  const existing = await db.dailyAttendance.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });

  if (existing?.isLive) {
    return { success: true as const, message: "Already checked in", record: existing };
  }

  // Checking in again after a check-out resumes the day: the first check-in time is kept,
  // the check-out is cleared and the worked minutes so far are carried forward.
  const record = await db.dailyAttendance.upsert({
    where: { userId_date: { userId: user.id, date: today } },
    create: {
      userId: user.id,
      date: today,
      status: "WORKING_NOW",
      checkInTime: timeStr,
      checkInSource: payload?.source || "Web",
      checkInLocationName: payload?.locationName || null,
      checkInAddress: payload?.address || null,
      checkInPhoto: payload?.photo,
      workMode: payload?.workMode || "OFFICE",
      isLive: true,
      liveSince: now,
      workedMinutes: 0,
    },
    update: {
      status: "WORKING_NOW",
      checkInTime: existing?.checkInTime || timeStr,
      checkOutTime: null,
      checkInSource: existing?.checkInSource || payload?.source || "Web",
      checkInLocationName: existing?.checkInLocationName || payload?.locationName || null,
      checkInAddress: existing?.checkInAddress || payload?.address || null,
      checkInPhoto: existing?.checkInPhoto || payload?.photo,
      workMode: payload?.workMode || existing?.workMode || "OFFICE",
      isLive: true,
      liveSince: now,
      actionRequiredType: null,
      actionRequiredReason: null,
    },
  });

  revalidateAttendance();
  return { success: true as const, record };
}

// ── 2. CHECK-OUT ACTION ───────────────────────────────────────────────────────

export async function checkOutAction(payload?: {
  source?: string;
  locationName?: string;
  address?: string;
  photo?: string;
}) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized");

  const now = new Date();
  const today = dateFromKey(istDateKey(now))!;
  const timeStr = istTimeString(now);

  const existing = await db.dailyAttendance.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });

  if (!existing?.checkInTime || !existing.isLive) {
    return fail("You are not checked in today.");
  }

  const sessionMinutes = existing.liveSince
    ? Math.max(0, Math.floor((now.getTime() - existing.liveSince.getTime()) / 60_000))
    : workedMinutesBetween(existing.checkInTime, timeStr) ?? 0;

  const record = await db.dailyAttendance.update({
    where: { userId_date: { userId: user.id, date: today } },
    data: {
      status: "PRESENT",
      checkOutTime: timeStr,
      checkOutSource: payload?.source || "Web",
      checkOutLocationName: payload?.locationName || null,
      checkOutAddress: payload?.address || null,
      checkOutPhoto: payload?.photo || existing.checkOutPhoto,
      isLive: false,
      liveSince: null,
      workedMinutes: (existing.workedMinutes || 0) + sessionMinutes,
      actionRequiredType: null,
      actionRequiredReason: null,
    },
  });

  revalidateAttendance();
  return { success: true as const, record };
}

// ── 3. SUBMIT ATTENDANCE REGULARIZATION ───────────────────────────────────────

const REASON_MAX = 500;
const REMARKS_MAX = 250;

export async function submitRegularizationAction(payload: {
  /** "YYYY-MM-DD" */
  missingDate: string;
  checkInTime: string;
  checkOutTime: string;
  reason: string;
  remarks?: string;
  issueDescription?: string;
  /** Managers only: regularize on behalf of a team member (approved immediately). */
  forUserId?: string;
}): Promise<ActionResult<{ requestId: string }>> {
  const actor = await currentUser();
  if (!actor) return fail("Unauthorized");

  const onBehalf = Boolean(payload.forUserId && payload.forUserId !== actor.id);
  if (onBehalf && !canManageAttendance(actor)) return fail("Only managers can regularize on behalf of others.");
  const userId = onBehalf ? payload.forUserId! : actor.id;

  const key = (payload.missingDate || "").trim();
  const date = dateFromKey(key);
  if (!date) return fail("Pick a valid attendance date.");
  if (key > istDateKey()) return fail("You can't regularize a future date.");
  if (isWeekendKey(key)) return fail("That date is a weekend — request a comp-off instead.");

  const checkIn = normalizeTime(payload.checkInTime);
  const checkOut = normalizeTime(payload.checkOutTime);
  if (!checkIn || !checkOut) return fail("Enter check-in and check-out as e.g. 09:30 AM.");
  if (!workedMinutesBetween(checkIn, checkOut)) return fail("Check-out must be after check-in.");

  const reason = (payload.reason || "").trim();
  if (!reason) return fail("A reason is required.");
  if (reason.length > REASON_MAX) return fail(`Reason must be under ${REASON_MAX} characters.`);
  const remarks = (payload.remarks || "").trim();
  if (remarks.length > REMARKS_MAX) return fail(`Remarks must be under ${REMARKS_MAX} characters.`);

  const [target, holiday, existingAtt, openRequest, leaves] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } }),
    db.holiday.findFirst({ where: { date, ...MANDATORY_HOLIDAY } }),
    db.dailyAttendance.findUnique({ where: { userId_date: { userId, date } } }),
    db.attendanceRegularization.findFirst({
      where: { userId, missingDate: date, status: { in: ["PENDING", "APPROVED"] } },
    }),
    db.leaveRequest.findMany({
      where: { userId, status: "APPROVED", fromDate: { lte: date }, toDate: { gte: date } },
    }),
  ]);

  if (!target?.isActive) return fail("Employee not found.");
  if (holiday) return fail(`${holiday.name} is a holiday — request a comp-off instead.`);
  if (openRequest) {
    return fail(
      openRequest.status === "PENDING"
        ? "A regularization for this date is already pending approval."
        : "This date has already been regularized."
    );
  }
  const leaveFraction = leaves.reduce((acc, l) => acc + leaveFractionOnDay(l, key), 0);
  if (leaveFraction >= 1) return fail("You're on approved leave that day — cancel the leave first if you worked.");
  if (existingAtt?.isLive && key === istDateKey()) {
    return fail("You're checked in right now — check out instead of regularizing today.");
  }

  const request = await db.attendanceRegularization.create({
    data: {
      userId,
      missingDate: date,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      reason,
      remarks: remarks || null,
      issueDescription:
        payload.issueDescription?.trim() ||
        (existingAtt?.checkInTime ? "Missing check-out" : "No attendance or leave record found"),
      existingCheckIn: existingAtt?.checkInTime ?? null,
      existingCheckOut: existingAtt?.checkOutTime ?? null,
      status: "PENDING",
    },
  });

  if (onBehalf) {
    await applyApprovedRegularization(request.id, actor.id);
  }

  revalidateAttendance();
  return { success: true, requestId: request.id };
}

/** Marks a regularization approved and writes the requested times onto DailyAttendance. */
async function applyApprovedRegularization(requestId: string, reviewerId: string) {
  const current = await db.attendanceRegularization.findUniqueOrThrow({ where: { id: requestId } });
  const date = dateFromKey(dateKeyFromUtc(current.missingDate))!;
  const worked = workedMinutesBetween(current.checkInTime, current.checkOutTime) ?? 0;

  await db.$transaction([
    db.attendanceRegularization.update({
      where: { id: requestId },
      data: { status: "APPROVED", rejectionReason: null, reviewedById: reviewerId, reviewedAt: new Date() },
    }),
    db.dailyAttendance.upsert({
      where: { userId_date: { userId: current.userId, date } },
      create: {
        userId: current.userId,
        date,
        status: "PRESENT",
        checkInTime: current.checkInTime,
        checkOutTime: current.checkOutTime,
        checkInSource: "Regularized",
        checkOutSource: "Regularized",
        workMode: "OFFICE",
        workedMinutes: worked,
        isLive: false,
      },
      update: {
        status: "PRESENT",
        checkInTime: current.checkInTime,
        checkOutTime: current.checkOutTime,
        checkOutSource: "Regularized",
        workedMinutes: worked,
        isLive: false,
        liveSince: null,
        actionRequiredType: null,
        actionRequiredReason: null,
      },
    }),
  ]);
}

// ── 4. REVIEW REGULARIZATION ACTION (APPROVE / REJECT) ────────────────────────

export async function reviewRegularizationAction(payload: {
  requestId: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}): Promise<ActionResult> {
  const reviewer = await currentUser();
  if (!reviewer) return fail("Unauthorized");
  if (!canManageAttendance(reviewer)) return fail("Only managers can review regularizations.");

  const current = await db.attendanceRegularization.findUnique({ where: { id: payload.requestId } });
  if (!current) return fail("Regularization request not found.");
  if (current.userId === reviewer.id) return fail("You can't review your own regularization.");
  if (current.status !== "PENDING") return fail(`This request is already ${current.status.toLowerCase()}.`);

  if (payload.status === "APPROVED") {
    await applyApprovedRegularization(current.id, reviewer.id);
  } else {
    await db.attendanceRegularization.update({
      where: { id: current.id },
      data: {
        status: "REJECTED",
        rejectionReason: payload.rejectionReason?.trim() || null,
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
      },
    });
  }

  revalidateAttendance();
  return { success: true };
}

// ── 5. CANCEL REGULARIZATION ACTION ──────────────────────────────────────────

export async function cancelRegularizationAction(requestId: string): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return fail("Unauthorized");

  const item = await db.attendanceRegularization.findUnique({ where: { id: requestId } });
  if (!item) return fail("Request not found.");
  if (item.userId !== user.id) return fail("You can only withdraw your own requests.");
  if (item.status !== "PENDING") return fail("Only pending requests can be withdrawn.");

  await db.attendanceRegularization.delete({ where: { id: requestId } });

  revalidateAttendance();
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
  const user = await currentUser();
  if (!user) return fail("Unauthorized");

  const dateObj = dateFromKey(payload.workDate.slice(0, 10));
  if (!dateObj) return fail("Invalid work date.");
  const expiryDate = new Date(dateObj);
  expiryDate.setUTCDate(expiryDate.getUTCDate() + 90); // 90 days validity

  const compOff = await db.compensatoryRequest.create({
    data: {
      userId: user.id,
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

  revalidateAttendance();
  return { success: true as const, compOff };
}
