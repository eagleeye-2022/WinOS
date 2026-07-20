import { NextResponse } from "next/server";
import { getSharedByMeNotes } from "@/features/notes/queries";

export async function GET() {
  try {
    const sharedNotes = await getSharedByMeNotes();
    return NextResponse.json(sharedNotes);
  } catch (error) {
    console.error("[GET Shared By Me Notes API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch notes shared by user" }, { status: 500 });
  }
}
