// Reverse geocoding (coordinates → "Area, Town") for Pulse check-in via the TomTom Reverse Geocoding API
// (https://developer.tomtom.com/reverse-geocoding-api/documentation/reverse-geocode). Server-only.
// Needs TOMTOM_API_KEY. Requests are throttled (free tier: 5 requests/s) and results cached.
// Never throws — callers fall back to raw coordinates when this returns null.

const ENDPOINT = "https://api.tomtom.com/search/2/reverseGeocode";
const TIMEOUT_MS = 4000;
const MIN_INTERVAL_MS = 250;
const CACHE_LIMIT = 500;

export interface ReverseGeocodeResult {
  /** Short label, e.g. "Siddhi Park, Wagholi". */
  name: string;
  /** Full line, e.g. "Wagholi Manjri Road, Siddhi Park, Wagholi, Pune 412207, Maharashtra". */
  address: string;
}

/** The parts of TomTom's `address` object we use. */
export interface TomTomAddress {
  streetNameAndNumber?: string;
  street?: string;
  neighbourhood?: string;
  /** Smallest named area, e.g. a colony / society ("Siddhi Park"). */
  municipalitySecondarySubdivision?: string;
  /** Locality within the city ("Wagholi", "Rajwada"). */
  municipalitySubdivision?: string;
  /** City / town. */
  municipality?: string;
  localName?: string;
  countrySecondarySubdivision?: string;
  countrySubdivisionName?: string;
  countrySubdivision?: string;
  postalCode?: string;
  /** TomTom's own full address line. */
  freeformAddress?: string;
}

function unique(parts: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const v = p?.trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}

/** Turns a TomTom address into our short name + full address. Pure, so it can be unit-tested. */
export function formatTomTomAddress(a: TomTomAddress): ReverseGeocodeResult | null {
  // Most specific area first: colony / neighbourhood, then locality, then city.
  let nameParts = unique([
    a.municipalitySecondarySubdivision || a.neighbourhood,
    a.municipalitySubdivision,
    a.municipality || a.localName,
  ]);
  // Only a city known: lead with the street so the name still says where in it.
  if (nameParts.length < 2) nameParts = unique([a.street, ...nameParts]);
  const name = nameParts.slice(0, 2).join(", ") || unique((a.freeformAddress || "").split(",").slice(0, 2)).join(", ");
  if (!name) return null;

  const state = a.countrySubdivisionName || a.countrySubdivision;
  const address =
    a.freeformAddress?.trim() ||
    unique([a.streetNameAndNumber || a.street, ...nameParts, state]).join(", ") + (a.postalCode ? ` ${a.postalCode}` : "");
  return { name, address: address.trim() || name };
}

// ── Rate limit + cache (per server process) ──────────────────────────────────

const cache = new Map<string, ReverseGeocodeResult>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** Runs `task` after the previous one, at least MIN_INTERVAL_MS after the last request started. */
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Street-level address for the point, whatever the fix's accuracy. */
export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
  const apiKey = process.env.TOMTOM_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[reverse-geocode] TOMTOM_API_KEY is not set, using coordinates.");
    return null;
  }

  // ~11 m buckets: people checking in from the same spot share one lookup.
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const params = new URLSearchParams({ key: apiKey, language: "en-GB" });
    const url = `${ENDPOINT}/${latitude},${longitude}.json?${params}`;

    const json = await throttled(async () => {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`TomTom responded ${res.status}`);
      return (await res.json()) as { addresses?: { address?: TomTomAddress }[] };
    });

    const address = json?.addresses?.[0]?.address;
    if (!address) return null;
    const result = formatTomTomAddress(address);
    if (!result) return null;

    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return result;
  } catch (err) {
    console.warn("[reverse-geocode] lookup failed, using coordinates:", err instanceof Error ? err.message : err);
    return null;
  }
}
