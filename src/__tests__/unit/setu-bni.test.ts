import { describe, expect, it } from "vitest";
import {
  BNI_STAGE_IDS,
  DEFAULT_TAGS,
  NOTE_REF_IN,
  NOTE_REF_OUT,
  NOTE_TODO,
  NOTE_TODO_DONE,
  applyBniStage,
  bniStageOf,
  buildContacts,
  buildReferrals,
  checkLog121,
  checkProspect,
  checkReferral,
  connectorName,
  decodeReferral,
  decodeRole,
  encodeReferral,
  encodeRole,
  findByName,
  isBniNote,
  matchesContactFilter,
  memberSummaries,
  memberTimeline,
  parseBotCommand,
  parseStage,
  parseVCards,
  pipelineStatusText,
  prospectSources,
  setuStats,
  stageForNew,
  textToHtml,
  type BniTags,
} from "@/features/setu/bni";
import type { Deal, DealCall, DealMeeting, DealNote } from "@/features/setu/types";

const deal = (over: Partial<Deal>): Deal => ({
  id: "x",
  leadCode: "LD-2026-0001",
  title: "",
  company: "Acme",
  contactName: "Asha",
  contactRole: "",
  phone: "",
  email: "",
  location: "",
  source: "",
  stage: "LEAD",
  ownerId: "u-1",
  ownerName: "Rep",
  remark: "",
  updatedAt: "2026-11-20T10:00:00+05:30",
  ...over,
});
const member = (over: Partial<Deal>) => deal({ bni: { kind: "MEMBER", origin: "DIRECT", hold: false }, ...over });
const note = (over: Partial<DealNote>): DealNote => ({
  id: "n",
  dealId: "m1",
  category: "NOTE",
  title: "Note",
  body: "",
  pinned: false,
  authorId: "u-1",
  authorName: "Rep",
  createdAt: "2026-11-20T10:00:00Z",
  ...over,
});
const meeting = (over: Partial<DealMeeting>): DealMeeting => ({
  id: "mt",
  dealId: "m1",
  title: "121 Meeting — Shreshtha",
  type: "121 Meeting",
  startAt: "2026-11-15T04:30:00Z",
  endAt: "2026-11-15T05:30:00Z",
  hostId: "u-1",
  hostName: "Rep",
  channel: "IN_OFFICE",
  location: "BNI",
  agenda: "<p>Discussed web work</p>",
  attendees: [],
  status: "COMPLETED",
  reminder: "30m",
  history: [],
  ...over,
});

describe("record tags in contactRole", () => {
  it("round-trips tags and keeps the visible role clean", () => {
    const tags: BniTags = { kind: "MEMBER", origin: "BOT", hold: true, sub: "AGREEMENT" };
    const stored = encodeRole("BNI Member", tags);
    expect(stored).toBe("[bni:member,bot,hold,agr] BNI Member");
    expect(decodeRole(stored)).toEqual({ role: "BNI Member", tags });
  });

  it("stores a plain direct prospect without a prefix", () => {
    expect(encodeRole("Decision Maker", DEFAULT_TAGS)).toBe("Decision Maker");
    expect(decodeRole("Decision Maker")).toEqual({ role: "Decision Maker", tags: DEFAULT_TAGS });
  });

  it("never stacks prefixes when re-encoding an already-tagged role", () => {
    expect(encodeRole("[bni:opp] Old", { kind: "PROSPECT", origin: "121", hold: false })).toBe("[bni:121] Old");
  });

  it("handles an empty or missing role", () => {
    expect(encodeRole("", { kind: "OPPORTUNITY", origin: "DIRECT", hold: false })).toBe("[bni:opp]");
    expect(decodeRole("[bni:opp]").role).toBe("");
  });
});

