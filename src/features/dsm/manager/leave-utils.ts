// Pure helpers for showing team members' leave on All DSM (safe for client components).

import type { MemberLeaveInfo } from "./queries";

/** True when the leave takes the whole day off (no DSM expected that day). */
export function isFullDayLeave(leave: MemberLeaveInfo | null | undefined): boolean {
  return Boolean(leave && leave.status === "APPROVED" && leave.durationType === "FULL_DAY");
}

/** "First half", "10:00 AM – 12:00 PM", … — null for a full day. */
export function leavePartLabel(leave: MemberLeaveInfo): string | null {
  if (leave.durationType === "HALF_DAY") {
    return leave.halfDayType === "SECOND_HALF"
      ? "Second half"
      : leave.halfDayType === "FIRST_HALF"
      ? "First half"
      : "Half day";
  }
  if (leave.fromTime && leave.toTime) return `${leave.fromTime} – ${leave.toTime}`;
  if (leave.durationType === "QUARTER_DAY") return "Quarter day";
  if (leave.durationType === "EARLY_LEAVE") return "Early leave";
  if (leave.durationType === "HOURLY") return "Hourly";
  return null;
}
