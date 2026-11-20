"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROUTES } from "@/constants/routes";
import { canManageAttendance } from "@/features/attendance/utils";
import {
  canEditProfileField,
  isProfileField,
  parseProfileFieldValue,
  PROFILE_FIELDS,
  type ProfileField,
  type ProfileFieldValue,
} from "../profile-fields";
import { DOCUMENT_FIELDS } from "../constants";
import { encodeSaturdaysOff } from "../work-week";

export type ProfileFieldSaveResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * Saves one profile field inline (Pulse profile → click a value, edit, auto-save).
 * Re-checks who is asking on every call: members edit their own personal / contact details,
 * managers (anyone Pulse treats as a manager — see canManageAttendance) edit everything here on anyone.
 */
export async function updateProfileFieldAction(
  targetUserId: string,
  field: string,
  raw: string
): Promise<ProfileFieldSaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in again." };

  // Re-read the viewer: a stale session must not keep edit rights after a role change or deactivation.
  const viewer = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, profileRole: true, isActive: true },
  });
  if (!viewer?.isActive) return { ok: false, error: "Please sign in again." };

  if (!isProfileField(field)) return { ok: false, error: "This field can't be edited here." };
  // "Manager" = the same people who can open a member's profile in Pulse (canManageAttendance).
  if (!canEditProfileField(field, { id: viewer.id, isManager: canManageAttendance(viewer) }, targetUserId)) {
    return { ok: false, error: `You don't have permission to change ${PROFILE_FIELDS[field].label}.` };
  }

  const target = await db.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!target) return { ok: false, error: "Team member not found." };

  const parsed = parseProfileFieldValue(field, raw);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  // Reporting managers: a real member, never yourself; the primary must be a manager (as in the form).
  if (PROFILE_FIELDS[field].kind === "user" && typeof parsed.value === "string") {
    if (parsed.value === targetUserId) return { ok: false, error: "A member cannot report to themselves." };
    const person = await db.user.findUnique({ where: { id: parsed.value }, select: { role: true } });
    if (!person) return { ok: false, error: `Choose a valid ${PROFILE_FIELDS[field].label}.` };
    if (field === "reportingToId" && person.role !== "MANAGER") {
      return { ok: false, error: "The primary reporting manager must be a manager." };
    }
  }

  try {
    await db.user.update({ where: { id: targetUserId }, data: { [field]: parsed.value } });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      // Unique columns: Member ID and work email.
      return { ok: false, error: `That ${PROFILE_FIELDS[field].label} is already used by another member.` };
    }
    console.error("updateProfileFieldAction failed:", err);
    return { ok: false, error: "Couldn't save. Try again." };
  }

  revalidatePath(ROUTES.settingsUsers);
  revalidatePath(ROUTES.pulseProfile);

  const v = parsed.value;
  return { ok: true, value: v instanceof Date ? v.toISOString() : Array.isArray(v) ? encodeSaturdaysOff(v) : v };
}

// ── Add a member (profile-style Add Member page) ─────────────────────────────

export type CreateMemberResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<ProfileField, string>> };

/**
 * Creates a team member from the Add Member page. Managers only (canManageAttendance — the same
 * people who can edit profiles). Every field goes through the same checks as inline editing
 * (parseProfileFieldValue), so required fields, dropdown values, dates and emails agree everywhere.
 */