describe("12-stage pipeline", () => {
  const at = (stage: Deal["stage"], tags: Partial<BniTags> = {}) => bniStageOf({ stage, bni: { ...DEFAULT_TAGS, ...tags } });

  it("maps stored stage + tags to a column", () => {
    expect(at("LEAD")).toBe("PROSPECT");
    expect(at("MEETING")).toBe("DISCOVERY");
    expect(at("DISCUSSION")).toBe("ESTIMATION");
    expect(at("PROPOSAL")).toBe("ESTIMATE_SENT");
    expect(at("PROPOSAL", { sub: "CLIENT_MEET_2" })).toBe("CLIENT_MEET_2");
    expect(at("NEGOTIATION", { sub: "AGREEMENT" })).toBe("AGREEMENT");
    expect(at("MEETING", { hold: true })).toBe("ON_HOLD");
    expect(at("CLOSED_WON", { hold: true })).toBe("WON");
    expect(at("CLOSED_LOST")).toBe("LOST");
    expect(at("LEAD", { kind: "OPPORTUNITY" })).toBe("OPPORTUNITY");
    // A sub-stage that doesn't belong to the stored stage is ignored.
    expect(at("MEETING", { sub: "AGREEMENT" })).toBe("DISCOVERY");
    // Records without tags are plain prospects.
    expect(bniStageOf({ stage: "LEAD" })).toBe("PROSPECT");
  });

  it("every column round-trips through applyBniStage", () => {
    for (const target of BNI_STAGE_IDS) {
      const next = applyBniStage({ stage: "MEETING", tags: { ...DEFAULT_TAGS, origin: "BOT" } }, target);
      expect(bniStageOf({ stage: next.stage, bni: next.tags })).toBe(target);
      expect(next.tags.origin).toBe("BOT");
    }
  });

  it("On Hold keeps the underlying stage, and leaving it clears the flag", () => {
    const held = applyBniStage({ stage: "PROPOSAL", tags: { ...DEFAULT_TAGS, sub: "CLIENT_MEET_1" } }, "ON_HOLD");
    expect(held).toEqual({ stage: "PROPOSAL", tags: { ...DEFAULT_TAGS, hold: true, sub: "CLIENT_MEET_1" } });
    expect(applyBniStage(held, "NEGOTIATION").tags.hold).toBe(false);
    // A closed record put on hold reopens at Prospect.
    expect(applyBniStage({ stage: "CLOSED_LOST", tags: DEFAULT_TAGS }, "ON_HOLD").stage).toBe("LEAD");
  });

  it("moving an opportunity card into a stage makes it a prospect", () => {
    expect(applyBniStage({ stage: "LEAD", tags: { ...DEFAULT_TAGS, kind: "OPPORTUNITY" } }, "DISCOVERY").tags.kind).toBe("PROSPECT");
    expect(stageForNew("OPPORTUNITY", "PROSPECT", "DIRECT").tags.kind).toBe("OPPORTUNITY");
  });
});

describe("referral notes", () => {
  it("round-trips details and tolerates plain text", () => {
    const d = { name: "Parth", business: "Web", phone: "9876543210", via: "Ankur" };
    expect(decodeReferral(encodeReferral(d))).toEqual(d);
    expect(decodeReferral("Just a name")).toEqual({ name: "Just a name", business: "", phone: "", via: "" });
  });

  it("flags machine notes", () => {
    expect(isBniNote(note({ title: NOTE_TODO }))).toBe(true);
    expect(isBniNote(note({ title: "Meeting recap" }))).toBe(false);
  });

  it("strips the Co prefix from a connector", () => {
    expect(connectorName("Co Raj Pagariya Ji")).toBe("Raj Pagariya Ji");
    expect(connectorName("co. Ankur")).toBe("Ankur");
    expect(connectorName("Website")).toBe("Website");
  });
});

