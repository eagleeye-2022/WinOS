"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { MANDATORY_HOLIDAY } from "@/features/attendance/attendance-data";
import {
  canManageAttendance,
  dateFromKey,
  dateKeyFromUtc,
  FULL_DAY_NAMES,
  istDateKey,
  normalizeTime,
  workedMinutesBetween,
} from "@/features/attendance/utils";
import { LeaveActionError, type ActionResult } from "../action-result";
import { canManageUser } from "@/features/attendance/team-scope";
import {
  approvalStepsFor,
  approverIdsFor,
  canActOnStep,
  loadRequester,
  notify,
  type ApproverRole,
} from "../approval-flow";
import { effectiveAvailable, getOrOpenBalance } from "../balance";
import {
  applyExceededRule,
  checkEligibility,
  checkRequestLimits,
  compOffCredit,
  compOffExpiry,
  countLeaveDays,
  validateLeaveRequest,
  type LeaveDurationType,
} from "../leave-rules";

// Every action returns an ActionResult instead of throwing (see ../action-result for why).
// `fail()` inside an action body ends it with a user-facing message.

function fail(message: string): never {
  throw new LeaveActionError(message);
}

async function run<T extends object>(label: string, body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { success: true, ...(await body()) };
  } catch (err) {
    if (err instanceof LeaveActionError) return { success: false, message: err.message };
    const code = (err as { code?: string } | null)?.code;
    if (code === "P2002") return { success: false, message: "That already exists." };
    if (code === "P2025") return { success: false, message: "This record was changed or removed. Refresh and try again." };
    console.error(`[leave] ${label} failed:`, err);
    return { success: false, message: "Something went wrong. Please try again." };
  }
}

/** Session + a fresh User row (guards against a stale JWT after a DB reset or deactivation). */
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) fail("Unauthorized");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, profileRole: true, isActive: true },
  });
  if (!user?.isActive) fail("Unauthorized");
  return user;
}

async function requireManager() {
  const user = await requireUser();
  if (!canManageAttendance(user)) fail("Only managers can do this");
  return user;
}

/** Leave changes what attendance shows for those days, so refresh both modules. */
function revalidateLeaveAndAttendance() {
  revalidatePath("/pulse/leave");
  revalidatePath("/pulse/leave/team");
  revalidatePath("/pulse/attendance");
  revalidatePath("/pulse/team-attendance");
  revalidatePath("/people/home");
}

function parseKey(value: string | undefined, what: string): string {
  const key = (value || "").slice(0, 10);
  if (!dateFromKey(key)) fail(`Pick a valid ${what}.`);
  return key;
}

/** "27/10/2026" or "27/10/2026 – 29/10/2026" for notification text. */
function leaveDateLabel(fromKey: string, toKey: string): string {
  const dmy = (k: string) => k.split("-").reverse().join("/");
  return fromKey === toKey ? dmy(fromKey) : `${dmy(fromKey)} – ${dmy(toKey)}`;
}

const REASON_MAX = 1000;

function requireReason(value: string | undefined): string {
  const reason = (value || "").trim();
  if (!reason) fail("A reason is required.");
  if (reason.length > REASON_MAX) fail(`Reason must be under ${REASON_MAX} characters.`);
  return reason;
}

// ── Attachments ──────────────────────────────────────────────────────────────

