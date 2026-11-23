"use client";

import { createStore, type StoreApi } from "zustand";
import type { SetuApi } from "./api";
import type { ActionResult } from "./server/guard";
import type {
  ActiveTimer,
  Deal,
  DealCall,
  DealInput,
  DealLostDetails,
  DealMeeting,
  DealNote,
  DealStage,
  DealTimeLog,
  DealWonDetails,
  DealFile,
  MeetingAttendee,
  MeetingRsvp,
  MeetingStatus,
  NegotiationRequest,
  NoteCategory,
  ProposalVersion,
  SetuSnapshot,
  TeamMember,
} from "./types";
import type { CallFields, MeetingFields } from "./validation";

// Client cache of the Setu data. It starts from the server snapshot the Setu layout loads, and every
// action calls a server action (./api) and merges the saved record back in. When the server
// re-renders the layout after a write (revalidatePath), the provider replaces the data with the
// fresh snapshot. Actions throw an Error with a user-facing message when the server refuses.

export type DraftPatch = { title: string; value: number; reason: string };

export interface SetuState {
  me: TeamMember;
  team: TeamMember[];
  deals: Deal[];
  notes: DealNote[];
  timeLogs: DealTimeLog[];
  activeTimer: ActiveTimer | null;
  requests: NegotiationRequest[];
  calls: DealCall[];
  meetings: DealMeeting[];
  proposals: ProposalVersion[];

  createDeal: (input: DealInput) => Promise<Deal>;
  updateDeal: (dealId: string, input: DealInput) => Promise<Deal>;
  /** Optimistic (the board card moves at once; reverts if the server refuses). */
  moveDeal: (dealId: string, stage: DealStage) => Promise<void>;
  closeWon: (dealId: string, details: DealWonDetails) => Promise<Deal>;
  closeLost: (dealId: string, details: DealLostDetails) => Promise<Deal>;

  addNote: (dealId: string, note: { title: string; body: string; pinned: boolean; category: NoteCategory }) => Promise<DealNote>;
  updateNote: (noteId: string, patch: Partial<Pick<DealNote, "title" | "body" | "pinned">>) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;

  addRequest: (dealId: string, request: { text: string; requestedBy: string }) => Promise<void>;
  updateRequest: (requestId: string, request: { text: string; requestedBy: string }) => Promise<void>;
  deleteRequest: (requestId: string) => Promise<void>;

  startTimer: (dealId: string) => Promise<void>;
  stopTimer: (reason: string) => Promise<DealTimeLog>;
  discardTimer: () => Promise<void>;
  deleteTimeLog: (logId: string) => Promise<void>;

  logCall: (dealId: string, call: CallFields) => Promise<void>;
  updateCall: (callId: string, call: CallFields) => Promise<void>;
  deleteCall: (callId: string) => Promise<void>;

  addMeeting: (dealId: string, meeting: MeetingFields & { hostRole?: string }, status: "DRAFT" | "UPCOMING" | "COMPLETED") => Promise<DealMeeting>;
  updateMeeting: (meetingId: string, meeting: MeetingFields, status?: MeetingStatus) => Promise<DealMeeting>;
  completeMeeting: (meetingId: string, attendees: MeetingAttendee[], summary: string) => Promise<void>;
  cancelMeeting: (meetingId: string) => Promise<void>;
  setAttendeeRsvp: (meetingId: string, attendeeId: string, rsvp: MeetingRsvp) => Promise<void>;
  addMeetingInvite: (meetingId: string, attendee: Omit<MeetingAttendee, "id">) => Promise<void>;
  deleteMeeting: (meetingId: string) => Promise<void>;

  createProposalDraft: (dealId: string) => Promise<void>;
  saveProposalDraft: (proposalId: string, patch: DraftPatch, attachment?: DealFile | null) => Promise<void>;
  publishProposal: (proposalId: string, patch: DraftPatch, attachment?: DealFile | null) => Promise<void>;
  discardProposalDraft: (proposalId: string) => Promise<void>;
}