describe("members, referrals and stats", () => {
  const m1 = member({ id: "m1", contactName: "Shreshtha Goyal Ji", source: "Anur Ji" });
  const p1 = deal({ id: "p1", contactName: "Parth", stage: "MEETING", bni: { kind: "PROSPECT", origin: "121", hold: false } });
  const p2 = deal({ id: "p2", contactName: "Antra Raje", source: "Raj Pagariya", bni: { kind: "PROSPECT", origin: "BOT", hold: false } });
  const won = deal({ id: "p3", contactName: "Vijay", stage: "CLOSED_WON" });
  const opp = deal({ id: "o1", contactName: "Goa Target Pitch", bni: { kind: "OPPORTUNITY", origin: "DIRECT", hold: false } });
  const deals = [m1, p1, p2, won, opp];
  const notes = [
    note({ id: "r1", title: `${NOTE_REF_IN}>p1`, body: encodeReferral({ name: "Parth" }), createdAt: "2026-11-16T00:00:00Z" }),
    note({ id: "r2", title: NOTE_REF_IN, body: encodeReferral({ name: "Sheetal" }), createdAt: "2026-11-17T00:00:00Z" }),
    note({ id: "r3", title: NOTE_REF_OUT, body: encodeReferral({ name: "Shreshtha" }), createdAt: "2026-11-18T00:00:00Z" }),
    note({ id: "t1", title: NOTE_TODO, body: "Send portfolio" }),
    note({ id: "t2", title: NOTE_TODO_DONE, body: "Calendar invite" }),
    note({ id: "n1", title: "Note", body: "<p>Called, will retry</p>", createdAt: "2026-11-14T00:00:00Z" }),
  ];
  const meetings = [meeting({ id: "mt1" }), meeting({ id: "mt2", dealId: "p1", type: "Discovery" })];

  it("summarises each member", () => {
    const [s] = memberSummaries(deals, notes, meetings);
    expect(s.member.id).toBe("m1");
    expect(s.refsReceived).toBe(2);
    expect(s.refsGiven).toBe(1);
    expect(s.pendingRefs.map((n) => n.id)).toEqual(["r2"]);
    expect(s.prospects.map((d) => d.id)).toEqual(["p1"]);
    expect(s.openTodos).toBe(1);
    expect(s.meetings.map((m) => m.id)).toEqual(["mt1"]);
  });

  it("links converted prospects back to their member", () => {
    expect(prospectSources(deals, notes).get("p1")?.id).toBe("m1");
  });

  it("lists referrals received, given and typed-in connectors", () => {
    const rows = buildReferrals(deals, notes);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.r1).toMatchObject({ direction: "RECEIVED", status: "CONVERTED", memberName: "Shreshtha Goyal Ji" });
    expect(byId.r1.prospect?.id).toBe("p1");
    expect(byId.r2).toMatchObject({ direction: "RECEIVED", status: "PENDING" });
    expect(byId.r3).toMatchObject({ direction: "GIVEN", status: "GIVEN" });
    expect(byId["deal-p2"]).toMatchObject({ direction: "RECEIVED", memberName: "Raj Pagariya", status: "CONVERTED" });
    // p1 is linked by a note, so it isn't listed twice.
    expect(rows.filter((r) => r.prospect?.id === "p1")).toHaveLength(1);
  });

  it("computes the header stats", () => {
    const s = setuStats(deals, notes, meetings, "2026-11-25");
    expect(s).toMatchObject({ prospects: 3, meetings121: 1, refsReceived: 3, refsGiven: 1, won: 1, members: 1, opportunities: 1 });
    // Open prospects p1, p2 — both touched within 30 days.
    expect(s.pipelineHealth).toBe(100);
    expect(setuStats(deals, notes, meetings, "2027-02-01").pipelineHealth).toBe(0);
    expect(setuStats([], [], [], "2026-11-25").pipelineHealth).toBeNull();
  });

  it("builds contacts without opportunity cards and filters them", () => {
    const contacts = buildContacts(deals, notes);
    expect(contacts.map((c) => c.deal.id).sort()).toEqual(["m1", "p1", "p2", "p3"]);
    const by = (id: string) => contacts.find((c) => c.deal.id === id)!;
    expect(by("m1")).toMatchObject({ kind: "MEMBER", refsReceived: 2, followUp: true });
    expect(matchesContactFilter(by("p1"), "referrals")).toBe(true);
    expect(matchesContactFilter(by("p2"), "referrals")).toBe(true);
    expect(matchesContactFilter(by("p3"), "won")).toBe(true);
    expect(matchesContactFilter(by("m1"), "prospects")).toBe(false);
  });

  it("merges a member's meetings, notes and calls newest first", () => {
    const call: DealCall = {
      id: "c1",
      dealId: "m1",
      title: "Call",
      direction: "OUTBOUND",
      outcome: "CONNECTED",
      startedAt: "2026-11-19T00:00:00Z",
      endedAt: "2026-11-19T00:05:00Z",
      repId: "u-1",
      repName: "Rep",
      contactName: "Shreshtha",
      summary: "<p>Agreed to meet</p>",
    };
    const feed = memberTimeline("m1", notes, meetings, [call]);
    expect(feed.map((e) => e.id)).toEqual(["c1", "mt1", "n1"]);
    expect(feed[2].text).toBe("Called, will retry");
  });

  it("answers the status command", () => {
    expect(pipelineStatusText(deals)).toBe("Prospect: 1\nDiscovery Mtg: 1\nDeal Won: 1\nMixed / Opport.: 1");
    expect(pipelineStatusText([m1])).toBe("The pipeline is empty.");
  });
});

