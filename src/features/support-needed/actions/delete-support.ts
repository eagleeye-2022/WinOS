"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type DeleteSupportState = { message?: string };

export async function deleteSupport(
  _prev: DeleteSupportState,
  formData: FormData
): Promise<DeleteSupportState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "Unauthorized" };
  }

  const supportId = formData.get("supportId") as string;
  if (!supportId) return { message: "Missing support ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const existing = await d.standupSupportNeed.findUnique({
    where: { id: supportId },
    select: { entry: { select: { userId: true, status: true } } },
  });
  if (!existing) return { message: "Support item not found" };

  const isManager = session.user.role === "MANAGER";
  const isOwner = session.user.id === existing.entry.userId;

  if (!isManager && !isOwner) {
    return { message: "Unauthorized" };
  }

  if (existing.entry.status === "REVIEWED" && !isManager) {
    return { message: "This entry has already been reviewed and cannot be changed." };
  }

  const need = await d.standupSupportNeed.delete({
    where: { id: supportId },
    select: { entry: { select: { userId: true } } },
  });

  revalidatePath("/support");
  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${need.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: "deleted" };
}
