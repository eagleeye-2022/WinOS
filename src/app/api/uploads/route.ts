import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate safe unique filename
    const fileExtension = path.extname(file.name);
    const baseName = path.basename(file.name, fileExtension).replace(/[^a-zA-Z0-9]/g, "_");
    const uniqueFileName = `${Date.now()}-${baseName}${fileExtension}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    // Save to server disk
    await fs.writeFile(filePath, buffer);

    // Determine host protocol and domain
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
    const siteUrl = `${protocol}://${host}`;

    const fileUrl = `${siteUrl.replace(/\/$/, "")}/api/uploads/${uniqueFileName}`;

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
