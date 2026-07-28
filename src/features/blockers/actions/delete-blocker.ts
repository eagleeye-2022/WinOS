"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type DeleteBlockerState = { message?: string };

export async function deleteBlocker(
  _prev: DeleteBlockerState,
  formData: FormData
): Promise<DeleteBlockerState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "Unauthorized" };
  }

  const blockerId = formData.get("blockerId") as string;
  if (!blockerId) return { message: "Missing blocker ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const existing = await d.standupBlocker.findUnique({
    where: { id: blockerId },
    select: { entry: { select: { userId: true, status: true } } },
  });
  if (!existing) return { message: "Blocker not found" };

  const isManager = session.user.role === "MANAGER";
  const isOwner = session.user.id === existing.entry.userId;

  if (!isManager && !isOwner) {
    return { message: "Unauthorized" };
  }

  if (existing.entry.status === "REVIEWED" && !isManager) {
    return { message: "This entry has already been reviewed and cannot be changed." };
  }

  const blocker = await d.standupBlocker.delete({
    where: { id: blockerId },
    select: { entry: { select: { userId: true } } },
  });

  revalidatePath("/blockers");
  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${blocker.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: "deleted" };
}