/** A file the browser already uploaded through POST /api/uploads. */
export interface UploadedAttachment {
  fileName: string;
  fileUrl: string;
  /** Bytes. */
  fileSize: number;
  fileType?: string;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function checkAttachments(
  files: UploadedAttachment[] | undefined,
  rules?: { acceptedFileTypes: string[]; maxFileSizeMb: number }
): UploadedAttachment[] {
  const list = files ?? [];
  if (list.length > 5) fail("Attach at most 5 files.");
  for (const f of list) {
    // Only links to our own upload store — never an arbitrary URL.
    if (!/^\/api\/uploads\/[^/?#]+$/.test(f.fileUrl || "")) fail("Attachment upload failed. Please attach the file again.");
    const ext = (f.fileName.split(".").pop() || "").toUpperCase();
    const accepted = (rules?.acceptedFileTypes ?? []).map((t) => t.toUpperCase().replace(/^\./, ""));
    const okExt = accepted.length === 0 || accepted.includes(ext) || (ext === "JPEG" && accepted.includes("JPG"));
    if (!okExt) fail(`${f.fileName}: only ${accepted.join(", ")} files are accepted.`);
    if (rules?.maxFileSizeMb && f.fileSize > rules.maxFileSizeMb * 1024 * 1024) {
      fail(`${f.fileName} is larger than ${rules.maxFileSizeMb} MB.`);
    }
  }
  return list;
}

function attachmentRows(files: UploadedAttachment[], uploadedById: string) {
  return files.map((f) => ({
    fileName: f.fileName,
    fileUrl: f.fileUrl,
    fileSize: formatSize(f.fileSize),
    fileType: f.fileType || "application/octet-stream",
    uploadedById,
  }));
}

// ── 1. APPLY FOR LEAVE ───────────────────────────────────────────────────────

export async function applyLeaveAction(formData: {
  leaveTypeCode: string;
  durationType: LeaveDurationType;
  halfDayType?: "FIRST_HALF" | "SECOND_HALF";
  fromDate: string;
  toDate: string;
  fromTime?: string;
  toTime?: string;
  /** Only used for hourly / early leave; full and half days are counted on the server. */
  durationDays: number;
  durationHours?: number;
  reason: string;
  attachments?: UploadedAttachment[];
}): Promise<
  ActionResult<{ requestId: string; durationDays: number; autoApproved: boolean; isLossOfPay: boolean; lopDays: number }>
> {
  return run("applyLeave", async () => {
    const user = await requireUser();
    const userId = user.id;

    const leaveType = await db.leaveType.findUnique({ where: { code: formData.leaveTypeCode } });
    if (!leaveType) fail("Invalid leave type.");

    const fromKey = parseKey(formData.fromDate, "start date");
    const toKey = parseKey(formData.toDate, "end date");
    if (toKey < fromKey) fail("The end date can't be before the start date.");
    const from = dateFromKey(fromKey)!;
    const to = dateFromKey(toKey)!;
    const reason = requireReason(formData.reason);
    if (formData.durationType === "HALF_DAY" && !formData.halfDayType) fail("Pick the first or second half.");

    const endExclusive = new Date(to);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const holidays = await db.holiday.findMany({
      where: { date: { gte: from, lt: endExclusive }, ...MANDATORY_HOLIDAY },
      select: { date: true },
    });
    const holidayKeys = new Set(holidays.map((h) => dateKeyFromUtc(h.date)));

    const count = countLeaveDays({
      fromKey,
      toKey,
      durationType: formData.durationType,
      requestedDays: formData.durationDays,
      isHoliday: (k) => holidayKeys.has(k),
      policy: leaveType,
    });
    if ("error" in count) fail(count.error);

    const attachments = checkAttachments(formData.attachments, leaveType);
    const ruleError = validateLeaveRequest({
      policy: leaveType,
      fromKey,
      toKey,
      todayKey: istDateKey(),
      durationType: formData.durationType,
      days: count.days,
      workingKeys: count.workingKeys,
      hasAttachment: attachments.length > 0,
    });
    if (ruleError) fail(ruleError);

    // A full-day leave on a day that was already worked would hide that work, so refuse it.
    if (formData.durationType === "FULL_DAY") {
      const workedDay = await db.dailyAttendance.findFirst({
        where: { userId, date: { in: count.workingKeys.map((k) => dateFromKey(k)!) }, checkInTime: { not: null } },
        orderBy: { date: "asc" },
        select: { date: true },
      });
      if (workedDay) {
        const k = dateKeyFromUtc(workedDay.date);
        fail(`You already checked in on ${FULL_DAY_NAMES[workedDay.date.getUTCDay()]} ${k.split("-").reverse().join("/")}. Apply half-day leave for that date, or leave it out.`);
      }
    }

    // A full-day leave can't share a day with any other leave (two partial leaves may).
    const overlapping = await db.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "APPROVED"] },
        fromDate: { lte: to },
        toDate: { gte: from },
        ...(formData.durationType === "FULL_DAY" ? {} : { durationType: "FULL_DAY" as const }),
      },
    });
    if (overlapping) fail("You already have a leave request covering these dates.");

    // Who the leave type is for (department, employment type, probation, minimum service).
    const facts = await db.user.findUnique({
      where: { id: userId },
      select: { department: true, employmentType: true, profileRole: true, dateOfJoining: true, dateOfConfirmation: true },
    });
    const eligibilityError = facts ? checkEligibility(leaveType, facts, fromKey) : null;
    if (eligibilityError) fail(eligibilityError);

    // Gap between requests, requests per period and clubbing, against the other live requests.
    const windowStart = new Date(from);
    windowStart.setUTCDate(windowStart.getUTCDate() - 400);
    const others = await db.leaveRequest.findMany({
      where: { userId, status: { in: ["PENDING", "APPROVED"] }, toDate: { gte: windowStart } },
      select: { fromDate: true, toDate: true, leaveType: { select: { code: true } } },
    });
    const limitError = checkRequestLimits(
      leaveType,
      fromKey,
      toKey,
      others.map((o) => ({ code: o.leaveType.code, fromKey: dateKeyFromUtc(o.fromDate), toKey: dateKeyFromUtc(o.toDate) }))
    );
    if (limitError) fail(limitError);

