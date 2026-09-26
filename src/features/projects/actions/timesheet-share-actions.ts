/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { issueTimesheetShareToken } from "@/lib/timesheet-share-token";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_EXPIRY_DAYS = [1, 7, 30];

/**
 * Builds a public, read-only link to the caller's own time logs for one day.
 * Nothing is stored — the link is a signed token, so it can't be edited to
 * point at another user or date.
 */
export async function createTimesheetShareLinkAction(date: string, expiresInDays: number | null) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized", data: null };

  const d = db as any;
  const user = await d.user.findFirst({
    where: {
      OR: [
        { id: session.user.id },
        ...(session.user.email ? [{ email: session.user.email }] : []),
      ],
    },
    select: { id: true },
  });
  if (!user) {
    return {
      success: false,
      error: "Your session is no longer valid. Please sign out and sign back in.",
      data: null,
    };
  }

  if (!DATE_RE.test(date)) return { success: false, error: "Invalid date", data: null };
  if (expiresInDays !== null && !ALLOWED_EXPIRY_DAYS.includes(expiresInDays)) {
    return { success: false, error: "Invalid expiry", data: null };
  }

  const expiresAt = expiresInDays ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000 : null;
  const token = issueTimesheetShareToken({ userId: user.id, date, expiresAt });

  return {
    success: true,
    data: {
      path: `/share/timesheet/${token}`,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    },
  };
}
