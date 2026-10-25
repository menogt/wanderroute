import type { PlanningCustomization } from "./planningCustomization";
import { suggestedActivities } from "./planningActivityChoices.ts";
import { excursionTransport } from "./planningExcursions.ts";
import type { PlanningAllowances } from "./planningBudget";
import { arrivalReadyMinute } from "./routeConstraints.ts";
import { calculateCostLedger, type CostLedger, type CostLineInput, type ExchangeRate } from "./costLedger.ts";
import { validatePlanningItinerary, type ValidationResult } from "./itineraryValidation.ts";
import type { CandidatePlace, PlanningItineraryV2, TripBriefV1 } from "./planningTypes";
import type { PlanningRouteConcept, PlanningV2Result, ConceptReadiness } from "./planningV2";
import { loadPlanningV2Places, eligibleActivityPlaces } from "./planningV2Places.ts";
import { requestAiActivityPlan, validateAiActivityPlan, type AiActivityPlan } from "./planningV2ItineraryService.ts";
import { routeDayCities, schedulePlanningDays, type DaySelection, type ActivitySelection } from "./planningV2Scheduling.ts";
import type { TransportLeg, TransportPlan } from "./transportTypes";

export type DetailedPlanningResult = {
  itinerary: PlanningItineraryV2;
  ledger: CostLedger;
  validation: ValidationResult;
  readiness: ConceptReadiness;
  places: CandidatePlace[];
  generationMode: "AI" | "LIMITED_DRAFT";
  allowances?: PlanningAllowances;
  customization?: PlanningCustomization;
  planningContext?: PlanningV2Result;
  transport?: TransportPlan;
  generationIssue?: string;
  unscheduledActivities?: (ActivitySelection & { city: string; label: string })[];
};
export type DetailedPlanningServices = {
  getPlaces?: (route: PlanningRouteConcept["candidate"]) => Promise<CandidatePlace[]>;
  getAiPlan?: (brief: TripBriefV1, route: PlanningRouteConcept["candidate"],
    places: CandidatePlace[]) => Promise<AiActivityPlan>;
  exchangeRates?: ExchangeRate[];
};

function unknown(currency: TripBriefV1["budget"]["currency"], reason: string): CostLineInput["unitPrice"] {
  return { kind: "UNKNOWN", currency, reason };
}

function sourcedPrice(place: CandidatePlace | undefined,
  basis: CandidatePlace["priceBasis"]): CostLineInput["unitPrice"] | undefined {
  if (!place?.priceEvidence || place.priceBasis !== basis ||
      !Number.isFinite(place.priceEvidence.amount) || place.priceEvidence.amount < 0) return undefined;
  return { kind: "EXACT", evidence: place.priceEvidence };
}

