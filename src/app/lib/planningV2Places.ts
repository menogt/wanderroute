import { candidateFromDbPlace } from "./candidatePlaces.ts";
import type { CandidatePlace } from "./planningTypes";
import type { CandidateRoute } from "./routeTypes";
import type { DbPlace } from "./supabase";

const PER_CITY_LIMIT = 60;
const MAX_CITIES = 8;
const QUERY_TIMEOUT_MS = 8_000;

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
  const signal = AbortSignal.timeout(QUERY_TIMEOUT_MS);
  const { data, error } = await supabase.from("places")
    .select("id,name,city,category,lat,lng,price_usd,source,importance_score,rating")
    .eq("city", city)
    .order("importance_score", { ascending: false })
    .limit(PER_CITY_LIMIT)
    .abortSignal(signal);
  if (error) throw new Error(`Place lookup failed for ${city}.`);
  return ((data ?? []) as DbPlace[]).filter(place => !!place.id).map(place => candidateFromDbPlace(place));
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
    !!place.databaseId && ["attraction", "beach", "temple"].includes(place.category));
}
