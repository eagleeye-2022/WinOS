"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getStr } from "@/lib/action-utils";

export type DeleteBoardNoteState = { message?: string };

export async function deleteBoardNote(
  _prevState: DeleteBoardNoteState,
  formData: FormData
): Promise<DeleteBoardNoteState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const id = getStr(formData, "id");
  if (!id) return { message: "Missing note ID" };

  const d = db as any;

  // Verify ownership / authorization
  const note = await d.boardNote.findUnique({
    where: { id },
  });
  if (!note) return { message: "Note not found" };

  if (note.authorId !== session.user.id) {
    return { message: "Unauthorized" };
  }

  await d.boardNote.delete({
    where: { id },
  });

  return { message: "deleted" };
}
