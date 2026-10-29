// Who a manager is responsible for in Pulse (team attendance, team leave, approvals).
// Server-only (not a "use server" module) — imported by the attendance / leave queries and actions.
//
// Rule:
//  - Admins (profileRole ADMIN / PORTAL_OWNER) manage everyone.
//  - Other managers manage their reporting tree (primary or secondary reports, any depth)
//    plus everyone who has no reporting manager set — so nobody is left without an approver,
//    and an org that hasn't filled in reporting lines behaves as before (every manager sees all).

import { db } from "@/lib/db";
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
 * Ids of the people `viewer` manages, or null for "everyone" (admins).
 * Non-managers manage nobody.
 */
export async function managedUserIds(viewer: Viewer): Promise<Set<string> | null> {
  if (!canManageAttendance(viewer)) return new Set();
  if (isPulseAdmin(viewer)) return null;
  const org = await db.user.findMany({
    where: { isActive: true, OR: [{ profileRole: null }, { profileRole: { not: "CLIENT" } }] },
    select: { id: true, reportingToId: true, secondaryReportingToId: true, profileRole: true },
  });
  const hasAdmin = org.some((u) => ADMIN_PROFILE_ROLES.has(u.profileRole ?? ""));
  return managedIdsFrom(viewer.id, org, !hasAdmin);
}

/** Prisma `where` fragment limiting rows to the people the viewer manages. */
export function scopeWhere(ids: Set<string> | null, field = "userId") {
  return ids === null ? {} : { [field]: { in: [...ids] } };
}

/** Whether `viewer` may act on (approve, review, view) `targetUserId`'s Pulse records. */
export async function canManageUser(viewer: Viewer, targetUserId: string): Promise<boolean> {
  if (!canManageAttendance(viewer) || viewer.id === targetUserId) return false;
  const ids = await managedUserIds(viewer);
  return ids === null || ids.has(targetUserId);
}
