"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type MarkBlockerResolvedState = { message?: string };

export async function markBlockerResolved(
  _: MarkBlockerResolvedState,
  formData: FormData
): Promise<MarkBlockerResolvedState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const blockerId = formData.get("blockerId") as string;
  if (!blockerId) return { message: "Missing id" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Resolving is a manager-only decision; the owner can describe progress via
  // comments, but only a manager marks the blocker as actually resolved.
  if (session.user.role !== "MANAGER") return { message: "Unauthorized" };

  const blocker = await d.standupBlocker.findUnique({
    where: { id: blockerId },
    select: { id: true },
  });
  if (!blocker) return { message: "Not found" };

  await d.standupBlocker.update({
    where: { id: blockerId },
    data: { resolved: true },
  });

  revalidatePath("/blockers");
  return { message: "resolved" };
}
