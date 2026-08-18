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

export const LOCATIONS = ["EagleEye Digital HQ", "Work From Home"] as const;

export type Location = (typeof LOCATIONS)[number];
