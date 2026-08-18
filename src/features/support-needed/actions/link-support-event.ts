"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/** Links (or unlinks, when eventId is null) a support need to a scheduled calendar event. */
export async function linkSupportNeedEvent(supportId: string, eventId: string | null): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const existing = await d.standupSupportNeed.findUnique({
    where: { id: supportId },
    select: { entry: { select: { userId: true } } },
  });
  if (!existing) return;

  const isManager = session.user.role === "MANAGER";
  const isOwner = session.user.id === existing.entry.userId;
  if (!isManager && !isOwner) return;

  await d.standupSupportNeed.update({
    where: { id: supportId },
    data: { eventId },
  });

  revalidatePath("/support");
  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${existing.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
}
