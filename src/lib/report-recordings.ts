// Server-side storage for end-of-day report recordings made with the in-app recorder.
//
// Files live on the server's disk in a PRIVATE directory (not under public/, which Next serves
// without auth) and are only readable through GET /api/report-recordings/<key>, which checks that
// the viewer is the owner or a manager.
//
// Env:
//   REPORT_RECORDINGS_DIR    — absolute storage path. Default: <cwd>/storage/report-recordings.
//                              On Hostinger, point this OUTSIDE the deployed app folder so a
//                              redeploy doesn't wipe the videos.
//   REPORT_RECORDING_MAX_MB  — upload size cap in MB. Default: 500.

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";

// Key: <userId>_<YYYY-MM-DD>_<random>.<ext>. The owner's id is part of the key so access can be
// checked without a DB lookup; the strict pattern also rules out path traversal.
const KEY_RE = /^([A-Za-z0-9]{8,40})_(\d{4}-\d{2}-\d{2})_([a-f0-9]{16})\.(webm|mp4)$/;

export const RECORDING_MIME: Record<string, string> = { webm: "video/webm", mp4: "video/mp4" };

export function getRecordingsDir(): string {
  return process.env.REPORT_RECORDINGS_DIR?.trim() || path.join(process.cwd(), "storage", "report-recordings");
}

export function getMaxRecordingBytes(): number {
  const mb = Number(process.env.REPORT_RECORDING_MAX_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : 500) * 1024 * 1024;
}

export function parseRecordingKey(key: string | null | undefined): { userId: string; dateStr: string; ext: string } | null {
  const m = KEY_RE.exec(key ?? "");
  return m ? { userId: m[1], dateStr: m[2], ext: m[4] } : null;
}

export function makeRecordingKey(userId: string, dateStr: string, ext: "webm" | "mp4"): string {
  return `${userId}_${dateStr}_${crypto.randomBytes(8).toString("hex")}.${ext}`;
}

/** Owner can view their own recording; managers can view anyone's. */
export function canViewRecording(key: string, viewer: { id: string; role?: string | null }): boolean {
  const parsed = parseRecordingKey(key);
  if (!parsed) return false;
  return parsed.userId === viewer.id || viewer.role === "MANAGER";
}

export function recordingPath(key: string): string {
  if (!parseRecordingKey(key)) throw new Error("Invalid recording key");
  return path.join(getRecordingsDir(), key);
}

export async function recordingExists(key: string): Promise<boolean> {
  if (!parseRecordingKey(key)) return false;
  try {
    const st = await fsp.stat(recordingPath(key));
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

export class RecordingTooLargeError extends Error {}

/** Streams a request body to disk without buffering it in memory. Removes partial files on failure. */
export async function saveRecordingStream(
  key: string,
  body: ReadableStream<Uint8Array>,
  maxBytes = getMaxRecordingBytes()
): Promise<number> {
  const dest = recordingPath(key);
  await fsp.mkdir(path.dirname(dest), { recursive: true });

  let written = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      written += chunk.length;
      if (written > maxBytes) cb(new RecordingTooLargeError("Recording is too large"));
      else cb(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(body as unknown as import("stream/web").ReadableStream),
      limiter,
      fs.createWriteStream(dest)
    );
  } catch (err) {
    await fsp.rm(dest, { force: true });
    throw err;
  }
  if (written === 0) {
    await fsp.rm(dest, { force: true });
    throw new Error("Empty recording");
  }
  return written;
}

/** Best-effort delete (e.g. when a member re-records and replaces the file). */
export async function deleteRecording(key: string | null | undefined): Promise<void> {
  if (!key || !parseRecordingKey(key)) return;
  await fsp.rm(recordingPath(key), { force: true }).catch(() => { });
}

/** Parses a single-range "bytes=start-end" header against a file size. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number;
  let end: number;
  if (m[1] === "") {
    // suffix range: last N bytes
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return null;
  return { start, end };
}
