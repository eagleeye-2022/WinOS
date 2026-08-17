"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
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
  {
    profileType: "USER",
    key: "TASK",
    name: "Task",
    actions: [
      {
        key: "VIEW",
        label: "View",
        controlType: "SCOPE",
        defaults: [
          { role: "EMPLOYEE", scope: "ALL" },
          { role: "MANAGER", scope: "ALL" },
          { role: "CONTRACTOR", scope: "ALL" },
        ],
      },
      { key: "ADD", label: "Add", controlType: "BOOLEAN", defaults: allTrue("USER") },
      {
        key: "EDIT",
        label: "Edit",
        controlType: "SCOPE",
        defaults: [
          { role: "EMPLOYEE", scope: "BOTH", scopeAssignee: true, scopeOwner: true },
          { role: "MANAGER", scope: "ALL" },
          { role: "CONTRACTOR", scope: "BOTH", scopeAssignee: true, scopeOwner: true },
        ],
      },
      {
        key: "TRASH",
        label: "Trash",
        controlType: "SCOPE",
        defaults: [
          { role: "EMPLOYEE", scope: "OWNED" },
          { role: "MANAGER", scope: "ALL" },
          { role: "CONTRACTOR", scope: "OWNED" },
        ],
      },
      { key: "REORDER", label: "Reorder", controlType: "BOOLEAN", defaults: allTrue("USER") },
      { key: "ADD_FOLLOWERS", label: "Add Followers", controlType: "BOOLEAN", defaults: allTrue("USER") },
      { key: "PREVIEW_BLUEPRINT", label: "Preview Blueprint", controlType: "BOOLEAN", defaults: allTrue("USER") },
      { key: "ASSOCIATE_BLUEPRINT", label: "Associate Blueprint", controlType: "BOOLEAN", defaults: allTrue("USER") },
    ],
  },
  {
    profileType: "USER",
    key: "TASK_LIST",
    name: "Task List",
    actions: [
      { key: "VIEW", label: "View", controlType: "BOOLEAN", defaults: allTrue("USER") },
      {
        key: "ADD",
        label: "Add",
        controlType: "BOOLEAN",
        defaults: [
          { role: "EMPLOYEE", enabled: false },
          { role: "MANAGER", enabled: true },
          { role: "CONTRACTOR", enabled: false },
        ],
      },
      {
        key: "EDIT",
        label: "Edit",
        controlType: "BOOLEAN",
        defaults: [
          { role: "EMPLOYEE", enabled: false },
          { role: "MANAGER", enabled: false },
          { role: "CONTRACTOR", enabled: false },
        ],
      },
      {
        key: "TRASH",
        label: "Trash",
        controlType: "SCOPE",
        defaults: [
          { role: "EMPLOYEE", scope: "OWNED" },
          { role: "MANAGER", scope: "ALL" },
          { role: "CONTRACTOR", scope: "OWNED" },
        ],
      },
      { key: "REORDER", label: "Reorder", controlType: "BOOLEAN", defaults: allTrue("USER") },
    ],
  },
  {
    profileType: "USER",
    key: "TIME_LOGS",
    name: "Time Logs",
    actions: [
      {
        key: "VIEW",
        label: "View",
        controlType: "SCOPE",
        defaults: [
          { role: "EMPLOYEE", scope: "OWNED" },
          { role: "MANAGER", scope: "ALL" },
          { role: "CONTRACTOR", scope: "OWNED" },
        ],
      },
      {
        key: "ADD",
        label: "Add",
        controlType: "SCOPE",
        defaults: [
          { role: "EMPLOYEE", scope: "OWNED" },
          { role: "MANAGER", scope: "OWNED" },
          { role: "CONTRACTOR", scope: "OWNED" },
        ],
      },
      {
        key: "EDIT",
        label: "Edit",
        controlType: "SCOPE",
        defaults: [
          { role: "EMPLOYEE", scope: "OWNED" },
          { role: "MANAGER", scope: "OWNED" },
          { role: "CONTRACTOR", scope: "OWNED" },
        ],
      },
      {
        key: "TRASH",
        label: "Trash",
        controlType: "SCOPE",
        defaults: [
          { role: "EMPLOYEE", scope: "OWNED" },
          { role: "MANAGER", scope: "ALL" },
          { role: "CONTRACTOR", scope: "OWNED" },
        ],
      },
      { key: "APPROVE", label: "Approve", controlType: "BOOLEAN", defaults: allTrue("USER") },
    ],
  },
  {
    profileType: "USER",
    key: "TIMESHEET",
    name: "Timesheet",
    actions: [
      {
        key: "VIEW",
        label: "View",
        controlType: "SCOPE",
        defaults: [
          { role: "EMPLOYEE", scope: "OWNED" },
          { role: "MANAGER", scope: "ALL" },
          { role: "CONTRACTOR", scope: "OWNED" },
        ],
      },
      { key: "ADD", label: "Add", controlType: "BOOLEAN", defaults: allTrue("USER") },
      { key: "EDIT", label: "Edit", controlType: "BOOLEAN", defaults: allTrue("USER") },
      {
        key: "DELETE",
        label: "Delete",
        controlType: "SCOPE",
        defaults: [
          { role: "EMPLOYEE", scope: "OWNED" },
          { role: "MANAGER", scope: "ALL" },
          { role: "CONTRACTOR", scope: "OWNED" },
        ],
      },
      {
        key: "APPROVE",
        label: "Approve",
        controlType: "BOOLEAN",
        defaults: [
          { role: "EMPLOYEE", enabled: true },
          { role: "MANAGER", enabled: true },
          { role: "CONTRACTOR", enabled: false },
        ],
      },
    ],
  },
  genericModule("USER", "OTHERS", "Others"),
  genericModule("USER", "PROJECT_REPORTS", "Project Reports"),
  genericModule("USER", "GLOBAL_REPORTS", "Global Reports"),
  genericModule("USER", "DASHBOARDS", "Dashboards"),
  genericModule("USER", "PORTAL_PERMISSIONS", "Portal Permissions"),
  genericModule("USER", "SETTINGS", "Settings"),
  genericModule("USER", "INTEGRATIONS", "Integrations"),
  genericModule("USER", "FIELD_PERMISSIONS", "Field Permissions"),
];

const CLIENT_SEED_MODULES: SeedModule[] = [
  genericModule("CLIENT", "PROJECTS", "Projects"),
  genericModule("CLIENT", "INVOICES", "Invoices"),
  genericModule("CLIENT", "DOCUMENTS", "Documents"),
  genericModule("CLIENT", "SUPPORT_REQUESTS", "Support Requests"),
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
    select: { key: true },
  });
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
