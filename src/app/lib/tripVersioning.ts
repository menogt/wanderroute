/**
 * Persisted current trips have no schemaVersion and are treated as V1.
 * Planning V2 snapshots carry schemaVersion: 2 inside itinerary_json; no
 * database column or rewrite of existing localStorage entries is required.
 * Both read paths in tripsDb use this adapter before handing data to screens.
 */
import type { GeneratedItinerary } from "../components/rl/types";
import { citiesFromLegacyInputs } from "./cityPlan.ts";

/** Absence of a version means the persisted current/legacy format (V1). */
export function itinerarySchemaVersion(trip: GeneratedItinerary): 1 | 2 {
  const version = (trip as GeneratedItinerary & { schemaVersion?: number }).schemaVersion;
  if (version === undefined || version === 1) return 1;
  if (version === 2) return 2;
  throw new Error(`Unsupported itinerary schema version: ${version}`);
}

/**
 * Read-time adapter only: the original local/Supabase JSON is not rewritten.
 * Position-based IDs stay fixed across reloads of the same legacy snapshot;
 * legacy data has no identity that could survive item reordering.
 */
export function adaptStoredTrip(trip: GeneratedItinerary): GeneratedItinerary {
  itinerarySchemaVersion(trip);
  const cities = Array.isArray(trip.cities) && trip.cities.length > 0
    ? trip.cities
    : citiesFromLegacyInputs(
      trip as unknown as { cities?: unknown; startCity?: unknown },
      trip.totalDays ?? 7
    );

  const days = Array.isArray(trip.days) ? trip.days.map((day, dayIndex) => ({
    ...day,
    items: Array.isArray(day.items) ? day.items.map((item, itemIndex) => ({
      ...item,
      id: item.id || `legacy:${encodeURIComponent(trip.id)}:${dayIndex}:${itemIndex}`,
    })) : day.items,
  })) : trip.days;

  // V2 IDs are authored once by its producer. Filling a missing ID only makes
  // a malformed snapshot displayable; it does not claim a durable edit identity.
  return { ...trip, cities, days };
}
