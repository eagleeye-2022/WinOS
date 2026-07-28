"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type MarkSupportResolvedState = { message?: string };

export async function markSupportResolved(
  _: MarkSupportResolvedState,
  formData: FormData
): Promise<MarkSupportResolvedState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const supportId = formData.get("supportId") as string;
  const resolvedVal = formData.get("resolved") as string | null;
  if (!supportId) return { message: "Missing id" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Resolving is a manager-only decision; the owner can describe progress via
  // comments, but only a manager marks the support need as actually resolved.
  if (session.user.role !== "MANAGER") return { message: "Unauthorized" };

  const need = await d.standupSupportNeed.findUnique({
    where: { id: supportId },
    select: { id: true, resolved: true, entry: { select: { userId: true } } },
  });
  if (!need) return { message: "Not found" };

  const newResolved = resolvedVal !== null ? resolvedVal === "true" : !need.resolved;

  await d.standupSupportNeed.update({
    where: { id: supportId },
    data: { resolved: newResolved },
  });

  revalidatePath("/support");
  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${need.entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: newResolved ? "resolved" : "unresolved" };
}
