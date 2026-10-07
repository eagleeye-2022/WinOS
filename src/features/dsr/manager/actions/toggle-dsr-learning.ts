"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type ToggleDsrLearningState = { message?: string };

export async function toggleDsrLearning(
  _prev: ToggleDsrLearningState,
  formData: FormData
): Promise<ToggleDsrLearningState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const itemId = formData.get("itemId") as string;
  if (!itemId) return { message: "Missing item ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const item = await d.dsrLearningItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      completed: true,
      dsrEntryId: true,
      dsrEntry: { select: { id: true, userId: true, status: true, date: true } },
    },
  });

  if (!item) return { message: "Item not found" };


  // Toggle completion
  const newCompleted = !item.completed;
  await d.dsrLearningItem.update({
    where: { id: itemId },
    data: { completed: newCompleted },
  });

  revalidatePath(`/report/member/${item.dsrEntry.userId}`);
  revalidatePath("/report/all");
  revalidatePath("/report");
  revalidatePath("/report/my");

  return { message: "toggled" };
}
