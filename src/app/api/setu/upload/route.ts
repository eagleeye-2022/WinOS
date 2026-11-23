import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { saveUploadFile } from "@/lib/upload-storage";
import { requireSetuUser } from "@/features/setu/server/guard";
import { isAllowedSetuFile } from "@/features/setu/server/files";

// Setu proposal / closing-document uploads: internal users only, PDF / DOC / DOCX up to 25MB.
// The file is stored like every other upload (UPLOAD_DIR, served at /api/uploads/<name>); the
// proposal / closure action then records it in CrmFile.
export async function POST(request: NextRequest) {
  try {
    const me = await requireSetuUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const invalid = isAllowedSetuFile(file.name, file.size);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const ext = path.extname(file.name).toLowerCase();
    const base = path.basename(file.name, path.extname(file.name)).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 80) || "file";
    const stored = `setu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${ext}`;
    await saveUploadFile(stored, Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ name: file.name, size: file.size, url: `/api/uploads/${stored}` });
  } catch (error) {
    console.error("[setu:upload]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
