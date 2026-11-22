import { MUST_SEE } from "./curatedPlaces.ts";
import { SELECTABLE_CITIES } from "./cityPlan.ts";
import { PLACE_PHOTOS, type PlacePhoto } from "./placePhotoCatalog.ts";
import { isActivityPlace, landmarkIdentity } from "./planningV2Places.ts";
import type { CandidatePlace, TravelPace } from "./planningTypes";

/** A place the traveller asked for by name. Its town decides where the route goes. */
export type RequestedPlace = {
  key: string;
  name: string;
  city: string;
  /** Set when the place came from the database search; landmarks resolve by name. */
  databaseId?: string;
  source: "landmark" | "database";
  category?: string;
};
export type PickablePlace = RequestedPlace & { photo?: PlacePhoto };

export const MAX_REQUESTED_PLACES = 12;
const MAX_TOWNS = 8;
export const ACTIVITIES_PER_DAY: Record<TravelPace, number> = { SLOW_TRAVEL: 1, RELAXED: 2, BALANCED: 2, PACKED: 3 };
export const activitiesPerDay = (pace?: TravelPace) => ACTIVITIES_PER_DAY[pace ?? "BALANCED"];

export const placeKey = (city: string, name: string) => `${city}|${name}`;

/** The places most first-time visitors ask for, shown first in the picker. */
const POPULAR = [
  "Sigiriya|Sigiriya Rock Fortress", "Kandy|Temple of the Sacred Tooth Relic", "Ella|Nine Arches Bridge",
  "Galle|Galle Fort", "Dambulla|Dambulla Cave Temple", "Ella|Little Adam's Peak", "Mirissa|Mirissa Beach",
  "Nuwara Eliya|Horton Plains National Park", "Kandy|Royal Botanical Gardens Peradeniya", "Mirissa|Whale Watching Mirissa",
  "Sigiriya|Pidurangala Rock", "Ella|Ravana Falls",
];

export function photoForPlace(city: string, name: string): PlacePhoto | undefined {
  return PLACE_PHOTOS[placeKey(city, name)] ?? PLACE_PHOTOS[placeKey(city, landmarkIdentity(name, city) ?? "")];
}

/** Every landmark in the editorial guide, most-asked first, each with its town and photo if one is free to use. */
export function pickablePlaces(): PickablePlace[] {
  const all = Object.entries(MUST_SEE).flatMap(([city, names]) => names.map(name => ({
    key: placeKey(city, name), name, city, source: "landmark" as const, category: "attraction", photo: photoForPlace(city, name),
  })));
  const rank = (key: string) => { const index = POPULAR.indexOf(key); return index < 0 ? POPULAR.length : index; };
  return all.map((place, index) => ({ place, index }))
    .sort((a, b) => rank(a.place.key) - rank(b.place.key) || a.index - b.index).map(item => item.place);
}

