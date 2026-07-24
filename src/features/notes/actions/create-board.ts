"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getStr, validateText } from "@/lib/action-utils";

export type CreateBoardState = { errors?: { name?: string[] }; message?: string; boardId?: string };

export async function createBoard(
  _prevState: CreateBoardState,
  formData: FormData
): Promise<CreateBoardState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const name = getStr(formData, "name");
  const nameError = validateText("Board name", name, 60);
  if (nameError) return { errors: { name: nameError } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (db as any).board.findUnique({
    where: { name_ownerId: { name, ownerId: session.user.id } },
  });
  if (existing) return { errors: { name: ["A board with that name already exists"] } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const board = await (db as any).board.create({
    data: { name, ownerId: session.user.id },
  });

  revalidatePath("/notes");
  return { message: "created", boardId: board.id };
}
