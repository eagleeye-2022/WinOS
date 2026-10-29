"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { MANDATORY_HOLIDAY } from "../attendance-data";
import { compOffCredit, compOffExpiry } from "@/features/leave/leave-rules";
import { reverseGeocode } from "@/lib/reverse-geocode";
import { canManageUser } from "../team-scope";
import { approverIdsFor, loadRequester, notify } from "@/features/leave/approval-flow";
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
  revalidatePath("/people/home");
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

/** GPS fix taken in the browser at check-in. */
export interface CheckInLocation {
  latitude: number;
  longitude: number;
  /** Metres, as reported by the browser. */
  accuracy?: number;
}

/** "18.44939, 73.89241" — stored in checkInLocationName (there are no lat/lng columns). */
function formatCoords(loc: CheckInLocation): string {
  return `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
}

function validLocation(loc: CheckInLocation | undefined): loc is CheckInLocation {
  return (
    !!loc &&
    Number.isFinite(loc.latitude) &&
    Number.isFinite(loc.longitude) &&
    Math.abs(loc.latitude) <= 90 &&
    Math.abs(loc.longitude) <= 180
  );
}

/** A location saved as bare "lat, lng" (no place name found, or saved before names existed). */
const COORDS_ONLY = /^\s*-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?\s*$/;

/** Only selfies saved through our own upload route. */
const PHOTO_URL = /^\/api\/uploads\/[^/?#]+\.(jpe?g|png|webp)$/i;

/**
 * Worst GPS accuracy accepted for a check-in, in metres. Browsers without a real fix (e.g. Windows with
 * Location services off) report an IP-based guess with accuracy in the thousands of km.
 * Keep in sync with MAX_ACCURACY_M in check-in-capture-modal.
 */
const MAX_LOCATION_ACCURACY_M = 1000;

/** Refusal message when a check-in/out capture is missing or too imprecise, else null. */
function captureError(payload: { location?: CheckInLocation; photo?: string } | undefined, verb: string): string | null {
  if (!validLocation(payload?.location)) return `Allow location access to ${verb}.`;
  if (!payload?.photo || !PHOTO_URL.test(payload.photo)) return `Take a photo to ${verb}.`;
  // A missing accuracy fails this too (NaN <= n is false).
  if (!(Number(payload.location.accuracy) <= MAX_LOCATION_ACCURACY_M)) {
    return `Your location isn't precise enough to ${verb}. Turn on device location and try again.`;
  }
  return null;
}

/**
 * Location name + address line for a GPS fix: the OpenStreetMap area name when found (coordinates
 * kept in the address for the map link), else the bare coordinates.
 */
async function describeLocation(loc: CheckInLocation, { lookup = true } = {}) {
  const coords = formatCoords(loc);
  const accuracy = loc.accuracy && Number.isFinite(loc.accuracy) ? `±${Math.round(loc.accuracy)} m` : null;
  const place = lookup ? await reverseGeocode(loc.latitude, loc.longitude) : null;
  return {
    place,
    locationName: place?.name ?? coords,
    address: place
      ? `${place.address} · ${coords}${accuracy ? ` (${accuracy})` : ""}`
      : accuracy
      ? `GPS accuracy ${accuracy}`
      : null,
  };
}

/** Place name for a GPS fix, shown in the check-in dialog before confirming (cached for the check-in itself). */
export async function lookupPlaceAction(loc: CheckInLocation) {
  const user = await currentUser();
  if (!user || !validLocation(loc)) return null;
  return reverseGeocode(loc.latitude, loc.longitude);
}

