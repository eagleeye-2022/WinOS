"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type BlockerReminderState = { message?: string };

/**
 * Send a reminder notification about an unresolved blocker.
 * - Owner (whoever raised the blocker, member or manager) → notifies the mentioned
 *   user, else their team lead, else the first manager in the system.
 * - Manager viewing someone else's blocker → notifies the team member who owns it.
 */
export async function sendBlockerReminder(
  _: BlockerReminderState,
  formData: FormData
): Promise<BlockerReminderState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  const blockerId = formData.get("blockerId") as string;
  if (!blockerId) return { message: "Missing id" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const blocker = await d.standupBlocker.findUnique({
    where: { id: blockerId },
    include: {
      entry: {
        include: {
          user: {
            select: {
              id: true, name: true,
              teamMemberships: {
                take: 1,
                include: { team: { select: { leadId: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!blocker) return { message: "Not found" };
  if (blocker.resolved) return { message: "already_resolved" };

  const isOwner = blocker.entry.userId === session.user.id;
  const isManager = session.user.role === "MANAGER";
  if (!isOwner && !isManager) return { message: "Unauthorized" };

  // Decide who to notify. Ownership decides the direction, not role — a manager
  // who raised their own blocker still needs to escalate outward, not to themself.
  let targetUserId: string | null = null;
  if (isOwner) {
    // Owner notifies the mentioned user, if any, else their team lead
    targetUserId = blocker.mentionedUserId ?? null;

    if (!targetUserId) {
      const firstMembership = blocker.entry.user.teamMemberships?.[0];
      targetUserId = firstMembership?.team?.leadId ?? null;
    }

    // Fall back to any other manager in the system
    if (!targetUserId) {
      const manager = await d.user.findFirst({
        where: { role: "MANAGER", id: { not: session.user.id } },
        select: { id: true },
      });
      targetUserId = manager?.id ?? null;
    }
  } else {
    // Manager reminds the team member who has this blocker
    targetUserId = blocker.entry.userId;
  }

  if (!targetUserId || targetUserId === session.user.id) {
    return { message: "no_target" };
  }

  await d.notification.create({
    data: {
      type: "DSM_REMINDER",
      title: "Blocker Reminder",
      message: `Reminder: the blocker "${blocker.text.slice(0, 80)}" is still unresolved and needs attention.`,
      userId: targetUserId,
      createdById: session.user.id,
    },
  });

  revalidatePath("/blockers");
  return { message: "sent" };
}
