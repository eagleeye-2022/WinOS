import { describe, it, expect } from "vitest";

// ── Status transition rules (mirrors server action guard logic) ───────────────
// These tests document the authoritative rules for status guards without
// requiring DB or auth mocks.

type DsrStatus = "DRAFT" | "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "MISSED";
type DsmStatus = "DRAFT" | "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "MISSED";

function canMemberResubmitDsr(status: DsrStatus): boolean {
  return status !== "REVIEWED";
}

function canMemberResubmitDsm(status: DsmStatus): boolean {
  return status !== "REVIEWED";
}

function canManagerReviewDsr(status: DsrStatus): boolean {
  return status === "SUBMITTED" || status === "PENDING_REVIEW";
}

// ── DSR re-submission guard ───────────────────────────────────────────────────

describe("DSR member re-submission guard", () => {
  it("allows submission when entry is DRAFT", () => {
    expect(canMemberResubmitDsr("DRAFT")).toBe(true);
  });

  it("allows submission when no entry exists (null treated as DRAFT)", () => {
    // null entry → always allowed
    expect(canMemberResubmitDsr("DRAFT")).toBe(true);
  });

  it("allows re-submission of SUBMITTED entry (member can update before review)", () => {
    expect(canMemberResubmitDsr("SUBMITTED")).toBe(true);
  });

  it("allows re-submission of PENDING_REVIEW entry", () => {
    expect(canMemberResubmitDsr("PENDING_REVIEW")).toBe(true);
  });

  it("blocks re-submission of REVIEWED entry", () => {
    expect(canMemberResubmitDsr("REVIEWED")).toBe(false);
  });

  it("allows submission when entry is MISSED (can still file late)", () => {
    expect(canMemberResubmitDsr("MISSED")).toBe(true);
  });
});

// ── DSM re-submission guard ───────────────────────────────────────────────────

describe("DSM member re-submission guard", () => {
  it("allows submission when entry is DRAFT", () => {
    expect(canMemberResubmitDsm("DRAFT")).toBe(true);
  });

  it("allows the owner to edit a SUBMITTED entry (moves to PENDING_REVIEW)", () => {
    expect(canMemberResubmitDsm("SUBMITTED")).toBe(true);
  });

  it("allows the owner to keep editing a PENDING_REVIEW entry", () => {
    expect(canMemberResubmitDsm("PENDING_REVIEW")).toBe(true);
  });

  it("blocks re-submission of REVIEWED entry", () => {
    expect(canMemberResubmitDsm("REVIEWED")).toBe(false);
  });

  it("allows re-submission of MISSED entry (late filing)", () => {
    expect(canMemberResubmitDsm("MISSED")).toBe(true);
  });
});

// ── DSR / DSM status transition after a self-edit save ────────────────────────
// Mirrors the `finalStatus` logic in saveDsr/saveDsm: editing an already
// submitted entry must land on PENDING_REVIEW (never silently fall back to
// DRAFT, which would hide the entry from manager review), regardless of
// whether the UI action was "draft" or "submit".

type SaveAction = "draft" | "submit";

function resultingStatusAfterSave(existingStatus: DsrStatus | null, action: SaveAction): DsrStatus {
  const requestedStatus = action === "submit" ? "SUBMITTED" : "DRAFT";
  const wasSubmitted = existingStatus === "SUBMITTED" || existingStatus === "PENDING_REVIEW";
  return wasSubmitted ? "PENDING_REVIEW" : requestedStatus;
}

