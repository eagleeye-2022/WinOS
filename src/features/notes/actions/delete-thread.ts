"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";
import { canManageThread } from "./_utils";

export type DeleteThreadState = { message?: string };

export async function deleteThread(
  _prevState: DeleteThreadState,
  formData: FormData
): Promise<DeleteThreadState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const threadId = getStr(formData, "threadId");
  if (!threadId) return { message: "Missing list/thread ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const thread = await d.thread.findUnique({
    where: { id: threadId },
    select: { authorId: true, board: { select: { ownerId: true } } },
  });
  if (!thread) return { message: "List not found" };

  if (!canManageThread(thread, { id: session.user.id, role: session.user.role })) {
    return { message: "Unauthorized" };
  }

  await d.thread.delete({ where: { id: threadId } });

  revalidatePath("/notes");
  return { message: "deleted" };
}