    const year = from.getUTCFullYear();
    const steps = approvalStepsFor(leaveType.approvalFlow, leaveType.managerApprovalRequired);
    const requester = await loadRequester(userId);
    const result = await db.$transaction(async (tx) => {
      const balance = await getOrOpenBalance(tx, userId, leaveType, year);

      // Pending requests already hold part of the balance; monthly types only offer what's accrued;
      // comp-off only counts credits that haven't expired.
      const available = await effectiveAvailable(tx, { userId, type: leaveType, balance, onKey: fromKey });
      const outcome = applyExceededRule({ policy: leaveType, days: count.days, available });
      if ("error" in outcome) fail(outcome.error);

      // No approval steps (manager approval not required) → approved on submit and booked at once.
      const autoApproved = steps.length === 0;
      const now = new Date();

      const request = await tx.leaveRequest.create({
        data: {
          userId,
          leaveTypeId: leaveType.id,
          durationType: formData.durationType,
          halfDayType: formData.durationType === "HALF_DAY" ? formData.halfDayType : null,
          fromDate: from,
          toDate: to,
          fromTime: formData.fromTime,
          toTime: formData.toTime,
          durationDays: count.days,
          durationHours: formData.durationHours,
          reason,
          status: autoApproved ? "APPROVED" : "PENDING",
          isLossOfPay: outcome.isLossOfPay,
          lopDaysCount: outcome.lopDays,
          approvalSteps: {
            create: [
              {
                stepOrder: 1,
                stepName: "Requested",
                approverId: userId,
                approverName: user.name || "Employee",
                approverRole: "Applicant",
                status: "APPROVED",
                actionDate: now,
                comments: autoApproved ? "Approved automatically — this leave type needs no approval" : undefined,
              },
              ...steps.map((s, i) => ({
                stepOrder: i + 2,
                stepName: s.stepName,
                approverRole: s.approverRole,
                status: "PENDING" as const,
              })),
            ],
          },
          attachments: attachments.length ? { create: attachmentRows(attachments, userId) } : undefined,
        },
      });

      await tx.userLeaveBalance.update({
        where: { id: balance.id },
        data: autoApproved
          ? {
              bookedDays: { increment: count.days },
              lossOfPayDays: outcome.isLossOfPay ? { increment: outcome.lopDays } : undefined,
            }
          : { pendingDays: { increment: count.days } },
      });

      return { requestId: request.id, durationDays: count.days, autoApproved, ...outcome };
    });

    if (!result.autoApproved && requester) {
      const approvers = await approverIdsFor(steps[0].approverRole, requester);
      await notify(
        userId,
        approvers.map((id) => ({
          userId: id,
          title: "Leave request to review",
          message: `${user.name || "An employee"} applied for ${leaveType.name}: ${leaveDateLabel(fromKey, toKey)} (${result.durationDays} day${result.durationDays === 1 ? "" : "s"}).`,
          relatedEntryId: result.requestId,
        }))
      );
    }

    revalidateLeaveAndAttendance();
    return result;
  });
}

// ── 2. CANCEL LEAVE REQUEST ──────────────────────────────────────────────────

export async function cancelLeaveRequestAction(requestId: string): Promise<ActionResult> {
  return run("cancelLeave", async () => {
    const user = await requireUser();

    const request = await db.leaveRequest.findUnique({ where: { id: requestId }, include: { leaveType: true } });
    if (!request) fail("Request not found.");
    const own = request.userId === user.id;
    if (!own && !(await canManageUser(user, request.userId))) {
      fail("You can only cancel your own leave, or leave of people in your team.");
    }
    if (request.status !== "PENDING" && request.status !== "APPROVED") {
      fail(`This request is already ${request.status.toLowerCase()}.`);
    }

    await db.$transaction(async (tx) => {
      // Conditional on the status we read, so a concurrent approve/cancel can't release days twice.
      const { count } = await tx.leaveRequest.updateMany({
        where: { id: requestId, status: request.status },
        data: { status: "CANCELLED" },
      });
      if (count === 0) fail("This request was just updated. Refresh and try again.");

      // Release whatever the request was holding: pending days, or booked (and LOP) days once approved.
      await tx.userLeaveBalance.updateMany({
        where: { userId: request.userId, leaveTypeId: request.leaveTypeId, year: request.fromDate.getUTCFullYear() },
        data:
          request.status === "APPROVED"
            ? {
                bookedDays: { decrement: request.durationDays },
                lossOfPayDays: request.isLossOfPay ? { decrement: request.lopDaysCount } : undefined,
              }
            : { pendingDays: { decrement: request.durationDays } },
      });
    });

    if (!own) {
      await notify(user.id, [
        {
          userId: request.userId,
          title: "Leave cancelled",
          message: `${user.name || "Your manager"} cancelled your ${request.leaveType.name} (${leaveDateLabel(dateKeyFromUtc(request.fromDate), dateKeyFromUtc(request.toDate))}).`,
          relatedEntryId: request.id,
        },
      ]);
    }

    revalidateLeaveAndAttendance();
    return {};
  });
}

/** The first approval step still waiting, plus whether it's the last one. */
async function pendingStepOf(requestId: string) {
  const steps = await db.leaveApprovalStep.findMany({
    where: { leaveRequestId: requestId, stepOrder: { gt: 1 } },
    orderBy: { stepOrder: "asc" },
  });
  const index = steps.findIndex((s) => s.status === "PENDING");
  if (index === -1) return null;
  return { step: steps[index], next: steps[index + 1] ?? null };
}

// ── 3. APPROVE LEAVE REQUEST (APPROVER ACTION) ───────────────────────────────