function buildCostLines(brief: TripBriefV1, days: PlanningItineraryV2["days"],
  places: CandidatePlace[], transport: TransportPlan, customization?: PlanningCustomization): CostLineInput[] {
  const byId = new Map(places.filter(place => place.databaseId).map(place => [place.databaseId!, place]));
  const legs = new Map([...transport.legs, transport.arrivalTransfer, transport.departureTransfer,
    ...(transport.excursions ?? []).flatMap(visit => [visit.outbound, visit.inbound])]
    .filter((leg): leg is TransportLeg => !!leg).map(leg => [leg.id, leg]));
  const lines: CostLineInput[] = [];
  for (const day of days) {
    if (day.overnightCity) {
      const stay = customization?.stays[day.city];
      const hotel = day.accommodationPlaceId ? byId.get(day.accommodationPlaceId) : undefined;
      const rooms = stay?.rooms;
      const roomPrice = stay?.nightlyRoomAmount !== undefined && stay.status !== "CHANGED_CANCELLED" ? { kind: "EXACT" as const, evidence: { amount: stay.nightlyRoomAmount, currency: stay.rateCurrency ?? brief.budget.currency, status: "KNOWN" as const, source: "Traveler-recorded room rate; not independently verified" } } : sourcedPrice(hotel, "PER_ROOM_NIGHT");
      lines.push({ id: `day-${day.day}:stay`, day: day.day, category: "ACCOMMODATION",
        description: `Stay in ${day.city}; availability and occupancy to confirm`, quantity: rooms ?? 1,
        periodCount: 1, periodUnit: "NIGHT", chargingBasis: "PER_ROOM",
        unitPrice: rooms && roomPrice ? roomPrice : unknown(brief.budget.currency,
          "No sourced room-night price or explicit room allocation") });
    }
    lines.push({ id: `day-${day.day}:food`, day: day.day, category: "FOOD",
      description: `Meals in ${day.city}`, quantity: brief.travellerCount,
      chargingBasis: "PER_PERSON", unitPrice: unknown(brief.budget.currency, "No sourced meal price") });
    for (const item of day.items) {
      if (item.category === "activity" && !item.isFreeTime) {
        const place = item.placeId ? byId.get(item.placeId) : undefined;
        lines.push({ id: `cost:${item.id}`, day: day.day,
          category: place?.category === "beach" ? "ACTIVITIES" : "ENTRY_FEES",
          description: item.label, quantity: brief.travellerCount, chargingBasis: "PER_PERSON",
          unitPrice: sourcedPrice(place, "PER_PERSON") ?? unknown(brief.budget.currency,
            "No sourced per-person activity or entry price") });
      } else if (item.category === "transport") {
        const mode = item.transportLegId ? legs.get(item.transportLegId)?.mode : undefined;
        const perPerson = mode === "TRAIN" || mode === "BUS" || mode === "PUBLIC_TRANSPORT_UNSPECIFIED";
        lines.push({ id: `cost:${item.id}`, day: day.day, category: "TRANSPORT",
          description: item.label, quantity: perPerson ? brief.travellerCount : 1,
          chargingBasis: perPerson ? "PER_PERSON" : mode === "PRIVATE_DRIVER" ? "PER_VEHICLE" : "FIXED",
          unitPrice: unknown(brief.budget.currency, "No sourced transfer fare or vehicle price") });
      }
    }
  }
  lines.push({ id: "trip:local-transport", category: "TRANSPORT", description: "Local journeys between activities", quantity: 1, chargingBasis: "FIXED", unitPrice: unknown(brief.budget.currency, "Local transport has not been priced") });
  lines.push({ id: "trip:miscellaneous", category: "MISCELLANEOUS", description: "Other trip expenses",
    quantity: 1, chargingBasis: "FIXED", unitPrice: unknown(brief.budget.currency,
      "Miscellaneous costs have not been priced") });
  return lines;
}

function limitedSelections(brief: TripBriefV1, route: PlanningRouteConcept["candidate"],
  places: CandidatePlace[]): DaySelection[] {
  const cities = routeDayCities(route, brief.durationDays);
  const used = new Set<string>();
  const capacity = { SLOW_TRAVEL: 1, RELAXED: 2, BALANCED: 2, PACKED: 3 }[brief.pace ?? "BALANCED"];
  return cities.map((city, index) => {
    const arrivalRest = index === 0 && (arrivalReadyMinute(brief) ?? 0) >= 18 * 60;
    const departure = index === cities.length - 1 && !!brief.departure;
    const chosen = arrivalRest || departure ? [] : suggestedActivities(places, city, brief, used, capacity);
    chosen.forEach(place => used.add(place.databaseId!));
    return { placeIds: chosen.map(place => place.databaseId!), note: arrivalRest ? "Arrival, check-in and rest." : departure ? "Leave time for packing and your departure transfer." : "Explore at your own pace. Local journeys and opening hours need checking." };
  });
}

