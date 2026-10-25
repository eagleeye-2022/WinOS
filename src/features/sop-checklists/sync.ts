/* eslint-disable @typescript-eslint/no-explicit-any */
import { planChecklistSync, SyncTaskItem, SyncTemplateItem } from "./utils";
import { docFromItems, isDocNode, type DocNode } from "./doc";

/**
 * Prisma `create` data for a task's copy of an SOP (`template` loaded with its items in order).
 * Older list-only SOPs get a checkbox-list document, so every attached copy renders the same way.
 */
export function sopCopyCreateData(
  template: any,
  taskId: string,
  position: number,
  user: { id: string; name: string }
) {
  return {
    taskId,
    templateId: template.id,
    templateVersion: template.version,
    content: (isDocNode(template.content) ? template.content : docFromItems(template.items)) as any,
    name: template.name,
    position,
    attachedById: user.id,
    attachedByName: user.name,
    items: {
      create: template.items.map((i: any) => ({
        sourceItemId: i.id,
        text: i.text,
        position: i.position,
        isRequired: i.isRequired,
        requiresEvidence: i.requiresEvidence,
      })),
    },
  };
}

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
