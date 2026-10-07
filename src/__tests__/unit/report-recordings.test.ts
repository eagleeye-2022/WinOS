import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  canViewRecording,
  deleteRecording,
  makeRecordingKey,
  parseRange,
  parseRecordingKey,
  recordingExists,
  recordingPath,
  RecordingTooLargeError,
  saveRecordingStream,
} from "@/lib/report-recordings";

const USER = "cmabc123def456ghi789jkl0";

function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

describe("recording keys", () => {
  it("round-trips owner, date and extension", () => {
    const key = makeRecordingKey(USER, "2026-10-07", "webm");
    expect(parseRecordingKey(key)).toEqual({ userId: USER, dateStr: "2026-10-07", ext: "webm" });
  });

  it("rejects path traversal and malformed keys", () => {
    expect(parseRecordingKey("../../etc/passwd")).toBeNull();
    expect(parseRecordingKey(`${USER}_2026-10-07_0123456789abcdef.webm/../x`)).toBeNull();
    expect(parseRecordingKey(`${USER}_2026-10-07_0123456789abcdef.exe`)).toBeNull();
    expect(parseRecordingKey("")).toBeNull();
    expect(() => recordingPath("../secret")).toThrow();
  });

  it("lets the owner and managers view, nobody else", () => {
    const key = makeRecordingKey(USER, "2026-10-07", "webm");
    expect(canViewRecording(key, { id: USER, role: "TEAM_MEMBER" })).toBe(true);
    expect(canViewRecording(key, { id: "someoneelse123", role: "MANAGER" })).toBe(true);
    expect(canViewRecording(key, { id: "someoneelse123", role: "TEAM_MEMBER" })).toBe(false);
  });
});

describe("parseRange", () => {
  it("parses open, closed and suffix ranges", () => {
    expect(parseRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange("bytes=90-500", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  });

  it("rejects unsatisfiable or malformed ranges", () => {
    expect(parseRange("bytes=100-", 100)).toBeNull();
    expect(parseRange("bytes=20-10", 100)).toBeNull();
    expect(parseRange("bytes=-", 100)).toBeNull();
    expect(parseRange("items=0-1", 100)).toBeNull();
    expect(parseRange(null, 100)).toBeNull();
  });
});

describe("saveRecordingStream", () => {
  let dir: string;
  const original = process.env.REPORT_RECORDINGS_DIR;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "winos-rec-"));
    process.env.REPORT_RECORDINGS_DIR = dir;
  });
  afterEach(async () => {
    process.env.REPORT_RECORDINGS_DIR = original;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("writes the stream to the private recordings dir", async () => {
    const key = makeRecordingKey(USER, "2026-10-07", "webm");
    const size = await saveRecordingStream(key, streamOf(new Uint8Array([1, 2, 3]), new Uint8Array([4])));
    expect(size).toBe(4);
    expect(await fs.readFile(path.join(dir, key))).toEqual(Buffer.from([1, 2, 3, 4]));
    expect(await recordingExists(key)).toBe(true);
  });

  it("rejects and cleans up a file over the size limit", async () => {
    const key = makeRecordingKey(USER, "2026-10-07", "webm");
    await expect(saveRecordingStream(key, streamOf(new Uint8Array(10)), 5)).rejects.toBeInstanceOf(RecordingTooLargeError);
    expect(await recordingExists(key)).toBe(false);
  });

  it("rejects an empty upload", async () => {
    const key = makeRecordingKey(USER, "2026-10-07", "webm");
    await expect(saveRecordingStream(key, streamOf())).rejects.toThrow(/empty/i);
    expect(await recordingExists(key)).toBe(false);
  });

  it("deletes a recording", async () => {
    const key = makeRecordingKey(USER, "2026-10-07", "mp4");
    await saveRecordingStream(key, streamOf(new Uint8Array([9])));
    await deleteRecording(key);
    expect(await recordingExists(key)).toBe(false);
  });
});
