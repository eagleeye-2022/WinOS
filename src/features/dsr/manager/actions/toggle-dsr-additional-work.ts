"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type ToggleDsrAdditionalWorkState = { message?: string };

export async function toggleDsrAdditionalWork(
  _prev: ToggleDsrAdditionalWorkState,
  formData: FormData
): Promise<ToggleDsrAdditionalWorkState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const itemId = formData.get("itemId") as string;
  if (!itemId) return { message: "Missing item ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const item = await d.dsrAdditionalWork.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      completed: true,
      dsrEntryId: true,
      dsrEntry: { select: { id: true, userId: true, status: true, date: true } },
    },
  });

  if (!item) return { message: "Item not found" };


  const newCompleted = !item.completed;
  await d.dsrAdditionalWork.update({
    where: { id: itemId },
    data: { completed: newCompleted },
  });

  revalidatePath(`/report/member/${item.dsrEntry.userId}`);
  revalidatePath("/report/all");
  revalidatePath("/report");
  revalidatePath("/report/my");
  // Also shown under "What Did You Do Yesterday?" on the DSM member review.
  revalidatePath(`/dsm/member/${item.dsrEntry.userId}`);

  return { message: "toggled" };
}
