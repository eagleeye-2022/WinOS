"use client";

import { create } from "zustand";
import { MOCK_MEETINGS, MOCK_PROSPECTS, MOCK_REFERRALS } from "./data/mock-setu";
import type { Meeting121, MeetingNote, PipelineStageId, Prospect, Referral } from "./types";

// Design-phase store: seeded from mock data and kept in memory so actions on one Setu page
// (convert referrals, move a card) show up on the others. A refresh resets everything.
// Each action here maps 1:1 to a future server action.

interface SetuState {
  meetings: Meeting121[];
  prospects: Prospect[];
  referrals: Referral[];
  addMeeting: (meeting: Omit<Meeting121, "id">) => Meeting121;
  addMeetingNote: (meetingId: string, text: string) => void;
  toggleTodo: (meetingId: string, todoId: string) => void;
  /** Turns a meeting's pending referral names into Stage-1 prospects; returns how many. */
  convertReferrals: (meetingId: string) => number;
  addProspect: (prospect: Omit<Prospect, "id" | "updatedAt">) => Prospect;
  moveProspect: (prospectId: string, stage: PipelineStageId) => void;
  updateProspectRemark: (prospectId: string, remark: string) => void;
  addReferral: (referral: Omit<Referral, "id">) => void;
}

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

export const useSetuStore = create<SetuState>((set, get) => ({
  meetings: MOCK_MEETINGS,
  prospects: MOCK_PROSPECTS,
  referrals: MOCK_REFERRALS,

  addMeeting: (meeting) => {
    const created = { ...meeting, id: uid("m") };
    set((s) => ({ meetings: [created, ...s.meetings] }));
    return created;
  },

  addMeetingNote: (meetingId, text) => {
    const note: MeetingNote = { id: uid("n"), date: today(), text };
    set((s) => ({
      meetings: s.meetings.map((m) => (m.id === meetingId ? { ...m, notes: [...m.notes, note] } : m)),
    }));
  },

  toggleTodo: (meetingId, todoId) =>
    set((s) => ({
      meetings: s.meetings.map((m) =>
        m.id === meetingId
          ? { ...m, todos: m.todos.map((t) => (t.id === todoId ? { ...t, done: !t.done } : t)) }
          : m
      ),
    })),

  convertReferrals: (meetingId) => {
    const meeting = get().meetings.find((m) => m.id === meetingId);
    if (!meeting || meeting.pendingReferralNames.length === 0) return 0;
    const created: Prospect[] = meeting.pendingReferralNames.map((name) => ({
      id: uid("p"),
      name,
      business: "",
      connectedVia: `Co ${meeting.memberName}`,
      phone: "",
      email: "",
      stage: "PROSPECT",
      source: "MEETING_121",
      meetingId,
      remark: `Referral from 121 · ${meeting.memberName}`,
      updatedAt: today(),
    }));
    set((s) => ({
      prospects: [...created, ...s.prospects],
      meetings: s.meetings.map((m) =>
        m.id === meetingId
          ? { ...m, pendingReferralNames: [], prospectIds: [...m.prospectIds, ...created.map((p) => p.id)] }
          : m
      ),
      referrals: s.referrals.map((r) =>
        r.meetingId === meetingId && r.direction === "RECEIVED" && r.status === "OPEN" ? { ...r, status: "CONVERTED" } : r
      ),
    }));
    return created.length;
  },

  addProspect: (prospect) => {
    const created = { ...prospect, id: uid("p"), updatedAt: today() };
    set((s) => ({ prospects: [created, ...s.prospects] }));
    return created;
  },

  moveProspect: (prospectId, stage) =>
    set((s) => ({
      prospects: s.prospects.map((p) => (p.id === prospectId ? { ...p, stage, updatedAt: today() } : p)),
    })),

  updateProspectRemark: (prospectId, remark) =>
    set((s) => ({
      prospects: s.prospects.map((p) => (p.id === prospectId ? { ...p, remark, updatedAt: today() } : p)),
    })),

  addReferral: (referral) => set((s) => ({ referrals: [{ ...referral, id: uid("r") }, ...s.referrals] })),
}));