describe("DSR/DSM status transition on self-edit save", () => {
  it("first submit on a DRAFT/null entry results in SUBMITTED", () => {
    expect(resultingStatusAfterSave(null, "submit")).toBe("SUBMITTED");
    expect(resultingStatusAfterSave("DRAFT", "submit")).toBe("SUBMITTED");
  });

  it("saving a draft on a DRAFT/null entry stays DRAFT", () => {
    expect(resultingStatusAfterSave(null, "draft")).toBe("DRAFT");
    expect(resultingStatusAfterSave("DRAFT", "draft")).toBe("DRAFT");
  });

  it("editing a SUBMITTED entry and re-submitting results in PENDING_REVIEW", () => {
    expect(resultingStatusAfterSave("SUBMITTED", "submit")).toBe("PENDING_REVIEW");
  });

  it("editing a SUBMITTED entry via the draft action does NOT fall back to DRAFT", () => {
    expect(resultingStatusAfterSave("SUBMITTED", "draft")).toBe("PENDING_REVIEW");
  });

  it("editing a PENDING_REVIEW entry stays PENDING_REVIEW", () => {
    expect(resultingStatusAfterSave("PENDING_REVIEW", "submit")).toBe("PENDING_REVIEW");
    expect(resultingStatusAfterSave("PENDING_REVIEW", "draft")).toBe("PENDING_REVIEW");
  });
});

// ── DSR manager review guard ──────────────────────────────────────────────────

describe("DSR manager review guard", () => {
  it("allows review of SUBMITTED entry", () => {
    expect(canManagerReviewDsr("SUBMITTED")).toBe(true);
  });

  it("allows review of PENDING_REVIEW entry", () => {
    expect(canManagerReviewDsr("PENDING_REVIEW")).toBe(true);
  });

  it("blocks review of DRAFT entry", () => {
    expect(canManagerReviewDsr("DRAFT")).toBe(false);
  });

  it("blocks review of already-REVIEWED entry", () => {
    expect(canManagerReviewDsr("REVIEWED")).toBe(false);
  });

  it("blocks review of MISSED entry", () => {
    expect(canManagerReviewDsr("MISSED")).toBe(false);
  });
});

// ── Reminder skip logic ───────────────────────────────────────────────────────

type SubmissionStatus = "SUBMITTED" | "PENDING_REVIEW" | "REVIEWED" | "DRAFT" | "MISSED" | null;

function hasSubmittedToday(status: SubmissionStatus): boolean {
  return status === "SUBMITTED" || status === "PENDING_REVIEW" || status === "REVIEWED";
}

describe("Reminder skip logic — hasSubmittedToday", () => {
  it("skips SUBMITTED users (already submitted)", () => {
    expect(hasSubmittedToday("SUBMITTED")).toBe(true);
  });

  it("skips PENDING_REVIEW users (already submitted)", () => {
    expect(hasSubmittedToday("PENDING_REVIEW")).toBe(true);
  });

  it("skips REVIEWED users (already submitted)", () => {
    expect(hasSubmittedToday("REVIEWED")).toBe(true);
  });

  it("sends reminder to DRAFT users (not yet submitted)", () => {
    expect(hasSubmittedToday("DRAFT")).toBe(false);
  });

  it("sends reminder when there is no entry today (null)", () => {
    expect(hasSubmittedToday(null)).toBe(false);
  });

  it("sends reminder to MISSED users (still need a filing)", () => {
    expect(hasSubmittedToday("MISSED")).toBe(false);
  });
});

// ── Cooldown window logic ─────────────────────────────────────────────────────

function isCooldownActive(lastReminderMs: number | null, cooldownMs: number, nowMs: number): boolean {
  if (lastReminderMs === null) return false;
  return nowMs - lastReminderMs < cooldownMs;
}

describe("Reminder cooldown logic", () => {
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  const now = Date.now();

  it("no cooldown when never reminded", () => {
    expect(isCooldownActive(null, FOUR_HOURS, now)).toBe(false);
  });

  it("active cooldown when reminded 1 hour ago", () => {
    expect(isCooldownActive(now - 1 * 3600 * 1000, FOUR_HOURS, now)).toBe(true);
  });

  it("active cooldown when reminded 3h59m ago (just under threshold)", () => {
    expect(isCooldownActive(now - (4 * 3600 * 1000 - 1), FOUR_HOURS, now)).toBe(true);
  });

  it("cooldown expired when reminded exactly 4 hours ago", () => {
    expect(isCooldownActive(now - FOUR_HOURS, FOUR_HOURS, now)).toBe(false);
  });

  it("cooldown expired when reminded 5 hours ago", () => {
    expect(isCooldownActive(now - 5 * 3600 * 1000, FOUR_HOURS, now)).toBe(false);
  });
});
