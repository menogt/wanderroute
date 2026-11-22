import type { GenerationOptions } from "./generationRequest.ts";
import type { PlanningCustomization } from "./planningCustomization";
import { suggestedActivities } from "./planningActivityChoices.ts";
import { excursionTransport } from "./planningExcursions.ts";
import type { PlanningAllowances } from "./planningBudget";
import { arrivalReadyMinute } from "./routeConstraints.ts";
import { calculateCostLedger, type CostLedger, type CostLineInput, type ExchangeRate } from "./costLedger.ts";
import { admissionPrice, foodDayPrice, INDICATIVE_EXCHANGE_RATES, legCost, localTransportCost,
  miscellaneousCost, roomNightPrice } from "./indicativePrices.ts";
import { planningSeasonMonth } from "./routeSeason.ts";
import { validatePlanningItinerary, type ValidationResult } from "./itineraryValidation.ts";
import type { CandidatePlace, PlanningItineraryV2, TripBriefV1 } from "./planningTypes";
import type { PlanningRouteConcept, PlanningV2Result, ConceptReadiness } from "./planningV2";
import { loadPlanningV2Places, eligibleActivityPlaces, withPinnedPlaces } from "./planningV2Places.ts";
import { activitiesPerDay, assignPinsToDays, resolveRequestedPlaces } from "./requestedPlaces.ts";
import { daysWithoutSightseeing, requestAiActivityPlan, validateAiActivityPlan, type AiActivityPlan } from "./planningV2ItineraryService.ts";
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
export type DetailedPlanningServices = GenerationOptions & {
  getPlaces?: (route: PlanningRouteConcept["candidate"]) => Promise<CandidatePlace[]>;
  getAiPlan?: (brief: TripBriefV1, route: PlanningRouteConcept["candidate"],
    places: CandidatePlace[], signal?: AbortSignal, fixed?: string[][]) => Promise<AiActivityPlan>;
  /** Loads chosen database places missing from the per-town lists. */
  getPlacesById?: (ids: string[]) => Promise<CandidatePlace[]>;
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
  const airportLegs = new Set([transport.arrivalTransfer?.id, transport.departureTransfer?.id].filter(Boolean));
  const visitLegs = new Set((transport.excursions ?? []).flatMap(visit => [visit.outbound.id, visit.inbound.id]));
  const month = planningSeasonMonth(brief);
  const food = foodDayPrice(brief.comfortTier);
  const lines: CostLineInput[] = [];
  const drivingDays = new Set<number>();
  for (const day of days) {
    if (day.overnightCity) {
      const stay = customization?.stays[day.city];
      const hotel = day.accommodationPlaceId ? byId.get(day.accommodationPlaceId) : undefined;
      const roomPrice = stay?.nightlyRoomAmount !== undefined && stay.status !== "CHANGED_CANCELLED" ? { kind: "EXACT" as const, evidence: { amount: stay.nightlyRoomAmount, currency: stay.rateCurrency ?? brief.budget.currency, status: "KNOWN" as const, source: "Traveler-recorded room rate; not independently verified" } } : sourcedPrice(hotel, "PER_ROOM_NIGHT");
      // Recorded or sourced room rates need the traveller's room count; estimates assume double rooms.
      const exact = stay?.rooms && roomPrice;
      lines.push({ id: `day-${day.day}:stay`, day: day.day, category: "ACCOMMODATION",
        description: `Stay in ${day.city}; availability and occupancy to confirm`,
        quantity: exact ? stay!.rooms! : stay?.rooms ?? Math.ceil(brief.travellerCount / 2),
        periodCount: 1, periodUnit: "NIGHT", chargingBasis: "PER_ROOM",
        unitPrice: exact ? roomPrice : roomNightPrice(brief.comfortTier, month) });
    }
    lines.push({ id: `day-${day.day}:food`, day: day.day, category: "FOOD",
      description: `Meals in ${day.city}`, quantity: brief.travellerCount,
      chargingBasis: "PER_PERSON", unitPrice: food });
    for (const item of day.items) {
      if (item.category === "activity" && !item.isFreeTime) {
        const place = item.placeId ? byId.get(item.placeId) : undefined;
        lines.push({ id: `cost:${item.id}`, day: day.day,
          category: place?.category === "beach" ? "ACTIVITIES" : "ENTRY_FEES",
          description: item.label, quantity: brief.travellerCount, chargingBasis: "PER_PERSON",
          unitPrice: sourcedPrice(place, "PER_PERSON") ?? admissionPrice(place, item.label) });
      } else if (item.category === "transport") {
        const leg = item.transportLegId ? legs.get(item.transportLegId) : undefined;
        const mode = leg?.mode;
        const perPerson = mode === "TRAIN" || mode === "BUS" || mode === "PUBLIC_TRANSPORT_UNSPECIFIED";
        const estimate = leg ? legCost(leg, brief, { airport: airportLegs.has(leg.id), dayVisit: visitLegs.has(leg.id) }) : undefined;
        if (mode === "PRIVATE_DRIVER") drivingDays.add(day.day);
        lines.push({ id: `cost:${item.id}`, day: day.day, category: "TRANSPORT", description: item.label,
          ...(estimate ?? { quantity: perPerson ? brief.travellerCount : 1,
            chargingBasis: perPerson ? "PER_PERSON" : mode === "PRIVATE_DRIVER" ? "PER_VEHICLE" : "FIXED",
            unitPrice: unknown(brief.budget.currency, "No sourced transfer fare or vehicle price") }) });
      }
    }
  }
  const local = localTransportCost(brief, drivingDays.size);
  lines.push({ id: "trip:local-transport", category: "TRANSPORT", description: brief.transportPreference === "PRIVATE_DRIVER"
    ? "Driver's non-transfer days" : "Local journeys between activities", ...local });
  lines.push({ id: "trip:miscellaneous", category: "MISCELLANEOUS", description: "SIM cards and tips",
    quantity: 1, chargingBasis: "FIXED", unitPrice: miscellaneousCost(brief, food) });
  return lines;
}

