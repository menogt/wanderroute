import { MUST_SEE } from "./curatedPlaces.ts";
import { eligibleActivityPlaces } from "./planningV2Places.ts";
import type { CandidatePlace, TripBriefV1 } from "./planningTypes";

const INTEREST_NAMES: Partial<Record<TripBriefV1["interests"][number], RegExp>> = {
  beaches: /beach|coast|reef|island/i, culture: /temple|museum|fort|heritage|sacred|dance|market/i,
  temples: /temple|sacred|maligawa|vihara|kovil/i, hiking: /rock|peak|plains|hill|trail/i,
  wildlife: /wild|national park|whale|bird|safari/i, food: /market/i,
  adventure: /rock|peak|plains|surf|reef/i,
};
/** Editorial name matches guide preference, not claims of operating hours or access. */
export function cityInterestAffinity(city: string, brief: TripBriefV1): number {
  return (MUST_SEE[city] ?? []).filter(name => brief.interests.some(interest => INTEREST_NAMES[interest]?.test(name))).length;
}
export function visitDurationEstimate(place: CandidatePlace): number {
  return /horton plains|ella rock/i.test(place.name) ? 240 : /rock fortress|pidurangala/i.test(place.name) ? 120 : 90;
}
export function activityPracticalDetail(place: CandidatePlace): string {
  if (/beach|reef|island/i.test(place.name)) return "Keep this coastal stop flexible. Check access, water conditions and local restrictions before visiting.";
  if (/temple|maligawa|vihara|sacred/i.test(place.name)) return "Plan a respectful religious-site visit. Confirm dress requirements, access and opening hours.";
  if (/rock|peak|hill|plains/i.test(place.name)) return "Leave time for the walk and breaks. Check route access, footing and current conditions before setting out.";
  if (/museum|fort/i.test(place.name)) return "Explore the area's history at your own pace. Confirm opening days, admission and time needed.";
  if (/market/i.test(place.name)) return "Explore the local market. Check trading hours and access before choosing a visit time.";
  if (/park|safari|whale|forest/i.test(place.name)) return "Check access, permits, guide requirements and current conditions directly with the operator.";
  return "An optional local stop. Confirm access, opening hours and the time needed before traveling.";
}
function separation(a: CandidatePlace, b: CandidatePlace): number | undefined {
  if (!a.coordinates || !b.coordinates) return undefined;
  const lat = Math.PI / 180, x = (a.coordinates.longitude - b.coordinates.longitude) * Math.cos((a.coordinates.latitude + b.coordinates.latitude) * lat / 2);
  return Math.hypot(a.coordinates.latitude - b.coordinates.latitude, x) * 111;
}

/** Small local clusters use straight-line distance only for grouping, never for journey times. */
export function suggestedActivities(places: CandidatePlace[], city: string, brief: TripBriefV1,
  used: Set<string>, capacity: number): CandidatePlace[] {
  const candidates = eligibleActivityPlaces(places, city).filter(place => !used.has(place.databaseId!));
  const preference = (place: CandidatePlace) => brief.interests.filter(interest => INTEREST_NAMES[interest]?.test(place.name)).length;
  const ranked = candidates.map((place, index) => ({ place, index })).sort((a, b) => preference(b.place) - preference(a.place) || a.index - b.index);
  const chosen: CandidatePlace[] = [];
  let minutes = 0;
  while (ranked.length && chosen.length < capacity) {
    const first = chosen[0];
    if (first?.coordinates) ranked.sort((a, b) => (separation(first, a.place) ?? 999) - (separation(first, b.place) ?? 999) || preference(b.place) - preference(a.place));
    const next = ranked.shift()!.place;
    const duration = visitDurationEstimate(next), distance = first ? separation(first, next) : undefined;
    if (chosen.length && (minutes + duration + 30 > 300 || distance !== undefined && distance > 15)) continue;
    chosen.push(next); minutes += duration + (chosen.length > 1 ? 30 : 0);
  }
  return chosen;
}
