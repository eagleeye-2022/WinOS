"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStr } from "@/lib/action-utils";

export type SaveDsmState = {
  errors?: { tasks?: string[]; learningText?: string[] };
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
  const sessionUser = await d.user.findFirst({
    where: {
      OR: [
        { id: session.user.id },
        ...(session.user.email ? [{ email: session.user.email }] : []),
      ],
    },
    select: { id: true },
  });
  if (!sessionUser) {
    console.error(
      "[saveDsm] session.user not found in User table.",
      { sessionUserId: session.user.id, sessionEmail: session.user.email }
    );
    return { message: "Your session is no longer valid. Please sign out and sign back in." };
  }
  const userId = sessionUser.id;

  // Managers have their own self-DSM page; redirect/revalidate must match
  // whichever route they're submitting from, same as team members on /dsm.
  const selfPath = session.user.role === "MANAGER" ? "/dsm/my" : "/dsm";

  const action = getStr(formData, "action"); // "draft" | "submit"
  const dateStr = getStr(formData, "date");  // "YYYY-MM-DD"
  const status = action === "submit" ? "SUBMITTED" : "DRAFT";

  // Normalize date to UTC midnight for the @@unique constraint
  const date = new Date(dateStr + "T00:00:00.000Z");

  let learningText = getStr(formData, "learningText");
  const learningItemTexts = (formData.getAll("learningItemText") as string[]).map((t) => t.trim()).filter(Boolean);
  if (learningItemTexts.length > 0) {
    learningText = learningItemTexts.join("\n");
  }
  const rawTaskTexts = formData.getAll("taskText") as string[];
  const rawTaskPriorities = formData.getAll("taskPriority") as string[];
  const tasksToCreate: { text: string; priority: string | null }[] = [];
  for (let i = 0; i < rawTaskTexts.length; i++) {
    const t = rawTaskTexts[i]?.trim();
    if (t) {
      tasksToCreate.push({ text: t, priority: rawTaskPriorities[i] || null });
    }
  }
  const taskTexts = tasksToCreate.map((t) => t.text);

  const blockerTexts = (formData.getAll("blockerText") as string[]).map((t) => t.trim());
  const blockerPriorities = formData.getAll("blockerPriority") as string[];
  // Each blockerUserId value is a comma-separated list of mentioned user IDs
  const blockerUserIdRaw = formData.getAll("blockerUserId") as string[];
  const supportTexts = (formData.getAll("supportText") as string[]).map((t) => t.trim());
  // Each supportUserId value is a comma-separated list of mentioned user IDs
  const supportUserIdRaw = formData.getAll("supportUserId") as string[];
  // Each supportEventId value links the row to a previously scheduled calendar event
  const supportEventIdRaw = formData.getAll("supportEventId") as string[];

  // Validate on submit only
  if (action === "submit") {
    const errors: { tasks?: string[]; learningText?: string[] } = {};
    if (taskTexts.length === 0) {
      errors.tasks = ["At least one task is required to submit"];
    }
    if (!learningText || !learningText.trim()) {
      errors.learningText = ["Learning details are required to submit"];
    }
    if (Object.keys(errors).length > 0) {
      return { errors };
    }
  }

  // Guard: a REVIEWED entry cannot be changed by the member
  const existing = await d.standupEntry.findUnique({
    where: { userId_date: { userId, date } },
    select: { status: true, submittedAt: true },
  });
  if (existing?.status === "REVIEWED") {
    return { message: "This entry has already been reviewed and cannot be changed." };
  }

  // Editing an already-submitted entry keeps it visible to the manager — it
  // must never silently fall back to DRAFT (which is hidden from review).
  const wasSubmitted = existing?.status === "SUBMITTED" || existing?.status === "PENDING_REVIEW";
  const finalStatus = wasSubmitted ? "PENDING_REVIEW" : status;
  const submittedAt = finalStatus === "DRAFT" ? null : existing?.submittedAt ?? new Date();

  let entry: { id: string };
  try {
    // Upsert entry by (userId, date)
    entry = await d.standupEntry.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        status: finalStatus,
        submittedAt,
        learningText: learningText || null,
      },
      update: {
        status: finalStatus,
        submittedAt,
        learningText: learningText || null,
      },
    });

    // Sync TODAY tasks (replace)
    await d.standupTask.deleteMany({ where: { entryId: entry.id, kind: "TODAY" } });
    if (tasksToCreate.length > 0) {
      await d.standupTask.createMany({
        data: tasksToCreate.map((item, i: number) => ({
          text: item.text,
          kind: "TODAY",
          order: i,
          priority: item.priority,
          entryId: entry.id,
        })),
      });
    }

    // Sync blockers (replace)
    await d.standupBlocker.deleteMany({ where: { entryId: entry.id } });
    for (let i = 0; i < blockerTexts.length; i++) {
      const text = blockerTexts[i];
      if (!text) continue;
      const rawIds = blockerUserIdRaw[i] ? blockerUserIdRaw[i].split(",").filter(Boolean) : [];
      const blocker = await d.standupBlocker.create({
        data: {
          entryId: entry.id,
          text,
          priority: blockerPriorities[i] || "MEDIUM",
          resolved: false,
          mentionedUserId: rawIds[0] ?? null,
          mentionedUserIds: rawIds.length > 0 ? rawIds.join(",") : null,
        },
      });
      if (rawIds.length > 0 && d.standupBlockerMention) {
        await d.standupBlockerMention.createMany({
          data: rawIds.map((userId: string) => ({ blockerId: blocker.id, userId })),
        });
      }
    }

    // Sync support needs (replace)
    await d.standupSupportNeed.deleteMany({ where: { entryId: entry.id } });
    for (let i = 0; i < supportTexts.length; i++) {
      const text = supportTexts[i];
      if (!text) continue;
      const rawIds = supportUserIdRaw[i] ? supportUserIdRaw[i].split(",").filter(Boolean) : [];
      const eventId = supportEventIdRaw[i]?.trim() || null;
      const support = await d.standupSupportNeed.create({
        data: {
          entryId: entry.id,
          text,
          order: i,
          resolved: false,
          mentionedUserId: rawIds[0] ?? null,
          mentionedUserIds: rawIds.length > 0 ? rawIds.join(",") : null,
          eventId,
        },
      });
      if (rawIds.length > 0 && d.standupSupportNeedMention) {
        await d.standupSupportNeedMention.createMany({
          data: rawIds.map((userId: string) => ({ supportNeedId: support.id, userId })),
        });
      }
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

  // Create SUBMITTED timeline event on first submit
  if (finalStatus === "SUBMITTED") {
    const existingEvent = await d.standupTimelineEvent.findFirst({
      where: { entryId: entry.id, type: "SUBMITTED" },
    });
    if (!existingEvent) {
      await d.standupTimelineEvent.create({
        data: {
          entryId: entry.id,
          type: "SUBMITTED",
          label: "Report Submitted",
          occurredAt: new Date(),
        },
      });
    }
  }

  revalidatePath(selfPath);

  if (action === "submit") {
    redirect(`${selfPath}?submitted=1`);
  }

  return { message: "saved" };
}
