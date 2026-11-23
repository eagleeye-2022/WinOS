import { UPLOAD_ACCEPT, UPLOAD_MAX_BYTES } from "../constants";
import type { DealFile } from "../types";
import type { Checked } from "../validation";

// Setu files are uploaded first (POST /api/setu/upload → stored via lib/upload-storage) and then
// referenced by the action that saves the proposal / closure. These checks make sure an action
// only records files that came from our own upload route.

const ALLOWED_EXT = UPLOAD_ACCEPT.split(",");
const STORED_URL_RE = /^\/api\/uploads\/[A-Za-z0-9._-]+$/;

export function isAllowedSetuFile(name: string, size: number): string | null {
  const ext = `.${name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (!ALLOWED_EXT.includes(ext)) return "Only PDF or DOCX files can be attached.";
  if (size > UPLOAD_MAX_BYTES) return "Files must be 25MB or smaller.";
  if (size <= 0) return "That file is empty.";
  return null;
}

/** Validates uploaded-file references sent by the client (max 20). */
export function checkUploadedFiles(files: unknown): Checked<{ id?: string; name: string; size: number; url: string }[]> {
  if (!Array.isArray(files)) return { ok: true, value: [] };
  if (files.length > 20) return { ok: false, error: "Attach at most 20 files." };
  const out: { id?: string; name: string; size: number; url: string }[] = [];
  for (const f of files as Partial<DealFile>[]) {
    const name = typeof f.name === "string" ? f.name.trim().slice(0, 255) : "";
    const size = typeof f.size === "number" ? Math.round(f.size) : 0;
    const url = typeof f.url === "string" ? f.url : "";
    if (!name || !STORED_URL_RE.test(url)) return { ok: false, error: "A file wasn't uploaded correctly — please attach it again." };
    const err = isAllowedSetuFile(name, size);
    if (err) return { ok: false, error: `${name}: ${err}` };
    out.push({ id: typeof f.id === "string" && !f.id.startsWith("upload-") ? f.id : undefined, name, size, url });
  }
  return { ok: true, value: out };
}