export async function createMemberAction(values: Partial<Record<string, string>>): Promise<CreateMemberResult> {
  const viewer = await profileViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  if (!viewer.isManager) return { ok: false, error: "Only managers can add team members." };

  const data: Record<string, ProfileFieldValue> = {};
  const fieldErrors: Partial<Record<ProfileField, string>> = {};
  for (const field of Object.keys(PROFILE_FIELDS) as ProfileField[]) {
    const parsed = parseProfileFieldValue(field, values[field] ?? "");
    if ("error" in parsed) fieldErrors[field] = parsed.error;
    else data[field] = parsed.value;
  }

  // Reporting managers must be real people; the primary must be a manager (as in the member form).
  for (const field of ["reportingToId", "secondaryReportingToId"] as const) {
    const id = data[field];
    if (typeof id !== "string") continue;
    const person = await db.user.findUnique({ where: { id }, select: { role: true } });
    if (!person) fieldErrors[field] = `Choose a valid ${PROFILE_FIELDS[field].label}.`;
    else if (field === "reportingToId" && person.role !== "MANAGER") {
      fieldErrors[field] = "The primary reporting manager must be a manager.";
    }
  }

  const firstError = Object.values(fieldErrors)[0];
  if (firstError) return { ok: false, error: firstError, fieldErrors };

  try {
    const user = await db.user.create({
      // Same as User Management's Add Member: they sign in with an OTP to this (verified) work email.
      data: { ...data, email: data.email as string, emailVerified: new Date() } as Parameters<typeof db.user.create>[0]["data"],
      select: { id: true },
    });
    revalidateProfiles();
    return { ok: true, id: user.id };
  } catch (err) {
    const e = err as { code?: string; meta?: { target?: string[] | string } };
    if (e?.code === "P2002") {
      const target = String(e.meta?.target ?? "");
      if (target.includes("employeeId")) {
        return { ok: false, error: "That Member ID is already used.", fieldErrors: { employeeId: "That Member ID is already used." } };
      }
      return { ok: false, error: "A member with this work email already exists.", fieldErrors: { email: "A member with this work email already exists." } };
    }
    console.error("createMemberAction failed:", err);
    return { ok: false, error: "Couldn't add the member. Try again." };
  }
}

// ── Edit a whole profile at once (Edit Profile form) ────────────────────────

export type UpdateMemberResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<ProfileField, string>> };

/**
 * Saves the fields changed in the Edit Profile form in one go. Each field goes through the same
 * permission + value checks as inline editing (canEditProfileField / parseProfileFieldValue), and
 * nothing is written unless every changed field passes.
 */
export async function updateMemberProfileAction(
  targetUserId: string,
  changes: Partial<Record<string, string>>
): Promise<UpdateMemberResult> {
  const viewer = await profileViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };

  const target = await db.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!target) return { ok: false, error: "Team member not found." };

  const data: Record<string, ProfileFieldValue> = {};
  const fieldErrors: Partial<Record<ProfileField, string>> = {};
  for (const [field, raw] of Object.entries(changes)) {
    if (!isProfileField(field)) return { ok: false, error: "Some of these fields can't be edited here." };
    if (!canEditProfileField(field, viewer, targetUserId)) {
      return { ok: false, error: `You don't have permission to change ${PROFILE_FIELDS[field].label}.` };
    }
    const parsed = parseProfileFieldValue(field, raw ?? "");
    if ("error" in parsed) fieldErrors[field] = parsed.error;
    else data[field] = parsed.value;
  }

  for (const field of ["reportingToId", "secondaryReportingToId"] as const) {
    const id = data[field];
    if (typeof id !== "string") continue;
    if (id === targetUserId) {
      fieldErrors[field] = "A member cannot report to themselves.";
      continue;
    }
    const person = await db.user.findUnique({ where: { id }, select: { role: true } });
    if (!person) fieldErrors[field] = `Choose a valid ${PROFILE_FIELDS[field].label}.`;
    else if (field === "reportingToId" && person.role !== "MANAGER") {
      fieldErrors[field] = "The primary reporting manager must be a manager.";
    }
  }

  const firstError = Object.values(fieldErrors)[0];
  if (firstError) return { ok: false, error: firstError, fieldErrors };
  if (Object.keys(data).length === 0) return { ok: true };

  try {
    await db.user.update({ where: { id: targetUserId }, data });
  } catch (err) {
    const e = err as { code?: string; meta?: { target?: string[] | string } };
    if (e?.code === "P2002") {
      const isMemberId = String(e.meta?.target ?? "").includes("employeeId");
      const msg = isMemberId ? "That Member ID is already used." : "A member with this work email already exists.";
      return { ok: false, error: msg, fieldErrors: isMemberId ? { employeeId: msg } : { email: msg } };
    }
    console.error("updateMemberProfileAction failed:", err);
    return { ok: false, error: "Couldn't save. Try again." };
  }

  revalidateProfiles();
  return { ok: true };
}

