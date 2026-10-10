"use server";

// Dropdown data for the Client Location columns (Country → City). The data itself lives in
// ../location-data.ts, read from the repo's scripts/data/locations/ files.

import { auth } from "@/lib/auth";
// Only async functions may be exported from a "use server" file — import the LocationOption type
// from ../location-data directly.
import { COUNTRIES, getCountryCities, type LocationOption } from "../location-data";

/** Every country with its ISO 3166-1 alpha-2 code, e.g. { code: "IN", name: "India" }, sorted. */
export async function getCountryOptionsAction(): Promise<LocationOption[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return COUNTRIES;
}

/** Every city of one country (by ISO code), sorted. Cities have no short code, so `code` repeats the name. */
export async function getCityOptionsAction(countryCode: string): Promise<LocationOption[]> {
  const session = await auth();
  if (!session?.user?.id || !countryCode) return [];
  const names = await getCountryCities(countryCode);
  return names.map((name) => ({ code: name, name }));
}
