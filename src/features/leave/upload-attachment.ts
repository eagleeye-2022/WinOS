// Client-side: uploads a leave / comp-off attachment through POST /api/uploads (a Route Handler, so
// it isn't bound by the 1 MB Server Action body limit) and returns what the leave actions store.

import type { UploadedAttachment } from "./actions/leave-actions";

export async function uploadAttachment(file: File): Promise<UploadedAttachment> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body });
  const json = (await res.json().catch(() => null)) as { fileUrl?: string; error?: string } | null;
  if (!res.ok || !json?.fileUrl) throw new Error(json?.error || `Couldn't upload ${file.name}.`);
  return { fileName: file.name, fileUrl: json.fileUrl, fileSize: file.size, fileType: file.type || undefined };
}
