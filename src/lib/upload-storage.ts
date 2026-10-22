import fs from "fs/promises";
import path from "path";

// ── Where uploaded files live ─────────────────────────────────────────────────
// By default files go to `public/uploads` inside the app. On hosting that rebuilds the app folder
// on every deploy (Hostinger Git deploy), that folder is wiped and every upload is lost — so set
// UPLOAD_DIR to a folder OUTSIDE the app (e.g. /home/<user>/winos-uploads), which deploys never
// touch. Files are always served through /api/uploads/<name>, so their links don't change.

const LEGACY_DIRS = [
  path.join(process.cwd(), "public", "uploads"),
  path.join(process.cwd(), "uploads"),
];

/** The folder new uploads are written to. */
export function uploadDir(): string {
  const custom = process.env.UPLOAD_DIR?.trim();
  return custom ? path.resolve(custom) : LEGACY_DIRS[0];
}

/** Folders an uploaded file may be in, newest location first (older files stay where they were saved). */
export function uploadReadDirs(): string[] {
  return Array.from(new Set([uploadDir(), ...LEGACY_DIRS]));
}

/** Saves an uploaded file under `fileName` (already made safe and unique by the caller). */
export async function saveUploadFile(fileName: string, data: Buffer): Promise<void> {
  const dir = uploadDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, path.basename(fileName)), data);
}
