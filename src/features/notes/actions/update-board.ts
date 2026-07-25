"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getStr, validateText } from "@/lib/action-utils";

export type UpdateBoardState = { errors?: { name?: string[] }; message?: string };

export async function updateBoard(
  _prevState: UpdateBoardState,
  formData: FormData
): Promise<UpdateBoardState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const boardId = getStr(formData, "boardId");
  const name = getStr(formData, "name");

  if (!boardId) return { message: "Missing board ID" };

  const nameError = validateText("Board name", name, 60);
  if (nameError) return { errors: { name: nameError } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const board = await d.board.findUnique({ where: { id: boardId } });
  if (!board) return { message: "Board not found" };

  if (board.ownerId !== session.user.id) {
    return { message: "Unauthorized" };
  }

  await d.board.update({
    where: { id: boardId },
    data: { name },
  });

  revalidatePath("/notes");
  return { message: "updated" };
}
