import type { Currency, Interest } from "../components/rl/types";
import { buildCandidateDestinations, generateRouteCandidates, knownPlanningDestinations } from "./routeCandidates.ts";
import { calculateCostLedger, compareBudget, type CostLedger, type CostLineInput } from "./costLedger.ts";
import type { RouteConceptV1, TripBriefV1 } from "./planningTypes";
import { CMB_AIRPORT, resolvePlanningEndpoint } from "./planningV2Locations.ts";
import { assessPlanningSeason, planningSeasonMonth, type PlanningSeason } from "./routeSeason.ts";
import type { CandidateRoute, PlanningDestination, RouteReason } from "./routeTypes";
import { buildTransportPlan } from "./transportPlanning.ts";
import type { TransportMode, TransportPlan } from "./transportTypes";
import { fetchTravelMatrix, type MatrixLocation, type TravelMatrix } from "./travelTimeMatrix.ts";

export type ConceptReadiness = "READY" | "READY_WITH_WARNINGS" | "NEEDS_CONFIRMATION" | "INVALID";
export type PlanningV2Issue = {
  code: string;
  severity: "ERROR" | "WARNING" | "UNKNOWN";
  detail?: string;
};
export type PlanningRouteConcept = {
  routeConcept: RouteConceptV1;
  candidate: CandidateRoute;
  transport: TransportPlan;
  ledger: CostLedger;
  readiness: ConceptReadiness;
  issues: PlanningV2Issue[];
  recommendation: string;
  /** Car-road estimates only for legs actually assigned to a private driver. */
  knownDrivingMinutes?: number;
  longestKnownDrivingLegMinutes?: number;
};
export type PlanningV2Result = {
  brief: TripBriefV1;
  destinations: PlanningDestination[];
  matrix: TravelMatrix;
  concepts: PlanningRouteConcept[];
  rejected: PlanningRouteConcept[];
  issues: PlanningV2Issue[];
};
export type PlanningV2Services = {
  getMatrix?: (locations: MatrixLocation[]) => Promise<TravelMatrix>;
  getCostLines?: (brief: TripBriefV1, route: CandidateRoute, transport: TransportPlan) => CostLineInput[];
  assignments?: Record<string, TransportMode>;
  now?: () => string;
};

const INTERESTS: Interest[] = ["beaches", "culture", "wildlife", "hiking", "food", "temples", "adventure", "photography"];
const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "AUD", "LKR"];
const ROAD_ONLY = new Set(["EXCESSIVE_DRIVING", "PREFERRED_DRIVING_EXCEEDED", "UNROUTABLE",
  "ROUTING_UNKNOWN", "ARRIVAL_CONFLICT", "DEPARTURE_CONFLICT"]);

export function validatePlanningBrief(brief: TripBriefV1): PlanningV2Issue[] {
  const issues: PlanningV2Issue[] = [];
  const error = (code: string, detail: string) => issues.push({ code, severity: "ERROR" as const, detail });
  if (brief.schemaVersion !== 1) error("BRIEF_VERSION", "This trip brief version is not supported.");
  if (!Number.isInteger(brief.durationDays) || brief.durationDays < 2 || brief.durationDays > 21) {
    error("DURATION", "Choose a trip between 2 and 21 days.");
  }
  if (!Number.isInteger(brief.travellerCount) || brief.travellerCount < 1 || brief.travellerCount > 12) {
    error("TRAVELLERS", "Choose between 1 and 12 travellers.");
  }
  if (!Number.isFinite(brief.budget?.amount) || brief.budget.amount <= 0 || brief.budget.amount > 10_000_000 ||
      !CURRENCIES.includes(brief.budget.currency)) error("BUDGET", "Enter a positive total budget and currency.");
  if (!Array.isArray(brief.interests) || brief.interests.length === 0 ||
      brief.interests.some(interest => !INTERESTS.includes(interest))) error("INTERESTS", "Choose at least one valid interest.");
  if (!Array.isArray(brief.requestedCities) || brief.requestedCities.length > 8 ||
      brief.requestedCities.some(city => typeof city !== "string" || !city.trim() || city.length > 80)) {
    error("DESTINATIONS", "Choose up to eight valid destinations, or leave them open.");
  }
  if (brief.travelMonth !== undefined && (!Number.isInteger(brief.travelMonth) || brief.travelMonth < 1 || brief.travelMonth > 12)) {
    error("TRAVEL_MONTH", "Choose a valid travel month.");
  }
  if (brief.pace !== undefined && !["SLOW_TRAVEL", "RELAXED", "BALANCED", "PACKED"].includes(brief.pace)) {
    error("PACE", "Choose a valid travel pace.");
  }
  if (brief.comfortTier !== undefined && !["budget", "comfort", "luxury"].includes(brief.comfortTier)) {
    error("COMFORT", "Choose a valid comfort tier.");
  }
  if (brief.transportPreference !== undefined && !["PRIVATE_DRIVER", "PUBLIC_TRANSPORT", "MIXED",
    "TUK_TUK_SELF_DRIVE", "RECOMMEND"].includes(brief.transportPreference)) {
    error("TRANSPORT", "Choose a valid transport preference.");
  }
  if (brief.maxPreferredDailyDrivingMinutes !== undefined &&
      (!Number.isFinite(brief.maxPreferredDailyDrivingMinutes) || brief.maxPreferredDailyDrivingMinutes < 30 ||
        brief.maxPreferredDailyDrivingMinutes > 720)) error("DRIVING_LIMIT", "Set a driving preference from 30 to 720 minutes.");
  for (const endpoint of [brief.arrival, brief.departure]) {
    if (endpoint?.location && endpoint.location.length > 100) error("ENDPOINT_LOCATION", "Keep travel locations under 100 characters.");
    if (endpoint?.dateTime && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(endpoint.dateTime) ||
        !Number.isFinite(Date.parse(endpoint.dateTime)))) error("ENDPOINT_TIME", "Enter a valid arrival or departure time.");
  }
  return issues;
}

