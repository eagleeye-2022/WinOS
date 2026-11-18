// Inline-editable profile fields (Pulse profile) — which ones exist, who may edit them, and how a
// typed value is checked. Shared by the profile page (to show edit affordances) and
// updateProfileFieldAction (which enforces the same rules on the server).
//
// Everyone edits their own personal / contact details. Managers (anyone Pulse treats as a manager —
// canManageAttendance) edit every field User Management's member form has, on anyone: also role,
// work email and reporting managers.

import {
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  GENDERS,
  LOCATIONS,
  MARITAL_STATUSES,
  PARENT_RELATIONSHIPS,
} from "./constants";

/** "user": another member's id (reporting managers) — the server checks it exists. */
export type ProfileFieldKind = "text" | "date" | "select" | "email" | "phone" | "user";

export interface ProfileFieldConfig {
  kind: ProfileFieldKind;
  label: string;
  /** Can't be cleared (the member form requires it). */
  required?: boolean;
  /** Only managers may change it — for themselves or anyone else. */
  managerOnly?: boolean;
  options?: readonly string[];
  /** Display text for stored option values (e.g. TEAM_MEMBER → "Team Member"). */
  optionLabels?: Record<string, string>;
}

export const ROLE_LABELS: Record<string, string> = { TEAM_MEMBER: "Team Member", MANAGER: "Manager" };

export const PROFILE_FIELDS = {
  // Basic / work (manager-only)
  name: { kind: "text", label: "Full Name", required: true, managerOnly: true },
  employeeId: { kind: "text", label: "Member ID", required: true, managerOnly: true },
  email: { kind: "email", label: "Work Email", required: true, managerOnly: true },
  role: {
    kind: "select",
    label: "Role",
    required: true,
    managerOnly: true,
    options: ["TEAM_MEMBER", "MANAGER"],
    optionLabels: ROLE_LABELS,
  },
  title: { kind: "text", label: "Designation", required: true, managerOnly: true },
  department: { kind: "select", label: "Department", required: true, managerOnly: true, options: DEPARTMENTS },
  location: { kind: "select", label: "Location", required: true, managerOnly: true, options: LOCATIONS },
  employmentType: { kind: "select", label: "Member Type", managerOnly: true, options: EMPLOYMENT_TYPES },
  dateOfJoining: { kind: "date", label: "Date of Joining", managerOnly: true },
  dateOfConfirmation: { kind: "date", label: "Date of Confirmation", managerOnly: true },
  // Hierarchy (manager-only). Empty primary = "Top of Hierarchy (No Manager)".
  reportingToId: { kind: "user", label: "Primary Reporting Manager", managerOnly: true },
  secondaryReportingToId: { kind: "user", label: "Secondary Reporting Manager", managerOnly: true },
  // Personal
  dateOfBirth: { kind: "date", label: "Date of Birth", required: true },
  gender: { kind: "select", label: "Gender", required: true, options: GENDERS },
  maritalStatus: { kind: "select", label: "Marital Status", options: MARITAL_STATUSES },
  // Contact
  workMobile: { kind: "phone", label: "Work Mobile Number" },
  personalMobile: { kind: "phone", label: "Permanent Mobile Number", required: true },
  personalEmail: { kind: "email", label: "Permanent E-Mail Address" },
  parentGuardianName: { kind: "text", label: "Parent/Guardian Name", required: true },
  parentGuardianRelationship: {
    kind: "select",
    label: "Parent/Guardian Relationship",
    required: true,
    options: PARENT_RELATIONSHIPS,
  },
  parentGuardianMobile: { kind: "phone", label: "Parent/Guardian Mobile Number", required: true },
  permanentAddress: { kind: "text", label: "Permanent Address" },
  // Bank & identity (manager-only, like the member form)
  aadharNumber: { kind: "text", label: "Aadhar Number", managerOnly: true },
  bankAccountNumber: { kind: "text", label: "Bank Account Number", managerOnly: true },
  ifscCode: { kind: "text", label: "IFSC Code", managerOnly: true },
} as const satisfies Record<string, ProfileFieldConfig>;

export type ProfileField = keyof typeof PROFILE_FIELDS;

export function isProfileField(field: string): field is ProfileField {
  return Object.prototype.hasOwnProperty.call(PROFILE_FIELDS, field);
}

/** Whether `viewer` may change `field` on the profile of `targetUserId`. */
export function canEditProfileField(
  field: ProfileField,
  viewer: { id: string; isManager: boolean },
  targetUserId: string
): boolean {
  if (viewer.isManager) return true; // Managers edit anything here, on anyone (as on the edit page).
  if (viewer.id !== targetUserId) return false;
  return !(PROFILE_FIELDS[field] as ProfileFieldConfig).managerOnly;
}

/** Mobile fields start as "+91 " in the form; just the code means "no number". */
function cleanPhone(v: string): string {
  return v === "+91" ? "" : v;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks a typed value. Returns the value to store (null = cleared) or an error message.
 * Dates come in as YYYY-MM-DD.
 */
export function parseProfileFieldValue(
  field: ProfileField,
  raw: string,
  today: Date = new Date()
): { value: string | Date | null } | { error: string } {
  const cfg = PROFILE_FIELDS[field] as ProfileFieldConfig;
  let v = (raw ?? "").trim();
  if (cfg.kind === "phone") v = cleanPhone(v);

  if (!v) return cfg.required ? { error: `${cfg.label} is required.` } : { value: null };

  switch (cfg.kind) {
    case "select":
      if (!cfg.options?.includes(v)) return { error: `Choose a valid ${cfg.label}.` };
      return { value: v };
    case "email":
      if (!EMAIL_RE.test(v)) return { error: "Enter a valid email address." };
      return { value: v.toLowerCase() };
    case "user":
      // Existence / self-reporting are checked against the DB by the action.
      if (v.length > 64) return { error: `Choose a valid ${cfg.label}.` };
      return { value: v };
    case "phone":
      if (!/^[+\d][\d\s-]{5,19}$/.test(v)) return { error: "Enter a valid phone number." };
      return { value: v };
    case "date": {
      if (!DATE_RE.test(v)) return { error: "Enter a valid date." };
      const d = new Date(`${v}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) return { error: "Enter a valid date." };
      if (field === "dateOfBirth") {
        const endOfToday = new Date(today);
        endOfToday.setUTCHours(23, 59, 59, 999);
        if (d > endOfToday) return { error: "Date of Birth cannot be greater than the current date." };
      }
      return { value: d };
    }
    default:
      if (v.length > 300) return { error: `${cfg.label} is too long.` };
      return { value: v };
  }
}