// ── Photo & documents (Pulse profile) ────────────────────────────────────────
// Files go up through POST /api/uploads (signed-in only); these record the result. Same rules as the
// full member form: anyone changes their own photo, managers change anyone's; documents are manager-only.

/** Only files our own upload route stored — never an arbitrary / javascript: URL. */
const UPLOADED_FILE_RE = /^\/api\/uploads\/[A-Za-z0-9._-]+$/;

async function profileViewer() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const viewer = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, profileRole: true, isActive: true },
  });
  return viewer?.isActive ? { id: viewer.id, isManager: canManageAttendance(viewer) } : null;
}

function revalidateProfiles() {
  revalidatePath(ROUTES.settingsUsers);
  revalidatePath(ROUTES.pulseProfile);
}

/** Sets (or with null, removes) a member's profile photo. */
export async function setProfilePhotoAction(
  targetUserId: string,
  fileUrl: string | null
): Promise<{ ok: true; image: string | null } | { ok: false; error: string }> {
  const viewer = await profileViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  if (viewer.id !== targetUserId && !viewer.isManager) {
    return { ok: false, error: "You can only change your own photo." };
  }
  if (fileUrl !== null && !UPLOADED_FILE_RE.test(fileUrl)) return { ok: false, error: "Upload the photo again." };

  const target = await db.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!target) return { ok: false, error: "Team member not found." };

  await db.user.update({ where: { id: targetUserId }, data: { image: fileUrl } });
  revalidateProfiles();
  return { ok: true, image: fileUrl };
}

/** Saves a document into one slot, replacing what was there. */
export async function saveProfileDocumentAction(
  targetUserId: string,
  kind: string,
  fileName: string,
  fileUrl: string
): Promise<{ ok: true; document: { id: string; kind: string; fileName: string; fileUrl: string } } | { ok: false; error: string }> {
  const viewer = await profileViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  if (!viewer.isManager) return { ok: false, error: "Only managers can upload documents." };
  if (!DOCUMENT_FIELDS.some((d) => d.key === kind)) return { ok: false, error: "Unknown document type." };
  if (!UPLOADED_FILE_RE.test(fileUrl)) return { ok: false, error: "Upload the file again." };

  const target = await db.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!target) return { ok: false, error: "Team member not found." };

  const name = (fileName || "document").slice(0, 200);
  // One file per slot: replace the old one (not wrapped in a transaction, like the rest of the app).
  await db.userDocument.deleteMany({ where: { userId: targetUserId, kind } });
  const document = await db.userDocument.create({
    data: { userId: targetUserId, kind, fileName: name, fileUrl },
    select: { id: true, kind: true, fileName: true, fileUrl: true },
  });
  revalidateProfiles();
  return { ok: true, document };
}

/** Removes the document in one slot. */
export async function removeProfileDocumentAction(
  targetUserId: string,
  kind: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await profileViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  if (!viewer.isManager) return { ok: false, error: "Only managers can remove documents." };
  if (!DOCUMENT_FIELDS.some((d) => d.key === kind)) return { ok: false, error: "Unknown document type." };

  await db.userDocument.deleteMany({ where: { userId: targetUserId, kind } });
  revalidateProfiles();
  return { ok: true };
}

export interface ReportingOption {
  id: string;
  name: string;
}

/**
 * People to pick as reporting managers on the Pulse profile — managers only (the same people who may
 * change those fields). Primary: MANAGER-role users, as in User Management; secondary: anyone.
 */
export async function getReportingOptionsAction(): Promise<{ managers: ReportingOption[]; everyone: ReportingOption[] }> {
  const session = await auth();
  if (!session?.user?.id) return { managers: [], everyone: [] };
  const viewer = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, profileRole: true, isActive: true },
  });
  if (!viewer?.isActive || !canManageAttendance(viewer)) return { managers: [], everyone: [] };

  const users = await db.user.findMany({
    where: { isActive: true, OR: [{ profileRole: null }, { profileRole: { not: "CLIENT" } }] },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  const everyone = users.map((u) => ({ id: u.id, name: u.name || u.email }));
  const managers = users.filter((u) => u.role === "MANAGER").map((u) => ({ id: u.id, name: u.name || u.email }));
  return { managers, everyone };
}
