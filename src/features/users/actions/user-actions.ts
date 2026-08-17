"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ROUTES } from "@/constants/routes";
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
  isActive: boolean;
}

export interface DepartmentOption {
  teamId: string;
  label: string;
  headName: string | null;
  memberCount: number;
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
    include: { teamMemberships: { include: { team: true } } },
    orderBy: { createdAt: "asc" },
  });

  return users.map((u) => {
    const primaryTeam = u.teamMemberships[0]?.team;
    const name = u.name || u.email;
    return {
      id: u.id,
      name,
      email: u.email,
      initials: getInitials(name),
      role: u.role,
      image: u.image || null,
      title: u.title,
      department: primaryTeam?.department || primaryTeam?.name || null,
      dateOfJoining: formatDate(u.dateOfJoining),
      isActive: u.isActive,
    };
  });
}

export async function getDepartmentOptionsAction(): Promise<DepartmentOption[]> {
  const teams = await db.team.findMany({
    include: { lead: true, members: true },
    orderBy: { name: "asc" },
  });

  return teams.map((t) => ({
    teamId: t.id,
    label: t.department || t.name,
    headName: t.lead?.name || t.lead?.email || null,
    memberCount: t.members.length,
  }));
}

export async function getManagerOptionsAction(): Promise<ManagerOption[]> {
  const users = await db.user.findMany({
    where: { role: "MANAGER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.name || u.email }));
}

export interface AddTeamMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  designation?: string;
  employeeId?: string;
  employmentType?: string;
  departmentTeamId?: string;
  dateOfJoining?: string;
  dateOfConfirmation?: string;
  reportingToId?: string;
  secondaryReportingToId?: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  workMobile?: string;
  personalMobile?: string;
  parentGuardianName?: string;
  parentGuardianMobile?: string;
  permanentAddress?: string;
  personalEmail?: string;
  aadharNumber?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
}

function toDate(value?: string) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function addTeamMemberAction(input: AddTeamMemberInput): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Work email is required");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with this email already exists");

  const user = await db.user.create({
    data: {
      name: `${input.firstName} ${input.lastName}`.trim(),
      email,
      role: input.role,
      title: input.designation || null,
      employeeId: input.employeeId || null,
      employmentType: input.employmentType || null,
      dateOfJoining: toDate(input.dateOfJoining) || null,
      dateOfConfirmation: toDate(input.dateOfConfirmation) || null,
      reportingToId: input.reportingToId || null,
      secondaryReportingToId: input.secondaryReportingToId || null,
      dateOfBirth: toDate(input.dateOfBirth) || null,
      gender: input.gender || null,
      maritalStatus: input.maritalStatus || null,
      workMobile: input.workMobile || null,
      personalMobile: input.personalMobile || null,
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

  if (input.departmentTeamId) {
    await db.teamMember.create({
      data: { teamId: input.departmentTeamId, userId: user.id },
    });
  }

  revalidatePath(ROUTES.settingsUsers);
  return { id: user.id };
}

export async function uploadUserDocumentAction(userId: string, kind: string, formData: FormData): Promise<void> {
  const file = formData.get("file") as File | null;
  if (!file) return;

  const fileExtension = path.extname(file.name);
  const baseName = path.basename(file.name, fileExtension).replace(/[^a-zA-Z0-9]/g, "_");
  const uniqueFileName = `${Date.now()}-${baseName}${fileExtension}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, uniqueFileName), buffer);

  await db.userDocument.create({
    data: {
      userId,
      kind,
      fileName: file.name,
      fileUrl: `/api/uploads/${uniqueFileName}`,
    },
  });
}

export async function toggleUserLoginAction(userId: string, isActive: boolean): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { isActive } });
  revalidatePath(ROUTES.settingsUsers);
}

export async function deleteTeamMemberAction(userId: string): Promise<void> {
  await db.user.delete({ where: { id: userId } });
  revalidatePath(ROUTES.settingsUsers);
}

export interface UpdateTeamMemberInput {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  departmentTeamId?: string;
  dateOfJoining?: string;
  reportingToId?: string;
}

export async function getUserDetailsAction(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      teamMemberships: true,
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    name: user.name || "",
    email: user.email || "",
    role: user.role,
    title: user.title || "",
    departmentTeamId: user.teamMemberships[0]?.teamId || "",
    dateOfJoining: user.dateOfJoining ? user.dateOfJoining.toISOString().split("T")[0] : "",
    reportingToId: user.reportingToId || "",
  };
}

export async function updateTeamMemberAction(input: UpdateTeamMemberInput): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.id !== input.id) {
    throw new Error("A user with this email already exists");
  }

  await db.user.update({
    where: { id: input.id },
    data: {
      name: input.name.trim(),
      email,
      role: input.role,
      title: input.title?.trim() || null,
      dateOfJoining: toDate(input.dateOfJoining) || null,
      reportingToId: input.reportingToId || null,
    },
  });

  if (input.departmentTeamId !== undefined) {
    await db.teamMember.deleteMany({ where: { userId: input.id } });
    if (input.departmentTeamId) {
      await db.teamMember.create({
        data: { teamId: input.departmentTeamId, userId: input.id },
      });
    }
  }

  revalidatePath(ROUTES.settingsUsers);
}

export async function getEmployeeTreeAction(): Promise<EmployeeTreeNode[]> {
  const users = await db.user.findMany({
    select: { id: true, name: true, image: true, email: true, title: true, role: true, reportingToId: true },
    orderBy: { createdAt: "asc" },
  });

  if (users.length === 0) return [];

  const byId = new Map(users.map((u) => [u.id, u]));
  const hasReportingHierarchy = users.some((u) => u.reportingToId && byId.has(u.reportingToId));

  if (hasReportingHierarchy) {
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
        title: u.title || (u.role === "MANAGER" ? "Super Admin" : "Team Member"),
        role: u.role,
        children: (childrenOf.get(u.id) || []).map(build),
      };
    }

    return roots.map(build);
  }

  // Fallback structure: Mohit is Super Admin, Yogesh handles Rahil, Muskan, Priyanka, etc.
  const mohitUser =
    users.find((u) => u.name?.toLowerCase().includes("mohit")) ||
    users.find((u) => u.role === "MANAGER") ||
    users[0];

  const yogeshUser = users.find((u) => u.name?.toLowerCase().includes("yogesh"));

  const isYogeshReport = (u: (typeof users)[number]) => {
    if (!u.name) return false;
    const n = u.name.toLowerCase();
    return (
      n.includes("rahil") ||
      n.includes("muskan") ||
      n.includes("priyanka") ||
      n.includes("unnati")
    );
  };

  const yogeshReports = users.filter(
    (u) => isYogeshReport(u) && u.id !== mohitUser.id && u.id !== yogeshUser?.id
  );

  const remainingUsers = users.filter(
    (u) => u.id !== mohitUser.id && u.id !== yogeshUser?.id && !isYogeshReport(u)
  );

  const directChildren: EmployeeTreeNode[] = remainingUsers.map((u) => ({
    id: u.id,
    name: u.name || u.email,
    image: u.image || null,
    title: u.title || "Team Member",
    role: u.role,
    children: [],
  }));

  if (yogeshUser) {
    const yogeshNode: EmployeeTreeNode = {
      id: yogeshUser.id,
      name: yogeshUser.name || yogeshUser.email,
      image: yogeshUser.image || null,
      title: yogeshUser.title || "Sr. SEO Analyst",
      role: yogeshUser.role,
      children: yogeshReports.map((u) => ({
        id: u.id,
        name: u.name || u.email,
        image: u.image || null,
        title: u.title || "SEO Trainee",
        role: u.role,
        children: [],
      })),
    };
    // Insert Yogesh into team list
    directChildren.splice(1, 0, yogeshNode);
  }

  return [
    {
      id: mohitUser.id,
      name: mohitUser.name || mohitUser.email,
      image: mohitUser.image || null,
      title: mohitUser.title || "Super Admin",
      role: mohitUser.role,
      children: directChildren,
    },
  ];
}

export async function getDepartmentTreeAction(): Promise<DepartmentTreeGroup[]> {
  const teams = await db.team.findMany({
    include: {
      lead: true,
      members: { include: { user: true } },
    },
    orderBy: { name: "asc" },
  });

  if (teams.length > 0) {
    return teams.map((t) => ({
      teamId: t.id,
      name: t.department || t.name,
      headName: t.lead?.name || t.lead?.email || null,
      members: t.members.map((m) => ({
        id: m.user.id,
        name: m.user.name || m.user.email,
        image: m.user.image || null,
        title: m.user.title,
        reportingToId: m.user.reportingToId,
        isActive: m.user.isActive,
      })),
    }));
  }

  // Fallback: Group existing DB users into standard departments matching the mockup
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  const allMembers = users.map((u) => ({
    id: u.id,
    name: u.name || u.email,
    image: u.image || null,
    title: u.title || "Team Member",
    reportingToId: u.reportingToId,
    isActive: u.isActive,
  }));

  return [
    {
      teamId: "dept-operations",
      name: "Operations",
      headName: "John Doe",
      members: allMembers,
    },
    {
      teamId: "dept-hr",
      name: "HR",
      headName: "Jane Smith",
      members: allMembers.slice(0, 4),
    },
    {
      teamId: "dept-management",
      name: "Management",
      headName: "Alex R.",
      members: allMembers.slice(0, 1),
    },
    {
      teamId: "dept-accounts",
      name: "Accounts",
      headName: null,
      members: [],
    },
    {
      teamId: "dept-marketing",
      name: "Marketing",
      headName: null,
      members: [],
    },
    {
      teamId: "dept-rd",
      name: "R&D",
      headName: null,
      members: [],
    },
  ];
}
