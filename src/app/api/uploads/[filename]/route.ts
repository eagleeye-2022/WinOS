import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".json": "application/json",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
  ".csv": "text/csv",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    if (!filename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename);
    
    // Check primary public/uploads location
    let filePath = path.join(process.cwd(), "public", "uploads", safeFilename);
    let fileExists = false;

    try {
      await fs.access(filePath);
      fileExists = true;
    } catch {
      // Fallback check for root uploads folder
      filePath = path.join(process.cwd(), "uploads", safeFilename);
      try {
        await fs.access(filePath);
        fileExists = true;
      } catch {
        fileExists = false;
      }
    }

    if (!fileExists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(filePath);
    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "Cache-Control": "public, max-age=86400, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error serving uploaded file:", error);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
