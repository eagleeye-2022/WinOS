import { ROUTES } from "@/constants/routes";

/** The fields of a notification that decide where clicking it goes. */
export type NotificationTarget = {
  type: string;
  title: string;
  relatedEntryId: string | null;
};

/**
 * The app page a notification opens. Notifications have no link column, so the page is worked out
 * from the type, the title (leave / attendance / support / blocker notices reuse DSM_REMINDER) and
 * `relatedEntryId`. Returns null when there is nowhere useful to go.
 */
export function notificationHref({ type, title, relatedEntryId: id }: NotificationTarget): string | null {
  const t = title.toLowerCase();
  // Approver-bound notices ("Leave request to review", …) open under the Team pages.
  const forApprover = t.includes("to review");

  switch (type) {
    case "CALENDAR_INVITE":
      return id ? `${ROUTES.calendar}?event=${encodeURIComponent(id)}` : ROUTES.calendar;
    case "REPORT_REMINDER":
      return ROUTES.dsr;
    case "PROJECT_ASSIGNED":
      if (t.includes("learning task list")) return "/pulse/whyfi-learning";
      return id ? `/projects/${encodeURIComponent(id)}` : "/projects";
    case "CLIENT_INVITATION_SENT":
    case "CLIENT_INVITATION_ACCEPTED":
    case "CLIENT_INVITATION_REVOKED":
    case "CLIENT_ADDED_TO_PROJECT":
    case "CLIENT_REMOVED_FROM_PROJECT":
      return "/projects/users";
  }

  // DSM_REMINDER and anything else: tell the kinds apart by title.
  if (t.includes("comp-off")) {
    if (!id) return forApprover ? ROUTES.pulseTeamLeaveCompensatory : ROUTES.pulseLeaveCompensatory;
    return forApprover ? ROUTES.pulseTeamCompensatoryRequest(id) : ROUTES.pulseCompensatoryRequest(id);
  }
  if (t.includes("leave")) {
    if (!id) return forApprover ? ROUTES.pulseTeamLeaveRequests : ROUTES.pulseLeaveRequests;
    return forApprover ? ROUTES.pulseTeamLeaveRequest(id) : ROUTES.pulseLeaveRequest(id);
  }
  if (t.includes("regulariz")) return forApprover ? ROUTES.pulseTeamRegularization : ROUTES.pulseRegularization;
  if (t.includes("attendance")) return ROUTES.pulseAttendance;
  if (t.includes("support")) return ROUTES.support;
  if (t.includes("blocker")) return ROUTES.blockers;
  if (t.includes("report")) return ROUTES.dsr;
  if (t.includes("dsm")) return ROUTES.dsm;
  return null;
}
