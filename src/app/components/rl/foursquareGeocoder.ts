// Foursquare Places API — accurate business/landmark coordinate lookup.
// Foursquare is built for finding exact businesses and points of interest, so it
// pinpoints restaurants, hotels and landmarks far better than Nominatim.
//
// Free tier ~1,000 requests/day, no credit card. Results cached for 14 days in
// localStorage. Falls back to Nominatim (geocoder.ts) for anything Foursquare
// can't find — or when no API key is configured.
//
// The browser cannot call Foursquare directly — an authenticated request triggers
// a CORS preflight that Foursquare rejects. So we call our own /api/foursquare
// proxy, which adds the Bearer key server-side (the key never reaches the bundle):
//   - dev:  Vite dev-server proxy        (vite.config.ts → server.proxy)
//   - prod: Netlify Function             (netlify/functions/foursquare.js + netlify.toml)
// Docs: docs.foursquare.com/developer/reference/place-search

import { geocodePlace as nominatimGeocode } from "./geocoder";

const CACHE_KEY = "wanderroute_fsq_geocache";
const CACHE_TTL = 14 * 24 * 60 * 60 * 1000; // 14 days

// Same-origin proxy path. If it's unreachable/erroring, we fall back to Nominatim.
const FSQ_PROXY = "/api/foursquare";

// Sri Lanka bounding box — used to reject results that landed in the wrong country.
const SL_BOUNDS = { minLat: 5.9, maxLat: 9.9, minLng: 79.5, maxLng: 82.0 };

function inSriLanka(lat: number, lng: number): boolean {
  return lat >= SL_BOUNDS.minLat && lat <= SL_BOUNDS.maxLat &&
         lng >= SL_BOUNDS.minLng && lng <= SL_BOUNDS.maxLng;
}

type CacheEntry = { coords: [number, number] | null; timestamp: number };
type GeoCache = Record<string, CacheEntry>;

function loadCache(): GeoCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: GeoCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full — clear and start fresh
    localStorage.removeItem(CACHE_KEY);
  }
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

// City centres to bias Foursquare search toward the right area (matches the
// destination city extracted from "Colombo → Kandy" style labels).
const CITY_CENTERS: Record<string, [number, number]> = {
  Colombo:        [6.9271, 79.8612],
  Kandy:          [7.2906, 80.6337],
  Ella:           [6.8667, 81.0466],
  Mirissa:        [5.9483, 80.4716],
  Galle:          [6.0535, 80.2210],
  Sigiriya:       [7.9570, 80.7603],
  Negombo:        [7.2084, 79.8358],
  "Nuwara Eliya": [6.9497, 80.7891],
  Dambulla:       [7.8675, 80.6517],
  Trincomalee:    [8.5874, 81.2152],
  Unawatuna:      [6.0100, 80.2490],
  Hikkaduwa:      [6.1395, 80.1055],
  "Arugam Bay":   [6.8406, 81.8360],
};

// Rate limiter — be polite, max ~2 req/sec.
let lastRequest = 0;
async function rateLimited(): Promise<void> {
  const elapsed = Date.now() - lastRequest;
  if (elapsed < 550) {
    await new Promise(r => setTimeout(r, 550 - elapsed));
  }
  lastRequest = Date.now();
}

// Nominatim fallback — geocode then validate the result is inside Sri Lanka.
async function fallbackToNominatim(
  placeName: string,
  city?: string
): Promise<[number, number] | null> {
  const coords = await nominatimGeocode(`${placeName}, ${city || ""}, Sri Lanka`);
  return coords && inSriLanka(coords[0], coords[1]) ? coords : null;
}

// Core function — search Foursquare for a place, biased toward a city centre.
// Returns [lat, lng] or null. Caches every result (including null) for 14 days.
export async function geocodeWithFoursquare(
  placeName: string,
  city?: string
): Promise<[number, number] | null> {
  const cacheKey = `${placeName.toLowerCase().trim()}|${city || ""}`;

  const cache = loadCache();
  if (cache[cacheKey] && isFresh(cache[cacheKey])) {
    return cache[cacheKey].coords;
  }

  await rateLimited();

  // Bias the search toward the city centre if we know it.
  const cityCenter = city ? CITY_CENTERS[city] : null;
  const llParam = cityCenter ? `&ll=${cityCenter[0]},${cityCenter[1]}&radius=20000` : "";

  const url = `${FSQ_PROXY}?query=${encodeURIComponent(placeName)}${llParam}&limit=1`;

  try {
    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Foursquare error ${response.status}`);
    }

    const data = await response.json();
    let coords: [number, number] | null = null;

    if (data?.results?.length > 0) {
      const place = data.results[0];
      const lat = place.latitude ?? place.geocodes?.main?.latitude;
      const lng = place.longitude ?? place.geocodes?.main?.longitude;
      if (lat != null && lng != null && inSriLanka(lat, lng)) {
        coords = [lat, lng];
      }
    }

    // Foursquare found nothing valid — fall back to Nominatim.
    if (!coords) {
      coords = await fallbackToNominatim(placeName, city);
    }

    cache[cacheKey] = { coords, timestamp: Date.now() };
    saveCache(cache);
    return coords;
  } catch (error) {
    console.warn(`Foursquare geocoding failed for "${placeName}", trying Nominatim:`, error);
    const fallback = await fallbackToNominatim(placeName, city);
    cache[cacheKey] = { coords: fallback, timestamp: Date.now() };
    saveCache(cache);
    return fallback;
  }
}

export function clearFsqCache() {
  localStorage.removeItem(CACHE_KEY);
}
