"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type ReviewStandupState = { message?: string };

export async function reviewStandup(
  _prev: ReviewStandupState,
  formData: FormData
): Promise<ReviewStandupState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { message: "Unauthorized" };
  }

  const entryId = formData.get("entryId") as string;
  const reviewComment = (formData.get("reviewComment") as string | null) ?? "";

  if (!entryId) return { message: "Missing entry" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const entry = await d.standupEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { message: "Not found" };

  await d.standupEntry.update({
    where: { id: entryId },
    data: {
      status: "REVIEWED",
      reviewedAt: new Date(),
      reviewedById: session.user.id,
      reviewComment: reviewComment || null,
    },
  });

  revalidatePath("/dsm");
  revalidatePath("/dsm/my");
  revalidatePath("/dsm/all");
  revalidatePath(`/dsm/member/${entry.userId}`);
  return { message: "reviewed" };
}
