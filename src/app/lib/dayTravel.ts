// Travel between the places of one day, and a Google Maps link for the day.
//
// Times start as a distance estimate (instant, offline) and are replaced by OSRM road
// routing when it answers (free public demo server, cached in localStorage). OSRM assumes
// free-flowing roads, so town driving is never shown faster than realistic local speeds.

export type Point = { latitude: number; longitude: number };
export type TravelLeg = { minutes: number; km: number; walk: boolean; source: "estimate" | "road" };

const HILL_TOWNS = new Set(["kandy", "nuwara eliya", "ella", "haputale", "hatton", "bandarawela"]);
/** Door-to-door car averages on local roads, with stops and traffic. */
export const TOWN_SPEED_KMH = { hill: 22, lowland: 28 } as const;
const WALK_KMH = 4.5;
/** Up to this road distance a walk is the sensible way between two places. */
export const WALK_LIMIT_KM = 1.2;
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
const CACHE_PREFIX = "wanderroute_day_legs_";
const TIMEOUT_MS = 8000;

const speedFor = (city: string) => HILL_TOWNS.has(city.trim().toLowerCase()) ? TOWN_SPEED_KMH.hill : TOWN_SPEED_KMH.lowland;
const roundMinutes = (minutes: number) => minutes < 60 ? Math.max(5, Math.round(minutes / 5) * 5) : Math.round(minutes / 10) * 10;
const roundKm = (km: number) => km < 10 ? Math.round(km * 10) / 10 : Math.round(km);

/** Great-circle distance in kilometres. */
export function straightKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** A leg from road kilometres (and OSRM minutes when known), as a walk or a realistic drive. */
export function legFromRoad(km: number, city: string, osrmMinutes?: number, source: TravelLeg["source"] = "road"): TravelLeg {
  if (km <= WALK_LIMIT_KM) return { minutes: roundMinutes(km / WALK_KMH * 60), km: roundKm(km), walk: true, source };
  const realistic = km / speedFor(city) * 60;
  return { minutes: roundMinutes(Math.max(osrmMinutes ?? 0, realistic)), km: roundKm(km), walk: false, source };
}

/** Instant estimate: roads wind, more so in the hills. */
export function estimateLeg(a: Point, b: Point, city: string): TravelLeg {
  const winding = HILL_TOWNS.has(city.trim().toLowerCase()) ? 1.6 : 1.4;
  return legFromRoad(straightKm(a, b) * winding, city, undefined, "estimate");
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60); const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** "About 15 min drive · 6.2 km" or "About 10 min walk · 0.8 km". */
export function formatLeg(leg: TravelLeg): string {
  return `About ${formatMinutes(leg.minutes)} ${leg.walk ? "walk" : "drive"} · ${leg.km} km`;
}

const coords = (point: Point) => `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;

/** Google Maps directions through the day's places in order (no key needed); one place opens it on the map. */
export function googleMapsDayUrl(points: Point[]): string | undefined {
  if (!points.length) return undefined;
  if (points.length === 1) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords(points[0]))}`;
  const params = new URLSearchParams({ api: "1", origin: coords(points[0]), destination: coords(points[points.length - 1]), travelmode: "driving" });
  if (points.length > 2) params.set("waypoints", points.slice(1, -1).map(coords).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

type FetchJson = (url: string, signal: AbortSignal) => Promise<unknown>;
const defaultFetch: FetchJson = async (url, signal) => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`OSRM ${response.status}`);
  return response.json();
};

/** Road legs between consecutive points from OSRM, or null when it can't answer. Cached for good. */
export async function fetchDayLegs(points: Point[], city: string, fetchJson: FetchJson = defaultFetch): Promise<TravelLeg[] | null> {
  if (points.length < 2) return [];
  const path = points.map(point => `${point.longitude.toFixed(5)},${point.latitude.toFixed(5)}`).join(";");
  const key = CACHE_PREFIX + path;
  let raw: { minutes: number; km: number }[] | undefined;
  try { const cached = localStorage.getItem(key); if (cached) raw = JSON.parse(cached); } catch { /* storage unavailable */ }
  if (!raw) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const data = await fetchJson(`${OSRM_BASE}/${path}?overview=false`, controller.signal) as { routes?: { legs?: { duration: number; distance: number }[] }[] };
      const legs = data?.routes?.[0]?.legs;
      if (!Array.isArray(legs) || legs.length !== points.length - 1) return null;
      raw = legs.map(leg => ({ minutes: leg.duration / 60, km: leg.distance / 1000 }));
      try { localStorage.setItem(key, JSON.stringify(raw)); } catch { /* cache is optional */ }
    } catch { return null; } finally { clearTimeout(timer); }
  }
  return raw.map(leg => legFromRoad(leg.km, city, leg.minutes));
}
