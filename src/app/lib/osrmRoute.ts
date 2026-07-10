// Fetches an actual driving-route polyline between a sequence of cities from
// OSRM's free public demo server — no API key needed (router.project-osrm.org).
//
// The public demo server is meant for light/demo use, not production traffic,
// so treat failures (timeout, rate limit, downtime) as expected, not
// exceptional — callers should fall back to a straight line between cities,
// same philosophy as the AI itinerary generator's static fallback.
//
// Routes between the same city sequence never change, so results are cached
// in localStorage indefinitely — same pattern as geocoder.ts.

const CACHE_PREFIX = "wanderroute_osrm_route_";
const OSRM_BASE = "https://router.project-osrm.org/route/v1";
const TIMEOUT_MS = 8000;

export type OsrmProfile = "driving" | "foot";

function cacheKey(coords: [number, number][], profile: OsrmProfile): string {
  // Round to 3 decimals (~110m) so cache hits aren't broken by float noise.
  // Profile is part of the key since a driving route and a walking route
  // between the same two points are genuinely different.
  return CACHE_PREFIX + profile + "_" + coords.map(([lat, lng]) => `${lat.toFixed(3)},${lng.toFixed(3)}`).join(";");
}

// Returns the full route polyline as [lat, lng] pairs, or null if the
// route couldn't be fetched (caller should fall back to a straight line).
// profile: "driving" for routes between cities, "foot" for walking routes
// between nearby activities within one city.
export async function fetchRoadRoute(
  cityCoords: [number, number][],
  profile: OsrmProfile = "driving"
): Promise<[number, number][] | null> {
  console.log(`fetchRoadRoute (${profile}) called with`, cityCoords.length, "points");
  if (cityCoords.length < 2) return null;

  const key = cacheKey(cityCoords, profile);
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      console.log("OSRM route: cache hit");
      return JSON.parse(cached);
    }
  } catch {
    // localStorage may be unavailable — continue to fetch
  }

  // OSRM wants "lng,lat" pairs, semicolon-separated between waypoints.
  const coordsParam = cityCoords.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `${OSRM_BASE}/${profile}/${coordsParam}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`OSRM route request failed: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const coordinates = data.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      console.warn("OSRM response had no usable route geometry", data);
      return null;
    }

    // GeoJSON coordinates are [lng, lat] — flip to Leaflet's [lat, lng].
    const positions: [number, number][] = coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );

    try {
      localStorage.setItem(key, JSON.stringify(positions));
    } catch {
      // Cache write failure (quota, private browsing) is non-fatal
    }

    console.log("OSRM route: success,", positions.length, "points");
    return positions;
  } catch (err) {
    console.warn("OSRM route fetch threw an error (network/CORS/timeout):", err);
    return null; // network error, timeout, abort — caller falls back
  }
}
