"use server";

import { db } from "@/lib/db";
import { MEETING_CHANNEL_LABEL } from "../constants";
import type { DealMeeting, MeetingAttendee, MeetingRsvp, MeetingStatus } from "../types";
import { formatDate, formatTimeRange } from "../utils";
import { checkAttendee, checkMeeting, type MeetingFields } from "../validation";
import { loadMeeting, reminderToDb } from "../server/data";
import { areTeamMembers, failure, revalidateSetu, success, withSetuUser, type ActionResult } from "../server/guard";

type EventTone = "BLUE" | "GREEN" | "AMBER" | "RED";
const ev = (title: string, detail: string, tone: EventTone = "BLUE") => ({ title, detail, tone });
const slot = (startAt: string | Date, endAt: string | Date) => {
  const s = typeof startAt === "string" ? startAt : startAt.toISOString();
  const e = typeof endAt === "string" ? endAt : endAt.toISOString();
  return `${formatDate(s)}, ${formatTimeRange(s, e)} IST`;
};

/** "Invitation added" for external attendees with an email. (Sending the invite email itself isn't built yet.) */
function inviteEvent(attendees: Omit<MeetingAttendee, "id">[]) {
  const emails = attendees.filter((a) => a.external && a.email).map((a) => a.email);
  return emails.length ? ev("Invitation added", `Calendar invite queued for ${emails.join(", ")}.`) : null;
}

function attendeeRows(attendees: Omit<MeetingAttendee, "id">[]) {
  return attendees.map((a) => ({
    userId: a.external ? null : (a.userId ?? null),
    name: a.name,
    role: a.role ?? null,
    email: a.email ?? null,
    company: a.company ?? null,
    external: a.external,
    source: a.source ?? (a.external ? "GUEST" : "TEAM"),
    rsvp: a.rsvp ?? "PENDING",
    attended: a.attended ?? null,
  }));
}

function meetingData(m: MeetingFields) {
  return {
    title: m.title,
    type: m.type,
    startAt: new Date(m.startAt),
    endAt: new Date(m.endAt),
    channel: m.channel,
    link: m.link ?? null,
    location: m.location ?? null,
    agenda: m.agenda,
    reminder: reminderToDb(m.reminder),
    recordingUrl: m.recordingUrl ?? null,
  };
}

const teamIds = (attendees: Omit<MeetingAttendee, "id">[]) => attendees.filter((a) => !a.external && a.userId).map((a) => a.userId as string);

/** Schedules (UPCOMING), saves a draft (DRAFT) or logs a past meeting (COMPLETED, needs a summary). */
export async function addMeetingAction(
  dealId: string,
  fields: MeetingFields & { hostRole?: string },
  status: "DRAFT" | "UPCOMING" | "COMPLETED"
): Promise<ActionResult<DealMeeting>> {
  return withSetuUser("addMeeting", async (me) => {
    if (!["DRAFT", "UPCOMING", "COMPLETED"].includes(status)) return failure("Unknown meeting status.");
    const checked = checkMeeting(fields, status);
    if (!checked.ok) return failure(checked.error);
    const m = checked.value;
    if (status === "COMPLETED" && !m.summary?.replace(/<[^>]*>/g, "").trim()) return failure("Add the meeting summary.");
    if (!(await db.crmDeal.findUnique({ where: { id: dealId }, select: { id: true } }))) return failure("Pick the related lead / deal.");
    if (!(await areTeamMembers(teamIds(m.attendees)))) return failure("Team attendees must be active WinOS users.");

    const events =
      status === "DRAFT"
        ? [ev("Draft saved", `Saved as a draft by ${me.name}.`, "AMBER")]
        : status === "COMPLETED"
          ? [ev("Meeting logged", `Logged after the fact by ${me.name}.`, "GREEN")]
          : [ev("Meeting scheduled", `Scheduled by ${me.name} · ${MEETING_CHANNEL_LABEL[m.channel]}, ${slot(m.startAt, m.endAt)}.`), inviteEvent(m.attendees)].filter(
              (e): e is ReturnType<typeof ev> => e !== null
            );

    const row = await db.crmMeeting.create({
      data: {
        ...meetingData(m),
        dealId,
        hostId: me.id,
        hostRole: (typeof fields.hostRole === "string" && fields.hostRole.trim().slice(0, 200)) || me.title || null,
        status,
        summary: status === "COMPLETED" ? (m.summary ?? "") : null,
        attendees: { create: attendeeRows(m.attendees) },
        events: { create: events },
      },
      select: { id: true },
    });
    revalidateSetu();
    const meeting = await loadMeeting(row.id);
    return meeting ? success(meeting) : failure("Couldn't load the meeting.");
  });
}

