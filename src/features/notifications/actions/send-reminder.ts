"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { toUtcDate, isoToUtcDate } from "@/features/dsm/utils";
import { formatCutoffLabel, getOpenReportDateStr, getReportCutoff, getReportCutoffDayOffset } from "@/features/dsr/reporting";

const REMINDER_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4-hour cooldown per user per day

export type SendReminderState = {
  message?: string;
  sent?: number;
  skipped?: number;
};

/** "dsm" = morning standup (default), "report" = end-of-day report. Sent as the `kind` form field. */
type ReminderKind = "dsm" | "report";

const REMINDER_CONTENT: Record<ReminderKind, { type: string; title: string; message: string }> = {
  dsm: {
    type: "DSM_REMINDER",
    title: "DSM Reminder",
    message: "Hey! You haven't submitted your Daily Status Meeting update yet. Please submit before EOD.",
  },
  report: {
    type: "REPORT_REMINDER",
    title: "End-of-Day Report Reminder",
    message: `Hey! You haven't submitted your end-of-day report yet. Record today's work in Zoho Cliq, paste the link in Reporting and submit before the ${formatCutoffLabel(getReportCutoff(), getReportCutoffDayOffset())} cut-off.`,
  },
};

function reminderKindOf(formData: FormData): ReminderKind {
  return formData.get("kind") === "report" ? "report" : "dsm";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True if the user already has a reminder of this kind today within the cooldown window. */
async function alreadyRemindedToday(
  d: ReturnType<typeof Object.create>,
  userId: string,
  kind: ReminderKind = "dsm"
): Promise<boolean> {
  const todayStart = toUtcDate();
  const cooldownStart = new Date(Date.now() - REMINDER_COOLDOWN_MS);
  const cutoff = cooldownStart > todayStart ? cooldownStart : todayStart;

  const existing = await d.notification.findFirst({
    where: {
      userId,
      type: REMINDER_CONTENT[kind].type,
      createdAt: { gte: cutoff },
    },
  });
  return !!existing;
}

/** True if the user already submitted today (not pending). */
async function hasSubmittedToday(
  d: ReturnType<typeof Object.create>,
  userId: string,
  today: Date,
  kind: ReminderKind = "dsm"
): Promise<boolean> {
  const model = kind === "report" ? d.dsrEntry : d.standupEntry;
  // With a next-day cut-off, the report still open before ~6 AM is the previous day's.
  const date = kind === "report"
    ? isoToUtcDate(getOpenReportDateStr(new Date(), getReportCutoff(), getReportCutoffDayOffset()))
    : today;
  const entry = await model.findUnique({
    where: { userId_date: { userId, date } },
    select: { status: true },
  });
  if (!entry) return false;
  return (
    entry.status === "SUBMITTED" ||
    entry.status === "PENDING_REVIEW" ||
    entry.status === "REVIEWED"
  );
}

// ── Actions ───────────────────────────────────────────────────────────────────

/** Send a reminder to a single user. Returns skipped if user already submitted or reminded. */
export async function sendReminderToUser(
  _prev: SendReminderState,
  formData: FormData
): Promise<SendReminderState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const userId = formData.get("userId") as string;
  const teamId = (formData.get("teamId") as string | null) || null;
  const kind = reminderKindOf(formData);

  if (!userId) return { message: "Missing userId" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const today = toUtcDate();

  if (await hasSubmittedToday(d, userId, today, kind)) {
    return { message: "already_submitted", sent: 0, skipped: 1 };
  }
  if (await alreadyRemindedToday(d, userId, kind)) {
    return { message: "already_reminded", sent: 0, skipped: 1 };
  }

  await d.notification.create({
    data: {
      ...REMINDER_CONTENT[kind],
      userId,
      createdById: session.user.id,
      teamId,
    },
  });

  revalidatePath(kind === "report" ? "/report/all" : "/dsm/all");
  return { message: "sent", sent: 1, skipped: 0 };
}

/** Send reminders to all pending members of a team. */
export async function sendRemindersToTeam(
  _prev: SendReminderState,
  formData: FormData
): Promise<SendReminderState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const teamId = formData.get("teamId") as string;
  const kind = reminderKindOf(formData);
  if (!teamId) return { message: "Missing teamId" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const today = toUtcDate();

  const team = await d.team.findUnique({
    where: { id: teamId },
    include: { members: { select: { userId: true } } },
  });
  if (!team) return { message: "Team not found" };

  let sent = 0;
  let skipped = 0;

  for (const { userId } of team.members) {
    if (await hasSubmittedToday(d, userId, today, kind)) { skipped++; continue; }
    if (await alreadyRemindedToday(d, userId, kind)) { skipped++; continue; }

    await d.notification.create({
      data: {
        ...REMINDER_CONTENT[kind],
        userId,
        createdById: session.user.id,
        teamId,
      },
    });
    sent++;
  }

  revalidatePath(kind === "report" ? "/report/all" : "/dsm/all");
  return { message: sent > 0 ? "sent" : "all_reminded", sent, skipped };
}
