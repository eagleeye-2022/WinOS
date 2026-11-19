// Data for the click-to-open user card. Built once in the dashboard layout (same query that feeds
// avatar photos) and passed down, so opening a card never makes a request.

/** Today's presence, as shown on the user card ("Remote In", "On Leave", …). */
export type UserCardPresence =
  /** `since`: today's check-in time ("09:35 AM"), when known. */
  | { kind: "LIVE"; workMode: "REMOTE" | "OFFICE"; since: string | null }
  | { kind: "CHECKED_OUT"; at: string | null }
  | { kind: "ON_LEAVE" }
  | { kind: "NOT_IN" };

export type UserCardUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  title: string | null;
  department: string | null;
  /** Work mobile; for managers, the permanent mobile when there's no work number. Null when unset. */
  mobile: string | null;
  isActive: boolean;
  presence: UserCardPresence;
};

/** A stored mobile, or null when it's empty / only the "+91" prefix. */
export function cleanMobile(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t && t !== "+91" ? t : null;
}

export function presenceFrom(
  attendance: { isLive: boolean; workMode: string | null; checkInTime: string | null; checkOutTime: string | null } | undefined,
  onLeave: boolean,
): UserCardPresence {
  if (attendance?.isLive && !attendance.checkOutTime) {
    return {
      kind: "LIVE",
      workMode: attendance.workMode === "REMOTE" ? "REMOTE" : "OFFICE",
      since: attendance.checkInTime,
    };
  }
  if (attendance?.checkInTime) return { kind: "CHECKED_OUT", at: attendance.checkOutTime };
  if (onLeave) return { kind: "ON_LEAVE" };
  return { kind: "NOT_IN" };
}
