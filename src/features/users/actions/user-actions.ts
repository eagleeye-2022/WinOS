"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ROUTES } from "@/constants/routes";
import { calculateAge } from "@/lib/fmt";
import { DEPARTMENTS } from "@/features/users/constants";
import type { UserRole } from "@/types";

export interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: UserRole;
  image: string | null;
  title: string | null;
  department: string | null;
  dateOfJoining: string | null;
  age: number | null;
  isActive: boolean;
}

export interface ManagerOption {
  id: string;
  name: string;
}

export interface EmployeeTreeNode {
  id: string;
  name: string;
  image?: string | null;
  title: string | null;
  role: UserRole;
  children: EmployeeTreeNode[];
}

export interface DepartmentTreeMember {
  id: string;
  name: string;
  image?: string | null;
  title: string | null;
  reportingToId: string | null;
  isActive: boolean;
}

export interface DepartmentTreeGroup {
  teamId: string;
  name: string;
  headName: string | null;
  members: DepartmentTreeMember[];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";
}

function formatDate(d: Date | null) {
  if (!d) return null;
  return d.toLocaleDateString("en-GB");
}

export async function getTeamMembersAction(): Promise<TeamMemberRow[]> {
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  return users.map((u) => {
    const name = u.name || u.email;
    return {
      id: u.id,
      name,
      email: u.email,
      initials: getInitials(name),
      role: u.role,
      image: u.image || null,
      title: u.title,
      department: u.department,
      dateOfJoining: formatDate(u.dateOfJoining),
      age: calculateAge(u.dateOfBirth),
      isActive: u.isActive,
    };
  });
}

export async function getManagerOptionsAction(): Promise<ManagerOption[]> {
  const users = await db.user.findMany({
    where: { role: "MANAGER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.name || u.email }));
}

export interface MemberFormInput {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  employeeId: string;
  designation?: string;
  employmentType?: string;
  department: string;
  location: string;
  dateOfJoining?: string;
  dateOfConfirmation?: string;
  reportingToId: string;
  secondaryReportingToId?: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus?: string;
  workMobile?: string;
  personalMobile: string;
  parentGuardianName?: string;
  parentGuardianMobile?: string;
  permanentAddress?: string;
  personalEmail?: string;
  aadharNumber?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
}

// Kept as an alias so existing imports of the old name keep working.
export type AddTeamMemberInput = MemberFormInput;

function toDate(value?: string) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function assertRequiredFields(input: MemberFormInput) {
  const missing: string[] = [];
  if (!input.employeeId?.trim()) missing.push("Employee ID");
  if (!input.department?.trim()) missing.push("Department");
  // reportingToId isn't required at the DB level: a top-of-hierarchy user
  // (e.g. the CEO) legitimately has no manager. The client form still forces
  // an explicit choice — either a manager or "Top of Hierarchy" — before
  // submitting, so an empty value here means that choice was bypassed
  // (e.g. a direct API call), which we allow rather than block on.
  if (!input.gender?.trim()) missing.push("Gender");
  if (!input.dateOfBirth?.trim()) missing.push("Date of Birth");
  if (!input.personalMobile?.trim()) missing.push("Personal Mobile Number");
  if (!input.location?.trim()) missing.push("Location");
  if (missing.length > 0) {
    throw new Error(`Missing required field(s): ${missing.join(", ")}`);
  }
}

export async function addTeamMemberAction(input: MemberFormInput): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Work email is required");
  assertRequiredFields(input);

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with this email already exists");

  const user = await db.user.create({
    data: {
      name: `${input.firstName} ${input.lastName}`.trim(),
      email,
      role: input.role,
      title: input.designation || null,
      employeeId: input.employeeId.trim(),
      department: input.department,
      location: input.location,
      employmentType: input.employmentType || null,
      dateOfJoining: toDate(input.dateOfJoining) || null,
      dateOfConfirmation: toDate(input.dateOfConfirmation) || null,
      reportingToId: input.reportingToId || null,
      secondaryReportingToId: input.secondaryReportingToId || null,
      dateOfBirth: toDate(input.dateOfBirth) || null,
      gender: input.gender,
      maritalStatus: input.maritalStatus || null,
      workMobile: input.workMobile || null,
      personalMobile: input.personalMobile.trim(),
      parentGuardianName: input.parentGuardianName || null,
      parentGuardianMobile: input.parentGuardianMobile || null,
      permanentAddress: input.permanentAddress || null,
      personalEmail: input.personalEmail || null,
      aadharNumber: input.aadharNumber || null,
      bankAccountNumber: input.bankAccountNumber || null,
      ifscCode: input.ifscCode || null,
      emailVerified: new Date(),
    },
  });

  revalidatePath(ROUTES.settingsUsers);
  return { id: user.id };
}

export interface UpdateTeamMemberInput extends MemberFormInput {
  id: string;
}

export async function updateTeamMemberAction(input: UpdateTeamMemberInput): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Work email is required");
  assertRequiredFields(input);

  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.id !== input.id) {
    throw new Error("A user with this email already exists");
  }

  if (input.reportingToId === input.id) {
    throw new Error("A user cannot report to themselves");
  }

  await db.user.update({
    where: { id: input.id },
    data: {
      name: `${input.firstName} ${input.lastName}`.trim(),
      email,
      role: input.role,
      title: input.designation || null,
      employeeId: input.employeeId.trim(),
      department: input.department,
      location: input.location,
      employmentType: input.employmentType || null,
      dateOfJoining: toDate(input.dateOfJoining) || null,
      dateOfConfirmation: toDate(input.dateOfConfirmation) || null,
      reportingToId: input.reportingToId || null,
      secondaryReportingToId: input.secondaryReportingToId || null,
      dateOfBirth: toDate(input.dateOfBirth) || null,
      gender: input.gender,
      maritalStatus: input.maritalStatus || null,
      workMobile: input.workMobile || null,
      personalMobile: input.personalMobile.trim(),
      parentGuardianName: input.parentGuardianName || null,
      parentGuardianMobile: input.parentGuardianMobile || null,
      permanentAddress: input.permanentAddress || null,
      personalEmail: input.personalEmail || null,
      aadharNumber: input.aadharNumber || null,
      bankAccountNumber: input.bankAccountNumber || null,
      ifscCode: input.ifscCode || null,
    },
  });

  revalidatePath(ROUTES.settingsUsers);
}

