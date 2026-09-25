"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PROFILE_CONFIG } from "@/features/users/permission-config";
import type {
  ProfileType,
  ProfileRole,
  PermissionScope,
  ControlType,
} from "@/features/users/permission-config";

interface SeedRuleDefault {
  role: ProfileRole;
  enabled?: boolean;
  scope?: PermissionScope;
  scopeAssignee?: boolean;
  scopeOwner?: boolean;
}

interface SeedAction {
  key: string;
  label: string;
  controlType: ControlType;
  defaults: SeedRuleDefault[];
}

interface SeedModule {
  profileType: ProfileType;
  key: string;
  name: string;
  actions: SeedAction[];
}

function allTrue(profileType: ProfileType): SeedRuleDefault[] {
  return PROFILE_CONFIG[profileType].roles.map((r) => ({ role: r.role, enabled: true }));
}

// Generic View/Add/Edit/Trash pattern — used for module categories where the
// reference UI only shows a collapsed header with no visible action list.
// Elevated roles (per PROFILE_CONFIG) get "ALL" scope on Trash, others "OWNED".
function genericModule(profileType: ProfileType, key: string, name: string): SeedModule {
  const trashScope: SeedRuleDefault[] = PROFILE_CONFIG[profileType].roles.map((r) => ({
    role: r.role,
    scope: r.elevated ? "ALL" : "OWNED",
  }));
  return {
    profileType,
    key,
    name,
    actions: [
      { key: "VIEW", label: "View", controlType: "BOOLEAN", defaults: allTrue(profileType) },
      { key: "ADD", label: "Add", controlType: "BOOLEAN", defaults: allTrue(profileType) },
      { key: "EDIT", label: "Edit", controlType: "BOOLEAN", defaults: allTrue(profileType) },
      { key: "TRASH", label: "Trash", controlType: "SCOPE", defaults: trashScope },
    ],
  };
}

const USER_SEED_MODULES: SeedModule[] = [
  genericModule("USER", "STANDUP", "Standup"),
  genericModule("USER", "PROJECTS", "Projects"),
  genericModule("USER", "USER_MANAGEMENT", "User Management"),
  genericModule("USER", "PEOPLE", "Pulse"),
];

const CLIENT_SEED_MODULES: SeedModule[] = [
  genericModule("CLIENT", "PROJECT_OVERVIEW", "Project Overview"),
  genericModule("CLIENT", "TASKS", "Tasks"),
  genericModule("CLIENT", "TASK_DETAILS", "Task Details"),
  genericModule("CLIENT", "TASK_COMMENTS", "Task Comments"),
  genericModule("CLIENT", "DOCUMENTS", "Documents"),
  genericModule("CLIENT", "DISCUSSIONS", "Discussions"),
  genericModule("CLIENT", "PROJECT_CHAT", "Project Chat"),
  genericModule("CLIENT", "MILESTONES", "Milestones & Phases"),
  genericModule("CLIENT", "TIME_LOGS", "Time Logs"),
  genericModule("CLIENT", "REPORTS", "Reports"),
];

const SYSTEM_SEED_MODULES: SeedModule[] = [
  genericModule("SYSTEM", "USER_MANAGEMENT", "User Management"),
  genericModule("SYSTEM", "INTEGRATIONS", "Integrations"),
  genericModule("SYSTEM", "AUDIT_LOGS", "Audit Logs"),
  genericModule("SYSTEM", "BILLING_PLANS", "Billing & Plans"),
];

const SEED_MODULES_BY_PROFILE: Record<ProfileType, SeedModule[]> = {
  USER: USER_SEED_MODULES,
  CLIENT: CLIENT_SEED_MODULES,
  SYSTEM: SYSTEM_SEED_MODULES,
};

async function ensureSeeded(profileType: ProfileType) {
  const seedModules = SEED_MODULES_BY_PROFILE[profileType];
  const existingModules = await db.permissionModule.findMany({
    where: { profileType },
    select: { id: true, key: true, name: true },
  });

  // Keep display names in sync with the seed list (e.g. PEOPLE renamed to "Pulse").
  for (const existing of existingModules) {
    const seed = seedModules.find((mod) => mod.key === existing.key);
    if (seed && seed.name !== existing.name) {
      await db.permissionModule.update({ where: { id: existing.id }, data: { name: seed.name } });
    }
  }

  const existingKeys = new Set(existingModules.map((m) => m.key));
  const missingModules = seedModules.filter((mod) => !existingKeys.has(mod.key));
  if (missingModules.length === 0) return;

  const roles = PROFILE_CONFIG[profileType].roles.map((r) => r.role);
  const startOrder = existingModules.length;

  for (let mIdx = 0; mIdx < missingModules.length; mIdx++) {
    const mod = missingModules[mIdx];
    const createdModule = await db.permissionModule.create({
      data: { profileType, key: mod.key, name: mod.name, order: startOrder + mIdx },
    });

    for (let aIdx = 0; aIdx < mod.actions.length; aIdx++) {
      const action = mod.actions[aIdx];
      const createdAction = await db.permissionAction.create({
        data: {
          moduleId: createdModule.id,
          key: action.key,
          label: action.label,
          controlType: action.controlType,
          order: aIdx,
        },
      });

      for (const role of roles) {
        const def = action.defaults.find((d) => d.role === role);
        await db.permissionRule.create({
          data: {
            role,
            actionId: createdAction.id,
            enabled: def?.enabled ?? false,
            scope: def?.scope ?? "NONE",
            scopeAssignee: def?.scopeAssignee ?? false,
            scopeOwner: def?.scopeOwner ?? false,
          },
        });
      }
    }
  }
}

