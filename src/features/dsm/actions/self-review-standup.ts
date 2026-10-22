"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SELF_REVIEWED_EVENT } from "../utils";

export type SelfReviewState = { message?: string };

/**
 * A member marks their own submitted DSM as self-reviewed. It's only a mark — a "Self-Reviewed"
 * timeline event (no status change, no schema change): the DSM stays editable and the manager's
 * Review still locks it. Once per DSM; not on drafts or already-reviewed DSMs.
 */
export async function selfReviewStandup(entryId: string): Promise<SelfReviewState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  // Re-query the user so a stale JWT pointing at a deleted user fails cleanly.
  const user = await d.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true } });
  if (!user) return { message: "Your session is no longer valid. Please sign out and sign back in." };

  const entry = await d.standupEntry.findUnique({
    where: { id: entryId },
    select: { id: true, userId: true, status: true },
  });
  if (!entry || entry.userId !== user.id) return { message: "DSM not found." };
  if (entry.status === "DRAFT") return { message: "Submit your DSM before reviewing it." };
  if (entry.status === "REVIEWED") return { message: "This DSM has already been reviewed by your manager." };

  const existing = await d.standupTimelineEvent.findFirst({
    where: { entryId, type: SELF_REVIEWED_EVENT },
    select: { id: true },
  });
  if (!existing) {
    await d.standupTimelineEvent.create({
      data: {
        entryId,
        type: SELF_REVIEWED_EVENT,
        label: `${user.name || user.email} Self-Reviewed`,
        occurredAt: new Date(),
      },
    });
  }

  revalidatePath("/dsm");
  revalidatePath("/dsm/my");
  revalidatePath("/dsm/all");
  revalidatePath(`/dsm/member/${user.id}`);
  return { message: "self-reviewed" };
}