export async function approveLeaveRequestAction(
  requestId: string,
  comments?: string
): Promise<ActionResult<{ isLossOfPay: boolean; lopDays: number; completed: boolean; nextStep?: string }>> {
  return run("approveLeave", async () => {
    const approver = await requireUser();

    const request = await db.leaveRequest.findUnique({ where: { id: requestId }, include: { leaveType: true } });
    if (!request) fail("Request not found.");
    if (request.userId === approver.id) fail("You can't approve your own leave.");
    if (request.status !== "PENDING") fail(`This request is already ${request.status.toLowerCase()}.`);

    const requester = await loadRequester(request.userId);
    if (!requester) fail("Employee not found.");
    // Requests created before routing existed have a single "Reporting Manager" step.
    const pending = await pendingStepOf(requestId);
    const role = pending?.step.approverRole ?? "Reporting Manager";
    if (!(await canActOnStep(approver, role, requester))) {
      fail(`This step needs approval from the ${role.toLowerCase()}${role === "HR Admin" ? "" : " (or an admin)"}.`);
    }
    const dateLabel = leaveDateLabel(dateKeyFromUtc(request.fromDate), dateKeyFromUtc(request.toDate));

    // Not the last step: record this approval and hand over to the next approver.
    if (pending?.next) {
      const { count } = await db.leaveApprovalStep.updateMany({
        where: { id: pending.step.id, status: "PENDING" },
        data: {
          status: "APPROVED",
          actionDate: new Date(),
          approverId: approver.id,
          approverName: approver.name || "Approver",
          comments: comments || "Approved",
        },
      });
      if (count === 0) fail("This request was just reviewed by someone else.");

      const nextApprovers = await approverIdsFor(pending.next.approverRole as ApproverRole, requester);
      await notify(approver.id, [
        ...nextApprovers.map((id) => ({
          userId: id,
          title: "Leave request to review",
          message: `${approver.name || "A manager"} approved a ${request.leaveType.name} request (${dateLabel}); it now needs your approval.`,
          relatedEntryId: request.id,
        })),
        {
          userId: request.userId,
          title: "Leave approved — next step pending",
          message: `${approver.name || "Your manager"} approved your ${request.leaveType.name} (${dateLabel}). Waiting for ${pending.next.stepName}.`,
          relatedEntryId: request.id,
        },
      ]);

      revalidateLeaveAndAttendance();
      return { isLossOfPay: request.isLossOfPay, lopDays: request.lopDaysCount, completed: false, nextStep: pending.next.stepName };
    }

    const year = request.fromDate.getUTCFullYear();
    const outcome = await db.$transaction(async (tx) => {
      let balance = await getOrOpenBalance(tx, request.userId, request.leaveType, year);
      // A row opened just now doesn't hold this request's pending days yet.
      if (balance.pendingDays < request.durationDays) {
        balance = await tx.userLeaveBalance.update({
          where: { id: balance.id },
          data: { pendingDays: request.durationDays },
        });
      }

      // LOP is decided now, against the balance as it stands — it may have changed since applying.
      // Other people's pending requests don't matter; this request's own pending days are excluded.
      const result = applyExceededRule({
        policy: request.leaveType,
        days: request.durationDays,
        available: await effectiveAvailable(tx, {
          userId: request.userId,
          type: request.leaveType,
          balance: { ...balance, pendingDays: 0 },
          onKey: dateKeyFromUtc(request.fromDate),
        }),
      });
      if ("error" in result) fail(result.error);

      const { count } = await tx.leaveRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: { status: "APPROVED", isLossOfPay: result.isLossOfPay, lopDaysCount: result.lopDays },
      });
      if (count === 0) fail("This request was just reviewed by someone else.");

      await tx.leaveApprovalStep.updateMany({
        where: pending ? { id: pending.step.id } : { leaveRequestId: requestId, stepOrder: 2 },
        data: {
          status: "APPROVED",
          actionDate: new Date(),
          approverId: approver.id,
          approverName: approver.name || "Approver",
          comments: comments || "Approved",
        },
      });

      await tx.userLeaveBalance.update({
        where: { id: balance.id },
        data: {
          bookedDays: { increment: request.durationDays },
          pendingDays: { decrement: request.durationDays },
          lossOfPayDays: result.isLossOfPay ? { increment: result.lopDays } : undefined,
        },
      });

      return result;
    });

    await notify(approver.id, [
      {
        userId: request.userId,
        title: "Leave approved",
        message: `${approver.name || "Your manager"} approved your ${request.leaveType.name} (${dateLabel})${
          outcome.isLossOfPay ? `. ${outcome.lopDays} day(s) are loss of pay.` : "."
        }`,
        relatedEntryId: request.id,
      },
    ]);

    revalidateLeaveAndAttendance();
    return { ...outcome, completed: true };
  });
}

// ── 4. REJECT LEAVE REQUEST (MANAGER ACTION) ─────────────────────────────────

