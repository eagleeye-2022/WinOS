"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDayEffort } from "@/features/dsm/queries";
import { postToCliq, getAppBaseUrl } from "@/lib/zoho-cliq";
import {
  buildCliqReportMessage,
  getAllowedRecordingHosts,
  getReportCutoff,
  isReportLate,
  validateRecordingUrl,
} from "../reporting";

export type SaveDsrState = {
  errors?: {
    reflection?: string[];
    resultOfDay?: string[];
    recordingUrl?: string[];
  };
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
  const selfPath = session.user.role === "MANAGER" ? "/report/my" : "/report";

  const action = formData.get("action") as "draft" | "submit";
  const dateStr = formData.get("date") as string;
  const date = new Date(dateStr + "T00:00:00.000Z");

  const plannedTasksJson = formData.get("plannedTasksJson") as string;
  const additionalWorksJson = formData.get("additionalWorksJson") as string;
  const resolvedBlockersJson = formData.get("resolvedBlockersJson") as string;
  const followUpsDoneJson = formData.get("followUpsDoneJson") as string;
  const learningItemsJson = formData.get("learningItemsJson") as string;
  const sentiment = (formData.get("sentiment") as string) || null;
  const reflection = (formData.get("reflection") as string)?.trim() || null;
  const resultOfDay = (formData.get("resultOfDay") as string)?.trim() || null;
  const dayFeedback = (formData.get("dayFeedback") as string)?.trim() || null;
  const suggestions = (formData.get("suggestions") as string)?.trim() || null;
  const rawRecordingUrl = (formData.get("recordingUrl") as string)?.trim() || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Guard against a stale JWT pointing at a deleted user (common after a local DB reset).
  const user = await d.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { message: "Your account could not be found. Please sign in again." };

  // The Zoho Cliq / WorkDrive recording link is required to submit; drafts keep it only if valid.
  const urlCheck = rawRecordingUrl ? validateRecordingUrl(rawRecordingUrl, getAllowedRecordingHosts()) : null;
  const recordingUrl: string | null = urlCheck?.ok ? urlCheck.url : null;

  if (action === "submit") {
    const errors: SaveDsrState["errors"] = {};
    if (!resultOfDay) {
      errors.resultOfDay = ["Please add the outcome of the day before submitting."];
    }
    if (!recordingUrl) {
      errors.recordingUrl = [
        urlCheck && !urlCheck.ok ? urlCheck.error : "Paste the Zoho Cliq link to your recording before submitting.",
      ];
    }
    if (Object.keys(errors).length > 0) {
      return { errors, message: errors.recordingUrl?.[0] ?? errors.resultOfDay?.[0] };
    }
  }

  const plannedTasks: TaskItem[] = JSON.parse(plannedTasksJson || "[]");
  const additionalWorks: SimpleItem[] = JSON.parse(additionalWorksJson || "[]");
  const resolvedBlockers: SimpleItem[] = JSON.parse(resolvedBlockersJson || "[]");
  const followUpsDone: SimpleItem[] = JSON.parse(followUpsDoneJson || "[]");
  const learningItems: SimpleItem[] = JSON.parse(learningItemsJson || "[]");

  const completedCount = plannedTasks.filter((t) => t.completed).length;
  const totalCount = plannedTasks.length;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const status = action === "submit" ? "SUBMITTED" : "DRAFT";


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
  // Lateness is fixed by the first submission; later edits don't change it.
  const isLate = submittedAt ? isReportLate(dateStr, new Date(submittedAt), getReportCutoff()) : false;

  const effort = await getDayEffort(session.user.id, dateStr);
  const totalLoggedMinutes = effort.reduce((sum, row) => sum + row.minutes, 0);

  const reportFields = {
    status: finalStatus,
    completionPercent,
    plannedTaskCount: totalCount,
    completedTaskCount: completedCount,
    sentiment: sentiment || null,
    reflection,
    resultOfDay,
    dayFeedback,
    suggestions,
    recordingUrl,
    isLate,
    totalLoggedMinutes,
    submittedAt,
  };

  const entry = await d.dsrEntry.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    create: { userId: session.user.id, date, ...reportFields },
    update: reportFields,
  });

  // Replace child records
  await d.dsrPlannedTask.deleteMany({ where: { dsrEntryId: entry.id } });
  if (plannedTasks.length > 0) {
    try {
      await d.dsrPlannedTask.createMany({
        data: plannedTasks.map((t, i) => ({
          dsrEntryId: entry.id,
          text: t.text,
          priority: t.priority?.trim() || null,
          completed: t.completed,
          order: i,
        })),
      });
    } catch (err: unknown) {
      const msg = String(err);
      if (msg.includes("TaskPriority") || msg.includes("Invalid value for argument priority")) {
        const VALID_ENUM_PRIORITIES = new Set(["P1", "P2", "P3"]);
        await d.dsrPlannedTask.createMany({
          data: plannedTasks.map((t, i) => {
            const trimmed = t.priority?.trim().toUpperCase();
            return {
              dsrEntryId: entry.id,
              text: t.text,
              priority: trimmed && VALID_ENUM_PRIORITIES.has(trimmed) ? trimmed : null,
              completed: t.completed,
              order: i,
            };
          }),
        });
      } else {
        throw err;
      }
    }
  }

  // Mirror the DSR ticks onto that day's DSM tasks (matched by text — the two aren't linked by id),
  // so the next morning's "What Did You Do Yesterday?" summary shows what was actually completed.
  const completedByText = new Map(plannedTasks.map((t) => [t.text.trim().toLowerCase(), t.completed]));
  const dsmTasks: { id: string; text: string; isCompleted: boolean }[] = await d.standupTask.findMany({
    where: { kind: "TODAY", entry: { userId: session.user.id, date } },
    select: { id: true, text: true, isCompleted: true },
  });
  for (const t of dsmTasks) {
    const completed = completedByText.get(t.text.trim().toLowerCase());
    if (completed !== undefined && completed !== t.isCompleted) {
      await d.standupTask.update({ where: { id: t.id }, data: { isCompleted: completed } });
    }
  }

  await d.dsrAdditionalWork.deleteMany({ where: { dsrEntryId: entry.id } });
  const validAdditional = additionalWorks.filter((w) => w.text?.trim());
  if (validAdditional.length > 0) {
    await d.dsrAdditionalWork.createMany({
      data: validAdditional.map((w, i) => ({
        dsrEntryId: entry.id,
        text: w.text.trim(),
        completed: w.completed !== undefined ? w.completed : (w.resolved ?? true),
        order: i,
      })),
    });
  }

  await d.dsrResolvedBlocker.deleteMany({ where: { dsrEntryId: entry.id } });
  const validBlockers = resolvedBlockers.filter((b) => b.text?.trim());
  if (validBlockers.length > 0) {
    await d.dsrResolvedBlocker.createMany({
      data: validBlockers.map((b, i) => ({
        dsrEntryId: entry.id, text: b.text.trim(),
        resolved: b.resolved ?? b.completed ?? true, order: i,
      })),
    });
  }

  await d.dsrFollowUpDone.deleteMany({ where: { dsrEntryId: entry.id } });
  const validFollowUps = followUpsDone.filter((f) => f.text?.trim());
  if (validFollowUps.length > 0) {
    await d.dsrFollowUpDone.createMany({
      data: validFollowUps.map((f, i) => ({
        dsrEntryId: entry.id, text: f.text.trim(),
        completed: f.completed ?? f.resolved ?? true, order: i,
      })),
    });
  }

  // Synchronize resolved status to StandupBlocker and StandupSupportNeed records for this user/date
  try {
    const standupEntry = await d.standupEntry.findUnique({
      where: { userId_date: { userId: session.user.id, date } },
      include: { blockers: true, supportNeeds: true },
    });

    if (standupEntry) {
      for (const sb of standupEntry.blockers) {
        const cleanSbText = sb.text.replace(/^(@\S+\s*)+/, "").trim().toLowerCase();
        const match = validBlockers.find((b) => {
          const cleanBText = b.text.trim().toLowerCase();
          return cleanBText === cleanSbText || cleanSbText.includes(cleanBText) || cleanBText.includes(cleanSbText);
        });
        if (match) {
          const isResolved = match.resolved ?? match.completed ?? true;
          await d.standupBlocker.update({
            where: { id: sb.id },
            data: { resolved: isResolved },
          });
        }
      }

      for (const sn of standupEntry.supportNeeds) {
        const cleanSnText = sn.text.replace(/^(@\S+\s*)+/, "").trim().toLowerCase();
        const match = validFollowUps.find((f) => {
          const cleanFText = f.text.trim().toLowerCase();
          return cleanFText === cleanSnText || cleanSnText.includes(cleanFText) || cleanFText.includes(cleanSnText);
        });
        if (match) {
          const isDone = match.completed ?? match.resolved ?? true;
          await d.standupSupportNeed.update({
            where: { id: sn.id },
            data: { resolved: isDone },
          });
        }
      }
    }
  } catch (syncErr) {
    console.error("[saveDsr] Error syncing standup blocker/support status:", syncErr);
  }

  await d.dsrLearningItem.deleteMany({ where: { dsrEntryId: entry.id } });
  const validLearningItems = learningItems.filter((l) => l.text?.trim());
  if (validLearningItems.length > 0) {
    await d.dsrLearningItem.createMany({
      data: validLearningItems.map((l, i) => ({
        dsrEntryId: entry.id, text: l.text.trim(),
        completed: l.completed ?? false, order: i,
      })),
    });
  }

  // Create SUBMITTED timeline event on first submit
  if (status === "SUBMITTED") {
    const existingEvent = await d.dsrTimelineEvent.findFirst({
      where: { dsrEntryId: entry.id, type: "SUBMITTED" },
    });
    if (!existingEvent) {
      const userName = user.name ?? session.user.name ?? "User";
      await d.dsrTimelineEvent.create({
        data: {
          dsrEntryId: entry.id,
          type: "SUBMITTED",
          label: `${userName} Submitted Report${isLate ? " (Late)" : ""}`,
          occurredAt: new Date(),
        },
      });
    }
  }

  // Post the report to Zoho Cliq. Best-effort: a Cliq failure never blocks the save — the error
  // is stored on the entry so a manager can see it.
  if (action === "submit") {
    const baseUrl = getAppBaseUrl();
    const message = buildCliqReportMessage({
      memberName: user.name ?? user.email,
      dateStr,
      completedTaskCount: completedCount,
      plannedTaskCount: totalCount,
      totalLoggedMinutes,
      resultOfDay,
      dayFeedback,
      suggestions,
      recordingUrl,
      isLate,
      isUpdate: wasSubmitted,
      reportUrl: baseUrl ? `${baseUrl}/report/member/${user.id}?date=${dateStr}` : null,
    });
    const result = await postToCliq(message);
    try {
      await d.dsrEntry.update({
        where: { id: entry.id },
        data: result.ok
          ? { cliqPostedAt: new Date(), cliqError: null }
          : { cliqError: result.error },
      });
    } catch (cliqErr) {
      console.error("[saveDsr] Failed to record Cliq post status:", cliqErr);
    }
    if (!result.ok) console.error("[saveDsr] Zoho Cliq post failed:", result.error);
  }

  revalidatePath(selfPath);
  revalidatePath("/report/all");
  revalidatePath(`/report/member/${user.id}`);

  if (action === "submit") {
    redirect(`${selfPath}?submitted=1`);
  }

  return { message: "saved" };
}
