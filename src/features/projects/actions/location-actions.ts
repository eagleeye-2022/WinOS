"use server";

// Dropdown data for the Client Location columns, read from the repo's own data files in
// scripts/data/locations/ (see the README there) — no location library, nothing in the DB.
// countries + states are small and bundled with this module; cities (~2 MB) are imported
// lazily, only the first time a City dropdown is opened.

import countriesData from "../../../../scripts/data/locations/countries.json";
import statesData from "../../../../scripts/data/locations/states.json";
import { auth } from "@/lib/auth";

export type LocationOption = { code: string; name: string };

const COUNTRIES = countriesData as LocationOption[];
const STATES = statesData as Record<string, LocationOption[]>;

type CitiesData = Record<string, Record<string, string[]>>;
let citiesPromise: Promise<CitiesData> | null = null;
function loadCities(): Promise<CitiesData> {
  if (!citiesPromise) {
    citiesPromise = import("../../../../scripts/data/locations/cities.json")
      .then((m) => (m.default ?? m) as unknown as CitiesData)
      .catch((err) => {
        citiesPromise = null;
        throw err;
      });
  }
  return citiesPromise;
}

/** Every country with its ISO 3166-1 alpha-2 code, e.g. { code: "IN", name: "India" }, sorted. */
export async function getCountryOptionsAction(): Promise<LocationOption[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return COUNTRIES;
}

/** States / provinces / regions of one country (by ISO code), sorted. */
export async function getStateOptionsAction(countryCode: string): Promise<LocationOption[]> {
  const session = await auth();
  if (!session?.user?.id || !countryCode) return [];
  return STATES[countryCode.toUpperCase()] ?? [];
}

/** Cities of one state, sorted. Cities have no short code, so `code` repeats the name. */
export async function getCityOptionsAction(countryCode: string, stateCode: string): Promise<LocationOption[]> {
  const session = await auth();
  if (!session?.user?.id || !countryCode || !stateCode) return [];
  const cities = await loadCities();
  const names = cities[countryCode.toUpperCase()]?.[stateCode] ?? [];
  return names.map((name) => ({ code: name, name }));
}
