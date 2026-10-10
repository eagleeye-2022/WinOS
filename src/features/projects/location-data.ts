// Client Location data, read from the repo's own data files in scripts/data/locations/ (see the
// README there) — no location library, nothing in the DB. Server-side only: countries are small
// and bundled; cities (~2 MB) are imported lazily, the first time a country's cities are needed.

import countriesData from "../../../scripts/data/locations/countries.json";

export type LocationOption = { code: string; name: string };

/** Every country with its ISO 3166-1 alpha-2 code, e.g. { code: "IN", name: "India" }, sorted. */
export const COUNTRIES = countriesData as LocationOption[];

/** The listed country for an ISO code (any case), or undefined. */
export function findCountry(code: string | null | undefined): LocationOption | undefined {
  const iso = (code || "").trim().toUpperCase();
  return iso ? COUNTRIES.find((c) => c.code === iso) : undefined;
}

/** cities.json is keyed country → state → city names; the table only uses country → city. */
type CitiesData = Record<string, Record<string, string[]>>;
let citiesPromise: Promise<CitiesData> | null = null;
function loadCities(): Promise<CitiesData> {
  if (!citiesPromise) {
    citiesPromise = import("../../../scripts/data/locations/cities.json")
      .then((m) => (m.default ?? m) as unknown as CitiesData)
      .catch((err) => {
        citiesPromise = null;
        throw err;
      });
  }
  return citiesPromise;
}

const countryCitiesCache = new Map<string, string[]>();

/** Every city of one country (all its states merged, de-duplicated), sorted. [] if unknown. */
export async function getCountryCities(countryCode: string): Promise<string[]> {
  const iso = (countryCode || "").trim().toUpperCase();
  if (!iso) return [];
  const cached = countryCitiesCache.get(iso);
  if (cached) return cached;
  const byState = (await loadCities())[iso];
  const names = byState
    ? [...new Set(Object.values(byState).flat())].sort((a, b) => a.localeCompare(b))
    : [];
  countryCitiesCache.set(iso, names);
  return names;
}
