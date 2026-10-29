// Reverse geocoding (coordinates → "Area, Village/Town") via OpenStreetMap Nominatim.
// Server-only. Follows the Nominatim usage policy (https://operations.osmfoundation.org/policies/nominatim/):
// an identifying User-Agent, at most one request per second, and results cached.
// Never throws — callers fall back to raw coordinates when this returns null.

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const TIMEOUT_MS = 4000;
const MIN_INTERVAL_MS = 1100;
const CACHE_LIMIT = 500;

export interface ReverseGeocodeResult {
  /** Short label, e.g. "Ubale Nagar, Wagholi". */
  name: string;
  /** Full line, e.g. "Ubale Nagar, Wagholi, Haveli, Maharashtra 412207". */
  address: string;
}

/** The parts of Nominatim's `address` object we use. */
export interface NominatimAddress {
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  hamlet?: string;
  residential?: string;
  road?: string;
  village?: string;
  town?: string;
  city_district?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
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

/** Turns a Nominatim address into our short name + full address. Pure, so it can be unit-tested. */
export function formatNominatimAddress(a: NominatimAddress, displayName?: string): ReverseGeocodeResult | null {
  // Road is the last resort for the area: city centres often have no neighbourhood/suburb tag.
  const area = a.neighbourhood || a.suburb || a.quarter || a.residential || a.hamlet || a.road;
  const locality = a.village || a.town || a.city || a.municipality || a.city_district;
  const district = a.state_district || a.county;

  const nameParts = unique([area, locality]);
  const name = nameParts.length
    ? nameParts.join(", ")
    : unique((displayName || "").split(",").slice(0, 2)).join(", ");
  if (!name) return null;

  // De-duplicated part by part, so "Indore" (city) and "Indore" (district) appear once.
  const address = unique([...nameParts, district, a.state]).join(", ") + (a.postcode ? ` ${a.postcode}` : "");
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

function userAgent(): string {
  return process.env.NOMINATIM_USER_AGENT?.trim() || "WinOS/1.0 (Eagle Eye Digital internal attendance)";
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
  // ~11 m buckets: people checking in from the same spot share one lookup.
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(latitude),
      lon: String(longitude),
      zoom: "18",
      addressdetails: "1",
      "accept-language": "en",
    });
    const email = process.env.NOMINATIM_EMAIL?.trim();
    if (email) params.set("email", email);

    const json = await throttled(async () => {
      const res = await fetch(`${ENDPOINT}?${params}`, {
        headers: { "User-Agent": userAgent(), Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
      return (await res.json()) as { address?: NominatimAddress; display_name?: string; error?: string };
    });

    if (!json || json.error || !json.address) return null;
    const result = formatNominatimAddress(json.address, json.display_name);
    if (!result) return null;

    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return result;
  } catch (err) {
    console.warn("[reverse-geocode] lookup failed, using coordinates:", err instanceof Error ? err.message : err);
    return null;
  }
}