export async function rejectLeaveRequestAction(requestId: string, rejectionReason?: string): Promise<ActionResult> {
  return run("rejectLeave", async () => {
    const approver = await requireUser();

    const request = await db.leaveRequest.findUnique({ where: { id: requestId }, include: { leaveType: true } });
    if (!request) fail("Request not found.");
    if (request.userId === approver.id) fail("You can't reject your own leave.");
    if (request.status !== "PENDING") fail(`This request is already ${request.status.toLowerCase()}.`);

    const requester = await loadRequester(request.userId);
    if (!requester) fail("Employee not found.");
    const pending = await pendingStepOf(requestId);
    const role = pending?.step.approverRole ?? "Reporting Manager";
    if (!(await canActOnStep(approver, role, requester))) {
      fail(`This step needs a decision from the ${role.toLowerCase()}${role === "HR Admin" ? "" : " (or an admin)"}.`);
    }

    await db.$transaction(async (tx) => {
      const { count } = await tx.leaveRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: { status: "REJECTED", rejectionReason: rejectionReason || "Rejected" },
      });
      if (count === 0) fail("This request was just reviewed by someone else.");

      await tx.leaveApprovalStep.updateMany({
        where: pending ? { id: pending.step.id } : { leaveRequestId: requestId, stepOrder: 2 },
        data: {
          status: "REJECTED",
          actionDate: new Date(),
          approverId: approver.id,
          approverName: approver.name || "Approver",
          comments: rejectionReason || "Rejected",
        },
      });

      // Release pending days back
      await tx.userLeaveBalance.updateMany({
        where: { userId: request.userId, leaveTypeId: request.leaveTypeId, year: request.fromDate.getUTCFullYear() },
        data: { pendingDays: { decrement: request.durationDays } },
      });
    });

    await notify(approver.id, [
      {
        userId: request.userId,
        title: "Leave rejected",
        message: `${approver.name || "Your manager"} rejected your ${request.leaveType.name} (${leaveDateLabel(
          dateKeyFromUtc(request.fromDate),
          dateKeyFromUtc(request.toDate)
        )})${rejectionReason ? `: ${rejectionReason}` : "."}`,
        relatedEntryId: request.id,
      },
    ]);

    revalidateLeaveAndAttendance();
    return {};
  });
}

// ── 5. APPLY FOR COMPENSATORY OFF ────────────────────────────────────────────

