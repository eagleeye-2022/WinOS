/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import type { SopShare } from "./types";
import { isSopVisibleTo, sopDepartmentFor } from "./utils";

/**
 * Who may see which SOP (SopChecklistShare). Plain server module. Managers see everything; for
 * anyone else, reads go through filterSopsForViewer. Fails closed: if the shares can't be read,
 * members see only the SOPs they created.
 */

const d = db as any;

export async function loadSopShares(): Promise<SopShare[]> {
  try {
    return await d.sopChecklistShare.findMany({
      select: { templateId: true, department: true, listName: true, targetUserId: true, targetDepartment: true },
    });
  } catch (err) {
    console.error("[sop-sharing] Failed to read shares:", err);
    return [];
  }
}

async function viewerOf(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { id: true, department: true } });
  return { id: userId, department: u?.department ?? null };
}

/** The rows (SopChecklistTemplate) this non-manager may see. */
export async function filterSopsForViewer<
  T extends { id: string; name: string; category: string; department?: string | null; createdById?: string | null },
>(userId: string, rows: T[]): Promise<T[]> {
  const [viewer, shares] = await Promise.all([viewerOf(userId), loadSopShares()]);
  return rows.filter((r) =>
    isSopVisibleTo(
      { id: r.id, department: sopDepartmentFor(r), list: r.category, createdById: r.createdById },
      viewer,
      shares
    )
  );
}

/** List shares follow a renamed list. */
export async function renameListShares(department: string, from: string, to: string): Promise<void> {
  await d.sopChecklistShare.updateMany({
    where: { templateId: null, department, listName: from },
    data: { listName: to },
  });
}

/** Shares of a deleted list. Card shares stay: they belong to the SOP, not the list. */
export async function deleteListShares(department: string, list: string): Promise<void> {
  await d.sopChecklistShare.deleteMany({ where: { templateId: null, department, listName: list } });
}

export async function deleteSopShares(templateId: string): Promise<void> {
  await d.sopChecklistShare.deleteMany({ where: { templateId } });
}
