/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ActingUser, loadActingUser } from "../access";
import { recordSopEvents } from "../events";
import { loadSopShares } from "../sharing";
import { SOP_DEPARTMENTS, type SopShare, type SopShareTarget, type SopShareUserOption } from "../types";
import { sopDepartmentFor } from "../utils";

const d = db as any;
const SOP_PATH = "/projects/sop-checklists";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

async function requireManager(): Promise<ActingUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await loadActingUser(session.user.id);
  return user?.isManager ? user : null;
}

/** Everyone a manager can share with. */
export async function getSopShareUsersAction(): Promise<SopShareUserOption[]> {
  if (!(await requireManager())) return [];
  const users = await db.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, department: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.name || u.email, department: u.department ?? null }));
}

/** All shares, for the Share dialogs and the "shared" marks on the board (managers). */
export async function getSopSharesAction(): Promise<SopShare[]> {
  if (!(await requireManager())) return [];
  return loadSopShares();
}

/**
 * Replaces who a list or SOP card is shared with. Writes only SopChecklistShare, plus one
 * SopChecklistEvent per SOP affected, so it shows on their timelines.
 */
export async function setSopShareAction(
  target: SopShareTarget,
  people: { userIds: string[]; departments: string[] }
): Promise<Result<{ shares: SopShare[] }>> {
  const user = await requireManager();
  if (!user) return { success: false, error: "Only managers can share SOPs" };

  const scope =
    target.kind === "sop"
      ? { templateId: target.templateId, department: null, listName: null }
      : { templateId: null, department: target.department, listName: target.list };
  if (target.kind === "list" && !(SOP_DEPARTMENTS as readonly string[]).includes(target.department)) {
    return { success: false, error: "Unknown department" };
  }

  const departments = [...new Set(people.departments)].filter((x) => (SOP_DEPARTMENTS as readonly string[]).includes(x));
  const found = await db.user.findMany({
    where: { id: { in: [...new Set(people.userIds)] }, isActive: true },
    select: { id: true, name: true, email: true },
  });

  const rows = [
    ...found.map((u) => ({ ...scope, targetUserId: u.id, targetDepartment: null })),
    ...departments.map((dep) => ({ ...scope, targetUserId: null, targetDepartment: dep })),
  ].map((r) => ({ ...r, createdById: user.id, createdByName: user.name }));

  await d.$transaction(async (tx: any) => {
    await tx.sopChecklistShare.deleteMany({
      where: { templateId: scope.templateId, department: scope.department, listName: scope.listName },
    });
    if (rows.length > 0) await tx.sopChecklistShare.createMany({ data: rows });
  });

  // Timeline: the SOP itself, or every SOP currently in the list.
  const templates: any[] = await d.sopChecklistTemplate.findMany({
    where: target.kind === "sop" ? { id: target.templateId } : { category: target.list },
    select: { id: true, name: true, category: true, department: true },
  });
  const affected = target.kind === "sop" ? templates : templates.filter((t) => sopDepartmentFor(t) === target.department);
  await recordSopEvents(
    user,
    affected.map((t) => ({
      type: "TEMPLATE_SHARED" as const,
      templateId: t.id,
      templateName: t.name,
      details: {
        people: found.map((u) => u.name || u.email),
        departments,
        ...(target.kind === "list" ? { list: target.list } : {}),
      },
    }))
  );

  revalidatePath(SOP_PATH);
  return { success: true, shares: await loadSopShares() };
}