export async function applyCompensatoryAction(data: {
  workDate: string;
  fromTime: string;
  toTime: string;
  duration: "FULL_DAY" | "HALF_DAY" | "QUARTER_DAY";
  reason: string;
  attachments?: UploadedAttachment[];
}): Promise<ActionResult<{ id: string; expiryDate: string; hoursWorked: number }>> {
  return run("applyCompensatory", async () => {
    const user = await requireUser();
    const userId = user.id;

    const workKey = parseKey(data.workDate, "work date");
    if (workKey > istDateKey()) fail("You can't request a comp-off for a future date.");
    const workDate = dateFromKey(workKey)!;

    const fromTime = normalizeTime(data.fromTime);
    const toTime = normalizeTime(data.toTime);
    if (!fromTime || !toTime) fail("Enter the start and end time as e.g. 09:30 AM.");
    const minutes = workedMinutesBetween(fromTime, toTime);
    if (!minutes) fail("The end time must be after the start time.");
    const reason = requireReason(data.reason);
    const attachments = checkAttachments(data.attachments);

    const [existing, worked] = await Promise.all([
      db.compensatoryRequest.findFirst({
        where: { userId, workDate, status: { in: ["PENDING", "APPROVED"] } },
      }),
      db.dailyAttendance.findUnique({
        where: { userId_date: { userId, date: workDate } },
        select: { checkInTime: true },
      }),
    ]);
    if (existing) fail("You already have a comp-off request for this date.");
    // A comp-off is earned by working — the day must have a check-in.
    if (!worked?.checkInTime) fail("There's no check-in on this date, so there's no work to claim a comp-off for.");

    const expiryDate = compOffExpiry(workDate);
    const comp = await db.compensatoryRequest.create({
      data: {
        userId,
        workDate,
        fromTime,
        toTime,
        hoursWorked: Math.round((minutes / 60) * 100) / 100,
        duration: data.duration,
        creditedDays: compOffCredit(data.duration),
        reason,
        expiryDate,
        status: "PENDING",
        approvalSteps: {
          create: [
            {
              stepOrder: 1,
              stepName: "Requested",
              approverId: userId,
              approverName: user.name || "Employee",
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
        attachments: attachments.length ? { create: attachmentRows(attachments, userId) } : undefined,
      },
    });

    const requester = await loadRequester(userId);
    if (requester) {
      const approvers = await approverIdsFor("Reporting Manager", requester);
      await notify(
        userId,
        approvers.map((id) => ({
          userId: id,
          title: "Comp-off request to review",
          message: `${user.name || "An employee"} requested a comp-off for working on ${leaveDateLabel(workKey, workKey)}.`,
          relatedEntryId: comp.id,
        }))
      );
    }

    revalidateLeaveAndAttendance();
    return { id: comp.id, expiryDate: dateKeyFromUtc(expiryDate), hoursWorked: comp.hoursWorked };
  });
}

// ── 6. APPROVE COMPENSATORY OFF ──────────────────────────────────────────────

export async function approveCompensatoryAction(requestId: string): Promise<ActionResult> {
  return run("approveCompensatory", async () => {
    const manager = await requireManager();

    const comp = await db.compensatoryRequest.findUnique({ where: { id: requestId } });
    if (!comp) fail("Compensatory request not found.");
    if (comp.userId === manager.id) fail("You can't approve your own comp-off.");
    if (comp.status !== "PENDING") fail("This request has already been reviewed.");
    if (!(await canManageUser(manager, comp.userId))) fail("Only this person's reporting manager (or an admin) can approve it.");

    // The credit lands on the COMP leave type — without it, approving would credit nothing.
    const compLeaveType = await db.leaveType.findUnique({ where: { code: "COMP" } });
    if (!compLeaveType) {
      fail('No "Compensatory Off" leave type (code COMP) is set up. Create it under Leave Policy before approving.');
    }

    await db.$transaction(async (tx) => {
      // Conditional on PENDING so approving twice can't credit the balance twice.
      const { count } = await tx.compensatoryRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: { status: "APPROVED" },
      });
      if (count === 0) fail("This request was just reviewed by someone else.");

      await tx.leaveApprovalStep.updateMany({
        where: { compensatoryRequestId: requestId, stepOrder: 2 },
        data: {
          status: "APPROVED",
          actionDate: new Date(),
          approverId: manager.id,
          approverName: manager.name || "Manager",
          comments: "Approved by manager",
        },
      });

      const year = comp.workDate.getUTCFullYear();
      await tx.userLeaveBalance.upsert({
        where: { userId_leaveTypeId_year: { userId: comp.userId, leaveTypeId: compLeaveType.id, year } },
        update: { allocatedDays: { increment: comp.creditedDays } },
        create: { userId: comp.userId, leaveTypeId: compLeaveType.id, year, allocatedDays: comp.creditedDays },
      });
    });

    await notify(manager.id, [
      {
        userId: comp.userId,
        title: "Comp-off approved",
        message: `${manager.name || "Your manager"} approved your comp-off for ${leaveDateLabel(dateKeyFromUtc(comp.workDate), dateKeyFromUtc(comp.workDate))}: ${comp.creditedDays} day(s) added to your balance.`,
        relatedEntryId: comp.id,
      },
    ]);

    revalidateLeaveAndAttendance();
    return {};
  });
}

// ── 7. REJECT COMPENSATORY OFF ──────────────────────────────────────────────

export async function rejectCompensatoryAction(requestId: string, reason?: string): Promise<ActionResult> {
  return run("rejectCompensatory", async () => {
    const manager = await requireManager();

    const comp = await db.compensatoryRequest.findUnique({ where: { id: requestId } });
    if (!comp) fail("Compensatory request not found.");
    if (comp.userId === manager.id) fail("You can't reject your own comp-off.");
    if (comp.status !== "PENDING") fail("This request has already been reviewed.");
    if (!(await canManageUser(manager, comp.userId))) fail("Only this person's reporting manager (or an admin) can reject it.");

    await db.$transaction(async (tx) => {
      const { count } = await tx.compensatoryRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: { status: "REJECTED", rejectionReason: reason || "Rejected by manager" },
      });
      if (count === 0) fail("This request was just reviewed by someone else.");

      await tx.leaveApprovalStep.updateMany({
        where: { compensatoryRequestId: requestId, stepOrder: 2 },
        data: {
          status: "REJECTED",
          actionDate: new Date(),
          approverId: manager.id,
          approverName: manager.name || "Manager",
          comments: reason || "Rejected",
        },
      });
    });

    await notify(manager.id, [
      {
        userId: comp.userId,
        title: "Comp-off rejected",
        message: `${manager.name || "Your manager"} rejected your comp-off for ${leaveDateLabel(dateKeyFromUtc(comp.workDate), dateKeyFromUtc(comp.workDate))}${reason ? `: ${reason}` : "."}`,
        relatedEntryId: comp.id,
      },
    ]);

    revalidateLeaveAndAttendance();
    return {};
  });
}

// ── 8. ADJUST EMPLOYEE LEAVE BALANCE ────────────────────────────────────────