export interface PermissionRuleView {
  role: ProfileRole;
  enabled: boolean;
  scope: PermissionScope;
  scopeAssignee: boolean;
  scopeOwner: boolean;
}

export interface PermissionActionView {
  id: string;
  key: string;
  label: string;
  controlType: ControlType;
  rulesByRole: Record<string, PermissionRuleView>;
}

export interface PermissionModuleView {
  id: string;
  key: string;
  name: string;
  actions: PermissionActionView[];
}

export async function getPermissionMatrixAction(profileType: ProfileType): Promise<PermissionModuleView[]> {
  await ensureSeeded(profileType);

  const roles = PROFILE_CONFIG[profileType].roles.map((r) => r.role);

  const modules = await db.permissionModule.findMany({
    where: { profileType },
    orderBy: { order: "asc" },
    include: {
      actions: {
        orderBy: { order: "asc" },
        include: { rules: true },
      },
    },
  });

  return modules.map((mod) => ({
    id: mod.id,
    key: mod.key,
    name: mod.name,
    actions: mod.actions.map((action) => {
      const rulesByRole: Record<string, PermissionRuleView> = {};
      for (const role of roles) {
        const rule = action.rules.find((r) => r.role === role);
        rulesByRole[role] = {
          role,
          enabled: rule?.enabled ?? false,
          scope: (rule?.scope as PermissionScope) ?? "NONE",
          scopeAssignee: rule?.scopeAssignee ?? false,
          scopeOwner: rule?.scopeOwner ?? false,
        };
      }
      return {
        id: action.id,
        key: action.key,
        label: action.label,
        controlType: action.controlType as ControlType,
        rulesByRole,
      };
    }),
  }));
}

export interface UserModuleAccessRow {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  isActive: boolean;
  access: Record<string, boolean>; // moduleKey -> enabled
}

export interface UserModuleAccessView {
  modules: { id: string; key: string; name: string }[];
  users: UserModuleAccessRow[];
}

export interface ModuleAccessMap {
  modules: { id: string; key: string; name: string }[];
  // userId -> moduleKey -> enabled (only present when an explicit override exists)
  accessByUser: Record<string, Record<string, boolean>>;
}

// Shared base for every per-user module access read: the seeded USER-profile
// modules plus every explicit UserModuleAccess override. A missing override
// for a (user, module) pair means "enabled" — existing users stay
// unrestricted until an admin explicitly toggles a module off for them.
export async function getModuleAccessMapAction(): Promise<ModuleAccessMap> {
  await ensureSeeded("USER");

  const modules = await db.permissionModule.findMany({
    where: { profileType: "USER" },
    orderBy: { order: "asc" },
    select: { id: true, key: true, name: true },
  });

  const rows = await db.userModuleAccess.findMany({
    where: { moduleId: { in: modules.map((m) => m.id) } },
    select: { userId: true, moduleId: true, enabled: true },
  });
  const moduleKeyById = new Map(modules.map((m) => [m.id, m.key]));

  const accessByUser: Record<string, Record<string, boolean>> = {};
  for (const row of rows) {
    const key = moduleKeyById.get(row.moduleId);
    if (!key) continue;
    (accessByUser[row.userId] ??= {})[key] = row.enabled;
  }

  return { modules, accessByUser };
}

export async function getUserModuleAccessAction(): Promise<UserModuleAccessView> {
  const [{ modules, accessByUser }, users] = await Promise.all([
    getModuleAccessMapAction(),
    db.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, image: true, role: true, isActive: true },
    }),
  ]);

  return {
    modules,
    users: users.map((u) => ({
      userId: u.id,
      name: u.name || u.email,
      email: u.email,
      image: u.image,
      role: u.role,
      isActive: u.isActive,
      access: Object.fromEntries(
        modules.map((m) => [m.key, accessByUser[u.id]?.[m.key] ?? true])
      ),
    })),
  };
}

// The signed-in user's own module access — used to gate navigation/routes.
export async function getMyModuleAccessAction(): Promise<{
  role: string | null;
  access: Record<string, boolean>;
}> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { role: null, access: {} };

  const [{ modules, accessByUser }, role] = await Promise.all([
    getModuleAccessMapAction(),
    db.user.findUnique({ where: { id: userId }, select: { role: true } }).then((u) => u?.role ?? null),
  ]);

  return {
    role,
    access: Object.fromEntries(
      modules.map((m) => [m.key, accessByUser[userId]?.[m.key] ?? true])
    ),
  };
}

export async function setUserModuleAccessAction(
  userId: string,
  moduleId: string,
  enabled: boolean
): Promise<void> {
  await db.userModuleAccess.upsert({
    where: { userId_moduleId: { userId, moduleId } },
    create: { userId, moduleId, enabled },
    update: { enabled },
  });

  revalidatePath("/settings/profile-access");
}

export interface UpdatePermissionRuleInput {
  actionId: string;
  role: ProfileRole;
  enabled?: boolean;
  scope?: PermissionScope;
  scopeAssignee?: boolean;
  scopeOwner?: boolean;
}

export async function updatePermissionRuleAction(input: UpdatePermissionRuleInput): Promise<void> {
  await db.permissionRule.upsert({
    where: { role_actionId: { role: input.role, actionId: input.actionId } },
    create: {
      role: input.role,
      actionId: input.actionId,
      enabled: input.enabled ?? false,
      scope: input.scope ?? "NONE",
      scopeAssignee: input.scopeAssignee ?? false,
      scopeOwner: input.scopeOwner ?? false,
    },
    update: {
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.scopeAssignee !== undefined ? { scopeAssignee: input.scopeAssignee } : {}),
      ...(input.scopeOwner !== undefined ? { scopeOwner: input.scopeOwner } : {}),
    },
  });

  revalidatePath("/settings/profile-access");
}
