import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { uploadDir, uploadReadDirs } from "@/lib/upload-storage";

const inApp = path.join(process.cwd(), "public", "uploads");
const rootUploads = path.join(process.cwd(), "uploads");

describe("upload storage folder", () => {
  const original = process.env.UPLOAD_DIR;
  afterEach(() => {
    if (original === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = original;
  });

  it("uses public/uploads when UPLOAD_DIR isn't set", () => {
    delete process.env.UPLOAD_DIR;
    expect(uploadDir()).toBe(inApp);
    expect(uploadReadDirs()).toEqual([inApp, rootUploads]);
  });

  it("uses UPLOAD_DIR (outside the app) when set, and still reads the older folders", () => {
    const outside = path.resolve("/home/u123/winos-uploads");
    process.env.UPLOAD_DIR = ` ${outside} `;
    expect(uploadDir()).toBe(outside);
    expect(uploadReadDirs()).toEqual([outside, inApp, rootUploads]);
  });
});
