"use server";

import { auth } from "@/lib/auth";

export async function checkSessionAction(): Promise<{ active: boolean }> {
  const session = await auth();
  if (!session || !session.user || !(session.user as { id?: string }).id) {
    return { active: false };
  }
  return { active: true };
}