/**
 * Edits a meeting. `status` may promote a DRAFT to UPCOMING. Logs "scheduled" (draft → upcoming),
 * "rescheduled" (time changed) or "updated". Attendees are replaced by the given list.
 */
export async function updateMeetingAction(meetingId: string, fields: MeetingFields, status?: MeetingStatus): Promise<ActionResult<DealMeeting>> {
  return withSetuUser("updateMeeting", async (me) => {
    const current = await db.crmMeeting.findUnique({ where: { id: meetingId }, select: { status: true, startAt: true, endAt: true, summary: true } });
    if (!current) return failure("This meeting no longer exists.");
    if (current.status === "CANCELLED") return failure("Cancelled meetings can't be edited.");
    const next: MeetingStatus = status && (current.status === "DRAFT" ? ["DRAFT", "UPCOMING"] : [current.status]).includes(status) ? status : current.status;
    const checked = checkMeeting(fields, next);
    if (!checked.ok) return failure(checked.error);
    const m = checked.value;
    if (!(await areTeamMembers(teamIds(m.attendees)))) return failure("Team attendees must be active WinOS users.");

    const events: ReturnType<typeof ev>[] = [];
    if (current.status === "DRAFT" && next === "UPCOMING") {
      events.push(ev("Meeting scheduled", `Scheduled by ${me.name} · ${MEETING_CHANNEL_LABEL[m.channel]}, ${slot(m.startAt, m.endAt)}.`));
      const invite = inviteEvent(m.attendees);
      if (invite) events.push(invite);
    } else if (current.startAt.getTime() !== Date.parse(m.startAt) || current.endAt.getTime() !== Date.parse(m.endAt)) {
      events.push(ev("Meeting rescheduled", `Moved by ${me.name} to ${slot(m.startAt, m.endAt)}.`, "AMBER"));
    } else {
      events.push(ev("Details updated", `Edited by ${me.name}.`));
    }

    await db.$transaction([
      db.crmMeetingAttendee.deleteMany({ where: { meetingId } }),
      db.crmMeeting.update({
        where: { id: meetingId },
        data: {
          ...meetingData(m),
          status: next,
          // Only completed meetings carry a summary; keep the stored one when none is sent.
          summary: next === "COMPLETED" ? (m.summary ?? current.summary) : current.summary,
          attendees: { create: attendeeRows(m.attendees) },
          events: { create: events },
        },
      }),
    ]);
    revalidateSetu();
    const meeting = await loadMeeting(meetingId);
    return meeting ? success(meeting) : failure("Couldn't load the meeting.");
  });
}

/** Marks who attended, saves the summary and closes the meeting. */
export async function completeMeetingAction(meetingId: string, attendees: MeetingAttendee[], summary: string): Promise<ActionResult<DealMeeting>> {
  return withSetuUser("completeMeeting", async (me) => {
    const current = await db.crmMeeting.findUnique({ where: { id: meetingId }, select: { status: true } });
    if (!current) return failure("This meeting no longer exists.");
    if (current.status !== "UPCOMING" && current.status !== "COMPLETED") return failure("Only scheduled meetings can be completed.");
    const text = typeof summary === "string" ? summary.slice(0, 20_000) : "";
    if (!text.replace(/<[^>]*>/g, "").trim()) return failure("Add the meeting notes & discussion summary.");
    const cleaned: Omit<MeetingAttendee, "id">[] = [];
    for (const a of (Array.isArray(attendees) ? attendees : []).slice(0, 100)) {
      const c = checkAttendee(a);
      if (!c.ok) return failure(c.error);
      cleaned.push(c.value);
    }
    if (!(await areTeamMembers(teamIds(cleaned)))) return failure("Team attendees must be active WinOS users.");
    const present = cleaned.filter((a) => a.attended).length;
    await db.$transaction([
      db.crmMeetingAttendee.deleteMany({ where: { meetingId } }),
      db.crmMeeting.update({
        where: { id: meetingId },
        data: {
          status: "COMPLETED",
          summary: text,
          attendees: { create: attendeeRows(cleaned) },
          events: { create: [ev("Meeting completed", `Summary logged by ${me.name}; ${present} of ${cleaned.length} attendees present.`, "GREEN")] },
        },
      }),
    ]);
    revalidateSetu();
    const meeting = await loadMeeting(meetingId);
    return meeting ? success(meeting) : failure("Couldn't load the meeting.");
  });
}