export type SetuStore = StoreApi<SetuState>;

/** The data part of the state (what a snapshot replaces). */
export function snapshotState(s: SetuSnapshot) {
  return {
    me: s.me,
    team: s.team,
    deals: s.deals,
    notes: s.notes,
    timeLogs: s.timeLogs,
    activeTimer: s.activeTimer,
    requests: s.requests,
    calls: s.calls,
    meetings: s.meetings,
    proposals: s.proposals,
  };
}

async function unwrap<T>(p: Promise<ActionResult<T>>): Promise<T> {
  const res = await p;
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

const upsert = <T extends { id: string }>(list: T[], item: T): T[] => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list]);
const without = <T extends { id: string }>(list: T[], id: string): T[] => list.filter((x) => x.id !== id);

export function createSetuStore(snapshot: SetuSnapshot, api: SetuApi): SetuStore {
  return createStore<SetuState>()((set, get) => ({
    ...snapshotState(snapshot),

    createDeal: async (input) => {
      const deal = await unwrap(api.createDeal(input));
      set((s) => ({ deals: upsert(s.deals, deal) }));
      return deal;
    },
    updateDeal: async (dealId, input) => {
      const deal = await unwrap(api.updateDeal(dealId, input));
      set((s) => ({ deals: upsert(s.deals, deal) }));
      return deal;
    },
    moveDeal: async (dealId, stage) => {
      const before = get().deals.find((d) => d.id === dealId);
      if (!before || before.stage === stage) return;
      set((s) => ({ deals: s.deals.map((d) => (d.id === dealId ? { ...d, stage } : d)) }));
      try {
        const deal = await unwrap(api.moveDeal(dealId, stage));
        set((s) => ({ deals: upsert(s.deals, deal) }));
      } catch (err) {
        set((s) => ({ deals: upsert(s.deals, before) }));
        throw err;
      }
    },
    closeWon: async (dealId, details) => {
      const { documents, ...rest } = details;
      const deal = await unwrap(api.closeWon(dealId, rest, documents));
      set((s) => ({ deals: upsert(s.deals, deal) }));
      return deal;
    },
    closeLost: async (dealId, details) => {
      const deal = await unwrap(api.closeLost(dealId, details));
      set((s) => ({ deals: upsert(s.deals, deal) }));
      return deal;
    },

    addNote: async (dealId, note) => {
      const saved = await unwrap(api.addNote(dealId, note));
      set((s) => ({ notes: upsert(s.notes, saved) }));
      return saved;
    },
    updateNote: async (noteId, patch) => {
      const saved = await unwrap(api.updateNote(noteId, patch));
      set((s) => ({ notes: upsert(s.notes, saved) }));
    },
    deleteNote: async (noteId) => {
      await unwrap(api.deleteNote(noteId));
      set((s) => ({ notes: without(s.notes, noteId) }));
    },

    addRequest: async (dealId, request) => {
      const list = await unwrap(api.addRequest(dealId, request));
      set((s) => ({ requests: [...s.requests.filter((r) => r.dealId !== dealId), ...list] }));
    },
    updateRequest: async (requestId, request) => {
      const list = await unwrap(api.updateRequest(requestId, request));
      const dealId = list[0]?.dealId ?? get().requests.find((r) => r.id === requestId)?.dealId;
      set((s) => ({ requests: [...s.requests.filter((r) => r.dealId !== dealId), ...list] }));
    },
    deleteRequest: async (requestId) => {
      const dealId = get().requests.find((r) => r.id === requestId)?.dealId;
      const list = await unwrap(api.deleteRequest(requestId));
      set((s) => ({ requests: [...s.requests.filter((r) => r.dealId !== dealId), ...list] }));
    },

    startTimer: async (dealId) => {
      const timer = await unwrap(api.startTimer(dealId));
      set({ activeTimer: timer });
    },
    stopTimer: async (reason) => {
      const log = await unwrap(api.stopTimer(reason));
      set((s) => ({ activeTimer: null, timeLogs: upsert(s.timeLogs, log) }));
      return log;
    },
    discardTimer: async () => {
      await unwrap(api.discardTimer());
      set({ activeTimer: null });
    },
    deleteTimeLog: async (logId) => {
      await unwrap(api.deleteTimeLog(logId));
      set((s) => ({ timeLogs: without(s.timeLogs, logId) }));
    },

    logCall: async (dealId, call) => {
      const saved = await unwrap(api.logCall(dealId, call));
      set((s) => ({ calls: upsert(s.calls, saved) }));
    },
    updateCall: async (callId, call) => {
      const saved = await unwrap(api.updateCall(callId, call));
      set((s) => ({ calls: upsert(s.calls, saved) }));
    },
    deleteCall: async (callId) => {
      await unwrap(api.deleteCall(callId));
      set((s) => ({ calls: without(s.calls, callId) }));
    },

    addMeeting: async (dealId, meeting, status) => {
      const saved = await unwrap(api.addMeeting(dealId, meeting, status));
      set((s) => ({ meetings: upsert(s.meetings, saved) }));
      return saved;
    },
    updateMeeting: async (meetingId, meeting, status) => {
      const saved = await unwrap(api.updateMeeting(meetingId, meeting, status));
      set((s) => ({ meetings: upsert(s.meetings, saved) }));
      return saved;
    },
    completeMeeting: async (meetingId, attendees, summary) => {
      const saved = await unwrap(api.completeMeeting(meetingId, attendees, summary));
      set((s) => ({ meetings: upsert(s.meetings, saved) }));
    },
    cancelMeeting: async (meetingId) => {
      const saved = await unwrap(api.cancelMeeting(meetingId));
      set((s) => ({ meetings: upsert(s.meetings, saved) }));
    },
    setAttendeeRsvp: async (meetingId, attendeeId, rsvp) => {
      const saved = await unwrap(api.setAttendeeRsvp(meetingId, attendeeId, rsvp));
      set((s) => ({ meetings: upsert(s.meetings, saved) }));
    },
    addMeetingInvite: async (meetingId, attendee) => {
      const saved = await unwrap(api.addMeetingInvite(meetingId, attendee));
      set((s) => ({ meetings: upsert(s.meetings, saved) }));
    },
    deleteMeeting: async (meetingId) => {
      await unwrap(api.deleteMeeting(meetingId));
      set((s) => ({ meetings: without(s.meetings, meetingId) }));
    },

    createProposalDraft: async (dealId) => {
      const list = await unwrap(api.createProposalDraft(dealId));
      set((s) => ({ proposals: [...s.proposals.filter((p) => p.dealId !== dealId), ...list] }));
    },
    saveProposalDraft: async (proposalId, patch, attachment) => {
      const list = await unwrap(api.saveProposalDraft(proposalId, patch, attachment));
      const dealId = list[0]?.dealId;
      set((s) => ({ proposals: [...s.proposals.filter((p) => p.dealId !== dealId), ...list] }));
    },
    publishProposal: async (proposalId, patch, attachment) => {
      const { proposals, deal } = await unwrap(api.publishProposal(proposalId, patch, attachment));
      set((s) => ({ proposals: [...s.proposals.filter((p) => p.dealId !== deal.id), ...proposals], deals: upsert(s.deals, deal) }));
    },
    discardProposalDraft: async (proposalId) => {
      const dealId = get().proposals.find((p) => p.id === proposalId)?.dealId;
      const list = await unwrap(api.discardProposalDraft(proposalId));
      set((s) => ({ proposals: [...s.proposals.filter((p) => p.dealId !== dealId), ...list] }));
    },
  }));
}
