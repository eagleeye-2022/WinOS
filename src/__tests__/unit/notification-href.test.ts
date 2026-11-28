import { describe, expect, it } from "vitest";
import {
  notificationEntity,
  notificationHref,
  resolveNotificationHrefs,
  type NotificationEntity,
  type NotificationEntityLookup,
} from "@/features/notifications/utils";

const n = (type: string, title: string, relatedEntryId: string | null = null) => ({ type, title, relatedEntryId });

describe("notificationHref", () => {
  it("opens calendar invites on their event", () => {
    expect(notificationHref(n("CALENDAR_INVITE", "Calendar Invite", "ev 1"))).toBe("/calendar?event=ev%201");
    expect(notificationHref(n("CALENDAR_INVITE", "Calendar Invite"))).toBe("/calendar");
  });

  it("opens reminders on their page", () => {
    expect(notificationHref(n("DSM_REMINDER", "DSM Reminder"))).toBe("/dsm");
    expect(notificationHref(n("REPORT_REMINDER", "Daily Progress Report Reminder"))).toBe("/report");
    expect(notificationHref(n("DSM_REMINDER", "Blocker Reminder"))).toBe("/blockers");
    expect(notificationHref(n("DSM_REMINDER", "Support Request Reminder"))).toBe("/support");
    expect(notificationHref(n("DSM_REMINDER", "Support Needed (Meeting) Request", "e1"))).toBe("/support");
  });

  it("sends approvers to Team pages and members to My pages", () => {
    expect(notificationHref(n("DSM_REMINDER", "Leave request to review", "r1"))).toBe("/pulse/team/leaves/requests/r1");
    expect(notificationHref(n("DSM_REMINDER", "Leave approved", "r1"))).toBe("/pulse/my/leaves/requests/r1");
    expect(notificationHref(n("DSM_REMINDER", "Comp-off request to review", "c1"))).toBe("/pulse/team/leaves/compensatory/c1");
    expect(notificationHref(n("DSM_REMINDER", "Comp-off rejected", "c1"))).toBe("/pulse/my/leaves/compensatory/c1");
    expect(notificationHref(n("DSM_REMINDER", "Regularization to review", "g1"))).toBe("/pulse/team/attendance/regularization");
    expect(notificationHref(n("DSM_REMINDER", "Attendance regularized", "g1"))).toBe("/pulse/my/attendance/regularization");
    expect(notificationHref(n("DSM_REMINDER", "Attendance times edited"))).toBe("/pulse/my/attendance");
  });

  it("opens projects and WhyFi lists", () => {
    expect(notificationHref(n("PROJECT_ASSIGNED", "New project assigned", "p1"))).toBe("/projects/p1");
    expect(notificationHref(n("PROJECT_ASSIGNED", "Learning task list shared with you", "p1"))).toBe("/pulse/whyfi-learning");
    expect(notificationHref(n("CLIENT_INVITATION_ACCEPTED", "Client Invitation Accepted"))).toBe("/projects/users");
  });

  it("returns null for unknown notifications", () => {
    expect(notificationHref(n("DSM_REMINDER", "Something else"))).toBeNull();
  });

  it("uses the resolved key, or the list page when the record is gone", () => {
    expect(notificationHref(n("PROJECT_ASSIGNED", "New project assigned", "cmabc"), "EEDP-101")).toBe("/projects/EEDP-101");
    expect(notificationHref(n("PROJECT_ASSIGNED", "New project assigned", "cmabc"), null)).toBe("/projects");
    expect(notificationHref(n("DSM_REMINDER", "Leave approved", "r1"), null)).toBe("/pulse/my/leaves/requests");
    expect(notificationHref(n("DSM_REMINDER", "Comp-off request to review", "c1"), null)).toBe("/pulse/team/leaves/compensatory");
    expect(notificationHref(n("CALENDAR_INVITE", "Calendar Invite", "ev1"), null)).toBe("/calendar");
  });
});

describe("notificationEntity", () => {
  it("names the record each linked notification points at", () => {
    expect(notificationEntity(n("PROJECT_ASSIGNED", "New project assigned", "p1"))).toBe("project");
    expect(notificationEntity(n("PROJECT_ASSIGNED", "Learning task list shared with you", "p1"))).toBeNull();
    expect(notificationEntity(n("DSM_REMINDER", "Leave request to review", "r1"))).toBe("leaveRequest");
    expect(notificationEntity(n("DSM_REMINDER", "Comp-off approved", "c1"))).toBe("compOff");
    expect(notificationEntity(n("CALENDAR_INVITE", "Calendar Invite", "e1"))).toBe("calendarEvent");
    // Support / regularization links don't open a single record.
    expect(notificationEntity(n("DSM_REMINDER", "Support Needed (Meeting) Request", "e1"))).toBeNull();
    expect(notificationEntity(n("DSM_REMINDER", "Regularization to review", "g1"))).toBeNull();
    expect(notificationEntity(n("PROJECT_ASSIGNED", "New project assigned"))).toBeNull();
  });
});

describe("resolveNotificationHrefs", () => {
  it("links projects by code, drops deleted records, batches one lookup per kind", async () => {
    const calls: [NotificationEntity, string[]][] = [];
    const lookup: NotificationEntityLookup = async (entity, ids) => {
      calls.push([entity, ids]);
      if (entity === "project") return new Map([["cm-live", "EEDP-101"]]);
      if (entity === "leaveRequest") return new Map([["r1", "r1"]]);
      return new Map();
    };
    const out = await resolveNotificationHrefs(
      [
        n("PROJECT_ASSIGNED", "New project assigned", "cm-live"),
        n("PROJECT_ASSIGNED", "New project assigned", "cm-deleted"),
        n("PROJECT_ASSIGNED", "New project assigned", "cm-live"),
        n("DSM_REMINDER", "Leave approved", "r1"),
        n("DSM_REMINDER", "Leave rejected", "r-gone"),
        n("DSM_REMINDER", "Blocker Reminder"),
      ],
      lookup
    );
    expect(out.map((o) => o.href)).toEqual([
      "/projects/EEDP-101",
      "/projects",
      "/projects/EEDP-101",
      "/pulse/my/leaves/requests/r1",
      "/pulse/my/leaves/requests",
      "/blockers",
    ]);
    expect(calls).toHaveLength(2);
    expect(calls.find(([e]) => e === "project")?.[1]).toEqual(["cm-live", "cm-deleted"]);
  });

  it("keeps the links as they are when a lookup fails", async () => {
    const out = await resolveNotificationHrefs([n("PROJECT_ASSIGNED", "New project assigned", "p1")], async () => {
      throw new Error("db down");
    });
    expect(out[0].href).toBe("/projects/p1");
  });
});