export async function checkInAction(payload?: {
  workMode?: "OFFICE" | "REMOTE";
  source?: string;
  /** Required: where the employee is when checking in. */
  location?: CheckInLocation;
  /** Required: selfie URL from POST /api/uploads. */
  photo?: string;
}) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized");

  const invalid = captureError(payload, "check in");
  if (invalid || !payload?.location || !payload.photo) return fail(invalid ?? "Take a photo to check in.");

  // Taken before the address lookup, so the check-in time is when the employee confirmed.
  const now = new Date();
  const today = dateFromKey(istDateKey(now))!;
  const timeStr = istTimeString(now);

  const existing = await db.dailyAttendance.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });

  if (existing?.isLive) {
    return { success: true as const, message: "Already checked in", record: existing };
  }

  // A full-day leave would hide the day's work (attendance shows the leave), so the leave has to go
  // first. Half-day / hourly leave leaves the rest of the day to work. Weekends and holidays aren't
  // charged as leave, so working on one (comp-off) is still allowed.
  const todayKey = istDateKey(now);
  if (!isWeekendKey(todayKey)) {
    const [holiday, fullDayLeave] = await Promise.all([
      db.holiday.findFirst({ where: { date: today, ...MANDATORY_HOLIDAY }, select: { id: true } }),
      db.leaveRequest.findFirst({
        where: {
          userId: user.id,
          status: { in: ["APPROVED", "PENDING"] },
          durationType: "FULL_DAY",
          fromDate: { lte: today },
          toDate: { gte: today },
        },
        include: { leaveType: { select: { name: true } } },
      }),
    ]);
    if (!holiday && fullDayLeave) {
      return fail(
        fullDayLeave.status === "APPROVED"
          ? `You're on ${fullDayLeave.leaveType.name} today. Cancel the leave first if you're working.`
          : `You have a ${fullDayLeave.leaveType.name} request for today. Withdraw it first if you're working.`
      );
    }
  }

  // Resuming the day keeps the first check-in's location, so no lookup is needed then — except a
  // first check-in saved before place names existed (coordinates only), which gets one now.
  const keepExisting = Boolean(existing?.checkInLocationName) && !COORDS_ONLY.test(existing!.checkInLocationName!);
  const { place, locationName, address } = await describeLocation(payload.location, { lookup: !keepExisting });

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
      checkInLocationName: locationName,
      checkInAddress: address,
      checkInPhoto: payload.photo,
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
      // Resuming the day keeps the first check-in's location and photo (that's the day's check-in) —
      // unless that location is bare coordinates and a place name was found now.
      checkInLocationName: place || !existing?.checkInLocationName ? locationName : existing.checkInLocationName,
      checkInAddress: place || !existing?.checkInLocationName ? address : existing.checkInAddress,
      checkInPhoto: existing?.checkInPhoto || payload.photo,
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
  /** Required: where the employee is when checking out. */
  location?: CheckInLocation;
  /** Required: selfie URL from POST /api/uploads. */
  photo?: string;
}) {
  const user = await currentUser();
  if (!user) return fail("Unauthorized");

  const invalid = captureError(payload, "check out");
  if (invalid || !payload?.location || !payload.photo) return fail(invalid ?? "Take a photo to check out.");

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

  const { locationName, address } = await describeLocation(payload.location);

  const record = await db.dailyAttendance.update({
    where: { userId_date: { userId: user.id, date: today } },
    data: {
      status: "PRESENT",
      checkOutTime: timeStr,
      checkOutSource: payload.source || "Web",
      checkOutLocationName: locationName,
      checkOutAddress: address,
      checkOutPhoto: payload.photo,
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
  if (onBehalf && !(await canManageUser(actor, payload.forUserId!))) {
    return fail("You can only regularize on behalf of people in your team.");
  }
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
    await notify(actor.id, [
      {
        userId,
        title: "Attendance regularized",
        message: `${actor.name || "Your manager"} regularized your attendance for ${key.split("-").reverse().join("/")} (${checkIn} – ${checkOut}).`,
        relatedEntryId: request.id,
      },
    ]);
  } else {
    const requester = await loadRequester(userId);
    if (requester) {
      const approvers = await approverIdsFor("Reporting Manager", requester);
      await notify(
        actor.id,
        approvers.map((id) => ({
          userId: id,
          title: "Regularization to review",
          message: `${actor.name || "An employee"} asked to regularize ${key.split("-").reverse().join("/")} (${checkIn} – ${checkOut}).`,
          relatedEntryId: request.id,
        }))
      );
    }
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
  if (!(await canManageUser(reviewer, current.userId))) {
    return fail("Only this person's reporting manager (or an admin) can review it.");
  }
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

  const day = dateKeyFromUtc(current.missingDate).split("-").reverse().join("/");
  await notify(reviewer.id, [
    {
      userId: current.userId,
      title: payload.status === "APPROVED" ? "Regularization approved" : "Regularization rejected",
      message:
        payload.status === "APPROVED"
          ? `${reviewer.name || "Your manager"} approved your regularization for ${day}.`
          : `${reviewer.name || "Your manager"} rejected your regularization for ${day}${
              payload.rejectionReason?.trim() ? `: ${payload.rejectionReason.trim()}` : "."
            }`,
      relatedEntryId: current.id,
    },
  ]);

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

  const workKey = payload.workDate.slice(0, 10);
  const dateObj = dateFromKey(workKey);
  if (!dateObj) return fail("Invalid work date.");
  if (workKey > istDateKey()) return fail("You can't request a comp-off for a future date.");
  const reason = (payload.reason || "").trim();
  if (!reason) return fail("A reason is required.");

  const [existing, worked] = await Promise.all([
    db.compensatoryRequest.findFirst({
      where: { userId: user.id, workDate: dateObj, status: { in: ["PENDING", "APPROVED"] } },
    }),
    db.dailyAttendance.findUnique({
      where: { userId_date: { userId: user.id, date: dateObj } },
      select: { checkInTime: true },
    }),
  ]);
  if (existing) return fail("You already have a comp-off request for this date.");
  // A comp-off is earned by working — the day must have a check-in.
  if (!worked?.checkInTime) return fail("There's no check-in on this date, so there's no work to claim a comp-off for.");

  const duration = payload.hoursWorked >= 7 ? "FULL_DAY" : "HALF_DAY";
  const compOff = await db.compensatoryRequest.create({
    data: {
      userId: user.id,
      workDate: dateObj,
      fromTime: payload.fromTime,
      toTime: payload.toTime,
      hoursWorked: payload.hoursWorked,
      duration,
      creditedDays: compOffCredit(duration),
      reason,
      // Same validity as comp-offs applied from the Leave module.
      expiryDate: compOffExpiry(dateObj),
      status: "PENDING",
      approvalSteps: {
        create: [
          {
            stepOrder: 1,
            stepName: "Requested",
            approverId: user.id,
            approverName: user.name || "Employee",
            approverRole: "Applicant",
            status: "APPROVED",
            actionDate: new Date(),
          },
          { stepOrder: 2, stepName: "Manager Approval", approverRole: "Reporting Manager", status: "PENDING" },
        ],
      },
    },
  });

  const requester = await loadRequester(user.id);
  if (requester) {
    const approvers = await approverIdsFor("Reporting Manager", requester);
    await notify(
      user.id,
      approvers.map((id) => ({
        userId: id,
        title: "Comp-off request to review",
        message: `${user.name || "An employee"} requested a comp-off for working on ${workKey.split("-").reverse().join("/")}.`,
        relatedEntryId: compOff.id,
      }))
    );
  }

  revalidateAttendance();
  return { success: true as const, compOff };
}
