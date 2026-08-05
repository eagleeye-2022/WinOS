import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const account = await (db as any).zohoAccount.findUnique({
    where: { userId: session.user.id },
    select: {
      zohoEmail: true,
      primaryCalendarUid: true,
      apiDomain: true,
      accountsDomain: true,
      expiresAt: true,
      updatedAt: true,
    },
  });

  if (!account) {
    return NextResponse.json({
      connected: false,
      zohoEmail: null,
      message: "No Zoho account connected.",
    });
  }

  const isExpired = account.expiresAt ? new Date(account.expiresAt) < new Date() : false;

  return NextResponse.json({
    connected: true,
    zohoEmail: account.zohoEmail ?? session.user.email ?? null,
    primaryCalendarUid: account.primaryCalendarUid ?? null,
    apiDomain: account.apiDomain ?? "calendar.zoho.in",
    accountsDomain: account.accountsDomain ?? "accounts.zoho.in",
    expiresAt: account.expiresAt,
    isExpired,
  });
}
