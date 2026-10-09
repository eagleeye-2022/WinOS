import { describe, it, expect, vi, beforeEach } from "vitest";

// All Projects table: Industry + Client Location (Country / State / City).
// Save actions run with auth/db mocked; the location dropdown data uses the real dataset.

const mocks = vi.hoisted(() => {
  const fn = () => vi.fn();
  const db = {
    user: { findUnique: fn() },
    project: { findFirst: fn(), update: fn() },
    projectMember: { findFirst: fn() },
    projectActivity: { create: fn() },
  };
  return { db, auth: vi.fn() };
});

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateProjectIndustryAction, updateProjectLocationAction } from "@/features/projects/actions/project-actions";
import {
  getCityOptionsAction,
  getCountryOptionsAction,
  getStateOptionsAction,
} from "@/features/projects/actions/location-actions";
import { GET as getFlag } from "@/app/api/flags/[code]/route";

const d = mocks.db;

const baseProject = {
  id: "p1",
  code: "EEDP-1",
  industry: null as string | null,
  clientCountry: "India" as string | null,
  clientCountryCode: "IN" as string | null,
  clientState: "Madhya Pradesh" as string | null,
  clientStateCode: "MP" as string | null,
  clientCity: "Indore" as string | null,
};

function loginAs(role: "MANAGER" | "TEAM_MEMBER", member = false) {
  mocks.auth.mockResolvedValue({ user: { id: "u1", name: "Mia", role } });
  d.user.findUnique.mockResolvedValue({ role, profileRole: null });
  d.projectMember.findFirst.mockResolvedValue(member ? { id: "m1" } : null);
}

/** The `data` written by the last project.update call. */
const lastWrite = () => d.project.update.mock.calls.at(-1)?.[0]?.data;

beforeEach(() => {
  vi.clearAllMocks();
  d.project.findFirst.mockResolvedValue({ ...baseProject, ownerId: "someone-else" });
  // update() echoes back the merged row (what the action returns as `patch`).
  d.project.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...baseProject, ...data }));
  d.projectActivity.create.mockResolvedValue({});
});

describe("updateProjectIndustryAction", () => {
  it("saves a listed or typed-in industry (trimmed)", async () => {
    loginAs("MANAGER");
    expect((await updateProjectIndustryAction("EEDP-1", "  Skin Care ")).success).toBe(true);
    expect(lastWrite()).toEqual({ industry: "Skin Care" });
    await updateProjectIndustryAction("EEDP-1", "Pet Grooming");
    expect(lastWrite()).toEqual({ industry: "Pet Grooming" });
  });

  it("clears with an empty value", async () => {
    loginAs("MANAGER");
    await updateProjectIndustryAction("EEDP-1", "");
    expect(lastWrite()).toEqual({ industry: null });
  });

  it("refuses users who are neither managers nor project members", async () => {
    loginAs("TEAM_MEMBER", false);
    const res = await updateProjectIndustryAction("EEDP-1", "Healthcare");
    expect(res.success).toBe(false);
    expect(d.project.update).not.toHaveBeenCalled();
  });

  it("allows project members (same rule as links / notes)", async () => {
    loginAs("TEAM_MEMBER", true);
    expect((await updateProjectIndustryAction("EEDP-1", "Healthcare")).success).toBe(true);
  });
});

