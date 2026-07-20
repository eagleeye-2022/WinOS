import { NextResponse } from "next/server";
import { getSharedWithMeNotes } from "@/features/notes/queries";

export async function GET() {
  try {
    const sharedNotes = await getSharedWithMeNotes();
    return NextResponse.json(sharedNotes);
  } catch (error) {
    console.error("[GET Shared Notes API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch shared notes" }, { status: 500 });
  }
}
