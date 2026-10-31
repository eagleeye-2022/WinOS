/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ProjectTemplate, SOPPhaseTemplate } from "../types";
import { BUILT_IN_PROJECT_TEMPLATES, TemplateDraft, buildTemplateFromDraft } from "../template-utils";

const d = db as any;

/** Only rows saved from the Project Template tab, which always record who created them. */
const CUSTOM_TEMPLATE_WHERE = { createdByUserId: { not: null } };

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

/** Templates created by managers, plus their saved edits of the built-in ones (same id as the built-in). */
export async function getCustomProjectTemplatesAction(): Promise<ProjectTemplate[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, profileRole: true },
  });
  if (!user || user.profileRole === "CLIENT" || String(user.role).toUpperCase() === "CLIENT") return [];

  const rows = await d.projectTemplate.findMany({ where: CUSTOM_TEMPLATE_WHERE, orderBy: { createdAt: "asc" } });
  return rows.map(toProjectTemplate);
}

async function otherCustomTemplateNames(excludeId?: string): Promise<string[]> {
  const rows: { name: string }[] = await d.projectTemplate.findMany({
    where: { ...CUSTOM_TEMPLATE_WHERE, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { name: true },
  });
  return rows.map((r) => r.name);
}

function revalidateTemplatePages() {
  revalidatePath("/projects");
  revalidatePath("/projects/settings");
}

export async function createProjectTemplateAction(
  draft: TemplateDraft
): Promise<{ success: boolean; template?: ProjectTemplate; error?: string }> {
  const auth_ = await requireManager();
  if ("error" in auth_) return { success: false, error: auth_.error };

  const { template, error } = buildTemplateFromDraft(draft, await otherCustomTemplateNames());
  if (!template) return { success: false, error };

  const row = await d.projectTemplate.create({
    data: {
      name: template.name,
      description: template.description,
      category: template.category,
      isDefault: false,
      phases: template.phases as any,
      createdByUserId: auth_.userId,
    },
  });

  revalidateTemplatePages();

  return { success: true, template: toProjectTemplate(row) };
}

export async function updateProjectTemplateAction(
  id: string,
  draft: TemplateDraft
): Promise<{ success: boolean; template?: ProjectTemplate; error?: string }> {
  const auth_ = await requireManager();
  if ("error" in auth_) return { success: false, error: auth_.error };

  const builtIn = BUILT_IN_PROJECT_TEMPLATES.find((t) => t.id === id);
  if (!builtIn) {
    const existing = await d.projectTemplate.findFirst({ where: { id, ...CUSTOM_TEMPLATE_WHERE }, select: { id: true } });
    if (!existing) return { success: false, error: "Template not found." };
  }

  const { template, error } = buildTemplateFromDraft(draft, await otherCustomTemplateNames(id), builtIn);
  if (!template) return { success: false, error };

  const data = {
    name: template.name,
    description: template.description,
    category: template.category,
    phases: template.phases as any,
  };
  // A built-in template has no row until its first edit is saved.
  const row = builtIn
    ? await d.projectTemplate.upsert({
        where: { id },
        create: { id, ...data, isDefault: false, createdByUserId: auth_.userId },
        update: { ...data, createdByUserId: auth_.userId },
      })
    : await d.projectTemplate.update({ where: { id }, data });

  revalidateTemplatePages();

  return { success: true, template: toProjectTemplate(row) };
}

export async function deleteProjectTemplateAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const auth_ = await requireManager();
  if ("error" in auth_) return { success: false, error: auth_.error };

  const { count } = await d.projectTemplate.deleteMany({ where: { id, ...CUSTOM_TEMPLATE_WHERE } });
  if (count === 0) return { success: false, error: "Template not found." };

  revalidateTemplatePages();

  return { success: true };
}