describe("updateProjectLocationAction", () => {
  it("changing the country clears state and city", async () => {
    loginAs("MANAGER");
    const res = await updateProjectLocationAction("EEDP-1", "country", { name: "United Kingdom", code: "GB" });
    expect(lastWrite()).toEqual({
      clientCountry: "United Kingdom",
      clientCountryCode: "GB",
      clientState: null,
      clientStateCode: null,
      clientCity: null,
    });
    expect(res.patch).toMatchObject({ clientCountry: "United Kingdom", clientCountryCode: "GB", clientState: undefined, clientCity: undefined });
  });

  it("re-picking the same country keeps state and city", async () => {
    loginAs("MANAGER");
    await updateProjectLocationAction("EEDP-1", "country", { name: "India", code: "IN" });
    expect(lastWrite()).toEqual({ clientCountry: "India", clientCountryCode: "IN" });
  });

  it("changing the state clears the city", async () => {
    loginAs("MANAGER");
    await updateProjectLocationAction("EEDP-1", "state", { name: "Maharashtra", code: "MH" });
    expect(lastWrite()).toEqual({ clientState: "Maharashtra", clientStateCode: "MH", clientCity: null });
  });

  it("typed-in values are stored without a code", async () => {
    loginAs("MANAGER");
    await updateProjectLocationAction("EEDP-1", "country", { name: "Atlantis", code: "" });
    expect(lastWrite()).toMatchObject({ clientCountry: "Atlantis", clientCountryCode: null });
    await updateProjectLocationAction("EEDP-1", "city", { name: "New Town" });
    expect(lastWrite()).toEqual({ clientCity: "New Town" });
  });

  it("clearing the country clears everything below it", async () => {
    loginAs("MANAGER");
    await updateProjectLocationAction("EEDP-1", "country", { name: "" });
    expect(lastWrite()).toEqual({
      clientCountry: null,
      clientCountryCode: null,
      clientState: null,
      clientStateCode: null,
      clientCity: null,
    });
  });

  it("logs the change to the project's activity timeline", async () => {
    loginAs("MANAGER");
    await updateProjectLocationAction("EEDP-1", "city", { name: "Bhopal" });
    expect(d.projectActivity.create).toHaveBeenCalled();
    expect(JSON.stringify(d.projectActivity.create.mock.calls[0][0])).toContain("Client City");
  });

  it("refuses an invalid level and unauthorized users", async () => {
    loginAs("MANAGER");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((await updateProjectLocationAction("EEDP-1", "planet" as any, { name: "Mars" })).success).toBe(false);
    loginAs("TEAM_MEMBER", false);
    expect((await updateProjectLocationAction("EEDP-1", "city", { name: "Pune" })).success).toBe(false);
    expect(d.project.update).not.toHaveBeenCalled();
  });
});

describe("location dropdown data (real dataset)", () => {
  beforeEach(() => mocks.auth.mockResolvedValue({ user: { id: "u1" } }));

  it("lists every country with its ISO code, sorted by name", async () => {
    const countries = await getCountryOptionsAction();
    expect(countries.length).toBeGreaterThan(240);
    expect(countries).toContainEqual({ code: "IN", name: "India" });
    expect(countries).toContainEqual({ code: "GB", name: "United Kingdom" });
    const names = countries.map((c) => c.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it("lists a country's states and a state's cities", async () => {
    const states = await getStateOptionsAction("IN");
    expect(states).toContainEqual({ code: "MP", name: "Madhya Pradesh" });
    const cities = await getCityOptionsAction("IN", "MP");
    expect(cities.map((c) => c.name)).toContain("Indore");
  });

  it("returns nothing for unknown codes or when signed out", async () => {
    expect(await getStateOptionsAction("")).toEqual([]);
    expect(await getCityOptionsAction("IN", "")).toEqual([]);
    mocks.auth.mockResolvedValue(null);
    expect(await getCountryOptionsAction()).toEqual([]);
  });
});

describe("GET /api/flags/[code]", () => {
  const get = (code: string) => getFlag(new Request(`http://x/api/flags/${code}`), { params: Promise.resolve({ code }) });

  it("serves the SVG flag for an ISO code (any case, optional .svg)", async () => {
    for (const code of ["IN", "gb", "US.svg"]) {
      const res = await get(code);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
      expect(await res.text()).toMatch(/^<svg/);
    }
  });

  it("is cached long-term and locked down", async () => {
    const res = await get("IN");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("404s for unknown codes and junk input", async () => {
    for (const code of ["ZZ", "IND", "", "../etc", "constructor"]) {
      expect((await get(code)).status).toBe(404);
    }
  });
});