export interface MemberDetails extends MemberFormInput {
  id: string;
  image: string | null;
  documents: { kind: string; fileName: string; fileUrl: string }[];
}

export async function getUserDetailsAction(userId: string): Promise<MemberDetails | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { documents: true },
  });
  if (!user) return null;

  const [firstName, ...rest] = (user.name || "").split(" ");

  return {
    id: user.id,
    firstName: firstName || "",
    lastName: rest.join(" "),
    email: user.email || "",
    role: user.role,
    image: user.image || null,
    designation: user.title || "",
    employeeId: user.employeeId || "",
    employmentType: user.employmentType || "",
    department: user.department || "",
    location: user.location || "",
    dateOfJoining: user.dateOfJoining ? user.dateOfJoining.toISOString().split("T")[0] : "",
    dateOfConfirmation: user.dateOfConfirmation ? user.dateOfConfirmation.toISOString().split("T")[0] : "",
    reportingToId: user.reportingToId || "",
    secondaryReportingToId: user.secondaryReportingToId || "",
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split("T")[0] : "",
    gender: user.gender || "",
    maritalStatus: user.maritalStatus || "",
    workMobile: user.workMobile || "",
    personalMobile: user.personalMobile || "",
    parentGuardianName: user.parentGuardianName || "",
    parentGuardianMobile: user.parentGuardianMobile || "",
    permanentAddress: user.permanentAddress || "",
    personalEmail: user.personalEmail || "",
    aadharNumber: user.aadharNumber || "",
    bankAccountNumber: user.bankAccountNumber || "",
    ifscCode: user.ifscCode || "",
    documents: user.documents.map((d) => ({ kind: d.kind, fileName: d.fileName, fileUrl: d.fileUrl })),
  };
}

async function saveUploadedFile(file: File): Promise<{ url: string; fileName: string }> {
  const fileExtension = path.extname(file.name);
  const baseName = path.basename(file.name, fileExtension).replace(/[^a-zA-Z0-9]/g, "_");
  const uniqueFileName = `${Date.now()}-${baseName}${fileExtension}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, uniqueFileName), buffer);

  return { url: `/api/uploads/${uniqueFileName}`, fileName: file.name };
}

export async function uploadUserDocumentAction(userId: string, kind: string, formData: FormData): Promise<void> {
  const file = formData.get("file") as File | null;
  if (!file) return;

  const { url, fileName } = await saveUploadedFile(file);

  await db.userDocument.create({
    data: { userId, kind, fileName, fileUrl: url },
  });
}

export async function uploadProfileImageAction(userId: string, formData: FormData): Promise<{ url: string }> {
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided");

  const { url } = await saveUploadedFile(file);

  await db.user.update({ where: { id: userId }, data: { image: url } });
  revalidatePath(ROUTES.settingsUsers);
  return { url };
}

export async function updateUserImageAction(userId: string, imageUrl: string): Promise<{ url: string }> {
  await db.user.update({ where: { id: userId }, data: { image: imageUrl } });
  revalidatePath(ROUTES.settingsUsers);
  return { url: imageUrl };
}

export async function toggleUserLoginAction(userId: string, isActive: boolean): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { isActive } });
  revalidatePath(ROUTES.settingsUsers);
}

export async function deleteTeamMemberAction(userId: string): Promise<void> {
  await db.user.delete({ where: { id: userId } });
  revalidatePath(ROUTES.settingsUsers);
}

export async function getEmployeeTreeAction(): Promise<EmployeeTreeNode[]> {
  const users = await db.user.findMany({
    select: { id: true, name: true, image: true, email: true, title: true, role: true, reportingToId: true },
    orderBy: { createdAt: "asc" },
  });

  const byId = new Map(users.map((u) => [u.id, u]));
  const childrenOf = new Map<string, typeof users>();
  const roots: typeof users = [];

  for (const u of users) {
    if (u.reportingToId && byId.has(u.reportingToId)) {
      const list = childrenOf.get(u.reportingToId) || [];
      list.push(u);
      childrenOf.set(u.reportingToId, list);
    } else {
      roots.push(u);
    }
  }

  function build(u: (typeof users)[number]): EmployeeTreeNode {
    return {
      id: u.id,
      name: u.name || u.email,
      image: u.image || null,
      title: u.title || (u.role === "MANAGER" ? "Manager" : "Team Member"),
      role: u.role,
      children: (childrenOf.get(u.id) || []).map(build),
    };
  }

  return roots.map(build);
}

export async function getDepartmentTreeAction(): Promise<DepartmentTreeGroup[]> {
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  return DEPARTMENTS.map((department) => {
    const members = users.filter((u) => u.department === department);
    const head = members.find((u) => u.role === "MANAGER");
    return {
      teamId: department,
      name: department,
      headName: head ? head.name || head.email : null,
      members: members.map((u) => ({
        id: u.id,
        name: u.name || u.email,
        image: u.image || null,
        title: u.title,
        reportingToId: u.reportingToId,
        isActive: u.isActive,
      })),
    };
  });
}
