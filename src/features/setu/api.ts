"use client";

import { closeLostAction, closeWonAction, createDealAction, moveDealAction, updateDealAction } from "./actions/deal-actions";
import {
  addNoteAction,
  addRequestAction,
  deleteCallAction,
  deleteNoteAction,
  deleteRequestAction,
  deleteTimeLogAction,
  discardTimerAction,
  logCallAction,
  startTimerAction,
  stopTimerAction,
  updateCallAction,
  updateNoteAction,
  updateRequestAction,
} from "./actions/activity-actions";
import {
  addMeetingAction,
  addMeetingInviteAction,
  cancelMeetingAction,
  completeMeetingAction,
  deleteMeetingAction,
  setAttendeeRsvpAction,
  updateMeetingAction,
} from "./actions/meeting-actions";
import { createProposalDraftAction, discardProposalDraftAction, publishProposalAction, saveProposalDraftAction } from "./actions/proposal-actions";

/** The server actions the Setu store calls. Tests pass a fake with the same shape. */
export const setuApi = {
  createDeal: createDealAction,
  updateDeal: updateDealAction,
  moveDeal: moveDealAction,
  closeWon: closeWonAction,
  closeLost: closeLostAction,
  addNote: addNoteAction,
  updateNote: updateNoteAction,
  deleteNote: deleteNoteAction,
  addRequest: addRequestAction,
  updateRequest: updateRequestAction,
  deleteRequest: deleteRequestAction,
  startTimer: startTimerAction,
  stopTimer: stopTimerAction,
  discardTimer: discardTimerAction,
  deleteTimeLog: deleteTimeLogAction,
  logCall: logCallAction,
  updateCall: updateCallAction,
  deleteCall: deleteCallAction,
  addMeeting: addMeetingAction,
  updateMeeting: updateMeetingAction,
  completeMeeting: completeMeetingAction,
  cancelMeeting: cancelMeetingAction,
  setAttendeeRsvp: setAttendeeRsvpAction,
  addMeetingInvite: addMeetingInviteAction,
  deleteMeeting: deleteMeetingAction,
  createProposalDraft: createProposalDraftAction,
  saveProposalDraft: saveProposalDraftAction,
  publishProposal: publishProposalAction,
  discardProposalDraft: discardProposalDraftAction,
};

export type SetuApi = typeof setuApi;
