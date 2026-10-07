import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getMaxRecordingBytes,
  makeRecordingKey,
  RecordingTooLargeError,
  saveRecordingStream,
} from "@/lib/report-recordings";

// Upload a recording made with the in-app report recorder. The raw video is the request body
// (Content-Type video/webm or video/mp4), streamed straight to disk; `?date=YYYY-MM-DD` is the
// report date. Returns the storage key the report form submits as `recordingFile` (saved in the
// existing DsrEntry.recordingUrl column as /api/report-recordings/<key>).
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (db as any).user.findUnique({ where: { id: session.user.id }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "Account not found. Please sign in again." }, { status: 401 });

    const dateStr = request.nextUrl.searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: "Invalid report date" }, { status: 400 });
    }

    const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = contentType === "video/webm" ? "webm" : contentType === "video/mp4" ? "mp4" : null;
    if (!ext) return NextResponse.json({ error: "Only WebM or MP4 recordings are accepted" }, { status: 415 });

    const maxBytes = getMaxRecordingBytes();
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > maxBytes) {
      return NextResponse.json({ error: `Recording is larger than ${Math.round(maxBytes / 1024 / 1024)} MB` }, { status: 413 });
    }
    if (!request.body) return NextResponse.json({ error: "No recording received" }, { status: 400 });

    const key = makeRecordingKey(user.id, dateStr, ext);
    const size = await saveRecordingStream(key, request.body, maxBytes);
    return NextResponse.json({ key, size });
  } catch (err) {
    if (err instanceof RecordingTooLargeError) {
      return NextResponse.json({ error: "Recording is too large" }, { status: 413 });
    }
    console.error("[report-recordings] upload failed:", err);
    return NextResponse.json({ error: "Failed to save the recording" }, { status: 500 });
  }
}
