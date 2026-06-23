"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type AddSupportCommentState = { message?: string; errors?: { text?: string[] } };

export async function addSupportComment(
  _: AddSupportCommentState,
  formData: FormData
): Promise<AddSupportCommentState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const supportId = formData.get("supportId") as string;
  if (!supportId) return { message: "Missing id" };

  const text = (formData.get("text") as string)?.trim();
  if (!text) return { errors: { text: ["Update text is required"] } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const need = await d.standupSupportNeed.findUnique({
    where: { id: supportId },
    include: { entry: { select: { userId: true } } },
  });
  if (!need) return { message: "Not found" };

  // Owner can post progress updates on their own support need; managers can
  // comment on any item they're reviewing. Resolving stays manager-only (see mark-resolved.ts).
  const isOwner = need.entry.userId === session.user.id;
  const isManager = session.user.role === "MANAGER";
  if (!isOwner && !isManager) return { message: "Unauthorized" };

  await d.supportNeedComment.create({
    data: { text, supportNeedId: supportId, authorId: session.user.id },
  });

  revalidatePath("/support");
  return { message: "added" };
}
