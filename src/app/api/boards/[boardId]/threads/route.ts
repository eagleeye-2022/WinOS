import { NextResponse } from "next/server";
import { getThreads } from "@/features/notes/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    if (!boardId) {
      return NextResponse.json({ error: "Missing board ID" }, { status: 400 });
    }
    const threads = await getThreads(boardId);
    return NextResponse.json(threads);
  } catch (error) {
    console.error("[GET Board Threads API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 });
  }
}
