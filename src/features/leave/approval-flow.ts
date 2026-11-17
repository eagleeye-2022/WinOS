// Leave approval routing (server-only; imported by leave actions, not a "use server" module).
// Implements LeaveType.approvalFlow / managerApprovalRequired, who may act on each step, and who is
// notified. Notifications reuse the generic DSM_REMINDER type (as Support Needed does) — there is no
// leave-specific NotificationType in the schema.

import { after } from "next/server";
import { db } from "@/lib/db";
import { sendRequestUpdateEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/zoho-cliq";
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
  // Nobody approves or rejects their own request — it goes to someone above them (an admin, their
  // reporting manager, or any other manager when none is set).
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

type NotifyRow = { userId: string; title: string; message: string; relatedEntryId?: string };

/**
 * Best-effort in-app notifications plus an email to each recipient; never blocks the action.
 * `options.link` is the app path the email's "Open in WinOS" button goes to; `options.actorLabel`
 * overrides the "Approved by" / "Requested by" line the email works out from the title.
 */
export async function notify(
  createdById: string,
  rows: NotifyRow[],
  options?: { link?: string; actorLabel?: string }
): Promise<void> {
  const recipients = rows.filter((r) => r.userId && r.userId !== createdById);
  if (!recipients.length) return;
  try {
    await db.notification.createMany({
      data: recipients.map((r) => ({ type: "DSM_REMINDER" as const, createdById, ...r })),
    });
  } catch (err) {
    console.warn("[leave] notification failed:", err instanceof Error ? err.message : err);
  }
  scheduleEmails(createdById, recipients, options ?? {});
}

/** "Approved by" / "Rejected by" / … for the email, from the notification title. */
function actorLabelFor(title: string): string {
  if (/rejected/i.test(title)) return "Rejected by";
  if (/approved|regularized/i.test(title)) return "Approved by";
  if (/cancelled/i.test(title)) return "Cancelled by";
  if (/applied for you/i.test(title)) return "Applied by";
  if (/to review/i.test(title)) return "Requested by";
  return "By";
}

// TEMPORARY: every email meant for an approver (leave / comp-off / regularization "to review") goes
// to this one address instead of the real reporting manager(s). Set to null to use the real managers.
const MANAGER_EMAIL_OVERRIDE: string | null = "m.thakre@eagleeyedigital.io";

/** Approver-bound notifications ("Leave request to review", "Regularization to review", …). */
const isForApprover = (title: string) => /to review/i.test(title);

/** "/pulse/leave/requests/x" → "/pulse/leave/team/requests/x" (same for compensatory); others unchanged. */
const teamLeaveLink = (link: string) => link.replace(/^\/pulse\/leave\/(requests|compensatory)\//, "/pulse/leave/team/$1/");

const PRODUCTION_BASE_URL = "https://winos.eagleeyedigital.io";

/**
 * Base URL for the email buttons: APP_BASE_URL / NEXTAUTH_URL / AUTH_URL when set, else localhost
 * in development and the live WinOS site in production.
 */
function emailBaseUrl(): string {
  const configured = getAppBaseUrl();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return `http://localhost:${process.env.PORT || 3000}`;
  return PRODUCTION_BASE_URL;
}

/** Emails go out after the response is sent, so a slow SMTP server never delays the action. */
function scheduleEmails(createdById: string, rows: NotifyRow[], options: { link?: string; actorLabel?: string }) {
  const send = () => sendNotificationEmails(createdById, rows, options);
  try {
    after(send);
  } catch {
    // Outside a request (scripts, tests): send now, still best-effort.
    void send();
  }
}

async function sendNotificationEmails(
  createdById: string,
  rows: NotifyRow[],
  { link, actorLabel }: { link?: string; actorLabel?: string }
) {
  try {
    const users = await db.user.findMany({
      where: { id: { in: [createdById, ...rows.map((r) => r.userId)] } },
      select: { id: true, name: true, email: true, isActive: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const actorName = byId.get(createdById)?.name ?? null;
    const base = emailBaseUrl();

    // With the override, several approvers collapse into one address — send that email once.
    const sent = new Set<string>();
    const results = await Promise.allSettled(
      rows.map((r) => {
        const to = byId.get(r.userId);
        if (!to?.email || !to.isActive) return Promise.resolve();
        const overridden = MANAGER_EMAIL_OVERRIDE !== null && isForApprover(r.title);
        const address = overridden ? MANAGER_EMAIL_OVERRIDE! : to.email;
        const dedupeKey = `${address}\n${r.title}\n${r.message}`;
        if (sent.has(dedupeKey)) return Promise.resolve();
        sent.add(dedupeKey);
        // Approvers open the request under Team Leave; the member under My Leaves.
        const path = link && isForApprover(r.title) ? teamLeaveLink(link) : link;
        const url = path ? `${base}${path}` : null;
        return sendRequestUpdateEmail({
          to: address,
          recipientName: overridden ? null : to.name,
          title: r.title,
          message: r.message,
          actorName,
          actorLabel: actorLabel ?? actorLabelFor(r.title),
          actions: isForApprover(r.title) ? "review" : "view",
          url,
        });
      })
    );
    for (const res of results) {
      if (res.status === "rejected") {
        console.warn("[leave] email failed:", res.reason instanceof Error ? res.reason.message : res.reason);
      }
    }
  } catch (err) {
    console.warn("[leave] email failed:", err instanceof Error ? err.message : err);
  }
}
