/* eslint-disable @typescript-eslint/no-explicit-any */
import { planChecklistSync, SyncTaskItem, SyncTemplateItem } from "./utils";
import type { DocNode } from "./doc";

/**
 * Applies `planChecklistSync` to one TaskChecklist inside the caller's transaction (`tx`) and
 * stamps it with the template version — and document — it now matches. Plain server module.
 */
export async function applyChecklistSync(
  tx: any,
  checklistId: string,
  templateItems: SyncTemplateItem[],
  templateVersion: number,
  templateContent: DocNode
): Promise<void> {
  const taskItems: SyncTaskItem[] = await tx.taskChecklistItem.findMany({
    where: { checklistId },
    select: {
      id: true,
      sourceItemId: true,
      text: true,
      position: true,
      isRequired: true,
      requiresEvidence: true,
      isRemovedFromSop: true,
      checked: true,
    },
  });

  const plan = planChecklistSync(templateItems, taskItems);

  if (plan.delete.length > 0) {
    await tx.taskChecklistItem.deleteMany({ where: { id: { in: plan.delete }, checklistId } });
  }
  for (const u of plan.update) {
    await tx.taskChecklistItem.update({ where: { id: u.id }, data: u.data });
  }
  if (plan.create.length > 0) {
    await tx.taskChecklistItem.createMany({
      data: plan.create.map((t) => ({
        checklistId,
        sourceItemId: t.id,
        text: t.text,
        position: t.position,
        isRequired: t.isRequired,
        requiresEvidence: t.requiresEvidence,
      })),
    });
  }

  await tx.taskChecklist.update({
    where: { id: checklistId },
    data: { templateVersion, content: templateContent as any },
  });
}
