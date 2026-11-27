import { describe, expect, it } from "vitest";
import { notificationHref } from "@/features/notifications/utils";

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
});
