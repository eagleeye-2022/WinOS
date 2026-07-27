"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getStr, validateText } from "@/lib/action-utils";

export type UpdateThreadState = { errors?: { title?: string[] }; message?: string };

export async function updateThread(
  _prevState: UpdateThreadState,
  formData: FormData
): Promise<UpdateThreadState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const threadId = getStr(formData, "threadId");
  const title = getStr(formData, "title");

  if (!threadId) return { message: "Missing list ID" };

  const titleError = validateText("List title", title, 120);
  if (titleError) return { errors: { title: titleError } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const thread = await d.thread.findUnique({ where: { id: threadId } });
  if (!thread) return { message: "List not found" };

  if (thread.authorId !== session.user.id) {
    return { message: "Unauthorized" };
  }

  await d.thread.update({
    where: { id: threadId },
    data: { title },
  });

  revalidatePath("/notes");
  return { message: "updated" };
}
