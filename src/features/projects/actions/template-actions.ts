/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ProjectTemplate, SOPPhaseTemplate } from "../types";
import { DEFAULT_PROJECT_TEMPLATES } from "../data/sop-templates";

const d = db as any;

function toProjectTemplate(row: {
  id: string;
  name: string;
  description: string;
  category: string;
  isDefault: boolean;
  phases: unknown;
}): ProjectTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category as ProjectTemplate["category"],
    isDefault: row.isDefault,
    phases: (row.phases as SOPPhaseTemplate[]) || [],
  };
}

/**
 * Re-queries the current session's DB role — mirrors the manager check used across the
 * projects feature (see `isPrivilegedViewer` in project-actions.ts).
 */
async function requireManager(): Promise<{ userId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized: Please sign in to access WinOS Projects." };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, profileRole: true },
  });

  const roleStr = String(user?.role || "").toUpperCase();
  const isManager =
    roleStr === "ADMIN" ||
    roleStr === "SUPER_ADMIN" ||
    roleStr === "PROJECT_MANAGER" ||
    roleStr === "MANAGER" ||
    user?.profileRole === "ADMIN";

  if (!isManager) {
    return { error: "Only managers can manage project templates" };
  }

  return { userId: session.user.id };
}

/**
 * Ensures the ProjectTemplate table has at least the built-in SOP templates. Runs once —
 * subsequent calls see `count() > 0` and skip straight to the read.
 */
async function ensureSeeded(): Promise<void> {
  const count = await d.projectTemplate.count();
  if (count > 0) return;

  await d.projectTemplate.createMany({
    data: DEFAULT_PROJECT_TEMPLATES.map((tmpl) => ({
      id: tmpl.id,
      name: tmpl.name,
      description: tmpl.description,
      category: tmpl.category,
      isDefault: !!tmpl.isDefault,
      phases: tmpl.phases as any,
    })),
    skipDuplicates: true,
  });
}

export async function getProjectTemplatesAction(): Promise<ProjectTemplate[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  await ensureSeeded();

  const rows = await d.projectTemplate.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toProjectTemplate);
}

export interface ProjectTemplateInput {
  name: string;
  description: string;
  category: ProjectTemplate["category"];
  isDefault: boolean;
  phases: SOPPhaseTemplate[];
}

export async function createProjectTemplateAction(
  input: ProjectTemplateInput
): Promise<{ success: boolean; template?: ProjectTemplate; error?: string }> {
  const auth_ = await requireManager();
  if ("error" in auth_) return { success: false, error: auth_.error };

  const row = await d.projectTemplate.create({
    data: {
      name: input.name,
      description: input.description,
      category: input.category,
      isDefault: input.isDefault,
      phases: input.phases as any,
      createdByUserId: auth_.userId,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/projects/settings");

  return { success: true, template: toProjectTemplate(row) };
}

export async function updateProjectTemplateAction(
  id: string,
  input: ProjectTemplateInput
): Promise<{ success: boolean; template?: ProjectTemplate; error?: string }> {
  const auth_ = await requireManager();
  if ("error" in auth_) return { success: false, error: auth_.error };

  const row = await d.projectTemplate.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      category: input.category,
      isDefault: input.isDefault,
      phases: input.phases as any,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/projects/settings");

  return { success: true, template: toProjectTemplate(row) };
}

export async function deleteProjectTemplateAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const auth_ = await requireManager();
  if ("error" in auth_) return { success: false, error: auth_.error };

  await d.projectTemplate.delete({ where: { id } });

  revalidatePath("/projects");
  revalidatePath("/projects/settings");

  return { success: true };
}
