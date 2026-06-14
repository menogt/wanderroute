// Nominatim — OpenStreetMap's free geocoding API
// You pass a place name like "Nine Arch Bridge, Ella, Sri Lanka" and get back lat/lng.
//
// Nominatim Fair Use Policy:
// - Max 1 request per second — enforced by the rate limiter below
// - Send a descriptive User-Agent / Referer where possible (browsers manage these
//   automatically; the custom header below is best-effort — browsers may ignore it)
// - Results cached for 7 days in localStorage — minimises repeat requests
// - Free forever, no account needed
// - Docs: nominatim.org/release-docs/latest/api/Search/

const CACHE_KEY = "wanderroute_geocache";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

type CacheEntry = {
  coords: [number, number] | null;
  timestamp: number;
};

type GeoCache = Record<string, CacheEntry>;

// Load cache from localStorage
function loadCache(): GeoCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Save cache to localStorage
function saveCache(cache: GeoCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full — clear old entries
    localStorage.removeItem(CACHE_KEY);
  }
}

// Check if cache entry is still valid
function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

// Rate limiter — Nominatim allows max 1 request/second
let lastRequestTime = 0;
async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise(resolve => setTimeout(resolve, 1100 - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, options);
}

// Core geocoding function — takes a place name, returns [lat, lng] or null
export async function geocodePlace(placeName: string): Promise<[number, number] | null> {
  // Normalize the key
  const cacheKey = placeName.toLowerCase().trim();

  // Check cache first
  const cache = loadCache();
  if (cache[cacheKey] && isFresh(cache[cacheKey])) {
    return cache[cacheKey].coords;
  }

  // Build query — always append Sri Lanka for accuracy
  const query = placeName.includes("Sri Lanka")
    ? placeName
    : `${placeName}, Sri Lanka`;

  console.log("Geocoding:", query);

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=lk`;

  try {
    const response = await rateLimitedFetch(url, {
      headers: {
        // Browsers forbid overriding User-Agent and will ignore it, but it is
        // harmless and documents intent for non-browser callers.
        "User-Agent": "WanderRoute/1.0 (wanderroute.netlify.app)",
        "Accept": "application/json",
      },
    });
    if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);

    const data = await response.json();

    let coords: [number, number] | null = null;
    if (data && data.length > 0) {
      coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }

    console.log("Result:", coords);

    // Cache the result (even null — so we don't keep retrying failed lookups)
    cache[cacheKey] = { coords, timestamp: Date.now() };
    saveCache(cache);

    return coords;
  } catch (error) {
    console.warn(`Geocoding failed for "${placeName}":`, error);
    return null;
  }
}

// Batch geocode multiple places — respects rate limiting automatically
// Returns a map of { placeName: [lat, lng] | null }
export async function geocodePlaces(
  placeNames: string[]
): Promise<Record<string, [number, number] | null>> {
  const results: Record<string, [number, number] | null> = {};
  const cache = loadCache();

  // Separate cached vs uncached
  const toFetch: string[] = [];
  for (const name of placeNames) {
    const key = name.toLowerCase().trim();
    if (cache[key] && isFresh(cache[key])) {
      results[name] = cache[key].coords;
    } else {
      toFetch.push(name);
    }
  }

  // Fetch uncached ones one by one (rate limited)
  for (const name of toFetch) {
    results[name] = await geocodePlace(name);
  }

  return results;
}

// Clear the geocoding cache (useful for debugging)
export function clearGeoCache() {
  localStorage.removeItem(CACHE_KEY);
}

// Get cache stats (how many entries, how many are fresh)
export function getGeoCacheStats(): { total: number; fresh: number; stale: number } {
  const cache = loadCache();
  const entries = Object.values(cache);
  const fresh = entries.filter(isFresh).length;
  return { total: entries.length, fresh, stale: entries.length - fresh };
}
