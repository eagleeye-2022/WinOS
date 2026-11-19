import { describe, it, expect } from "vitest";
import { formatTomTomAddress } from "@/lib/reverse-geocode";

// Address objects below are trimmed from real TomTom reverseGeocode replies.
describe("formatTomTomAddress", () => {
  it("uses colony + locality as the name (Wagholi, Pune)", () => {
    expect(
      formatTomTomAddress({
        street: "Wagholi Manjri Road",
        municipalitySecondarySubdivision: "Siddhi Park",
        municipalitySubdivision: "Wagholi",
        municipality: "Pune",
        countrySubdivisionName: "Maharashtra",
        postalCode: "412207",
        freeformAddress: "Wagholi Manjri Road, Siddhi Park, Wagholi, Pune 412207, Maharashtra",
      })
    ).toEqual({
      name: "Siddhi Park, Wagholi",
      address: "Wagholi Manjri Road, Siddhi Park, Wagholi, Pune 412207, Maharashtra",
    });
  });

  it("uses locality + city when there is no colony (Rajwada, Indore)", () => {
    expect(
      formatTomTomAddress({
        streetNameAndNumber: "660, Mahatma Gandhi Road",
        street: "Mahatma Gandhi Road",
        municipalitySubdivision: "Rajwada",
        municipality: "Indore",
        countrySubdivisionName: "Madhya Pradesh",
        postalCode: "452007",
        freeformAddress: "660, Mahatma Gandhi Road, Rajwada, Indore 452007, Madhya Pradesh",
      })
    ).toEqual({
      name: "Rajwada, Indore",
      address: "660, Mahatma Gandhi Road, Rajwada, Indore 452007, Madhya Pradesh",
    });
  });

  it("uses the neighbourhood when there is no colony (Westminster, London)", () => {
    expect(
      formatTomTomAddress({
        streetNameAndNumber: "10 Downing Street",
        neighbourhood: "Saint James's",
        municipalitySubdivision: "Westminster",
        municipality: "London",
        freeformAddress: "10 Downing Street, Westminster, London, SW1A 2AA",
      })?.name
    ).toBe("Saint James's, Westminster");
  });

  it("leads with the street when only the city is known", () => {
    expect(formatTomTomAddress({ street: "Satna Umaria Road", municipality: "Unchahara" })?.name).toBe(
      "Satna Umaria Road, Unchahara"
    );
  });

  it("builds the address when TomTom sends no freeform line", () => {
    expect(
      formatTomTomAddress({
        street: "MG Road",
        municipalitySubdivision: "Vijay Nagar",
        municipality: "Indore",
        countrySubdivisionName: "Madhya Pradesh",
        postalCode: "452010",
      })
    ).toEqual({ name: "Vijay Nagar, Indore", address: "MG Road, Vijay Nagar, Indore, Madhya Pradesh 452010" });
  });

  it("drops repeated parts", () => {
    expect(formatTomTomAddress({ municipalitySubdivision: "Indore", municipality: "Indore" })?.name).toBe("Indore");
  });

  it("returns null when there is nothing to name", () => {
    expect(formatTomTomAddress({})).toBeNull();
  });
});
