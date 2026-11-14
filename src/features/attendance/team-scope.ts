// Who a manager is responsible for in Pulse (team attendance, team leave, approvals).
// Server-only (not a "use server" module) — imported by the attendance / leave queries and actions.
//
// Rule: every manager (role MANAGER, or profileRole MANAGER / ADMIN / PORTAL_OWNER) manages every
// employee except themselves. Leave steps routed to a Department Head or HR Admin keep their own
// rules (see leave/approval-flow.ts).

import { canManageAttendance } from "./utils";

export interface Viewer {
  id: string;
  role?: string | null;
  profileRole?: string | null;
}

const ADMIN_PROFILE_ROLES = new Set(["ADMIN", "PORTAL_OWNER"]);

export function isPulseAdmin(viewer: Viewer): boolean {
  return ADMIN_PROFILE_ROLES.has(viewer.profileRole ?? "");
}

interface OrgRow {
  id: string;
  reportingToId: string | null;
  secondaryReportingToId: string | null;
}

/**
 * Pure part of the rule, so it can be unit-tested.
 * `includeUnassignedManagers`: whether unassigned people who have reports of their own (the top of a
 * tree) are visible too — only when the org has no admin to look after them.
 */
export function managedIdsFrom(viewerId: string, org: OrgRow[], includeUnassignedManagers = false): Set<string> {
  const reportsOf = new Map<string, string[]>();
  for (const u of org) {
    for (const m of [u.reportingToId, u.secondaryReportingToId]) {
      if (!m) continue;
      const list = reportsOf.get(m) ?? [];
      list.push(u.id);
      reportsOf.set(m, list);
    }
  }

  const managed = new Set<string>();
  const queue = [viewerId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const r of reportsOf.get(id) ?? []) {
      if (r === viewerId || managed.has(r)) continue;
      managed.add(r);
      queue.push(r);
    }
  }
  // Unassigned people stay visible to every manager — except top-of-tree managers, who are the
  // admins' to approve (a team lead shouldn't approve their own boss's leave).
  for (const u of org) {
    if (u.reportingToId || u.secondaryReportingToId || u.id === viewerId) continue;
    if (reportsOf.has(u.id) && !includeUnassignedManagers) continue;
    managed.add(u.id);
  }
  return managed;
}

/**
 * Ids of the people `viewer` manages, or null for "everyone".
 * Every manager manages everyone (product decision, Nov 2026: any manager can see, approve and raise
 * requests for any team member — not just their reporting tree). Non-managers manage nobody.
 * Nobody manages themselves: canManageUser refuses the viewer's own id, so a manager's own
 * requests still go to someone else. `managedIdsFrom` keeps the reporting-tree rule if it's needed again.
 */
export async function managedUserIds(viewer: Viewer): Promise<Set<string> | null> {
  if (!canManageAttendance(viewer)) return new Set();
  return null;
}

/** True when a reviewer would be approving / rejecting / adjusting their own record. */
export function isSelfAction(viewer: Viewer, targetUserId: string): boolean {
  return viewer.id === targetUserId;
}

/** Prisma `where` fragment limiting rows to the people the viewer manages. */
export function scopeWhere(ids: Set<string> | null, field = "userId") {
  return ids === null ? {} : { [field]: { in: [...ids] } };
}

/**
 * Whether `viewer` may view / act on `targetUserId`'s Pulse records. True for the viewer's own id when
 * they're a manager, so approve / reject / adjust gates must also call `isSelfAction` — nobody approves
 * their own request.
 */
export async function canManageUser(viewer: Viewer, targetUserId: string): Promise<boolean> {
  if (!canManageAttendance(viewer)) return false;
  const ids = await managedUserIds(viewer);
  return ids === null || ids.has(targetUserId);
}
