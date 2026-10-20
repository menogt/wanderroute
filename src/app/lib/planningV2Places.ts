import { candidateFromDbPlace } from "./candidatePlaces.ts";
import type { CandidatePlace } from "./planningTypes";
import type { CandidateRoute } from "./routeTypes";
import type { DbPlace } from "./supabase";

const CATEGORY_LIMITS = [
  { category: "attraction", limit: 25 },
  { category: "temple", limit: 20 },
  { category: "beach", limit: 10 },
  { category: "hotel", limit: 15 },
] as const;
const MAX_CITIES = 8;
const QUERY_TIMEOUT_MS = 8_000;
const NON_ACTIVITY_NAME = /\b(?:restaurant|caf[eé]|coffee|food|dosai|dosa|hotel|resort|guest\s?house|inn|bar|pub|kfc|pizza|bakery|take\s?away|super(?:market|centre|center)|mall|shop|store|lounge)\b/i;
const RELIGIOUS_PLACE_NAME = /\b(?:temple|vihara|viharaya|kovil|devalaya|mosque|masjid|church|chapel|cathedral|stupa|buddha|monastery|shrine|sacred|piriwena|pirivena|bodhi|maligawa)\b/i;

function stableSlug(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Existing curated hotels are candidates, not availability or current-price evidence. */
async function curatedHotels(city: string): Promise<CandidatePlace[]> {
  const { HOTELS_BY_CITY } = await import("../components/rl/data");
  return (HOTELS_BY_CITY[city] ?? []).map(hotel => ({
    databaseId: `curated-hotel:${stableSlug(city)}:${stableSlug(hotel.name)}`,
    name: hotel.name, city, category: "hotel", sourceProvider: "WanderRoute curated guide",
    ...(hotel.location ? { coordinates: { latitude: hotel.location[0], longitude: hotel.location[1] } } : {}),
  }));
}

async function fetchCityPlaces(city: string): Promise<CandidatePlace[]> {
  const { supabase } = await import("./supabase");
  if (!supabase) return [];
  // A single city-wide limit can be exhausted by restaurants before any sights appear.
  const places: CandidatePlace[] = [];
  let successfulQueries = 0;
  for (const { category, limit } of CATEGORY_LIMITS) {
    try {
      const { data, error } = await supabase.from("places")
        .select("id,name,city,category,lat,lng,price_usd,source,importance_score,rating")
        .eq("city", city)
        .eq("category", category)
        .order("importance_score", { ascending: false })
        .limit(limit)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));
      if (error) continue;
      successfulQueries++;
      places.push(...((data ?? []) as DbPlace[]).filter(place => !!place.id).map(place => candidateFromDbPlace(place)));
    } catch { /* Keep usable categories when one lookup is unavailable. */ }
  }
  if (!successfulQueries) throw new Error(`Place lookup failed for ${city}.`);
  return places;
}

/** At most eight bounded city lookups; structured IDs and provenance survive retrieval. */
export async function loadPlanningV2Places(route: CandidateRoute,
  fetchCity: (city: string) => Promise<CandidatePlace[]> = fetchCityPlaces): Promise<CandidatePlace[]> {
  const cities = [...new Set(route.destinations.map(destination => destination.name))].slice(0, MAX_CITIES);
  const settled = await Promise.allSettled(cities.map(city => fetchCity(city)));
  const places: CandidatePlace[] = [];
  for (const [index, city] of cities.entries()) {
    if (settled[index].status === "fulfilled") places.push(...settled[index].value);
    places.push(...await curatedHotels(city));
  }
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  return places.filter(place => {
    if (!place.databaseId) return false;
    const nameKey = `${place.city.toLowerCase()}|${place.category.toLowerCase()}|${place.name.toLowerCase()}`;
    if (seenIds.has(place.databaseId) || seenNames.has(nameKey)) return false;
    seenIds.add(place.databaseId);
    seenNames.add(nameKey);
    return true;
  });
}

export function eligibleActivityPlaces(places: CandidatePlace[], city: string): CandidatePlace[] {
  return places.filter(place => place.city.toLowerCase() === city.toLowerCase() &&
    !!place.databaseId && ["attraction", "beach", "temple"].includes(place.category) &&
    !NON_ACTIVITY_NAME.test(place.name) &&
    (place.category !== "temple" || place.sourceProvider?.toLowerCase() !== "foursquare" ||
      RELIGIOUS_PLACE_NAME.test(place.name)));
}