/** Day indexes with no room for sightseeing: a late arrival day, and departure day. */
function restDays(brief: TripBriefV1, dayCount: number): Set<number> {
  const days = new Set<number>();
  if ((arrivalReadyMinute(brief) ?? 0) >= 18 * 60) days.add(0);
  if (brief.departure) days.add(dayCount - 1);
  return days;
}

/**
 * Chosen places first on their day, then the AI's picks; the AI never repeats a chosen place and adds
 * nothing to a day without sightseeing time (for example the morning of an early flight).
 */
function withFixedPlaces(days: DaySelection[], fixed: string[][], noTime: Set<number>): DaySelection[] {
  const all = new Set(fixed.flat());
  return days.map((day, index) => ({ ...day,
    placeIds: [...(fixed[index] ?? []), ...(noTime.has(index) ? [] : day.placeIds.filter(id => !all.has(id)))],
    // The AI's theme for such a day ("Free day in Negombo") would suggest time that isn't there.
    ...(noTime.has(index) ? { note: index === 0 ? "Arrival day: check in and rest." : "Departure day: leave time for your airport transfer." } : {}),
    ...(day.descriptions ? { descriptions: day.descriptions.filter(item => !noTime.has(index) || (fixed[index] ?? []).includes(item.placeId)) } : {}) }));
}