export async function adjustLeaveBalanceAction(data: {
  employeeId: string;
  leaveTypeId: string;
  adjustmentDays: number; // e.g. +3 or -1
  reason: "YEARLY_CORRECTION" | "SPECIAL_AWARD" | "POLICY_REVISION" | "LOSS_OF_PAY_REVERSAL" | "JOINING_PRORATION" | "OTHER";
  remarks?: string;
  year?: number;
}): Promise<ActionResult<{ newBalance: number }>> {
  return run("adjustLeaveBalance", async () => {
    const manager = await requireManager();
    const year = data.year || Number(istDateKey().slice(0, 4));
    const adjustmentDays = Math.round(Number(data.adjustmentDays) * 100) / 100;
    if (!Number.isFinite(adjustmentDays) || adjustmentDays === 0) fail("Enter the number of days to add or deduct.");
    if (Math.abs(adjustmentDays) > 366) fail("That adjustment is too large.");

    const [employee, leaveType] = await Promise.all([
      db.user.findUnique({ where: { id: data.employeeId }, select: { isActive: true } }),
      db.leaveType.findUnique({ where: { id: data.leaveTypeId }, select: { id: true } }),
    ]);
    if (!employee?.isActive) fail("Employee not found.");
    if (!leaveType) fail("Leave type not found.");
    if (!(await canManageUser(manager, data.employeeId))) fail("You can only adjust balances of people in your team.");

    const newBalance = await db.$transaction(async (tx) => {
      const balance = await tx.userLeaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: data.employeeId, leaveTypeId: data.leaveTypeId, year } },
      });
      const previousBalance = balance
        ? balance.allocatedDays + balance.carriedForward + balance.adjustedDays - balance.bookedDays
        : 0;
      const next = previousBalance + adjustmentDays;

      // Audit record
      await tx.leaveBalanceAdjustment.create({
        data: {
          userId: data.employeeId,
          adjustedById: manager.id,
          leaveTypeId: data.leaveTypeId,
          previousBalance,
          adjustmentDays,
          newBalance: next,
          reason: data.reason,
          remarks: data.remarks,
        },
      });

      await tx.userLeaveBalance.upsert({
        where: { userId_leaveTypeId_year: { userId: data.employeeId, leaveTypeId: data.leaveTypeId, year } },
        update: { adjustedDays: { increment: adjustmentDays } },
        create: { userId: data.employeeId, leaveTypeId: data.leaveTypeId, year, allocatedDays: 0, adjustedDays: adjustmentDays },
      });

      return next;
    });

    revalidateLeaveAndAttendance();
    return { newBalance };
  });
}

// ── 9. CREATE NEW LEAVE TYPE (WIZARD 6 STEPS) ────────────────────────────────

type TimeUnitInput = "DAYS" | "WEEKS" | "MONTHS" | "YEARS" | "HOURS";

export async function createLeaveTypeAction(data: {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  iconBgColor?: string;
  iconTextColor?: string;
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
  yearEndDate?: string;
  applicableTo?: "ALL_EMPLOYEES" | "FULL_TIME_ONLY" | "PROBATIONARY" | "CONTRACTORS" | "CUSTOM_DEPARTMENT";
  departments?: string[];
  employmentTypes?: string[];
  minServicePeriod?: number;
  minServiceUnit?: TimeUnitInput;
  allowFullDay?: boolean;
  allowHalfDay?: boolean;
  allowQuarterDay?: boolean;
  allowHourly?: boolean;
  allowPastDays?: boolean;
  pastDaysLimit?: number;
  pastDaysUnit?: TimeUnitInput;
  allowAdvanceDays?: boolean;
  advanceDaysLimit?: number;
  advanceDaysUnit?: TimeUnitInput;
  minAdvanceNotice?: number;
  minAdvanceNoticeUnit?: TimeUnitInput;
  minLeavePerRequest?: number;
  maxLeavePerRequest?: number;
  maxConsecutiveDays?: number;
  minGapBetweenRequests?: number;
  maxRequestsCount?: number;
  maxRequestsPeriod?: TimeUnitInput;
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
}): Promise<ActionResult<{ id: string }>> {
  return run("createLeaveType", async () => {
    await requireManager();

    const name = (data.name || "").trim();
    const code = (data.code || "").trim().toUpperCase();
    if (!name) fail("Enter a leave type name.");
    if (!/^[A-Z0-9_]{1,10}$/.test(code)) fail("The leave code must be 1–10 letters or digits.");
    const effectiveDate = dateFromKey(parseKey(data.effectiveDate, "effective date"))!;
    const expiryDate = data.expiryDate ? dateFromKey(parseKey(data.expiryDate, "expiry date"))! : null;
    if (expiryDate && expiryDate < effectiveDate) fail("The expiry date can't be before the effective date.");
    const yearEndDate = data.yearEndDate ? dateFromKey(parseKey(data.yearEndDate, "year end date")) : null;
    if (!(Number(data.annualEntitlement) >= 0)) fail("The entitlement can't be negative.");
    if (!(data.allowFullDay ?? true) && !(data.allowHalfDay ?? true) && !data.allowQuarterDay && !(data.allowHourly ?? true)) {
      fail("Allow at least one leave duration.");
    }

    const taken = await db.leaveType.findUnique({ where: { code }, select: { name: true } });
    if (taken) fail(`The code ${code} is already used by ${taken.name}.`);

    const newType = await db.leaveType.create({
      data: {
        name,
        code,
        description: data.description,
        icon: data.icon || "Thermometer",
        iconBgColor: data.iconBgColor || "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40",
        iconTextColor: data.iconTextColor || "text-emerald-600",
        isActive: data.isActive ?? true,
        effectiveDate,
        expiryDate,
        category: data.category || "PAID",
        allocationFrequency: data.allocationFrequency || "YEARLY",
        annualEntitlement: data.annualEntitlement,
        allowCarryForward: data.allowCarryForward ?? true,
        carryForwardLimit: data.carryForwardLimit ?? 5,
        balanceResetRule: data.balanceResetRule || "CARRY_FORWARD_UP_TO_LIMIT",
        exceededRule: data.exceededRule || "MARK_AS_LOP",
        yearEndDate,
        applicableTo: data.applicableTo || "ALL_EMPLOYEES",
        departments: data.departments || [],
        employmentTypes: data.employmentTypes || [],
        minServicePeriod: data.minServicePeriod ?? 6,
        minServiceUnit: data.minServiceUnit || "MONTHS",
        allowFullDay: data.allowFullDay ?? true,
        allowHalfDay: data.allowHalfDay ?? true,
        allowQuarterDay: data.allowQuarterDay ?? false,
        allowHourly: data.allowHourly ?? true,
        allowPastDays: data.allowPastDays ?? true,
        pastDaysLimit: data.pastDaysLimit ?? 7,
        pastDaysUnit: data.pastDaysUnit || "DAYS",
        allowAdvanceDays: data.allowAdvanceDays ?? true,
        advanceDaysLimit: data.advanceDaysLimit ?? 90,
        advanceDaysUnit: data.advanceDaysUnit || "DAYS",
        minAdvanceNotice: data.minAdvanceNotice ?? 2,
        minAdvanceNoticeUnit: data.minAdvanceNoticeUnit || "DAYS",
        minLeavePerRequest: data.minLeavePerRequest ?? 0.5,
        maxLeavePerRequest: data.maxLeavePerRequest ?? 10,
        maxConsecutiveDays: data.maxConsecutiveDays ?? 15,
        minGapBetweenRequests: data.minGapBetweenRequests ?? 2,
        maxRequestsCount: data.maxRequestsCount ?? 3,
        maxRequestsPeriod: data.maxRequestsPeriod || "MONTHS",
        applicableDays: data.applicableDays || ["Mon", "Tue", "Wed", "Thu", "Fri"],
        sandwichPolicy: data.sandwichPolicy ?? true,
        sandwichWeekends: data.sandwichWeekends ?? true,
        sandwichHolidays: data.sandwichHolidays ?? true,
        clubbingRestrictedCodes: data.clubbingRestrictedCodes || [],
        supportingDocPolicy: data.supportingDocPolicy || "REQUIRED_WHEN_EXCEEDS",
        docExceedsDays: data.docExceedsDays ?? 3,
        acceptedFileTypes: data.acceptedFileTypes || ["PDF", "JPG", "PNG"],
        maxFileSizeMb: data.maxFileSizeMb ?? 5,
        managerApprovalRequired: data.managerApprovalRequired ?? true,
        approvalFlow: data.approvalFlow || "DIRECT_MANAGER",
        allowAdminApplyOnBehalf: data.allowAdminApplyOnBehalf ?? true,
        employeeVisibility: data.employeeVisibility || "COMPLETE_LEAVE_SUMMARY",
        balanceDisplayPref: data.balanceDisplayPref || "LEAVE_REQUEST_START_DATE",
      },
    });

    // Provision this year's balance for active internal staff (project clients don't take leave).
    const users = await db.user.findMany({
      where: { isActive: true, OR: [{ profileRole: null }, { profileRole: { not: "CLIENT" } }] },
      select: { id: true },
    });
    const year = Number(istDateKey().slice(0, 4));
    await db.userLeaveBalance.createMany({
      data: users.map((u) => ({ userId: u.id, leaveTypeId: newType.id, year, allocatedDays: newType.annualEntitlement })),
      skipDuplicates: true,
    });

    revalidateLeaveAndAttendance();
    return { id: newType.id };
  });
}

