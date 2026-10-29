// Page-level guard for Pulse manager screens (Server Components only).

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROUTES } from "@/constants/routes";
import { canManageAttendance } from "./utils";

/** Sends anyone who isn't a Pulse manager to `fallback` (their own view) instead of a broken page. */
export async function requirePulseManagerPage(fallback: string = ROUTES.pulseLeave) {
  const session = await auth();
  if (!session?.user?.id) redirect(ROUTES.login);
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, profileRole: true, isActive: true },
  });
  if (!user?.isActive) redirect(ROUTES.login);
  if (!canManageAttendance(user)) redirect(fallback);
}
