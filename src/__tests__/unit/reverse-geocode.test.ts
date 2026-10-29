import { describe, it, expect } from "vitest";
import { formatNominatimAddress } from "@/lib/reverse-geocode";

describe("formatNominatimAddress", () => {
  it("uses area + village/town as the name", () => {
    expect(
      formatNominatimAddress({
        suburb: "Ubale Nagar",
        village: "Wagholi",
        county: "Haveli",
        state: "Maharashtra",
        postcode: "412207",
      })
    ).toEqual({ name: "Ubale Nagar, Wagholi", address: "Ubale Nagar, Wagholi, Haveli, Maharashtra 412207" });
  });

  it("falls back to the city when there is no village", () => {
    expect(formatNominatimAddress({ neighbourhood: "Vijay Nagar", city: "Indore", state: "Madhya Pradesh" })?.name).toBe(
      "Vijay Nagar, Indore"
    );
  });

  it("drops repeated parts", () => {
    expect(formatNominatimAddress({ suburb: "Indore", city: "Indore", state: "Madhya Pradesh" })).toEqual({
      name: "Indore",
      address: "Indore, Madhya Pradesh",
    });
  });

  it("uses the display name when the address has no area or locality", () => {
    expect(formatNominatimAddress({ state: "Goa" }, "NH66, Pernem, Goa, India")?.name).toBe("NH66, Pernem");
  });

  it("uses the road when there is no neighbourhood (real Nominatim reply for Rajwada, Indore)", () => {
    expect(
      formatNominatimAddress({
        road: "Rajwada Square",
        city_district: "Indore City",
        city: "Indore",
        county: "Juni Indore Tahsil",
        state_district: "Indore",
        state: "Madhya Pradesh",
        postcode: "452001",
      })
    ).toEqual({ name: "Rajwada Square, Indore", address: "Rajwada Square, Indore, Madhya Pradesh 452001" });
  });

  it("returns null when there is nothing to name", () => {
    expect(formatNominatimAddress({})).toBeNull();
  });
});
