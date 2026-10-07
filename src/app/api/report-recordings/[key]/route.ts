import fs from "fs";
import fsp from "fs/promises";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canViewRecording, parseRange, parseRecordingKey, RECORDING_MIME, recordingPath } from "@/lib/report-recordings";

// Streams a stored report recording to its owner or a manager. Supports HTTP Range requests so the
// <video> player can seek without downloading the whole file.
export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await params;
  const parsed = parseRecordingKey(key);
  if (!parsed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canViewRecording(key, { id: session.user.id, role: session.user.role })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filePath = recordingPath(key);
  let size: number;
  try {
    size = (await fsp.stat(filePath)).size;
  } catch {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  const baseHeaders: Record<string, string> = {
    "Content-Type": RECORDING_MIME[parsed.ext] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `inline; filename="${key}"`,
  };

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const range = parseRange(rangeHeader, size);
    if (!range) {
      return new Response(null, { status: 416, headers: { ...baseHeaders, "Content-Range": `bytes */${size}` } });
    }
    const stream = fs.createReadStream(filePath, { start: range.start, end: range.end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(range.end - range.start + 1),
      },
    });
  }

  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}
