"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStr } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";
import { boardNoteAccessInclude, canEditBoardNote } from "./_utils";

export type ShareBoardNoteState = { message?: string };

export async function shareBoardNote(
  _prevState: ShareBoardNoteState,
  formData: FormData
): Promise<ShareBoardNoteState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const noteId = getStr(formData, "noteId");
  const shareUserIdsStr = getStr(formData, "shareUserIds") || "";

  if (!noteId) return { message: "Missing note ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Anyone who may edit the card may share it (same rule as "Share to Project")
  const note = await d.boardNote.findUnique({
    where: { id: noteId },
    include: boardNoteAccessInclude(session.user.id),
  });
  if (!note) return { message: "Note not found" };

  if (!(await canEditBoardNote(note, { id: session.user.id, role: session.user.role }))) {
    return { message: "Unauthorized" };
  }

  const shareUserIds = shareUserIdsStr.split(",").map((s) => s.trim()).filter(Boolean);

  // Clear existing shares and replace
  await d.boardNoteShare.deleteMany({ where: { noteId } });

  if (shareUserIds.length > 0) {
    await d.boardNoteShare.createMany({
      data: shareUserIds.map((userId) => ({
        noteId,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/notes");
  revalidatePath("/dsm");
  revalidatePath("/report");
  revalidatePath("/dsm/my");
  revalidatePath("/report/my");
  revalidatePath("/dsm/all");
  revalidatePath("/report/all");
  return { message: "shared" };
}
