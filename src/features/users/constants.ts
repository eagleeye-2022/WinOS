export const DEPARTMENTS = [
  "Operation",
  "Sales",
  "HR",
  "Accounts",
  "Legal",
  "Marketing",
  "Management",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

/**
 * Employment types a member can have. Single source for User Management's member form and the leave
 * type wizard's eligibility step, so a leave type limited to e.g. "Intern" matches people set to "Intern".
 */
export const EMPLOYMENT_TYPES = ["Permanent", "Intern", "Trainee", "Contract"] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const LOCATIONS = ["EagleEye Digital HQ", "Work From Home"] as const;

export type Location = (typeof LOCATIONS)[number];