// ── 10. TOGGLE LEAVE TYPE STATUS ─────────────────────────────────────────────

export async function toggleLeaveTypeStatusAction(id: string, isActive: boolean): Promise<ActionResult> {
  return run("toggleLeaveTypeStatus", async () => {
    await requireManager();
    await db.leaveType.update({ where: { id }, data: { isActive } });
    revalidatePath("/pulse/leave/team");
    revalidatePath("/pulse/leave");
    return {};
  });
}

// ── 11. HOLIDAYS CRUD ────────────────────────────────────────────────────────

export async function createHolidayAction(data: {
  name: string;
  date: string;
  type: "PUBLIC" | "OPTIONAL" | "COMPANY_SPECIAL";
  description?: string;
}): Promise<ActionResult> {
  return run("createHoliday", async () => {
    const manager = await requireManager();

    const name = (data.name || "").trim();
    if (!name) fail("Enter a holiday name.");
    const holidayDate = dateFromKey(parseKey(data.date, "holiday date"))!;

    const duplicate = await db.holiday.findFirst({ where: { date: holidayDate, name } });
    if (duplicate) fail(`${name} is already on this date.`);

    await db.holiday.create({
      data: {
        name,
        date: holidayDate,
        dayOfWeek: FULL_DAY_NAMES[holidayDate.getUTCDay()],
        year: holidayDate.getUTCFullYear(),
        type: data.type,
        isOptional: data.type === "OPTIONAL",
        description: data.description,
        createdById: manager.id,
      },
    });

    revalidateLeaveAndAttendance();
    return {};
  });
}

export async function deleteHolidayAction(id: string): Promise<ActionResult> {
  return run("deleteHoliday", async () => {
    await requireManager();
    await db.holiday.delete({ where: { id } });
    revalidateLeaveAndAttendance();
    return {};
  });
}
