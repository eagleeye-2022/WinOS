"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type DisconnectState = {
  message?: string;
};

export async function disconnectZohoAccount(
  __: DisconnectState,
  ___: FormData,
): Promise<DisconnectState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Unauthorized" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).zohoAccount.deleteMany({ where: { userId: session.user.id } });

  revalidatePath("/calendar");
  return { message: "disconnected" };
}
