"use server";

import path from "path";
import { db } from "@/lib/db";
import { saveUploadFile } from "@/lib/upload-storage";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canManageAttendance } from "@/features/attendance/utils";
import { canManageUser, managedUserIds } from "@/features/attendance/team-scope";

export interface RTDDocument {
  id: string;
  taskName: string;
  fileName: string;
  fileUrl?: string;
  fileType?: "image" | "document" | string;
  uploadedOn: string;
  submittedBy: {
    name: string;
    initials: string;
    email: string;
  };
  comment?: string;
  managerNotes?: string;
}

// Extract initials helper
function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** The signed-in user, re-read from the DB (never trust ids/roles sent by the browser). */
async function requireViewer() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const viewer = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, profileRole: true, isActive: true },
  });
  if (!viewer?.isActive) throw new Error("Unauthorized");
  return viewer;
}

/**
 * RTD documents the signed-in user may see: their own, plus their team's for managers.
 * The arguments are ignored (kept for the existing caller) — identity comes from the session.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getRtdDocumentsAction(_currentUserId?: string, _isManager?: boolean): Promise<RTDDocument[]> {
  const viewer = await requireViewer();
  const scope = canManageAttendance(viewer) ? await managedUserIds(viewer) : new Set<string>();

  const dbDocs = await db.roleTaskDocument.findMany({
    where: scope === null ? {} : { userId: { in: [viewer.id, ...scope] } },
    include: { user: true },
    orderBy: { createdAt: "desc" }
  });

  // 4. Map DB records to the client RTDDocument interface
  return dbDocs.map((doc) => {
    const uploadedOn = doc.uploadedOn.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) + " " + doc.uploadedOn.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    let normalizedUrl = doc.fileUrl || undefined;
    if (normalizedUrl) {
      if (normalizedUrl.includes("/uploads/")) {
        const parts = normalizedUrl.split("/uploads/");
        normalizedUrl = `/api/uploads/${parts[parts.length - 1]}`;
      }
    }

    return {
      id: doc.id,
      taskName: doc.taskName,
      fileName: doc.fileName,
      fileUrl: normalizedUrl,
      fileType: doc.fileType,
      uploadedOn,
      submittedBy: {
        name: doc.user.name || doc.user.email,
        initials: getInitials(doc.user.name || doc.user.email),
        email: doc.user.email,
      },
      comment: doc.comment || undefined,
      managerNotes: doc.managerNotes || undefined,
    };
  });
}

export async function uploadRtdFileAction(userId: string, formData: FormData): Promise<string> {
  // Upload for yourself, or (managers) for someone in your team.
  const viewer = await requireViewer();
  if (userId !== viewer.id && !(await canManageUser(viewer, userId))) throw new Error("Forbidden");
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");

  const taskName = formData.get("taskName") as string || "Untitled Task Document";
  const comment = formData.get("comment") as string || undefined;

  const fileExtension = path.extname(file.name);
  const baseName = path.basename(file.name, fileExtension).replace(/[^a-zA-Z0-9]/g, "_");
  const uniqueFileName = `${Date.now()}-${baseName}${fileExtension}`;

  // Save to local storage and generate URL dynamically
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // UPLOAD_DIR (outside the app) when set, so the file survives deploys — see lib/upload-storage.
  await saveUploadFile(uniqueFileName, buffer);

  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
  const siteUrl = `${protocol}://${host}`;

  const fileUrl = `${siteUrl}/api/uploads/${uniqueFileName}`;

  // Save document directly to database
  await db.roleTaskDocument.create({
    data: {
      taskName,
      fileName: file.name,
      fileUrl,
      fileType: file.type.startsWith("image/") ? "image" : "document",
      userId,
      comment,
    }
  });

  return fileUrl;
}

export async function saveRtdManagerNotesAction(docId: string, managerNotes: string): Promise<void> {
  // Only a manager responsible for the document's owner writes notes on it.
  const viewer = await requireViewer();
  const doc = await db.roleTaskDocument.findUnique({ where: { id: docId }, select: { userId: true } });
  if (!doc) throw new Error("Document not found");
  if (!(await canManageUser(viewer, doc.userId))) throw new Error("Forbidden");
  await db.roleTaskDocument.update({
    where: { id: docId },
    data: { managerNotes },
  });
}