function limitedSelections(brief: TripBriefV1, route: PlanningRouteConcept["candidate"],
  places: CandidatePlace[], fixed: string[][] = []): DaySelection[] {
  const cities = routeDayCities(route, brief.durationDays);
  const used = new Set<string>(fixed.flat());
  const capacity = activitiesPerDay(brief.pace);
  const rest = restDays(brief, cities.length);
  return cities.map((city, index) => {
    const arrivalRest = index === 0 && rest.has(0);
    const departure = index === cities.length - 1 && rest.has(index);
    const pinned = fixed[index] ?? [];
    const chosen = arrivalRest || departure ? [] : suggestedActivities(places, city, brief, used, Math.max(0, capacity - pinned.length));
    chosen.forEach(place => used.add(place.databaseId!));
    return { placeIds: [...pinned, ...chosen.map(place => place.databaseId!)], note: arrivalRest ? "Arrival, check-in and rest." : departure ? "Leave time for packing and your departure transfer." : "Explore at your own pace. Local journeys and opening hours need checking." };
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
  const rates = [...exchangeRates, ...INDICATIVE_EXCHANGE_RATES.filter(rate =>
    !exchangeRates.some(given => given.from === rate.from && given.to === rate.to))];
  const ledger = calculateCostLedger(buildCostLines(brief, days, places, transport, customization), brief.budget.currency,
    brief.travellerCount, rates);
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
  const scheduled = new Set(days.flatMap(day => day.items.map(item => item.placeId).filter((id): id is string => !!id)));
  for (const { request, place } of resolveRequestedPlaces(brief.requestedPlaces, places)) {
    if (place?.databaseId && scheduled.has(place.databaseId)) continue;
    const issue = { code: "REQUESTED_PLACE_UNSCHEDULED", severity: "WARNING" as const,
      details: { place: request.name, city: request.city, ...(place ? {} : { unavailable: true }) } };
    validation.issues.push(issue);
    validation.warnings.push(issue);
    if (validation.status === "READY") validation.status = "READY_WITH_WARNINGS";
  }
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
  services.signal?.throwIfAborted();
  const selected = result.concepts.find(concept => concept.routeConcept.id === selectedId);
  if (!selected || selected.readiness === "INVALID") throw new Error("Select a usable route concept first.");
  const { brief } = result;
  const route = selected.candidate;
  const cities = routeDayCities(route, brief.durationDays);
  services.onProgress?.("places");
  const places = await withPinnedPlaces(await (services.getPlaces ?? loadPlanningV2Places)(route),
    brief.requestedPlaces, services.getPlacesById);
  services.signal?.throwIfAborted();
  const pins = resolveRequestedPlaces(brief.requestedPlaces, places).flatMap(entry => entry.place ? [entry.place] : []);
  const { fixed, overflow } = assignPinsToDays(pins, cities, activitiesPerDay(brief.pace), restDays(brief, cities.length));
  let selections: DaySelection[];
  let generationMode: DetailedPlanningResult["generationMode"] = "AI";
  let generationIssue: string | undefined;
  if (!cities.some(city => eligibleActivityPlaces(places, city).length > 0)) {
    generationMode = "LIMITED_DRAFT";
    generationIssue = "No trusted activity records are available for this route. Add place coverage before relying on daily suggestions.";
    selections = limitedSelections(brief, route, places, fixed);
  } else {
    try {
      services.onProgress?.("suggestions");
      const raw = await (services.getAiPlan ?? requestAiActivityPlan)(brief, route, places, services.signal, fixed);
      services.signal?.throwIfAborted();
      const plan = validateAiActivityPlan(raw, route, brief, places, fixed);
      selections = withFixedPlaces(plan.days, fixed, daysWithoutSightseeing(brief, cities.length));
    } catch {
      services.signal?.throwIfAborted();
      generationMode = "LIMITED_DRAFT";
      generationIssue = "Activity suggestions could not be verified. This limited draft uses place records only; retry to request suggestions.";
      selections = limitedSelections(brief, route, places, fixed);
    }
  }
  services.signal?.throwIfAborted();
  services.onProgress?.("assembling");
  const detailed = buildDetailedPlanningResult(result, selectedId, places, selections, generationMode,
    generationIssue, services.exchangeRates ?? []);
  // Chosen places with no room yet wait in "Places to visit" and can be added to a day in their town.
  return overflow.length ? { ...detailed, unscheduledActivities: overflow.map(place => ({
    id: `activity:requested:${place.databaseId}`, placeId: place.databaseId!, city: place.city, label: place.name })) } : detailed;
}
