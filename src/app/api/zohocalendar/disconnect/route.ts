import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (db as any).zohoAccount.deleteMany({
      where: { userId: session.user.id },
    });

    revalidatePath("/calendar");
    revalidatePath("/zohocalendar");

    return NextResponse.json({
      success: true,
      message: "Zoho Calendar account disconnected successfully.",
      count: result.count,
    });
  } catch (error) {
    console.error("[api:zoho:disconnect] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to disconnect Zoho account" },
      { status: 500 },
    );
  }
}
