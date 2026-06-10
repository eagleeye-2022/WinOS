import type { HelpRequestItem } from "./queries";

export type HelpStatusFilter = "all" | "in_progress" | "resolved";

/** Days since the help request was raised. Returns 0 for same-day. */
export function daysOpen(date: Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
}

/** Filter and search help requests client-side. */
export function filterHelpRequests(
  items: HelpRequestItem[],
  status: HelpStatusFilter,
  search: string
): HelpRequestItem[] {
  const q = search.toLowerCase();
  return items.filter((s) => {
    if (status === "in_progress" && s.resolved) return false;
    if (status === "resolved" && !s.resolved) return false;
    if (q) {
      const matchText = s.text.toLowerCase().includes(q);
      const matchUser = (s.raisedBy?.name ?? s.raisedBy?.email ?? "").toLowerCase().includes(q);
      if (!matchText && !matchUser) return false;
    }
    return true;
  });
}