describe("input checks", () => {
  it("accepts a prospect with just a name and normalises the connector", () => {
    const r = checkProspect({ name: " Antra ", via: "Co Raj", stage: "DISCOVERY" });
    expect(r.ok && r.value).toMatchObject({ name: "Antra", via: "Raj", stage: "DISCOVERY", kind: "PROSPECT", origin: "DIRECT" });
  });

  it("rejects bad prospect fields", () => {
    expect(checkProspect({ name: "" }).ok).toBe(false);
    expect(checkProspect({ name: "A", phone: "123" }).ok).toBe(false);
    expect(checkProspect({ name: "A", email: "nope" }).ok).toBe(false);
  });

  it("forces opportunity cards into the opportunity column", () => {
    const r = checkProspect({ name: "Pitch Deck", kind: "OPPORTUNITY", stage: "WON" });
    expect(r.ok && r.value.stage).toBe("OPPORTUNITY");
  });

  it("checks a 121 log", () => {
    expect(checkLog121({ date: "2026-11-20" }).ok).toBe(false); // no member
    expect(checkLog121({ member: { name: "M", business: "", phone: "", email: "", address: "", via: "" }, date: "20/11" }).ok).toBe(false);
    const r = checkLog121({ memberId: "m1", date: "2026-11-20", refsReceived: 1, referralNames: ["A", " ", "B"], refsGiven: 2, type: "Chapter Meeting" });
    expect(r.ok && r.value).toMatchObject({ refsReceived: 2, referralNames: ["A", "B"], refsGiven: 2, type: "Chapter Meeting", convert: false });
    expect(checkLog121({ memberId: "m1", date: "2026-11-20", refsGiven: -1 }).ok).toBe(false);
  });

  it("checks a referral", () => {
    expect(checkReferral({ details: { name: "A", business: "", phone: "", via: "" } }).ok).toBe(false); // no member
    const given = checkReferral({ direction: "GIVEN", memberName: "Saksham", details: { name: "X", business: "", phone: "", via: "" }, convert: true });
    expect(given.ok && given.value.convert).toBe(false); // only received referrals convert
  });

  it("escapes text into paragraphs", () => {
    expect(textToHtml("a < b\n\nsecond")).toBe("<p>a &lt; b</p><p>second</p>");
    expect(textToHtml("  ")).toBe("");
  });
});

describe("bot commands", () => {
  it("parses each command", () => {
    expect(parseBotCommand("status")).toEqual({ type: "status" });
    expect(parseBotCommand(" ")).toEqual({ type: "help" });
    expect(parseBotCommand("note Shreshtha Goyal: send portfolio")).toEqual({ type: "note", member: "Shreshtha Goyal", text: "send portfolio" });
    expect(parseBotCommand("ref recv 5 from Shreshtha")).toEqual({ type: "ref", direction: "RECEIVED", count: 5, name: "Shreshtha" });
    expect(parseBotCommand("ref gave 1 to Saksham Ji")).toEqual({ type: "ref", direction: "GIVEN", count: 1, name: "Saksham Ji" });
    expect(parseBotCommand("move Amit Pandey discovery")).toEqual({ type: "move", name: "Amit Pandey", stage: "DISCOVERY" });
    expect(parseBotCommand("move Satya client meet 2")).toEqual({ type: "move", name: "Satya", stage: "CLIENT_MEET_2" });
    expect(parseBotCommand("move Vijay won")).toEqual({ type: "move", name: "Vijay", stage: "WON" });
  });

  it("explains malformed commands", () => {
    expect(parseBotCommand("note Shreshtha").type).toBe("unknown");
    expect(parseBotCommand("ref recv 3 to X").type).toBe("unknown");
    expect(parseBotCommand("ref recv 0 from X").type).toBe("unknown");
    expect(parseBotCommand("move Amit somewhere").type).toBe("unknown");
    expect(parseBotCommand("hello").type).toBe("unknown");
  });

  it("parses stage names", () => {
    expect(parseStage("On Hold")).toBe("ON_HOLD");
    expect(parseStage("proposal")).toBe("ESTIMATION");
    expect(parseStage("estimate sent")).toBe("ESTIMATE_SENT");
    expect(parseStage("nope")).toBeNull();
  });

  it("finds records by loose name", () => {
    const list = [deal({ id: "a", contactName: "Amit Pandey Ji" }), deal({ id: "b", contactName: "Amita Shah", company: "Shah Foods" })];
    expect(findByName(list, "amit pandey")?.id).toBe("a");
    expect(findByName(list, "Amita")?.id).toBe("b");
    expect(findByName(list, "shah foods")?.id).toBe("b");
    expect(findByName(list, "zzz")).toBeUndefined();
    expect(findByName(list, "")).toBeUndefined();
  });
});

describe("vCard import", () => {
  it("reads several cards, folded lines and structured names", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Antra Raje",
      "ORG:Finance Consulting;Indore",
      "TEL;TYPE=CELL:+91 88274 83933",
      "EMAIL:antra@example.com",
      "ADR;TYPE=WORK:;;12 MG Road;Indore;MP;452001;India",
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:2.1",
      "N:Pandey;Amit;;;",
      "item1.TEL:9826055818",
      "NOTE:long line",
      " continued",
      "END:VCARD",
      "BEGIN:VCARD",
      "END:VCARD",
    ].join("\r\n");
    expect(parseVCards(vcf)).toEqual([
      { name: "Antra Raje", business: "Finance Consulting, Indore", phone: "+91 88274 83933", email: "antra@example.com", address: "12 MG Road, Indore, MP, 452001, India", via: "" },
      { name: "Amit Pandey", business: "", phone: "9826055818", email: "", address: "", via: "" },
    ]);
  });
});
