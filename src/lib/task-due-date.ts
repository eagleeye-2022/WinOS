/**
 * Conversions between the two due-date shapes that must stay in sync:
 *  - Srijan `ProjectTask.dueDate` — a string, "DD/MM/YYYY", or "--" for none (a few older rows are
 *    "YYYY-MM-DD").
 *  - DSM `StandupTask.dueDate` — a DateTime stored as UTC midnight.
 * Pure helpers (no DB) — see src/features/dsm/due-date-sync.ts for the syncing itself.
 */

/** Srijan due-date string → UTC-midnight Date, or null when empty/unparseable. */
export function projectDueDateToDate(value: string | null | undefined): Date | null {
  const s = (value ?? "").trim();
  if (!s || s === "--") return null;
  let y: number, m: number, d: number;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  else if (ymd) [y, m, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject impossible dates like 31/02/2026 (Date.UTC would roll them over).
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

/** DSM due date → Srijan due-date string ("DD/MM/YYYY", or "--" for none). */
export function dateToProjectDueDate(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "--";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

/**
 * The due date a DSM row should show: the linked Srijan task's when it has one (that's the shared
 * source of truth), otherwise the row's own.
 */
export function effectiveDsmDueDate(
  ownDueDate: Date | string | null | undefined,
  linkedProjectDueDate: string | null | undefined
): Date | null {
  const linked = projectDueDateToDate(linkedProjectDueDate);
  if (linked) return linked;
  if (!ownDueDate) return null;
  const own = new Date(ownDueDate);
  return Number.isNaN(own.getTime()) ? null : own;
}
