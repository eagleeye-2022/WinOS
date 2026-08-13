"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type SupportReminderState = { message?: string };

/**
 * Send a reminder about an unresolved support need.
 * - Owner (whoever raised the need, member or manager) → notifies the mentioned
 *   user, else their team lead, else the first manager in the system.
 * - Manager viewing someone else's need → notifies the team member who raised it.
 */
export async function sendSupportReminder(
  _: SupportReminderState,
  formData: FormData
): Promise<SupportReminderState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const supportId = formData.get("supportId") as string;
  if (!supportId) return { message: "Missing id" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const need = await d.standupSupportNeed.findUnique({
    where: { id: supportId },
    include: {
      entry: {
        include: {
          user: {
            select: {
              id: true,
              teamMemberships: {
                take: 1,
                include: { team: { select: { leadId: true } } },
              },
            },
          },
        },
      },
      mentionedUser: { select: { id: true } },
    },
  });
  if (!need) return { message: "Not found" };
  if (need.resolved) return { message: "already_resolved" };

  const isOwner = need.entry.userId === session.user.id;
  const isManager = session.user.role === "MANAGER";
  if (!isOwner && !isManager) return { message: "Unauthorized" };

  // Decide who to notify. Ownership decides the direction, not role — a manager
  // who raised their own support need still needs to escalate outward, not to themself.
  let targetUserId: string | null = null;
  if (isOwner) {
    // Owner notifies the mentioned user, if any, else their team lead, then any other manager
    targetUserId = need.mentionedUser?.id ?? null;

    if (!targetUserId) {
      const firstMembership = need.entry.user.teamMemberships?.[0];
      targetUserId = firstMembership?.team?.leadId ?? null;
    }

    if (!targetUserId) {
      const manager = await d.user.findFirst({
        where: { role: "MANAGER", id: { not: session.user.id } },
        select: { id: true },
      });
      targetUserId = manager?.id ?? null;
    }
  } else {
    // Manager reminds the team member who raised this support need
    targetUserId = need.entry.userId;
  }

  if (!targetUserId || targetUserId === session.user.id) {
    return { message: "no_target" };
  }

  await d.notification.create({
    data: {
      type: "DSM_REMINDER",
      title: "Support Request Reminder",
      message: `Reminder: support is still needed for "${need.text.slice(0, 80)}". Please follow up.`,
      userId: targetUserId,
      createdById: session.user.id,
    },
  });

  revalidatePath("/support");
  return { message: "sent" };
}
