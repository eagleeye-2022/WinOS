// Leave approval routing (server-only; imported by leave actions, not a "use server" module).
// Implements LeaveType.approvalFlow / managerApprovalRequired, who may act on each step, and who is
// notified. Notifications reuse the generic DSM_REMINDER type (as Support Needed does) — there is no
// leave-specific NotificationType in the schema.

import { db } from "@/lib/db";
import { canManageAttendance } from "@/features/attendance/utils";
import { canManageUser, isPulseAdmin, type Viewer } from "@/features/attendance/team-scope";

export type ApproverRole = "Reporting Manager" | "Department Head" | "HR Admin";

export interface StepTemplate {
  stepName: string;
  approverRole: ApproverRole;
}

/** Approval steps (after the applicant's own "Requested" step) for a leave type. */
export function approvalStepsFor(flow: string | null | undefined, managerApprovalRequired: boolean): StepTemplate[] {
  if (!managerApprovalRequired) return [];
  switch (flow) {
    case "DEPARTMENT_HEAD":
      return [{ stepName: "Department Head Approval", approverRole: "Department Head" }];
    case "HR_ADMIN":
      return [{ stepName: "HR Approval", approverRole: "HR Admin" }];
    case "CUSTOM_TWO_STEP":
      return [
        { stepName: "Manager Approval", approverRole: "Reporting Manager" },
        { stepName: "HR Approval", approverRole: "HR Admin" },
      ];
    default:
      return [{ stepName: "Manager Approval", approverRole: "Reporting Manager" }];
  }
}

interface Requester {
  id: string;
  department: string | null;
  reportingToId: string | null;
  secondaryReportingToId: string | null;
}

export async function loadRequester(userId: string): Promise<Requester | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, department: true, reportingToId: true, secondaryReportingToId: true },
  });
}

async function departmentHeadIds(r: Requester): Promise<string[]> {
  const teams = await db.team.findMany({
    where: {
      leadId: { not: null },
      OR: [...(r.department ? [{ department: r.department }] : []), { members: { some: { userId: r.id } } }],
    },
    select: { leadId: true },
  });
  return [...new Set(teams.map((t) => t.leadId!).filter((id) => id !== r.id))];
}

async function adminIds(excludeId: string): Promise<string[]> {
  const admins = await db.user.findMany({
    where: { isActive: true, profileRole: { in: ["ADMIN", "PORTAL_OWNER"] }, id: { not: excludeId } },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

async function reportingManagerIds(r: Requester): Promise<string[]> {
  const direct = [r.reportingToId, r.secondaryReportingToId].filter((id): id is string => Boolean(id) && id !== r.id);
  if (direct.length) {
    const active = await db.user.findMany({ where: { id: { in: direct }, isActive: true }, select: { id: true } });
    if (active.length) return active.map((u) => u.id);
  }
  // No reporting manager set: every manager may approve (see team-scope), so tell them all.
  const managers = await db.user.findMany({
    where: { isActive: true, id: { not: r.id } },
    select: { id: true, role: true, profileRole: true },
  });
  return managers.filter((m) => canManageAttendance(m)).map((m) => m.id);
}

/** Who should act on a step (used for notifications). Falls back to the reporting manager. */
export async function approverIdsFor(role: ApproverRole, r: Requester): Promise<string[]> {
  if (role === "Department Head") {
    const heads = await departmentHeadIds(r);
    if (heads.length) return heads;
  } else if (role === "HR Admin") {
    const admins = await adminIds(r.id);
    if (admins.length) return admins;
  }
  return reportingManagerIds(r);
}

/** Whether `viewer` may approve / reject a step with this role for `r`. Admins may act on any step. */
export async function canActOnStep(viewer: Viewer, role: ApproverRole | string | null, r: Requester): Promise<boolean> {
  if (viewer.id === r.id) return false;
  if (isPulseAdmin(viewer)) return true;
  if (role === "Department Head") {
    const heads = await departmentHeadIds(r);
    if (heads.length) return heads.includes(viewer.id);
  } else if (role === "HR Admin") {
    // Only admins — unless the org has none, then the reporting manager can.
    if ((await adminIds(r.id)).length) return false;
  }
  return canManageUser(viewer, r.id);
}

/** Best-effort in-app notifications; never blocks the action. */
export async function notify(
  createdById: string,
  rows: { userId: string; title: string; message: string; relatedEntryId?: string }[]
): Promise<void> {
  const data = rows
    .filter((r) => r.userId && r.userId !== createdById)
    .map((r) => ({ type: "DSM_REMINDER" as const, createdById, ...r }));
  if (!data.length) return;
  try {
    await db.notification.createMany({ data });
  } catch (err) {
    console.warn("[leave] notification failed:", err instanceof Error ? err.message : err);
  }
}
