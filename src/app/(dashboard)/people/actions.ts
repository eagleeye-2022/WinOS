"use server";

import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

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

export async function getRtdDocumentsAction(currentUserId: string, isManager: boolean): Promise<RTDDocument[]> {
  // 1. Fetch team members to check if we need to auto-initialize default documents
  const teamMembers = await db.user.findMany({
    where: { role: "TEAM_MEMBER" },
    include: { roleTaskDocuments: true }
  });

  // 2. Initialize default documents if a team member doesn't have any documents yet
  for (const member of teamMembers) {
    if (member.roleTaskDocuments.length === 0) {
      const isDev = member.title?.toLowerCase().includes("developer") || member.title?.toLowerCase().includes("engineer");
      const isDesigner = member.title?.toLowerCase().includes("designer") || member.title?.toLowerCase().includes("creative");
      
      let taskName = "Q3 Marketing & Growth Strategy";
      let fileName = "growth_objectives.pdf";
      let comment = "Mapping out social media management channels and newsletter schedules for team review.";

      if (isDev) {
        taskName = "Q3 Backend Infrastructure & Performance";
        fileName = "infrastructure_scaling_proposal.pdf";
        comment = "Standardizing backend API routes and scaling Prisma connections for the upcoming Q3 release.";
      } else if (isDesigner) {
        taskName = "Design Tokens & Style Guide Refactor";
        fileName = "design_tokens_v2.pdf";
        comment = "Aligning brand guidelines and export definitions for Figma-to-code components.";
      }

      await db.roleTaskDocument.create({
        data: {
          taskName,
          fileName,
          fileUrl: "",
          fileType: "document",
          userId: member.id,
          comment,
          managerNotes: "Looks solid. Proceed with scheduling alignment review."
        }
      });
    }
  }

  // 3. Fetch RTD documents from the database
  const dbDocs = await db.roleTaskDocument.findMany({
    where: isManager ? {} : { userId: currentUserId },
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
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");

  const taskName = formData.get("taskName") as string || "Untitled Task Document";
  const comment = formData.get("comment") as string || undefined;

  const fileExtension = path.extname(file.name);
  const baseName = path.basename(file.name, fileExtension).replace(/[^a-zA-Z0-9]/g, "_");
  const uniqueFileName = `${Date.now()}-${baseName}${fileExtension}`;

  let fileUrl = "";

  // Attempt remote upload if REMOTE_UPLOAD_URL is defined
  const remoteUploadEndpoint = process.env.REMOTE_UPLOAD_URL;
  if (remoteUploadEndpoint) {
    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      const res = await fetch(remoteUploadEndpoint, {
        method: "POST",
        body: uploadData,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.fileUrl) {
          fileUrl = json.fileUrl;
        }
      }
    } catch (e) {
      console.warn("[RTD Upload] Remote upload endpoint unreachable, saving to local disk:", e);
    }
  }

  // Local storage fallback if remote upload was not used or failed
  if (!fileUrl) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, uniqueFileName);
    await fs.writeFile(filePath, buffer);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    fileUrl = siteUrl
      ? `${siteUrl.replace(/\/$/, "")}/api/uploads/${uniqueFileName}`
      : `/api/uploads/${uniqueFileName}`;
  }

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
  await db.roleTaskDocument.update({
    where: { id: docId },
    data: { managerNotes },
  });
}
