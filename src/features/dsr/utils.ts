import { toUtcDate, getWeekRange } from "@/features/dsm/utils";

export { toUtcDate, getWeekRange };

export type DsrReviewStatus =
  | { label: "Pending Review"; kind: "pending" }
  | { label: string; kind: "reviewed" }
  | { label: "Missed Deadline"; kind: "missed-deadline" }
  | { label: "None"; kind: "none" };

type DsrStatusInput = {
  status: string;
  date: Date;
  reviewedAt: Date | null;
  reviewedBy: { name: string | null } | null;
};

export function dsrReviewStatus(entry: DsrStatusInput): DsrReviewStatus {
  if (entry.status === "MISSED") return { label: "None", kind: "none" };
  if (entry.status === "REVIEWED") {
    return {
      label: `Reviewed by ${entry.reviewedBy?.name?.split(" ")[0] ?? "Manager"}`,
      kind: "reviewed",
    };
  }
  const ageMs = Date.now() - new Date(entry.date).getTime();
  const ageDays = ageMs / 86400000;
  if (
    (entry.status === "SUBMITTED" || entry.status === "PENDING_REVIEW") &&
    ageDays > 2 &&
    !entry.reviewedAt
  ) {
    return { label: "Missed Deadline", kind: "missed-deadline" };
  }
  if (entry.status === "SUBMITTED" || entry.status === "PENDING_REVIEW") {
    return { label: "Pending Review", kind: "pending" };
  }
  return { label: "None", kind: "none" };
}

export function formatEventTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(date));
}
