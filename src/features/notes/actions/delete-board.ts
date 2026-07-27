"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";

export type DeleteBoardState = { message?: string };

export async function deleteBoard(
  _prevState: DeleteBoardState,
  formData: FormData
): Promise<DeleteBoardState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const boardId = getStr(formData, "boardId");
  if (!boardId) return { message: "Missing board ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const board = await d.board.findUnique({ where: { id: boardId } });
  if (!board) return { message: "Board not found" };

  if (board.ownerId !== session.user.id && session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  await d.board.delete({ where: { id: boardId } });

  revalidatePath("/notes");
  return { message: "deleted" };
}
