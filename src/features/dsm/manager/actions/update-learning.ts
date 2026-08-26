"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type UpdateLearningState = { message?: string };

export async function updateLearningText(
  _prev: UpdateLearningState,
  formData: FormData
): Promise<UpdateLearningState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const entryId = formData.get("entryId") as string;
  const learningText = (formData.get("learningText") as string) ?? "";

  if (!entryId) return { message: "Missing entry ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const entry = await d.standupEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, status: true },
  });

  if (!entry) return { message: "Entry not found" };

  await d.standupEntry.update({
    where: { id: entryId },
    data: {
      learningText: learningText.trim() || null,
    },
  });

  revalidatePath("/dsm");
  revalidatePath(`/dsm/member/${entry.userId}`);
  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  return { message: "updated" };
}
