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
  const resolvedVal = formData.get("resolved") as string | null;
  if (!blockerId) return { message: "Missing id" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Resolving is a manager-only decision; the owner can describe progress via
  // comments, but only a manager marks the blocker as actually resolved.
  if (session.user.role !== "MANAGER") return { message: "Unauthorized" };

  const blocker = await d.standupBlocker.findUnique({
    where: { id: blockerId },
    select: { id: true, resolved: true, entry: { select: { userId: true } } },
  });
  if (!blocker) return { message: "Not found" };

  const newResolved = resolvedVal !== null ? resolvedVal === "true" : !blocker.resolved;

  await d.standupBlocker.update({
    where: { id: blockerId },
    data: { resolved: newResolved },
  });

  revalidatePath("/blockers");
  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${blocker.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: newResolved ? "resolved" : "unresolved" };
}
