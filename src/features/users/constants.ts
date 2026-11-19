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

export const GENDERS = ["Male", "Female", "Other"] as const;
export const MARITAL_STATUSES = ["Single", "Married"] as const;
export const PARENT_RELATIONSHIPS = ["Father", "Mother", "Spouse", "Brother", "Sister", "Guardian", "Other"] as const;

/** Documents a member can upload (UserDocument.kind → label). Used by the member form and the Pulse profile. */
export const DOCUMENT_FIELDS: { key: string; label: string }[] = [
  { key: "HIGHEST_DEGREE", label: "Highest Degree Marksheet" },
  { key: "TWELFTH_MARKSHEET", label: "12th Marksheet" },
  { key: "TENTH_MARKSHEET", label: "10th Marksheet" },
  { key: "PAN_CARD", label: "PAN Card" },
  { key: "AADHAR_CARD", label: "Aadhar Card" },
  { key: "EXPERIENCE_LETTER", label: "Experience/Internship Letter" },
  { key: "BANK_PASSBOOK", label: "Bank Account Passbook" },
];

export type Location = (typeof LOCATIONS)[number];
