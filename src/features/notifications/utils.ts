import { ROUTES } from "@/constants/routes";

/** The fields of a notification that decide where clicking it goes. */
export type NotificationTarget = {
  type: string;
  title: string;
  relatedEntryId: string | null;
};

/** The record a notification's `relatedEntryId` points at, when it opens that record's page. */
export type NotificationEntity = "project" | "leaveRequest" | "compOff" | "calendarEvent";

/**
 * Which kind of record `relatedEntryId` is, for the notifications whose link opens that record.
 * The server looks these up before showing the list (`resolveNotificationHrefs`), so a link to a
 * deleted project / request / event falls back to the list page instead of a "not found" page.
 */
export function notificationEntity({ type, title, relatedEntryId }: NotificationTarget): NotificationEntity | null {
  if (!relatedEntryId) return null;
  const t = title.toLowerCase();
  if (type === "CALENDAR_INVITE") return "calendarEvent";
  if (type === "PROJECT_ASSIGNED") return t.includes("learning task list") ? null : "project";
  if (type === "DSM_REMINDER") {
    if (t.includes("comp-off")) return "compOff";
    if (t.includes("leave")) return "leaveRequest";
  }
  return null;
}

/**
 * The app page a notification opens. Notifications have no link column, so the page is worked out
 * from the type, the title (leave / attendance / support / blocker notices reuse DSM_REMINDER) and
 * `relatedEntryId`. Returns null when there is nowhere useful to go.
 *
 * `resolvedKey` is what the server found for the related record (see `notificationEntity`):
 * omitted → use `relatedEntryId` as it is; a string → use it instead (a project's code, so the link
 * matches the rest of the app: /projects/EEDP-101); null → the record is gone, open the list page.
 */
export function notificationHref(target: NotificationTarget, resolvedKey?: string | null): string | null {
  const { type, title } = target;
  const id = resolvedKey === undefined ? target.relatedEntryId : resolvedKey;
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

/** Looks up the records a batch of notifications point at: entity → (relatedEntryId → key, or absent). */
export type NotificationEntityLookup = (
  entity: NotificationEntity,
  ids: string[]
) => Promise<Map<string, string>>;

/**
 * Each notification's link, with related records checked in one lookup per kind: a project links
 * by its code, and a project / leave / comp-off / event that no longer exists opens the list page.
 */
export async function resolveNotificationHrefs<T extends NotificationTarget>(
  notifications: T[],
  lookup: NotificationEntityLookup
): Promise<(T & { href: string | null })[]> {
  const idsByEntity = new Map<NotificationEntity, Set<string>>();
  for (const n of notifications) {
    const entity = notificationEntity(n);
    if (!entity || !n.relatedEntryId) continue;
    const set = idsByEntity.get(entity) ?? new Set<string>();
    set.add(n.relatedEntryId);
    idsByEntity.set(entity, set);
  }

  const found = new Map<NotificationEntity, Map<string, string>>();
  await Promise.all(
    [...idsByEntity].map(async ([entity, ids]) => {
      try {
        found.set(entity, await lookup(entity, [...ids]));
      } catch (err) {
        // A failed lookup must not hide the bell — keep the links as they are.
        console.warn("[notifications] link lookup failed:", entity, err instanceof Error ? err.message : err);
      }
    })
  );

  return notifications.map((n) => {
    const entity = notificationEntity(n);
    const keys = entity ? found.get(entity) : undefined;
    const resolvedKey = keys && n.relatedEntryId ? keys.get(n.relatedEntryId) ?? null : undefined;
    return { ...n, href: notificationHref(n, resolvedKey) };
  });
}