export async function cancelMeetingAction(meetingId: string): Promise<ActionResult<DealMeeting>> {
  return withSetuUser("cancelMeeting", async (me) => {
    const current = await db.crmMeeting.findUnique({ where: { id: meetingId }, select: { status: true } });
    if (!current) return failure("This meeting no longer exists.");
    if (current.status !== "UPCOMING") return failure("Only scheduled meetings can be cancelled.");
    await db.crmMeeting.update({
      where: { id: meetingId },
      data: { status: "CANCELLED", events: { create: [ev("Meeting cancelled", `Cancelled by ${me.name}.`, "RED")] } },
    });
    revalidateSetu();
    const meeting = await loadMeeting(meetingId);
    return meeting ? success(meeting) : failure("Couldn't load the meeting.");
  });
}

/** Records an attendee's reply (given by email / phone — there's no invite link yet). */
export async function setAttendeeRsvpAction(meetingId: string, attendeeId: string, rsvp: MeetingRsvp): Promise<ActionResult<DealMeeting>> {
  return withSetuUser("setRsvp", async () => {
    if (!["PENDING", "ACCEPTED", "DECLINED"].includes(rsvp)) return failure("Unknown RSVP.");
    const a = await db.crmMeetingAttendee.findFirst({ where: { id: attendeeId, meetingId }, select: { name: true, rsvp: true } });
    if (!a) return failure("That attendee is no longer on this meeting.");
    if (a.rsvp !== rsvp) {
      const label = rsvp === "ACCEPTED" ? "accepted" : rsvp === "DECLINED" ? "declined" : "reset to pending";
      await db.crmMeeting.update({
        where: { id: meetingId },
        data: {
          attendees: { update: { where: { id: attendeeId }, data: { rsvp } } },
          events: { create: [ev(`RSVP ${label} by ${a.name}`, "Response recorded.", rsvp === "ACCEPTED" ? "GREEN" : rsvp === "DECLINED" ? "RED" : "BLUE")] },
        },
      });
      revalidateSetu();
    }
    const meeting = await loadMeeting(meetingId);
    return meeting ? success(meeting) : failure("Couldn't load the meeting.");
  });
}

export async function addMeetingInviteAction(meetingId: string, attendee: Omit<MeetingAttendee, "id">): Promise<ActionResult<DealMeeting>> {
  return withSetuUser("addInvite", async (me) => {
    const c = checkAttendee(attendee);
    if (!c.ok) return failure(c.error);
    if (!(await areTeamMembers(teamIds([c.value])))) return failure("Team attendees must be active WinOS users.");
    const current = await db.crmMeeting.findUnique({ where: { id: meetingId }, select: { status: true } });
    if (!current) return failure("This meeting no longer exists.");
    if (current.status !== "UPCOMING") return failure("You can only invite people to a scheduled meeting.");
    await db.crmMeeting.update({
      where: { id: meetingId },
      data: {
        attendees: { create: attendeeRows([c.value]) },
        events: { create: [ev("Invitation added", `${me.name} invited ${c.value.name}${c.value.email ? ` (${c.value.email})` : ""}.`)] },
      },
    });
    revalidateSetu();
    const meeting = await loadMeeting(meetingId);
    return meeting ? success(meeting) : failure("Couldn't load the meeting.");
  });
}

/** Deletes a draft meeting outright (scheduled meetings are cancelled instead, keeping their history). */
export async function deleteMeetingAction(meetingId: string): Promise<ActionResult<{ id: string }>> {
  return withSetuUser("deleteMeeting", async () => {
    const current = await db.crmMeeting.findUnique({ where: { id: meetingId }, select: { status: true } });
    if (current && current.status !== "DRAFT") return failure("Only drafts can be deleted — cancel the meeting instead.");
    await db.crmMeeting.deleteMany({ where: { id: meetingId, status: "DRAFT" } });
    revalidateSetu();
    return success({ id: meetingId });
  });
}
