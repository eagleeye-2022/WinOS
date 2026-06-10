"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStr } from "@/lib/action-utils";

export type SaveDsmState = {
  errors?: { tasks?: string[] };
  message?: string;
};

export async function saveDsm(
  _prevState: SaveDsmState,
  formData: FormData
): Promise<SaveDsmState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Guard: verify the session user actually exists in the DB.
  // JWT sessions are cookie-based and not re-validated against the DB on each
  // request. After a local DB reset, the cookie holds a CUID that no longer
  // exists, causing FK violations on every write.
  const sessionUser = await d.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!sessionUser) {
    console.error(
      "[saveDsm] session.user.id not found in User table — stale JWT.",
      { sessionUserId: session.user.id }
    );
    return { message: "Your session is no longer valid. Please sign out and sign back in." };
  }

  const action = getStr(formData, "action"); // "draft" | "submit"
  const dateStr = getStr(formData, "date");  // "YYYY-MM-DD"
  const status = action === "submit" ? "SUBMITTED" : "DRAFT";

  // Normalize date to UTC midnight for the @@unique constraint
  const date = new Date(dateStr + "T00:00:00.000Z");

  const taskTexts = (formData.getAll("taskText") as string[]).map((t) => t.trim()).filter(Boolean);
  const blockerTexts = (formData.getAll("blockerText") as string[]).map((t) => t.trim());
  const blockerPriorities = formData.getAll("blockerPriority") as string[];
  const supportTexts = (formData.getAll("supportText") as string[]).map((t) => t.trim());
  const supportUserIds = formData.getAll("supportUserId") as string[];

  // Validate on submit only
  if (action === "submit" && taskTexts.length === 0) {
    return { errors: { tasks: ["At least one task is required to submit"] } };
  }

  // Guard: already-submitted/reviewed entries cannot be changed by the member
  const existing = await d.standupEntry.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
    select: { status: true },
  });
  if (
    existing?.status === "SUBMITTED" ||
    existing?.status === "PENDING_REVIEW" ||
    existing?.status === "REVIEWED"
  ) {
    return { message: "This entry has already been submitted and cannot be changed." };
  }

  let entry: { id: string };
  try {
    // Upsert entry by (userId, date)
    entry = await d.standupEntry.upsert({
      where: { userId_date: { userId: session.user.id, date } },
      create: {
        userId: session.user.id,
        date,
        status,
        submittedAt: status === "SUBMITTED" ? new Date() : null,
      },
      update: {
        status,
        submittedAt: status === "SUBMITTED" ? new Date() : null,
      },
    });

    // Sync TODAY tasks (replace)
    await d.standupTask.deleteMany({ where: { entryId: entry.id, kind: "TODAY" } });
    if (taskTexts.length > 0) {
      await d.standupTask.createMany({
        data: taskTexts.map((text: string, i: number) => ({ text, kind: "TODAY", order: i, entryId: entry.id })),
      });
    }

    // Sync blockers (replace)
    await d.standupBlocker.deleteMany({ where: { entryId: entry.id } });
    const validBlockers = blockerTexts
      .map((text: string, i: number) => ({ text, priority: blockerPriorities[i] || "MEDIUM", resolved: false }))
      .filter((b: { text: string }) => b.text);
    if (validBlockers.length > 0) {
      await d.standupBlocker.createMany({ data: validBlockers.map((b: { text: string; priority: string; resolved: boolean }) => ({ ...b, entryId: entry.id })) });
    }

    // Sync support needs (replace)
    await d.standupSupportNeed.deleteMany({ where: { entryId: entry.id } });
    const validSupport = supportTexts
      .map((text: string, i: number) => ({
        text,
        mentionedUserId: supportUserIds[i] || null,
        order: i,
      }))
      .filter((s: { text: string }) => s.text);
    if (validSupport.length > 0) {
      await d.standupSupportNeed.createMany({
        data: validSupport.map((s: { text: string; mentionedUserId: string | null; order: number }) => ({ ...s, entryId: entry.id })),
      });
    }
  } catch (err) {
    const e = err as Record<string, unknown>;
    const code = (e?.code ?? e?.errorCode) as string | undefined;
    console.error("[saveDsm] DB error", { code, meta: e?.meta, message: e?.message });
    if (code === "P2003") {
      // P2003 = foreign key constraint failed
      return { message: "Your session is no longer valid. Please sign out and sign back in." };
    }
    return { message: "Failed to save — please try again." };
  }

  revalidatePath("/dsm");

  if (action === "submit") {
    redirect("/dsm?submitted=1");
  }

  return { message: "saved" };
}
