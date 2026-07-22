"use server";

import { db } from "@/lib/db";
import { CompetencyCategory, CompetencyStatus } from "../../../../../generated/prisma/client";
import fs from "fs/promises";
import path from "path";

export interface IcaItem {
  id: string;
  name: string;
  status: "Matched" | "Extra" | "Missing";
}

export interface IcaDocumentData {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType?: string;
  comment?: string;
  uploadedOn: string;
}

export interface IcaProfileData {
  userId: string;
  userName: string;
  userEmail: string;
  title: string;
  submittedDate: string;
  skills: IcaItem[];
  knowledge: IcaItem[];
  selfImage: IcaItem[];
  traits: IcaItem[];
  motives: IcaItem[];
  managerNotes: string;
  comment: string;
  fileName: string;
  fileUrl: string;
  uploadedOn: string;
  documents: IcaDocumentData[];
}

// Convert DB status to frontend status casing
function parseStatus(dbStatus: CompetencyStatus): "Matched" | "Extra" | "Missing" {
  if (dbStatus === "MATCHED") return "Matched";
  if (dbStatus === "EXTRA") return "Extra";
  return "Missing";
}

// Convert frontend status casing to DB status casing
function toDbStatus(status: "Matched" | "Extra" | "Missing"): CompetencyStatus {
  if (status === "Matched") return "MATCHED";
  if (status === "Extra") return "EXTRA";
  return "MISSING";
}

// Default attributes templates based on job title
const DEVELOPER_TEMPLATE = {
  skills: ["React / Next.js", "TypeScript", "API Integration", "Unit Testing"],
  knowledge: ["Data Structures", "Software Architecture", "SQL & Relational DBs"],
  selfImage: ["Architect", "Collaborator", "Pragmatic Coder"],
  traits: ["Analytical", "Logical", "Patient debugger"],
  motives: ["Technical excellence", "Problem solving"]
};

const DESIGNER_TEMPLATE = {
  skills: ["Visual Design", "Prototyping", "Design Systems", "Typography"],
  knowledge: ["UI/UX Theory", "Accessibility", "Interaction Design"],
  selfImage: ["Problem Solver", "Leader", "User Advocate"],
  traits: ["Empathetic", "Detail-oriented", "Curious"],
  motives: ["Quality craftsmanship", "Process efficiency"]
};

const GENERAL_TEMPLATE = {
  skills: ["Task Execution", "Documentation", "Collaboration"],
  knowledge: ["Operational Workflow", "Project Management"],
  selfImage: ["Team Player", "Organizer"],
  traits: ["Reliable", "Organized"],
  motives: ["Quality delivery", "Project success"]
};

