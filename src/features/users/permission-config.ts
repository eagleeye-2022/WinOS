export type ProfileType = "USER" | "CLIENT" | "SYSTEM";
export type ProfileRole =
  | "EMPLOYEE"
  | "MANAGER"
  | "CONTRACTOR"
  | "CLIENT"
  | "GUEST"
  | "DEVELOPER"
  | "SUPPORT";
export type PermissionScope = "NONE" | "OWNED" | "ALL" | "BOTH";
export type ControlType = "BOOLEAN" | "SCOPE";

export interface ProfileRoleColumn {
  role: ProfileRole;
  label: string;
  sub?: string;
  elevated?: boolean; // gets "ALL" scope defaults instead of "OWNED"
}

export interface ProfileTypeConfig {
  label: string;
  roles: ProfileRoleColumn[];
  staticColumnLabel: string;
}

export const PROFILE_CONFIG: Record<ProfileType, ProfileTypeConfig> = {
  USER: {
    label: "User Profile",
    roles: [
      { role: "EMPLOYEE", label: "Employee", sub: "(Default)" },
      { role: "MANAGER", label: "Manager", elevated: true },
      { role: "CONTRACTOR", label: "Contractor" },
    ],
    staticColumnLabel: "Admin",
  },
  CLIENT: {
    label: "Client Profile",
    roles: [
      { role: "CLIENT", label: "Client", sub: "(Default)" },
      { role: "GUEST", label: "Guest" },
    ],
    staticColumnLabel: "Portal Admin",
  },
  SYSTEM: {
    label: "System Profile",
    roles: [
      { role: "DEVELOPER", label: "Developer", sub: "(Default)", elevated: true },
      { role: "SUPPORT", label: "Support" },
    ],
    staticColumnLabel: "Super Admin",
  },
};
