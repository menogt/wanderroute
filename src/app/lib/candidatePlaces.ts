import type { DbPlace } from "./supabase";
import type { CandidatePlace } from "./planningTypes";

type PlaceEnrichment = Pick<CandidatePlace,
  "providerPlaceId" | "openingHours" | "priceEvidence" | "sourceUpdatedAt"
>;

/** Preserve recorded facts; optional enrichment must come from an actual source. */
export function candidateFromDbPlace(
  place: DbPlace,
  enrichment: Partial<PlaceEnrichment> = {}
): CandidatePlace {
  return {
    name: place.name,
    city: place.city,
    category: place.category,
    ...(place.id ? { databaseId: place.id } : {}),
    ...(place.source ? { sourceProvider: place.source } : {}),
    ...(Number.isFinite(place.lat) && Number.isFinite(place.lng)
      ? { coordinates: { latitude: place.lat!, longitude: place.lng! } }
      : {}),
    ...(typeof place.price_usd === "number" && Number.isFinite(place.price_usd)
      ? { recordedPrice: { amount: place.price_usd, currency: "USD" as const } }
      : {}),
    ...enrichment,
  };
}
