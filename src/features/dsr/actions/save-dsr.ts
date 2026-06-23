"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type SaveDsrState = {
  errors?: { reflection?: string[] };
  message?: string;
};

type TaskItem = { id?: string; text: string; priority?: string | null; completed: boolean };
type SimpleItem = { id?: string; text: string; completed?: boolean; resolved?: boolean };

export async function saveDsr(
  _prev: SaveDsrState,
  formData: FormData
): Promise<SaveDsrState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  // Managers have their own self-DSR page; redirect/revalidate must match
  // whichever route they're submitting from, same as team members on /dsr.
  const selfPath = session.user.role === "MANAGER" ? "/dsr/my" : "/dsr";

  const action = formData.get("action") as "draft" | "submit";
  const dateStr = formData.get("date") as string;
  const date = new Date(dateStr + "T00:00:00.000Z");

  const plannedTasksJson = formData.get("plannedTasksJson") as string;
  const additionalWorksJson = formData.get("additionalWorksJson") as string;
  const resolvedBlockersJson = formData.get("resolvedBlockersJson") as string;
  const followUpsDoneJson = formData.get("followUpsDoneJson") as string;
  const sentiment = (formData.get("sentiment") as string) || null;
  const reflection = (formData.get("reflection") as string)?.trim() || null;
  const resultOfDay = (formData.get("resultOfDay") as string)?.trim() || null;

  if (action === "submit" && !reflection) {
    return { errors: { reflection: ["Please add a reflection before submitting."] } };
  }

  const plannedTasks: TaskItem[] = JSON.parse(plannedTasksJson || "[]");
  const additionalWorks: SimpleItem[] = JSON.parse(additionalWorksJson || "[]");
  const resolvedBlockers: SimpleItem[] = JSON.parse(resolvedBlockersJson || "[]");
  const followUpsDone: SimpleItem[] = JSON.parse(followUpsDoneJson || "[]");

  const completedCount = plannedTasks.filter((t) => t.completed).length;
  const totalCount = plannedTasks.length;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const status = action === "submit" ? "SUBMITTED" : "DRAFT";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Guard: a REVIEWED entry cannot be changed by the member
  const existing = await d.dsrEntry.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
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

  const entry = await d.dsrEntry.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    create: {
      userId: session.user.id,
      date,
      status: finalStatus,
      completionPercent,
      plannedTaskCount: totalCount,
      completedTaskCount: completedCount,
      sentiment: sentiment || null,
      reflection,
      resultOfDay,
      submittedAt,
    },
    update: {
      status: finalStatus,
      completionPercent,
      plannedTaskCount: totalCount,
      completedTaskCount: completedCount,
      sentiment: sentiment || null,
      reflection,
      resultOfDay,
      submittedAt,
    },
  });

  // Replace child records
  await d.dsrPlannedTask.deleteMany({ where: { dsrEntryId: entry.id } });
  if (plannedTasks.length > 0) {
    await d.dsrPlannedTask.createMany({
      data: plannedTasks.map((t, i) => ({
        dsrEntryId: entry.id,
        text: t.text,
        priority: t.priority || null,
        completed: t.completed,
        order: i,
      })),
    });
  }

  await d.dsrAdditionalWork.deleteMany({ where: { dsrEntryId: entry.id } });
  const validAdditional = additionalWorks.filter((w) => w.text?.trim());
  if (validAdditional.length > 0) {
    await d.dsrAdditionalWork.createMany({
      data: validAdditional.map((w, i) => ({ dsrEntryId: entry.id, text: w.text.trim(), order: i })),
    });
  }

  await d.dsrResolvedBlocker.deleteMany({ where: { dsrEntryId: entry.id } });
  const validBlockers = resolvedBlockers.filter((b) => b.text?.trim());
  if (validBlockers.length > 0) {
    await d.dsrResolvedBlocker.createMany({
      data: validBlockers.map((b, i) => ({
        dsrEntryId: entry.id, text: b.text.trim(),
        resolved: b.resolved ?? true, order: i,
      })),
    });
  }

  await d.dsrFollowUpDone.deleteMany({ where: { dsrEntryId: entry.id } });
  const validFollowUps = followUpsDone.filter((f) => f.text?.trim());
  if (validFollowUps.length > 0) {
    await d.dsrFollowUpDone.createMany({
      data: validFollowUps.map((f, i) => ({
        dsrEntryId: entry.id, text: f.text.trim(),
        completed: f.completed ?? true, order: i,
      })),
    });
  }

  // Create SUBMITTED timeline event on first submit
  if (status === "SUBMITTED") {
    const existingEvent = await d.dsrTimelineEvent.findFirst({
      where: { dsrEntryId: entry.id, type: "SUBMITTED" },
    });
    if (!existingEvent) {
      await d.dsrTimelineEvent.create({
        data: {
          dsrEntryId: entry.id,
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