export function buildDetailedPlanningResult(result: PlanningV2Result, selectedId: string,
  places: CandidatePlace[], selections: DaySelection[], generationMode: DetailedPlanningResult["generationMode"],
  generationIssue?: string, exchangeRates: ExchangeRate[] = [], customization?: PlanningCustomization): DetailedPlanningResult {
  const selected = result.concepts.find(concept => concept.routeConcept.id === selectedId);
  if (!selected || selected.readiness === "INVALID") throw new Error("Select a usable route concept first.");
  const { brief, matrix } = result;
  const route = selected.candidate;
  if (selected.routeConcept.stops.length !== route.destinations.length ||
      selected.routeConcept.stops.some((stop, index) => stop.destinationName !== route.destinations[index].name ||
        stop.nights !== route.nights[index])) throw new Error("The selected route no longer matches its concept.");
  const transport = excursionTransport(brief, route, matrix, selected.transport, customization?.wishlist);
  const days = schedulePlanningDays(brief, route, transport, places, selections, customization?.stays);
  const ledger = calculateCostLedger(buildCostLines(brief, days, places, transport, customization), brief.budget.currency,
    brief.travellerCount, exchangeRates);
  const itinerary: PlanningItineraryV2 = {
    schemaVersion: 2, id: `${route.id}:itinerary-v2`, routeConceptId: route.id,
    routeName: route.destinations.map(destination => destination.name).join(" to "),
    routeSlogan: selected.recommendation, routeKey: route.id,
    cities: route.destinations.map(destination => destination.name),
    totalDays: brief.durationDays, totalPeople: brief.travellerCount, currency: brief.budget.currency,
    inputBudget: brief.budget.amount,
    ...(brief.comfortTier ? { travelStyle: brief.comfortTier } : {}),
    days, globalTips: [], warnings: [...selected.issues.map(issue => issue.detail).filter((detail): detail is string => !!detail),
      ...(generationIssue ? [generationIssue] : [])], highlights: [],
  };
  const validation = validatePlanningItinerary({ itinerary, brief, route, matrix,
    transportPlan: transport, ledger, trustedPlaces: places });
  for (const request of customization?.wishlist ?? []) {
    if (request.requirement === "EXCLUDED" || route.destinations.some(stop => stop.name === request.city) || transport.excursions?.some(visit => visit.city === request.city)) continue;
    const issue = { code: request.requirement === "MUST" ? "MUST_VISIT_UNSCHEDULED" : "REQUESTED_VISIT_UNSCHEDULED", severity: request.requirement === "MUST" ? "ERROR" as const : "UNKNOWN" as const, details: { city: request.city } };
    validation.issues.push(issue);
    (issue.severity === "ERROR" ? validation.errors : validation.unknowns).push(issue);
    validation.status = validation.errors.length ? "INVALID" : "NEEDS_CONFIRMATION";
  }
  const readiness: ConceptReadiness = validation.status === "INVALID" ? "INVALID" :
    validation.status === "NEEDS_CONFIRMATION" || selected.readiness === "NEEDS_CONFIRMATION" || generationIssue
      ? "NEEDS_CONFIRMATION" : validation.status === "READY_WITH_WARNINGS" || selected.readiness === "READY_WITH_WARNINGS"
        ? "READY_WITH_WARNINGS" : "READY";
  return { itinerary, ledger, validation, readiness, places, generationMode, customization, planningContext: result, transport,
    ...(generationIssue ? { generationIssue } : {}) };
}

/** Rebuilds every derived field after an edit; no AI or network call is involved. */
export function recalculatePlanningV2Itinerary(result: PlanningV2Result, selectedId: string,
  previous: DetailedPlanningResult, selections: DaySelection[]): DetailedPlanningResult {
  if (previous.itinerary.routeConceptId !== selectedId || selections.length !== result.brief.durationDays) {
    throw new Error("The edited itinerary no longer matches the selected route.");
  }
  return { ...buildDetailedPlanningResult(result, selectedId, previous.places, selections,
    previous.generationMode, previous.generationIssue, previous.ledger.exchangeRates, previous.customization),
    allowances: previous.allowances,
    unscheduledActivities: previous.unscheduledActivities ?? [] };
}

/** The selected route, transport and matrix are authoritative; AI only selects allowed place IDs. */
export async function generatePlanningV2Itinerary(result: PlanningV2Result, selectedId: string,
  services: DetailedPlanningServices = {}): Promise<DetailedPlanningResult> {
  const selected = result.concepts.find(concept => concept.routeConcept.id === selectedId);
  if (!selected || selected.readiness === "INVALID") throw new Error("Select a usable route concept first.");
  const { brief } = result;
  const route = selected.candidate;
  const cities = routeDayCities(route, brief.durationDays);
  const places = await (services.getPlaces ?? loadPlanningV2Places)(route);
  let selections: DaySelection[];
  let generationMode: DetailedPlanningResult["generationMode"] = "AI";
  let generationIssue: string | undefined;
  if (!cities.some(city => eligibleActivityPlaces(places, city).length > 0)) {
    generationMode = "LIMITED_DRAFT";
    generationIssue = "No trusted activity records are available for this route. Add place coverage before relying on daily suggestions.";
    selections = limitedSelections(brief, route, places);
  } else {
    try {
      const raw = await (services.getAiPlan ?? requestAiActivityPlan)(brief, route, places);
      const plan = validateAiActivityPlan(raw, route, brief, places);
      selections = plan.days;
    } catch {
      generationMode = "LIMITED_DRAFT";
      generationIssue = "Activity suggestions could not be verified. This limited draft uses place records only; retry to request suggestions.";
      selections = limitedSelections(brief, route, places);
    }
  }
  return buildDetailedPlanningResult(result, selectedId, places, selections, generationMode,
    generationIssue, services.exchangeRates ?? []);
}
