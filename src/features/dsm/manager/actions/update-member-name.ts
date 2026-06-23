"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type UpdateMemberNameResult = { ok: boolean; message?: string };

/** Manager-only: set a team member's display name. Email remains the login identity. */
export async function updateMemberName(userId: string, name: string): Promise<UpdateMemberNameResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "MANAGER") {
    return { ok: false, message: "Unauthorized" };
  }

  const trimmed = name.trim();
  if (!userId) return { ok: false, message: "Missing user" };
  if (!trimmed) return { ok: false, message: "Name cannot be empty" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  await d.user.update({ where: { id: userId }, data: { name: trimmed } });

  revalidatePath("/dsm/all");
  revalidatePath("/dsm/my");
  revalidatePath("/dsm");
  revalidatePath("/dsr/manage");
  revalidatePath("/dsr/my");
  revalidatePath("/dsr");
  revalidatePath("/blockers");
  revalidatePath("/support");

  return { ok: true };
}
