import type { CandidatePlace, TripBriefV1 } from "./planningTypes";
import type { CandidateRoute } from "./routeTypes";
import { eligibleActivityPlaces } from "./planningV2Places.ts";
import { routeDayCities, type DaySelection } from "./planningV2Scheduling.ts";

export type AiDaySelection = Pick<DaySelection, "placeIds" | "descriptions" | "note"> & { day: number };
export type AiActivityPlan = { schemaVersion: 2; routeConceptId: string; days: AiDaySelection[] };

export function validateAiActivityPlan(value: unknown, route: CandidateRoute,
  brief: TripBriefV1, places: CandidatePlace[]): AiActivityPlan {
  const dayCities = routeDayCities(route, brief.durationDays);
  const plan = value as Partial<AiActivityPlan> | null;
  if (!plan || plan.schemaVersion !== 2 || plan.routeConceptId !== route.id ||
      !Array.isArray(plan.days) || plan.days.length !== dayCities.length) {
    throw new Error("The activity service returned an invalid route or day count.");
  }
  for (const [index, day] of plan.days.entries()) {
    const allowed = new Set(eligibleActivityPlaces(places, dayCities[index]).map(place => place.databaseId));
    const paceLimit = { SLOW_TRAVEL: 1, RELAXED: 2, BALANCED: 2, PACKED: 3 }[brief.pace ?? "BALANCED"];
    if (!day || day.day !== index + 1 || !Array.isArray(day.placeIds) || day.placeIds.length > paceLimit ||
        day.placeIds.some(id => typeof id !== "string" || !allowed.has(id)) ||
        new Set(day.placeIds).size !== day.placeIds.length ||
        day.note !== undefined && (typeof day.note !== "string" || day.note.length > 240) ||
        day.descriptions !== undefined && (!Array.isArray(day.descriptions) || day.descriptions.length > 3 ||
          day.descriptions.some(item => !item || !day.placeIds.includes(item.placeId) ||
            typeof item.text !== "string" || item.text.length > 240))) {
      throw new Error(`The activity service returned an untrusted place for day ${index + 1}.`);
    }
  }
  // Project the model response onto the validated fields. Extra keys must not
  // override trusted place selections or provide item identities to the scheduler.
  return { schemaVersion: 2, routeConceptId: route.id,
    days: plan.days.map(day => ({ day: day.day, placeIds: [...day.placeIds],
      ...(day.note !== undefined ? { note: day.note } : {}),
      ...(day.descriptions !== undefined ? { descriptions: day.descriptions.map(item =>
        ({ placeId: item.placeId, text: item.text })) } : {}),
    })) };
}

/** V2 asks the server only to select trusted IDs and write short descriptions. */
export async function requestAiActivityPlan(brief: TripBriefV1, route: CandidateRoute,
  places: CandidatePlace[]): Promise<AiActivityPlan> {
  const cities = routeDayCities(route, brief.durationDays);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let response: Response;
  try {
    response = await fetch("/api/generate-v2-itinerary", { method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schemaVersion: 2, routeConceptId: route.id,
        interests: brief.interests, pace: brief.pace,
        days: cities.map((city, index) => ({ day: index + 1, city,
          places: eligibleActivityPlaces(places, city).slice(0, 15).map(place => ({
            id: place.databaseId!, name: place.name, category: place.category,
          })) })) }) });
  } catch {
    throw new Error("Activity suggestions are unavailable. Retry to check the service.");
  } finally { clearTimeout(timeout); }
  let payload: any;
  try { payload = await response.json(); }
  catch { throw new Error("The activity service returned an unreadable response."); }
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error :
    "Activity suggestions are unavailable.");
  return validateAiActivityPlan(payload?.plan, route, brief, places);
}