export async function getIcaProfile(userId: string): Promise<IcaProfileData> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      icebergProfile: true,
      competencyAttributes: true,
      icaDocuments: {
        orderBy: { uploadedOn: "desc" },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  let profile = user.icebergProfile;
  let attributes = user.competencyAttributes;

  // Initialize profile and default attributes if they don't exist yet
  if (!profile) {
    profile = await db.icebergProfile.create({
      data: {
        userId: userId,
      },
    });

    // Determine template based on user title
    const title = (user.title || "").toLowerCase();
    const isDev = title.includes("developer") || title.includes("engineer") || title.includes("tech") || title.includes("programmer");
    const isDesigner = title.includes("design") || title.includes("ux") || title.includes("ui") || title.includes("creative");

    const template = isDev 
      ? DEVELOPER_TEMPLATE 
      : isDesigner 
      ? DESIGNER_TEMPLATE 
      : GENERAL_TEMPLATE;

    const attributesToCreate = [
      ...template.skills.map(name => ({ category: CompetencyCategory.SKILL, name })),
      ...template.knowledge.map(name => ({ category: CompetencyCategory.KNOWLEDGE, name })),
      ...template.selfImage.map(name => ({ category: CompetencyCategory.SELF_IMAGE, name })),
      ...template.traits.map(name => ({ category: CompetencyCategory.TRAIT, name })),
      ...template.motives.map(name => ({ category: CompetencyCategory.MOTIVE, name }))
    ];

    // Bulk create default attributes
    await db.competencyAttribute.createMany({
      data: attributesToCreate.map(attr => ({
        userId,
        category: attr.category,
        name: attr.name,
        status: CompetencyStatus.MATCHED
      }))
    });

    // Re-fetch attributes
    attributes = await db.competencyAttribute.findMany({
      where: { userId }
    });
  }

  // Format and group attributes by category
  const skills: IcaItem[] = [];
  const knowledge: IcaItem[] = [];
  const selfImage: IcaItem[] = [];
  const traits: IcaItem[] = [];
  const motives: IcaItem[] = [];

  for (const attr of attributes) {
    const item: IcaItem = {
      id: attr.id,
      name: attr.name,
      status: parseStatus(attr.status)
    };

    if (attr.category === CompetencyCategory.SKILL) skills.push(item);
    else if (attr.category === CompetencyCategory.KNOWLEDGE) knowledge.push(item);
    else if (attr.category === CompetencyCategory.SELF_IMAGE) selfImage.push(item);
    else if (attr.category === CompetencyCategory.TRAIT) traits.push(item);
    else if (attr.category === CompetencyCategory.MOTIVE) motives.push(item);
  }

  // Helper to normalize file URL
  const normalizeUrl = (url?: string | null) => {
    if (!url) return "";
    if (url.includes("/uploads/")) {
      const parts = url.split("/uploads/");
      return `/api/uploads/${parts[parts.length - 1]}`;
    }
    return url;
  };

  // Format documents array
  const documents: IcaDocumentData[] = (user.icaDocuments || []).map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    fileUrl: normalizeUrl(doc.fileUrl),
    fileType: doc.fileType ?? undefined,
    comment: doc.comment ?? undefined,
    uploadedOn: new Date(doc.uploadedOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " - " + new Date(doc.uploadedOn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  }));

  // Fallback for legacy single-file on profile if present and not in documents list
  if (profile?.fileName && profile?.fileUrl && !documents.some(d => d.fileUrl === normalizeUrl(profile.fileUrl))) {
    documents.unshift({
      id: "legacy-1",
      fileName: profile.fileName,
      fileUrl: normalizeUrl(profile.fileUrl),
      comment: profile.comment ?? undefined,
      uploadedOn: profile.uploadedOn 
        ? new Date(profile.uploadedOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " - " + new Date(profile.uploadedOn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) 
        : "Initial Upload",
    });
  }

  return {
    userId: user.id,
    userName: user.name ?? user.email,
    userEmail: user.email,
    title: user.title ?? "Team Member",
    submittedDate: profile.uploadedOn 
      ? new Date(profile.uploadedOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) 
      : new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    skills,
    knowledge,
    selfImage,
    traits,
    motives,
    managerNotes: profile.coachingNotes ?? "",
    comment: profile.comment ?? "",
    fileName: profile.fileName ?? (documents[0]?.fileName || ""),
    fileUrl: normalizeUrl(profile.fileUrl) || (documents[0]?.fileUrl || ""),
    uploadedOn: profile.uploadedOn 
      ? new Date(profile.uploadedOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " - " + new Date(profile.uploadedOn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) 
      : (documents[0]?.uploadedOn || ""),
    documents,
  };
}

export async function saveCoachingNotes(userId: string, notes: string): Promise<void> {
  await db.icebergProfile.upsert({
    where: { userId },
    update: { coachingNotes: notes },
    create: { userId, coachingNotes: notes }
  });
}

export async function saveIcaFile(
  userId: string, 
  fileName: string, 
  fileUrl: string, 
  comment?: string
): Promise<void> {
  await db.icaDocument.create({
    data: {
      userId,
      fileName,
      fileUrl,
      comment,
      uploadedOn: new Date(),
    },
  });

  await db.icebergProfile.upsert({
    where: { userId },
    update: { 
      fileName, 
      fileUrl, 
      comment, 
      uploadedOn: new Date() 
    },
    create: { 
      userId, 
      fileName, 
      fileUrl, 
      comment, 
      uploadedOn: new Date() 
    }
  });
}

export async function uploadIcaFileAction(userId: string, formData: FormData): Promise<void> {
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");

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
      console.warn("[ICA Upload] Remote upload endpoint unreachable, saving to local disk:", e);
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

  // Store in IcaDocument table to support multiple files
  await db.icaDocument.create({
    data: {
      userId,
      fileName: file.name,
      fileUrl,
      fileType: fileExtension,
      comment,
      uploadedOn: new Date(),
    },
  });

  await db.icebergProfile.upsert({
    where: { userId },
    update: { 
      fileName: file.name, 
      fileUrl, 
      comment, 
      uploadedOn: new Date() 
    },
    create: { 
      userId, 
      fileName: file.name, 
      fileUrl, 
      comment, 
      uploadedOn: new Date() 
    }
  });
}

export async function deleteIcaFileAction(documentId: string): Promise<void> {
  if (documentId.startsWith("legacy-")) return;
  await db.icaDocument.delete({
    where: { id: documentId },
  });
}

export async function createAttribute(
  userId: string,
  category: "SKILL" | "KNOWLEDGE" | "SELF_IMAGE" | "TRAIT" | "MOTIVE",
  name: string,
  status: "Matched" | "Extra" | "Missing"
): Promise<IcaItem> {
  const dbCat = category as CompetencyCategory;
  const dbStatus = toDbStatus(status);

  // Check if attribute already exists
  const existing = await db.competencyAttribute.findUnique({
    where: {
      userId_category_name: {
        userId,
        category: dbCat,
        name
      }
    }
  });

  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      status: parseStatus(existing.status)
    };
  }

  const attr = await db.competencyAttribute.create({
    data: {
      userId,
      category: dbCat,
      name,
      status: dbStatus
    }
  });

  return {
    id: attr.id,
    name: attr.name,
    status: parseStatus(attr.status)
  };
}

export async function updateAttributeStatus(
  attributeId: string,
  status: "Matched" | "Extra" | "Missing"
): Promise<void> {
  const dbStatus = toDbStatus(status);
  await db.competencyAttribute.update({
    where: { id: attributeId },
    data: { status: dbStatus }
  });
}

export async function deleteAttribute(attributeId: string): Promise<void> {
  await db.competencyAttribute.delete({
    where: { id: attributeId }
  });
}
