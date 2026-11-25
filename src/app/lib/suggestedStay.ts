import type { CandidatePlace } from "./planningTypes";
import type { TravelStyle } from "../components/rl/types";

const TIERS: TravelStyle[] = ["budget", "comfort", "luxury"];

/** Hotels the traveller can pick for `city`, curated guide entries first. */
export function hotelOptions(places: CandidatePlace[], city: string): CandidatePlace[] {
  const hotels = places.filter(place => place.city === city && place.category === "hotel" && place.databaseId);
  return [...hotels.filter(place => place.stayTier), ...hotels.filter(place => !place.stayTier)];
}

/**
 * A curated hotel to show when the traveller has not chosen one: the trip's comfort level, else the nearest
 * level, cheaper first. A suggestion only, never a booking, availability or a verified rate.
 * Unvetted database records are never suggested.
 */
export function suggestedStay(places: CandidatePlace[], city: string, tier: TravelStyle = "comfort"): CandidatePlace | undefined {
  const want = TIERS.indexOf(tier);
  const price = (place: CandidatePlace) => place.recordedPrice?.amount ?? Infinity;
  return hotelOptions(places, city).filter(place => place.stayTier)
    .map(place => ({ place, distance: Math.abs(TIERS.indexOf(place.stayTier!) - want) }))
    .sort((a, b) => a.distance - b.distance || price(a.place) - price(b.place))[0]?.place;
}

export const suggestedStayLabel = (hotel: CandidatePlace) => `${hotel.name} (suggested)`;
