import { describe, expect, it } from "vitest";
import {
  extractMentionsFromText,
  reconcileMentionParticipants,
  type CalendarMentionUser,
} from "@/features/calendar/utils";

describe("meeting-mentions utils", () => {
  const users: CalendarMentionUser[] = [
    { id: "usr_mohit", name: "Mohit Thakre", email: "mohit.thakre@example.com" },
    { id: "usr_sarah", name: "Sarah Connor", email: "sarah@example.com" },
    { id: "usr_johndoe", name: "John Doe", email: "john.doe@example.com" },
    { id: "usr_johnsmith", name: "John Smith", email: "john.smith@example.com" },
  ];

  describe("extractMentionsFromText", () => {
    it("extracts unique first name mention", () => {
      const ids = extractMentionsFromText("Quick sync with @Mohit on support", users);
      expect(ids).toEqual(["usr_mohit"]);
    });

    it("extracts full name mention", () => {
      const ids = extractMentionsFromText("Support Needed: @Sarah Connor meeting", users);
      expect(ids).toEqual(["usr_sarah"]);
    });

    it("extracts email prefix mention", () => {
      const ids = extractMentionsFromText("Catch up with @mohit.thakre", users);
      expect(ids).toEqual(["usr_mohit"]);
    });

    it("extracts multiple mentions", () => {
      const ids = extractMentionsFromText("Discussion: @Mohit and @Sarah Connor", users);
      expect(ids).toEqual(["usr_mohit", "usr_sarah"]);
    });

    it("does not match standard emails as mentions", () => {
      const ids = extractMentionsFromText("Send mail to user@mohit.thakre and check", users);
      expect(ids).toEqual([]);
    });

    it("does not match non-existent users", () => {
      const ids = extractMentionsFromText("Meeting with @nonexistent", users);
      expect(ids).toEqual([]);
    });

    it("requires full name or email when first name is ambiguous", () => {
      // Both John Doe and John Smith share first name "John"
      const ambiguousIds = extractMentionsFromText("Meeting with @John", users);
      expect(ambiguousIds).toEqual([]);

      const specificIds = extractMentionsFromText("Meeting with @John Doe", users);
      expect(specificIds).toEqual(["usr_johndoe"]);
    });
  });

  describe("reconcileMentionParticipants", () => {
    it("adds newly mentioned user to selected participants", () => {
      const { nextSelectedIds, nextMentionedIds } = reconcileMentionParticipants(
        [],
        new Set(),
        ["usr_mohit"],
      );
      expect(nextSelectedIds).toEqual(["usr_mohit"]);
      expect(Array.from(nextMentionedIds)).toEqual(["usr_mohit"]);
    });

    it("removes un-mentioned user when deleted from title", () => {
      const { nextSelectedIds, nextMentionedIds } = reconcileMentionParticipants(
        ["usr_mohit"],
        new Set(["usr_mohit"]),
        [],
      );
      expect(nextSelectedIds).toEqual([]);
      expect(Array.from(nextMentionedIds)).toEqual([]);
    });

    it("preserves manually selected participants when title mentions change", () => {
      // usr_sarah was manually selected (not mentioned in title)
      const currentSelected = ["usr_sarah", "usr_mohit"];
      const prevMentioned = new Set(["usr_mohit"]);
      // Title mention changes from Mohit to John Doe
      const nextMentioned = ["usr_johndoe"];

      const { nextSelectedIds } = reconcileMentionParticipants(
        currentSelected,
        prevMentioned,
        nextMentioned,
      );

      // Mohit removed because removed from title, John Doe added, Sarah preserved
      expect(nextSelectedIds).toContain("usr_sarah");
      expect(nextSelectedIds).toContain("usr_johndoe");
      expect(nextSelectedIds).not.toContain("usr_mohit");
    });

    it("handles multiple mentions selected simultaneously", () => {
      const { nextSelectedIds, nextMentionedIds } = reconcileMentionParticipants(
        [],
        new Set(),
        ["usr_mohit", "usr_sarah"],
      );
      expect(nextSelectedIds).toEqual(["usr_mohit", "usr_sarah"]);
      expect(Array.from(nextMentionedIds)).toEqual(["usr_mohit", "usr_sarah"]);
    });

    it("does not re-add participant if manually unselected while mention is unchanged", () => {
      // User mentioned Mohit, then unchecked Mohit in picker
      const currentSelected: string[] = []; // Mohit unchecked
      const prevMentioned = new Set(["usr_mohit"]);
      const nextMentioned = ["usr_mohit"]; // Still in title

      const { nextSelectedIds } = reconcileMentionParticipants(
        currentSelected,
        prevMentioned,
        nextMentioned,
      );

      // Mohit is not re-added because it wasn't newly mentioned
      expect(nextSelectedIds).toEqual([]);
    });
  });
});

