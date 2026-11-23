import { describe, expect, it, vi } from "vitest";
import { createSetuStore } from "@/features/setu/store";
import type { SetuApi } from "@/features/setu/api";
import { MOCK_DEALS, MOCK_REQUESTS } from "@/features/setu/data/mock-setu";
import type { Deal, SetuSnapshot } from "@/features/setu/types";

// The client store: starts from the server snapshot, calls the API and merges what it returns.
// The API is faked (the real one is the server actions, covered in setu-actions.test.ts).

const me = { id: "u-me", name: "Me", email: "me@eagleeyedigital.io" };

function snapshot(over: Partial<SetuSnapshot> = {}): SetuSnapshot {
  return {
    me,
    team: [me],
    deals: MOCK_DEALS.slice(0, 3),
    notes: [],
    timeLogs: [],
    activeTimer: null,
    requests: MOCK_REQUESTS.filter((r) => r.dealId === "d-abc"),
    calls: [],
    meetings: [],
    proposals: [],
    ...over,
  };
}

/** A fake API where every call is a vi.fn the test can program. */
function fakeApi(): SetuApi {
  return new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get: (target, key: string) => (target[key] ??= vi.fn()),
  }) as unknown as SetuApi;
}

describe("Setu store", () => {
  it("starts from the snapshot", () => {
    const store = createSetuStore(snapshot(), fakeApi());
    expect(store.getState().me).toEqual(me);
    expect(store.getState().deals).toHaveLength(3);
  });

  it("adds the deal the server created", async () => {
    const api = fakeApi();
    const created: Deal = { ...MOCK_DEALS[0], id: "d-new", leadCode: "LD-2026-0100" };
    vi.mocked(api.createDeal).mockResolvedValue({ ok: true, data: created });
    const store = createSetuStore(snapshot(), api);
    const deal = await store.getState().createDeal({
      company: "X",
      contactName: "Y",
      contactRole: "",
      phone: "9999999999",
      email: "y@x.com",
      location: "Pune",
      source: "",
      stage: "LEAD",
      title: "",
      remark: "",
    });
    expect(deal.id).toBe("d-new");
    expect(store.getState().deals[0].id).toBe("d-new");
  });

  it("throws the server's message and leaves the data untouched", async () => {
    const api = fakeApi();
    vi.mocked(api.deleteNote).mockResolvedValue({ ok: false, error: "Nope" });
    const store = createSetuStore(snapshot({ notes: [{ id: "n1", dealId: "d-01", category: "NOTE", title: "t", body: "b", pinned: false, authorId: "u", authorName: "U", createdAt: "2026-11-01T00:00:00Z" }] }), api);
    await expect(store.getState().deleteNote("n1")).rejects.toThrow("Nope");
    expect(store.getState().notes).toHaveLength(1);
  });

  it("moves a card at once and reverts if the server refuses", async () => {
    const api = fakeApi();
    let release!: (v: unknown) => void;
    vi.mocked(api.moveDeal).mockReturnValue(new Promise((r) => (release = r)) as never);
    const store = createSetuStore(snapshot(), api);
    const pending = store.getState().moveDeal("d-01", "MEETING");
    expect(store.getState().deals.find((d) => d.id === "d-01")?.stage).toBe("MEETING");
    release({ ok: false, error: "Deal is locked" });
    await expect(pending).rejects.toThrow("Deal is locked");
    expect(store.getState().deals.find((d) => d.id === "d-01")?.stage).toBe("LEAD");
  });

  it("replaces a deal's request list with the server's (renumbered) one", async () => {
    const api = fakeApi();
    vi.mocked(api.deleteRequest).mockResolvedValue({
      ok: true,
      data: [
        { id: "rq-2", dealId: "d-abc", level: 1, text: "b", requestedBy: "x" },
        { id: "rq-3", dealId: "d-abc", level: 2, text: "c", requestedBy: "x" },
      ],
    });
    const store = createSetuStore(snapshot(), api);
    await store.getState().deleteRequest("rq-1");
    expect(store.getState().requests.map((r) => [r.id, r.level])).toEqual([
      ["rq-2", 1],
      ["rq-3", 2],
    ]);
  });

  it("starts and stops the timer", async () => {
    const api = fakeApi();
    vi.mocked(api.startTimer).mockResolvedValue({ ok: true, data: { dealId: "d-01", userId: me.id, employeeName: "Me", startedAt: "2026-11-23T10:00:00Z" } });
    vi.mocked(api.stopTimer).mockResolvedValue({
      ok: true,
      data: { id: "t1", dealId: "d-01", userId: me.id, employeeName: "Me", reason: "Call", startedAt: "2026-11-23T10:00:00Z", endedAt: "2026-11-23T10:30:00Z" },
    });
    const store = createSetuStore(snapshot(), api);
    await store.getState().startTimer("d-01");
    expect(store.getState().activeTimer?.dealId).toBe("d-01");
    await store.getState().stopTimer("Call");
    expect(store.getState().activeTimer).toBeNull();
    expect(store.getState().timeLogs).toHaveLength(1);
  });

  it("passes closing documents separately to the server", async () => {
    const api = fakeApi();
    vi.mocked(api.closeWon).mockResolvedValue({ ok: true, data: { ...MOCK_DEALS[0], stage: "CLOSED_WON" } });
    const store = createSetuStore(snapshot(), api);
    const docs = [{ id: "upload-1", name: "MSA.pdf", size: 10, url: "/api/uploads/setu-1-MSA.pdf" }];
    await store.getState().closeWon("d-01", { finalValue: 1, closedDate: "2026-11-23", advanceReceived: 0, contractTerm: "1-Year Term", paymentTerms: "x", documents: docs });
    expect(api.closeWon).toHaveBeenCalledWith("d-01", { finalValue: 1, closedDate: "2026-11-23", advanceReceived: 0, contractTerm: "1-Year Term", paymentTerms: "x" }, docs);
    expect(store.getState().deals.find((d) => d.id === "d-01")?.stage).toBe("CLOSED_WON");
  });
});
