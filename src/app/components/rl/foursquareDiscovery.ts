// Foursquare Places API — category discovery near a city.
// Different from foursquareGeocoder.ts (which looks up ONE known place name).
// This searches for ALL places of a category near a city centre — used to
// auto-populate the map with hotels/restaurants/attractions with zero manual entry.
//
// Free tier ~1,000 requests/day, no credit card. Cached 7 days in localStorage
// per city+category (one cache entry covers up to `limit` results).
//
// Foursquare category IDs (standard taxonomy):
//   Hotels:       19014
//   Restaurants:  13065
//   Attractions:  16000 (landmarks/outdoors broad category)
// Docs: docs.foursquare.com/data-products/docs/categories

import { CITY_COORDS } from "./mapConfig";

const FSQ_PROXY = "/api/foursquare";
const CACHE_KEY = "wanderroute_fsq_discover_cache";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export type DiscoveryCategory = "hotel" | "restaurant" | "attraction";

const CATEGORY_IDS: Record<DiscoveryCategory, string> = {
  hotel: "19014",
  restaurant: "13065",
  attraction: "16000",
};

export type DiscoveredPlace = {
  fsqId: string;
  name: string;
  location: [number, number];
  address?: string;
  rating?: number;
  category: DiscoveryCategory;
  city: string;
};

type CacheEntry = { places: DiscoveredPlace[]; timestamp: number };
type DiscoverCache = Record<string, CacheEntry>;

function loadCache(): DiscoverCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: DiscoverCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

// Polite rate limiting — same pattern as foursquareGeocoder.ts
let lastRequest = 0;
async function rateLimited(): Promise<void> {
  const elapsed = Date.now() - lastRequest;
  if (elapsed < 550) await new Promise(r => setTimeout(r, 550 - elapsed));
  lastRequest = Date.now();
}

// Find places of one category near one city. Returns [] on any failure —
// callers should treat an empty result as "nothing extra to show", not an error.
export async function discoverPlacesNearCity(
  city: string,
  category: DiscoveryCategory,
  limit = 8
): Promise<DiscoveredPlace[]> {
  const cacheKey = `${city}|${category}|${limit}`;
  const cache = loadCache();
  if (cache[cacheKey] && isFresh(cache[cacheKey])) {
    return cache[cacheKey].places;
  }

  const center = CITY_COORDS[city];
  if (!center) return [];

  await rateLimited();

  const url = `${FSQ_PROXY}?ll=${center[0]},${center[1]}&radius=8000&categories=${CATEGORY_IDS[category]}&limit=${limit}&sort=POPULARITY`;

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Foursquare error ${response.status}`);

    const data = await response.json();
    const places: DiscoveredPlace[] = (data?.results ?? [])
      .map((p: any) => {
        const lat = p.latitude ?? p.geocodes?.main?.latitude;
        const lng = p.longitude ?? p.geocodes?.main?.longitude;
        if (lat == null || lng == null) return null;
        return {
          fsqId: p.fsq_place_id ?? p.fsq_id ?? `${city}-${p.name}`,
          name: p.name,
          location: [lat, lng] as [number, number],
          address: p.location?.formatted_address,
          rating: p.rating,
          category,
          city,
        };
      })
      .filter(Boolean) as DiscoveredPlace[];

    cache[cacheKey] = { places, timestamp: Date.now() };
    saveCache(cache);
    return places;
  } catch (error) {
    console.warn(`Foursquare discovery failed for ${city} (${category}):`, error);
    return [];
  }
}

// Discover one category across multiple cities, sequentially (rate-limit friendly).
export async function discoverPlacesAcrossCities(
  cities: string[],
  category: DiscoveryCategory,
  limitPerCity = 6
): Promise<DiscoveredPlace[]> {
  const all: DiscoveredPlace[] = [];
  for (const city of cities) {
    const places = await discoverPlacesNearCity(city, category, limitPerCity);
    all.push(...places);
  }
  return all;
}

export function clearDiscoveryCache() {
  localStorage.removeItem(CACHE_KEY);
}