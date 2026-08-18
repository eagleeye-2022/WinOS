/** Format a wait duration in seconds to a human-readable string. */
export function fmtWait(seconds: number): string {
  if (seconds <= 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  const mins = Math.ceil(seconds / 60);
  return `${mins} minute${mins !== 1 ? "s" : ""}`;
}

/** Age in whole years as of today, derived from a date of birth. */
export function calculateAge(dateOfBirth: Date | string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age--;

  return age >= 0 ? age : null;
}