/** Towns to plan around: those of the chosen places first, then any towns chosen directly. */
export function citiesFromPlaces(places: RequestedPlace[] = [], towns: string[] = []): string[] {
  const seen = new Set<string>();
  return [...places.map(place => place.city), ...towns].filter(city => {
    const key = city.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_TOWNS);
}

const clean = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

type SearchRow = { id?: string; name: string; city: string; category: string; source?: string };
async function searchDatabase(text: string): Promise<SearchRow[]> {
  const { supabase } = await import("./supabase");
  if (!supabase) return [];
  const { data, error } = await supabase.from("places").select("id,name,city,category,source")
    .ilike("name", `%${text.replace(/[%_,()]/g, " ").trim()}%`)
    .in("city", [...SELECTABLE_CITIES]).in("category", ["attraction", "temple", "beach"])
    .order("importance_score", { ascending: false }).limit(20)
    .abortSignal(AbortSignal.timeout(6_000));
  if (error) throw new Error("Place search is unavailable.");
  return (data ?? []) as SearchRow[];
}

/** Landmarks first, then database places in the planner's towns. Errors fall back to landmarks only. */
export async function searchPlaces(text: string, search: (text: string) => Promise<SearchRow[]> = searchDatabase,
  limit = 10): Promise<PickablePlace[]> {
  const query = clean(text);
  if (query.length < 2) return [];
  const words = query.split(" ");
  const matches = (name: string, city: string) => words.every(word => clean(`${name} ${city}`).includes(word));
  const landmarks = pickablePlaces().filter(place => matches(place.name, place.city));
  let rows: SearchRow[] = [];
  try { rows = await search(query); } catch { rows = []; }
  const found: PickablePlace[] = rows.filter(row => row.id && isActivityPlace({ databaseId: row.id, name: row.name, city: row.city,
    category: row.category, sourceProvider: row.source }) && !landmarkIdentity(row.name, row.city))
    .map(row => ({ key: `db:${row.id}`, name: row.name, city: row.city, databaseId: row.id, source: "database", category: row.category }));
  const seen = new Set<string>();
  return [...landmarks, ...found].filter(place => {
    const key = `${clean(place.city)}|${clean(place.name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

/** The loaded place record for each request, matched by database ID or by landmark name in its town. */
export function resolveRequestedPlaces(requested: RequestedPlace[] = [], places: CandidatePlace[]):
  { request: RequestedPlace; place?: CandidatePlace }[] {
  return requested.map(request => {
    const place = places.find(candidate => isActivityPlace(candidate) && (request.databaseId
      ? candidate.databaseId === request.databaseId
      : candidate.city.toLowerCase() === request.city.toLowerCase() &&
        (clean(candidate.name) === clean(request.name) || landmarkIdentity(candidate.name, candidate.city) === request.name)));
    return { request, ...(place ? { place } : {}) };
  });
}

/**
 * Spreads chosen places over the days spent in their town, fewest-filled day first, without passing the
 * pace limit. Blocked days (late arrival, departure day) are skipped. What doesn't fit is returned.
 */
export function assignPinsToDays(pins: CandidatePlace[], dayCities: string[], perDay: number,
  blocked: Set<number> = new Set()): { fixed: string[][]; overflow: CandidatePlace[] } {
  const fixed = dayCities.map(() => [] as string[]);
  const overflow: CandidatePlace[] = [];
  const seen = new Set<string>();
  for (const pin of pins) {
    if (!pin.databaseId || seen.has(pin.databaseId)) continue;
    seen.add(pin.databaseId);
    const days = dayCities.map((city, index) => ({ city, index }))
      .filter(day => day.city.toLowerCase() === pin.city.toLowerCase() && !blocked.has(day.index) && fixed[day.index].length < perDay)
      .sort((a, b) => fixed[a.index].length - fixed[b.index].length || a.index - b.index);
    if (days.length) fixed[days[0].index].push(pin.databaseId);
    else overflow.push(pin);
  }
  return { fixed, overflow };
}

/** Requested places per town, for giving a town enough nights. */
export function requestedPlaceCounts(requested: RequestedPlace[] = []): Map<string, number> {
  const counts = new Map<string, number>();
  for (const place of requested) counts.set(place.city.toLowerCase(), (counts.get(place.city.toLowerCase()) ?? 0) + 1);
  return counts;
}

export function validRequestedPlace(place: unknown): place is RequestedPlace {
  const value = place as Partial<RequestedPlace> | null;
  return !!value && typeof value.key === "string" && value.key.length > 0 && value.key.length <= 200 &&
    typeof value.name === "string" && value.name.trim().length > 0 && value.name.length <= 80 &&
    typeof value.city === "string" && (SELECTABLE_CITIES as readonly string[]).includes(value.city) &&
    (value.source === "landmark" || value.source === "database") &&
    (value.databaseId === undefined || typeof value.databaseId === "string" && value.databaseId.length <= 160);
}
