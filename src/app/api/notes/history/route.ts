import { NextResponse } from "next/server";
import { getHistory } from "@/features/notes/queries";

export async function GET() {
  try {
    const history = await getHistory();
    return NextResponse.json(history);
  } catch (error) {
    console.error("[GET Notes History API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch note history" }, { status: 500 });
  }
}