function normalizedBrief(brief: TripBriefV1): TripBriefV1 {
  const seen = new Set<string>();
  const requestedCities = brief.requestedCities.map(city => city.trim()).filter(city => {
    const key = city.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const normalizeEndpoint = (endpoint: TripBriefV1["arrival"]) => endpoint && ({
    ...endpoint,
    ...(endpoint.location ? { location: resolvePlanningEndpoint(endpoint.location)?.id ?? endpoint.location.trim() } : {}),
  });
  return { ...brief, requestedCities, interests: [...new Set(brief.interests)],
    ...(brief.arrival ? { arrival: normalizeEndpoint(brief.arrival) } : {}),
    ...(brief.departure ? { departure: normalizeEndpoint(brief.departure) } : {}) };
}

function matrixLocations(destinations: PlanningDestination[], brief: TripBriefV1,
  available: MatrixLocation[]): MatrixLocation[] {
  const locations = [...destinations];
  for (const location of [brief.arrival?.location, brief.departure?.location]) {
    if (!location) continue;
    const match = resolvePlanningEndpoint(location) ?? available.find(candidate =>
      candidate.id.toLowerCase() === location.toLowerCase() || candidate.name.toLowerCase() === location.toLowerCase());
    if (match && !locations.some(candidate => candidate.id === match.id)) locations.push(match as PlanningDestination);
  }
  return locations;
}

function unavailableMatrix(locations: MatrixLocation[], now: () => string,
  failure?: TravelMatrix["failure"]): TravelMatrix {
  return { locations, source: "UNAVAILABLE", generatedAt: now(), ...(failure ? { failure } : {}),
    legs: locations.map(from => locations.map(to => ({ fromId: from.id, toId: to.id,
      status: from.coordinates && to.coordinates ? "UNAVAILABLE" as const : "MISSING_COORDINATES" as const }))) };
}

function needsRoadMatrix(brief: TripBriefV1, assignments: Record<string, TransportMode>): boolean {
  return brief.transportPreference === "PRIVATE_DRIVER" || brief.transportPreference === "TUK_TUK_SELF_DRIVE" ||
    Object.values(assignments).includes("PRIVATE_DRIVER");
}

function defaultCostLines(brief: TripBriefV1, route: CandidateRoute, transport: TransportPlan): CostLineInput[] {
  const unknown = { kind: "UNKNOWN" as const, currency: brief.budget.currency, reason: "No sourced price available" };
  const lines: CostLineInput[] = [
    { id: `${route.id}:stays`, category: "ACCOMMODATION", description: "Accommodation", quantity: 1,
      periodCount: brief.durationDays - 1, periodUnit: "NIGHT", chargingBasis: "PER_ROOM", unitPrice: unknown },
    { id: `${route.id}:food`, category: "FOOD", description: "Meals", quantity: brief.travellerCount,
      periodCount: brief.durationDays, periodUnit: "DAY", chargingBasis: "PER_PERSON", unitPrice: unknown },
    { id: `${route.id}:activities`, category: "ACTIVITIES", description: "Activities", quantity: brief.travellerCount,
      chargingBasis: "PER_PERSON", unitPrice: unknown },
  ];
  for (const leg of [...transport.legs, transport.arrivalTransfer, transport.departureTransfer].filter(Boolean)) {
    const perPerson = ["TRAIN", "BUS", "PUBLIC_TRANSPORT_UNSPECIFIED"].includes(leg!.mode);
    lines.push({ id: `${route.id}:transport:${leg!.id}`, category: "TRANSPORT",
      description: `${leg!.fromId} to ${leg!.toId}`, quantity: perPerson ? brief.travellerCount : 1,
      chargingBasis: perPerson ? "PER_PERSON" : leg!.mode === "PRIVATE_DRIVER" ? "PER_VEHICLE" : "FIXED",
      unitPrice: unknown });
  }
  return lines;
}

function applicableRoadReason(reason: RouteReason, route: CandidateRoute, transport: TransportPlan): boolean {
  if (!ROAD_ONLY.has(reason.code)) return true;
  if (transport.preference === "PRIVATE_DRIVER") return true;
  if (reason.code === "ARRIVAL_CONFLICT") return transport.arrivalTransfer?.mode === "PRIVATE_DRIVER";
  if (reason.code === "DEPARTURE_CONFLICT") return transport.departureTransfer?.mode === "PRIVATE_DRIVER";
  const places = (reason.destinations ?? []).map(value => value.toLowerCase());
  const leg = route.legs.find(candidate => places.includes(candidate.fromId.toLowerCase()) &&
    places.includes(candidate.toId.toLowerCase()));
  if (leg) return transport.legs.some(candidate => candidate.fromId === leg.fromId &&
    candidate.toId === leg.toId && candidate.mode === "PRIVATE_DRIVER");
  if (reason.code === "ROUTING_UNKNOWN" || reason.code === "UNROUTABLE") {
    return [transport.arrivalTransfer, transport.departureTransfer].some(candidate => candidate?.mode === "PRIVATE_DRIVER" &&
      places.includes(candidate.fromId.toLowerCase()) && places.includes(candidate.toId.toLowerCase()));
  }
  return false;
}

function reasonDetail(reason: RouteReason): string {
  const places = reason.destinations?.join(" to ");
  const names: Record<string, string> = {
    REQUESTED_CITY_UNAVAILABLE: "A requested destination has no trusted coordinates",
    REQUESTED_CITY_OMITTED: "A requested destination does not fit this route",
    INSUFFICIENT_DAYS: "Too many stops for the available days",
    EXCESSIVE_DRIVING: "A road transfer exceeds the hard driving limit",
    PREFERRED_DRIVING_EXCEEDED: "A road transfer exceeds the preferred driving time",
    UNROUTABLE: "The road service reports no route",
    ROUTING_UNKNOWN: "Road routing is unavailable",
    SEASON_AVOID: "Strong seasonal conflict",
    SEASON_CAUTION: "Seasonal caution",
    SEASON_UNKNOWN: "Seasonal conditions need confirmation",
    ARRIVAL_CONFLICT: "Arrival transfer does not fit the available time",
    DEPARTURE_CONFLICT: "Departure transfer does not fit the available time",
    ARRIVAL_TIME_UNKNOWN: "Arrival transfer time cannot be checked",
    DEPARTURE_TIME_UNKNOWN: "Departure transfer time cannot be checked",
    ENDPOINT_UNKNOWN: "Arrival or departure location cannot be routed",
    BACKTRACKING: "The route reverses direction",
    DESTINATION_SWITCHING: "Changing bases takes travel time",
    ROUTE_REDUCED: "The route has been shortened to fit the trip",
  };
  return `${names[reason.code] ?? reason.code}${places ? `: ${places}` : ""}`;
}

function neutralRank(route: CandidateRoute): number {
  return route.score.components.requestedCoverage + route.score.components.season +
    route.score.components.switching + route.score.components.backtracking -
    route.reasons.filter(reason => reason.code === "REQUESTED_CITY_UNAVAILABLE" ||
      reason.code === "ENDPOINT_UNKNOWN").length * 20;
}

function createConcept(brief: TripBriefV1, route: CandidateRoute, matrix: TravelMatrix,
  services: PlanningV2Services): PlanningRouteConcept {
  const transport = buildTransportPlan(route, brief, matrix, services.assignments);
  const effectiveReasons = route.reasons.filter(reason => applicableRoadReason(reason, route, transport));
  const costLines = services.getCostLines?.(brief, route, transport) ?? defaultCostLines(brief, route, transport);
  const ledger = calculateCostLedger(costLines, brief.budget.currency, brief.travellerCount);
  const budget = compareBudget(ledger, brief.budget);
  const issues: PlanningV2Issue[] = effectiveReasons.map(reason => ({
    code: reason.code,
    severity: reason.severity === "REJECTION" ? "ERROR" : reason.severity === "UNCERTAIN" ? "UNKNOWN" : "WARNING",
    detail: reasonDetail(reason),
  }));
  if (transport.readiness.status !== "SUPPORTED") issues.push({ code: "TRANSPORT_CONFIRMATION", severity: "UNKNOWN",
    detail: transport.readiness.reasons.includes("PUBLIC_SCHEDULE_UNAVAILABLE")
      ? "Train and bus schedules, connections and fares are not available yet."
      : "Transport mode or journey timing needs confirmation." });
  if (ledger.summary.unknownCostCount) issues.push({ code: "COST_INCOMPLETE", severity: "UNKNOWN",
    detail: `${ledger.summary.unknownCostCount} cost ${ledger.summary.unknownCostCount === 1 ? "item needs" : "items need"} a sourced price.` });
  else if (budget.status === "UNKNOWN") issues.push({ code: "COST_INCOMPLETE", severity: "UNKNOWN",
    detail: "The available prices are not enough to confirm the trip budget." });
  for (const issue of ledger.issues.filter(issue => issue.severity === "ERROR")) issues.push({
    code: `COST_${issue.code}`, severity: "ERROR", detail: "A supplied cost line is invalid." });
  if (budget.status === "OVER_BUDGET") issues.push({ code: "BUDGET_OVER", severity: "ERROR",
    detail: "The minimum known cost exceeds the total budget." });
  else if (budget.status === "BUDGET_RISK") issues.push({ code: "BUDGET_RISK", severity: "WARNING",
    detail: "The estimated cost range crosses the total budget." });
  const readiness: ConceptReadiness = issues.some(issue => issue.severity === "ERROR") ? "INVALID" :
    issues.some(issue => issue.severity === "UNKNOWN") ? "NEEDS_CONFIRMATION" :
      issues.some(issue => issue.severity === "WARNING") ? "READY_WITH_WARNINGS" : "READY";
  const knownDriverLegs = transport.legs.filter(leg => leg.mode === "PRIVATE_DRIVER" && leg.durationMinutes !== undefined);
  const knownDrivingMinutes = knownDriverLegs.length ? knownDriverLegs.reduce((sum, leg) => sum + leg.durationMinutes!, 0) : undefined;
  const longestKnownDrivingLegMinutes = knownDriverLegs.length ? Math.max(...knownDriverLegs.map(leg => leg.durationMinutes!)) : undefined;
  const stopIds = route.destinations.map(destination => `${route.id}:${destination.id}`);
  const recommendation = route.destinations.length === 1 ? "One base keeps this trip simple." :
    route.destinations.filter(destination => destination.requested).length === brief.requestedCities.length &&
      brief.requestedCities.length ? "Keeps all requested destinations." :
      "Balances destination coverage with the available days.";
  const routeConcept: RouteConceptV1 = {
    schemaVersion: 1, id: route.id, tripBriefVersion: 1,
    stops: route.destinations.map((destination, index) => ({ id: stopIds[index],
      destinationName: destination.name, nights: route.nights[index] })),
    roadLegs: route.legs.map((leg, index) => ({ fromStopId: stopIds[index], toStopId: stopIds[index + 1],
      ...(leg.durationMinutes !== undefined ? { drivingDurationMinutes: leg.durationMinutes } : {}),
      ...(leg.distanceKm !== undefined ? { drivingDistanceKm: leg.distanceKm } : {}) })),
    ...(ledger.summary.trip.maximum !== undefined ? { estimatedBudgetRange: {
      minimum: ledger.summary.trip.minimum, maximum: ledger.summary.trip.maximum, currency: ledger.currency } } : {}),
    seasonalAssessment: { status: effectiveReasons.some(reason => reason.code === "SEASON_AVOID") ? "UNSUITABLE" :
      effectiveReasons.some(reason => reason.code === "SEASON_CAUTION") ? "CAUTION" :
        effectiveReasons.some(reason => reason.code === "SEASON_UNKNOWN") ? "UNKNOWN" : "SUITABLE",
      reasons: effectiveReasons.filter(reason => reason.code.startsWith("SEASON_")).map(reasonDetail) },
    tradeoffs: issues.map(issue => issue.detail).filter((value): value is string => !!value),
    constraintResults: effectiveReasons.map(reason => ({ constraint: reason.code,
      satisfied: reason.severity === "REJECTION" ? false : reason.severity === "UNCERTAIN" ? null : true,
      explanation: reasonDetail(reason) })),
    explanation: recommendation, generatedAt: services.now?.() ?? new Date().toISOString(),
    generatorVersion: "planning-v2-route-1",
  };
  return { routeConcept, candidate: route, transport, ledger, readiness, issues, recommendation,
    ...(knownDrivingMinutes !== undefined ? { knownDrivingMinutes, longestKnownDrivingLegMinutes } : {}) };
}

/** One bounded route-matrix request at most. All generation and scoring remain deterministic. */
export async function planRouteConcepts(rawBrief: TripBriefV1,
  services: PlanningV2Services = {}): Promise<PlanningV2Result> {
  const validation = validatePlanningBrief(rawBrief);
  if (validation.length) throw new PlanningBriefError(validation);
  const brief = normalizedBrief(rawBrief);
  const available = knownPlanningDestinations();
  const destinations = buildCandidateDestinations(brief, available);
  if (!destinations.length) throw new PlanningBriefError([{ code: "NO_DESTINATIONS", severity: "ERROR",
    detail: "No destinations are available for this brief." }]);
  const locations = matrixLocations(destinations, brief, [...available, CMB_AIRPORT]);
  const now = services.now ?? (() => new Date().toISOString());
  const assignments = services.assignments ?? {};
  let matrix: TravelMatrix;
  if (!needsRoadMatrix(brief, assignments)) matrix = unavailableMatrix(locations, now);
  else {
    try { matrix = await (services.getMatrix ?? ((items) => fetchTravelMatrix(items, { timeoutMs: 7000 })))(locations); }
    catch { matrix = unavailableMatrix(locations, now, "NETWORK_ERROR"); }
  }
  const month = planningSeasonMonth(brief);
  const seasons = new Map(destinations.map(destination => [destination.id,
    assessPlanningSeason(destination.name, month)] as [string, PlanningSeason]));
  const candidates = generateRouteCandidates(brief, destinations, matrix, seasons);
  const all = candidates.map(candidate => createConcept(brief, candidate, matrix, services));
  const roadRanking = brief.transportPreference === "PRIVATE_DRIVER";
  all.sort((a, b) => Number(a.readiness === "INVALID") - Number(b.readiness === "INVALID") ||
    (roadRanking ? b.candidate.score.rankValue - a.candidate.score.rankValue :
      neutralRank(b.candidate) - neutralRank(a.candidate)) || a.routeConcept.id.localeCompare(b.routeConcept.id));
  const valid = all.filter(concept => concept.readiness !== "INVALID");
  const distinctSets = new Set<string>();
  const selected: PlanningRouteConcept[] = [];
  for (const concept of valid) {
    const key = concept.candidate.destinations.map(destination => destination.id).sort().join("|");
    if (distinctSets.has(key)) continue;
    selected.push(concept);
    distinctSets.add(key);
    if (selected.length === 3) break;
  }
  for (const concept of valid) {
    if (selected.length === 3) break;
    if (!selected.some(existing => existing.routeConcept.id === concept.routeConcept.id)) selected.push(concept);
  }
  const issues: PlanningV2Issue[] = [];
  if (matrix.failure) issues.push({ code: matrix.failure === "TIMEOUT" ? "ROUTING_TIMEOUT" : "ROUTING_UNAVAILABLE",
    severity: "UNKNOWN", detail: "Road routing is unavailable. Retry to check driving estimates." });
  if (destinations.some(destination => !destination.coordinates)) issues.push({ code: "COORDINATES_MISSING",
    severity: "UNKNOWN", detail: "Some requested destinations have no trusted coordinates." });
  if (!selected.length) issues.push({ code: "NO_FEASIBLE_CONCEPTS", severity: "ERROR",
    detail: "No route meets the current constraints. Try more days, fewer stops or different travel times." });
  return { brief, destinations, matrix, concepts: selected,
    rejected: all.filter(concept => concept.readiness === "INVALID").slice(0, 3), issues };
}

export class PlanningBriefError extends Error {
  readonly issues: PlanningV2Issue[];
  constructor(issues: PlanningV2Issue[]) {
    super(issues.map(issue => issue.detail).join(" "));
    this.name = "PlanningBriefError";
    this.issues = issues;
  }
}
