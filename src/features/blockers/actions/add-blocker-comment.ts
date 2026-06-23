"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type AddBlockerCommentState = { message?: string; errors?: { text?: string[] } };

export async function addBlockerComment(
  _: AddBlockerCommentState,
  formData: FormData
): Promise<AddBlockerCommentState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const blockerId = formData.get("blockerId") as string;
  if (!blockerId) return { message: "Missing id" };

  const text = (formData.get("text") as string)?.trim();
  if (!text) return { errors: { text: ["Update text is required"] } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const blocker = await d.standupBlocker.findUnique({
    where: { id: blockerId },
    include: { entry: { select: { userId: true } } },
  });
  if (!blocker) return { message: "Not found" };

  // Owner can post progress updates on their own blocker; managers can comment
  // on any blocker they're reviewing. Resolving stays manager-only (see mark-resolved.ts).
  const isOwner = blocker.entry.userId === session.user.id;
  const isManager = session.user.role === "MANAGER";
  if (!isOwner && !isManager) return { message: "Unauthorized" };

  await d.blockerComment.create({
    data: { text, blockerId, authorId: session.user.id },
  });

  revalidatePath("/blockers");
  return { message: "added" };
}
