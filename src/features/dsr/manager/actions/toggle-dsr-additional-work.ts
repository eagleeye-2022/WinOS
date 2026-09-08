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

  const standup = await d.standupEntry.findUnique({
    where: { userId_date: { userId: item.dsrEntry.userId, date: item.dsrEntry.date } },
    select: { status: true },
  });
  if (standup?.status !== "REVIEWED") {
    return { message: "This member's DSM must be reviewed before the DSR can be edited." };
  }

  const newCompleted = !item.completed;
  await d.dsrAdditionalWork.update({
    where: { id: itemId },
    data: { completed: newCompleted },
  });

  revalidatePath(`/dsr/member/${item.dsrEntry.userId}`);
  revalidatePath("/dsr/manage");
  revalidatePath("/dsr");
  revalidatePath("/dsr/my");

  return { message: "toggled" };
}
