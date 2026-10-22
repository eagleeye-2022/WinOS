import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { auth } from "@/lib/auth";
import { saveUploadFile } from "@/lib/upload-storage";

export async function POST(request: NextRequest) {
  try {
    // Signed-in users only (it used to accept uploads from anyone).
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate safe unique filename
    const fileExtension = path.extname(file.name);
    const baseName = path.basename(file.name, fileExtension).replace(/[^a-zA-Z0-9]/g, "_");
    const uniqueFileName = `${Date.now()}-${baseName}${fileExtension}`;

    // UPLOAD_DIR (outside the app) when set, so the file survives deploys — see lib/upload-storage.
    await saveUploadFile(uniqueFileName, buffer);

    const fileUrl = `/api/uploads/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      fileName: file.name,
      storedFileName: uniqueFileName,
      fileUrl,
    });
  } catch (error) {
    console.error("Error processing file upload:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
