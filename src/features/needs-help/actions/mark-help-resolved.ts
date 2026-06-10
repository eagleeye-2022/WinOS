"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type MarkHelpResolvedState = { message?: string };

export async function markHelpResolved(
  _: MarkHelpResolvedState,
  formData: FormData
): Promise<MarkHelpResolvedState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const supportId = formData.get("supportId") as string;
  if (!supportId) return { message: "Missing id" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const need = await d.standupSupportNeed.findUnique({
    where: { id: supportId },
    select: { mentionedUserId: true },
  });
  if (!need) return { message: "Not found" };

  // Only the assigned person (mentionedUser) or a manager can resolve it.
  const isAssigned = need.mentionedUserId === session.user.id;
  const isManager = session.user.role === "MANAGER";
  if (!isAssigned && !isManager) return { message: "Unauthorized" };

  await d.standupSupportNeed.update({
    where: { id: supportId },
    data: { resolved: true },
  });

  revalidatePath("/needs-help");
  return { message: "resolved" };
}
