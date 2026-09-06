// Resolving which cities a trip actually visits, and in what order.
//
// The user picks cities in whatever order they tap them, but a route is only
// sensible if it follows the island's geography. Everything downstream — the
// AI prompt, the fallback builder, the place fetcher — consumes the ordered
// list produced here, so ordering is decided in exactly one place and neither
// the user nor the model gets to override it.

// Canonical clockwise circuit of Sri Lanka, starting and ending near Bandaranaike
// airport. Any selection is sorted by each city's index in this array.
export const CANONICAL_CITY_ORDER = [
  "Negombo",
  "Anuradhapura",
  "Sigiriya",
  "Dambulla",
  "Polonnaruwa",
  "Trincomalee",
  "Kandy",
  "Nuwara Eliya",
  "Ella",
  "Arugam Bay",
  "Tissamaharama/Yala",
  "Mirissa",
  "Galle",
  "Hikkaduwa",
  "Bentota",
  "Colombo",
];

/**
 * The cities offered in the pickers: the canonical stops we hold curated
 * landmark data for, so every selectable city produces a real itinerary rather
 * than a generic placeholder. The remaining entries in CANONICAL_CITY_ORDER
 * still sort correctly if they arrive from the map or an older saved trip.
 */
export const SELECTABLE_CITIES = [
  "Negombo",
  "Sigiriya",
  "Dambulla",
  "Trincomalee",
  "Kandy",
  "Nuwara Eliya",
  "Ella",
  "Arugam Bay",
  "Mirissa",
  "Galle",
  "Hikkaduwa",
  "Colombo",
];

export const MAX_CITIES = 6;

// Below this, a stop is a drive-through rather than a visit.
const MIN_DAYS_PER_CITY = 1.5;

/**
 * Sort cities into canonical circuit order. Unknown cities keep their relative
 * order and go last, so a city typed by hand or added from the map never
 * disappears.
 */
export function orderCities(cities: string[]): string[] {
  const seen = new Set<string>();
  const unique = cities.filter((city) => {
    const key = city.trim().toLowerCase();
    if (!city.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique
    .map((city, fallbackIndex) => {
      const index = CANONICAL_CITY_ORDER.findIndex(
        (known) => known.toLowerCase() === city.trim().toLowerCase()
      );
      return {
        city: city.trim(),
        rank: index === -1 ? CANONICAL_CITY_ORDER.length + fallbackIndex : index,
      };
    })
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.city);
}

/**
 * The route we build when the user picks nothing. Roughly two days per city,
 * always opening and closing near the airport.
 */
export function autoSelectCities(days: number): string[] {
  if (days <= 2) return ["Colombo"];
  if (days <= 4) return ["Negombo", "Kandy", "Colombo"];
  if (days <= 7) return ["Negombo", "Sigiriya", "Kandy", "Ella", "Galle"];
  if (days <= 11) {
    return ["Negombo", "Sigiriya", "Kandy", "Nuwara Eliya", "Ella", "Mirissa", "Galle"];
  }
  return orderCities([
    "Negombo",
    "Anuradhapura",
    "Sigiriya",
    "Trincomalee",
    "Kandy",
    "Nuwara Eliya",
    "Ella",
    "Mirissa",
    "Galle",
  ]);
}

/** How many cities this many days can carry without becoming a bus tour. */
export function maxCitiesForDays(days: number): number {
  return Math.max(1, Math.floor(days / MIN_DAYS_PER_CITY));
}

export type ResolvedCities = {
  /** Ordered, capped list to actually plan against. Never empty. */
  cities: string[];
  /** Cities removed because the trip is too short for them. */
  dropped: string[];
  /** True when the user picked nothing and we chose for them. */
  autoSelected: boolean;
};

/**
 * The single entry point: takes whatever the user selected and returns the
 * ordered list every downstream consumer should use.
 */
export function resolveCities(selected: string[] | undefined, days: number): ResolvedCities {
  const picked = orderCities(selected ?? []);

  if (picked.length === 0) {
    return { cities: autoSelectCities(days), dropped: [], autoSelected: true };
  }

  // The auto-select buckets above are hand-tuned and exempt from the cap; this
  // only trims selections the user made themselves.
  const limit = Math.min(MAX_CITIES, maxCitiesForDays(days));
  if (picked.length <= limit) {
    return { cities: picked, dropped: [], autoSelected: false };
  }

  return {
    cities: picked.slice(0, limit),
    dropped: picked.slice(limit),
    autoSelected: false,
  };
}

/**
 * Split the trip length across stops. Two nights per city is the target; spare
 * days go to the first and last stop, which absorb the arrival and departure
 * legs, rather than padding the middle of the circuit.
 */
export function distributeDays(cityCount: number, totalDays: number): number[] {
  const n = Math.max(1, Math.min(cityCount, totalDays));
  const out = new Array<number>(n).fill(Math.floor(totalDays / n));

  // Ends first, then working inward.
  const order: number[] = [];
  let front = 0;
  let back = n - 1;
  while (front <= back) {
    order.push(front);
    if (back !== front) order.push(back);
    front += 1;
    back -= 1;
  }

  let remainder = totalDays - out.reduce((sum, value) => sum + value, 0);
  let i = 0;
  while (remainder > 0) {
    out[order[i % order.length]] += 1;
    remainder -= 1;
    i += 1;
  }

  return out;
}

/**
 * Trips saved before the multi-city selector stored a single `startCity`.
 * Accept either shape so an old saved trip loads instead of crashing.
 */
export function citiesFromLegacyInputs(
  value: { cities?: unknown; startCity?: unknown },
  days: number
): string[] {
  if (Array.isArray(value.cities) && value.cities.length > 0) {
    const strings = value.cities.filter((city): city is string => typeof city === "string");
    if (strings.length > 0) return resolveCities(strings, days).cities;
  }

  if (typeof value.startCity === "string" && value.startCity.trim()) {
    return resolveCities([value.startCity], days).cities;
  }

  return autoSelectCities(days);
}
