// Data for the click-to-open user card. Built once in the dashboard layout (same query that feeds
// avatar photos) and passed down, so opening a card never makes a request.

/** Today's presence, as shown on the user card ("Remote In", "On Leave", …). */
export type UserCardPresence =
  | { kind: "LIVE"; workMode: "REMOTE" | "OFFICE" }
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
  isActive: boolean;
  presence: UserCardPresence;
};

export function presenceFrom(
  attendance: { isLive: boolean; workMode: string | null; checkInTime: string | null; checkOutTime: string | null } | undefined,
  onLeave: boolean,
): UserCardPresence {
  if (attendance?.isLive && !attendance.checkOutTime) {
    return { kind: "LIVE", workMode: attendance.workMode === "REMOTE" ? "REMOTE" : "OFFICE" };
  }
  if (attendance?.checkInTime) return { kind: "CHECKED_OUT", at: attendance.checkOutTime };
  if (onLeave) return { kind: "ON_LEAVE" };
  return { kind: "NOT_IN" };
}
